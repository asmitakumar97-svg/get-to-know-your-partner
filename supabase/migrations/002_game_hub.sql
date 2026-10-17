-- Run after schema.sql. Safe to rerun; existing Same Page rooms and answers are preserved.
alter table public.game_rooms add column if not exists game_type text not null default 'same-page'
  check (game_type in ('same-page','same-brain','pick-my-poison','read-the-room','more-likely'));

create or replace function public.game_state(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; result jsonb;
begin
  select * into r from public.game_rooms where id = $1;
  if not found or not public.is_game_member($1) then raise exception 'Room not found or you are not a member.'; end if;
  if r.expires_at <= now() then raise exception 'This room has expired. Please create a new room.'; end if;
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'mode', 'online', 'revision', r.revision, 'gameType', r.game_type,
    'deck', r.deck, 'round', r.round, 'phase', r.phase,
    'discussionSeconds', r.discussion_seconds,
    'discussionUntil', extract(epoch from r.discussion_until) * 1000,
    'ready', to_jsonb(r.ready),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'left',p.has_left) order by p.joined_at, p.id), '[]'::jsonb) from public.game_players p where p.room_id = r.id),
    'submitted', (select coalesce(jsonb_agg(a.player_id), '[]'::jsonb) from public.game_answers a where a.room_id = r.id and a.round = r.round),
    'answers', (select coalesce(jsonb_object_agg(x.round::text,x.answers), '{}'::jsonb) from (
      select a.round, jsonb_object_agg(a.player_id::text,a.payload) as answers
      from public.game_answers a where a.room_id = r.id group by a.round having count(*) = 2
    ) x)
  ) into result;
  return result;
end;
$$;

create or replace function public.create_game_mode(player_name text, scenario_deck jsonb, discussion_seconds integer, game_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare created jsonb; new_id uuid; option_count integer;
begin
  if game_kind is null or game_kind not in ('same-brain','pick-my-poison','read-the-room','more-likely') then raise exception 'Choose an available game.'; end if;
  if scenario_deck is null or jsonb_typeof(scenario_deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  option_count := case when game_kind in ('same-brain','read-the-room') then 4 else 2 end;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where jsonb_typeof(s->'options') is distinct from 'array') then raise exception 'Every question needs answer options.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where jsonb_array_length(s->'options') <> option_count) then raise exception 'Invalid number of answer options.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s, jsonb_array_elements(s->'options') o where jsonb_typeof(o) <> 'string' or length(o #>> '{}') not between 1 and 300) then raise exception 'Invalid answer option.'; end if;
  created := public.create_game(player_name, scenario_deck, discussion_seconds);
  new_id := (created->>'id')::uuid;
  update public.game_rooms set game_type = game_kind, revision = revision + 1 where id = new_id;
  return public.game_state(new_id);
end;
$$;

create or replace function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; stored_answer jsonb; option_count integer;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if exists(select 1 from public.game_answers a where a.room_id = $1 and a.round = $2 and a.player_id = auth.uid()) then return public.game_state($1); end if;
  if round_number is null or r.round <> round_number or r.phase <> 'answering' then raise exception 'This round is no longer accepting answers. Refresh your room.'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid answer.'; end if;
  if r.game_type = 'same-page' then
    if not (payload->>'verdict' ~ '^[0-4]$') or not (payload->>'emotion' ~ '^[0-4]$') or not (payload->>'factor' ~ '^[0-3]$')
      or not (payload ?& array['verdict','emotion','factor','explanation'])
      or jsonb_typeof(payload->'verdict') <> 'number' or jsonb_typeof(payload->'emotion') <> 'number' or jsonb_typeof(payload->'factor') <> 'number'
      or jsonb_typeof(payload->'explanation') <> 'string' or length(payload->>'explanation') > 600 then raise exception 'Please complete all three choices and keep explanations under 600 characters.'; end if;
    stored_answer := jsonb_build_object('verdict',payload->'verdict','emotion',payload->'emotion','factor',payload->'factor','explanation',payload->'explanation');
  else
    option_count := jsonb_array_length(r.deck->r.round->'options');
    if not (payload ?& array['choice','explanation'])
      or jsonb_typeof(payload->'choice') is distinct from 'number'
      or coalesce(payload->>'choice','') !~ '^[0-3]$'
      or jsonb_typeof(payload->'explanation') is distinct from 'string'
      or length(payload->>'explanation') > 600 then raise exception 'Choose a valid answer and keep explanations under 600 characters.'; end if;
    if (payload->>'choice')::integer >= option_count then raise exception 'That choice is not in this question.'; end if;
    stored_answer := jsonb_build_object('choice',payload->'choice','explanation',payload->'explanation');
    if r.game_type = 'pick-my-poison' then
      if jsonb_typeof(payload->'prediction') is distinct from 'number' or coalesce(payload->>'prediction','') !~ '^[0-1]$' then raise exception 'Predict your partner''s choice before submitting.'; end if;
      stored_answer := stored_answer || jsonb_build_object('prediction',payload->'prediction');
    end if;
    if r.game_type = 'same-brain' and r.round = jsonb_array_length(r.deck) - 1 then
      if jsonb_typeof(payload->'matchPrediction') is distinct from 'boolean' then raise exception 'Make your final-round match prediction before submitting.'; end if;
      stored_answer := stored_answer || jsonb_build_object('matchPrediction',payload->'matchPrediction');
    end if;
  end if;
  insert into public.game_answers(room_id,round,player_id,payload) values($1,$2,auth.uid(),stored_answer);
  if (select count(*) from public.game_answers a where a.room_id = r.id and a.round = r.round) = 2 then
    update public.game_rooms set phase = 'discussion', discussion_until = clock_timestamp() + make_interval(secs => r.discussion_seconds), updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  else
    update public.game_rooms set updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  end if;
  return public.game_state(r.id);
end;
$$;

revoke all on function public.create_game_mode(text,jsonb,integer,text) from public;
grant execute on function public.create_game_mode(text,jsonb,integer,text) to authenticated;
