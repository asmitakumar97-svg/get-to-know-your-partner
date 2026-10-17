-- Run after 002_game_hub.sql. Adds playlists and five-question Same Page sections.
alter table public.game_rooms add column if not exists night jsonb;

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
  return result || case when r.night is null then '{}'::jsonb else jsonb_build_object('night',r.night) end;
end;
$$;

create or replace function public.create_game(player_name text, scenario_deck jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_code text;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a room.'; end if;
  if player_name is null or length(trim(player_name)) not between 1 and 24 then raise exception 'Enter a name between 1 and 24 characters.'; end if;
  if scenario_deck is null or jsonb_typeof(scenario_deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  if jsonb_array_length(scenario_deck) not in (3,5,10,15,20,25,30) or pg_column_size(scenario_deck) > 40000 then raise exception 'Invalid scenario deck size.'; end if;
  if jsonb_array_length(scenario_deck) not in (3,5,10,20) and exists(select 1 from jsonb_array_elements(scenario_deck) s where s ? 'options') then raise exception 'Choose 3, 5, 10, or 20 rounds for this game.'; end if;
  if discussion_seconds is null or discussion_seconds not in (30,60,120,180) then raise exception 'Choose a valid discussion time.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where
    jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'title') is distinct from 'string' or
    jsonb_typeof(s->'category') is distinct from 'string' or jsonb_typeof(s->'text') is distinct from 'string' or
    jsonb_typeof(s->'prompt') is distinct from 'string') then raise exception 'Invalid scenario content.'; end if;
  if (select count(*) from public.game_rooms where host = auth.uid() and expires_at > now()) >= 20 then raise exception 'Room limit reached. Please reuse a recent room or try again later.'; end if;
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into public.game_rooms(code,host,deck,discussion_seconds) values(new_code,auth.uid(),scenario_deck,discussion_seconds) returning id into new_id;
      exit;
    exception when unique_violation then
      -- Retry a code collision without reusing a room.
    end;
  end loop;
  insert into public.game_players(room_id,id,name) values(new_id,auth.uid(),trim(player_name));
  return public.game_state(new_id);
end;
$$;

create or replace function public.create_game_night(player_name text, game_plan jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry jsonb; deck jsonb; kind text; option_count integer; created jsonb; clean_plan jsonb := '[]'::jsonb;
begin
  if game_plan is null or jsonb_typeof(game_plan) <> 'array' then raise exception 'Choose a game playlist.'; end if;
  if jsonb_array_length(game_plan) not between 2 and 5 or pg_column_size(game_plan) > 200000 then raise exception 'Choose two to five games.'; end if;
  if (select count(distinct e->>'gameType') from jsonb_array_elements(game_plan) e) <> jsonb_array_length(game_plan) then raise exception 'Choose different games for your playlist.'; end if;
  for entry in select value from jsonb_array_elements(game_plan) loop
    kind := entry->>'gameType'; deck := entry->'deck';
    if kind is null or kind not in ('same-page','same-brain','pick-my-poison','read-the-room','more-likely') then raise exception 'Choose an available game.'; end if;
    if deck is null or jsonb_typeof(deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
    if pg_column_size(deck) > 40000
      or (kind = 'same-page' and jsonb_array_length(deck) not in (3,5,10,15,20,25,30))
      or (kind <> 'same-page' and jsonb_array_length(deck) not in (3,5,10,20)) then raise exception 'Invalid scenario deck size.'; end if;
    if exists(select 1 from jsonb_array_elements(deck) s where
      jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'title') is distinct from 'string' or
      jsonb_typeof(s->'category') is distinct from 'string' or jsonb_typeof(s->'text') is distinct from 'string' or
      jsonb_typeof(s->'prompt') is distinct from 'string') then raise exception 'Invalid scenario content.'; end if;
    if kind <> 'same-page' then
      option_count := case when kind in ('same-brain','read-the-room') then 4 else 2 end;
      if exists(select 1 from jsonb_array_elements(deck) s where jsonb_typeof(s->'options') is distinct from 'array') then raise exception 'Every question needs answer options.'; end if;
      if exists(select 1 from jsonb_array_elements(deck) s where jsonb_array_length(s->'options') <> option_count) then raise exception 'Invalid number of answer options.'; end if;
      if exists(select 1 from jsonb_array_elements(deck) s, jsonb_array_elements(s->'options') o where jsonb_typeof(o) <> 'string' or length(o #>> '{}') not between 1 and 300) then raise exception 'Invalid answer option.'; end if;
      if kind = 'pick-my-poison' and exists(select 1 from jsonb_array_elements(deck) s where jsonb_typeof(s->'level') is distinct from 'number' or coalesce(s->>'level','') !~ '^[0-3]$') then raise exception 'Invalid dilemma level.'; end if;
    end if;
    clean_plan := clean_plan || jsonb_build_array(jsonb_build_object('gameType',kind,'deck',deck));
  end loop;
  entry := clean_plan->0;
  if entry->>'gameType' = 'same-page' then
    created := public.create_game(player_name, entry->'deck', discussion_seconds);
  else
    created := public.create_game_mode(player_name, entry->'deck', discussion_seconds, entry->>'gameType');
  end if;
  update public.game_rooms set night = jsonb_build_object('playlist',clean_plan,'index',0,'completed','[]'::jsonb,'finished',false),
    revision = revision + 1 where id = (created->>'id')::uuid;
  return public.game_state((created->>'id')::uuid);
end;
$$;

create or replace function public.advance_game_night(room_id uuid, game_index integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; current_index integer; next_entry jsonb; saved jsonb; next_night jsonb; next_ready uuid[];
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if r.night is null then raise exception 'This room does not have a playlist.'; end if;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Start a new game night.'; end if;
  current_index := (r.night->>'index')::integer;
  if game_index < current_index or (r.night->>'finished')::boolean then return public.game_state($1); end if;
  if game_index is null or game_index <> current_index or r.phase <> 'recap' then raise exception 'Finish the current game before continuing the playlist.'; end if;
  next_ready := case when auth.uid() = any(r.ready) then r.ready else array_append(r.ready,auth.uid()) end;
  if cardinality(next_ready) < 2 then
    update public.game_rooms set ready = next_ready, revision = revision + 1, updated_at = clock_timestamp() where id = r.id;
    return public.game_state($1);
  end if;
  saved := public.game_state($1) - 'night';
  next_night := jsonb_set(r.night, '{completed}', (r.night->'completed') || jsonb_build_array(saved));
  if current_index + 1 = jsonb_array_length(r.night->'playlist') then
    update public.game_rooms set night = jsonb_set(next_night,'{finished}','true'), ready = '{}',
      revision = revision + 1, updated_at = clock_timestamp() where id = r.id;
  else
    next_entry := r.night->'playlist'->(current_index + 1);
    delete from public.game_answers where game_answers.room_id = r.id;
    update public.game_rooms set night = jsonb_set(next_night,'{index}',to_jsonb(current_index + 1)),
      game_type = next_entry->>'gameType', deck = next_entry->'deck', round = 0, phase = 'answering',
      ready = '{}', discussion_until = null, revision = revision + 1, updated_at = clock_timestamp() where id = r.id;
  end if;
  return public.game_state($1);
end;
$$;

-- The playlist index makes delayed requests from a previous game harmless.
create or replace function public.answer_night_game(room_id uuid, game_index integer, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if r.night is null or game_index is null then raise exception 'This room does not have that playlist game.'; end if;
  if game_index < (r.night->>'index')::integer then return public.game_state($1); end if;
  if game_index <> (r.night->>'index')::integer or (r.night->>'finished')::boolean then raise exception 'That playlist game is not accepting answers.'; end if;
  return public.answer_game($1,$3,$4);
end;
$$;

create or replace function public.ready_night_game(room_id uuid, game_index integer, round_number integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if r.night is null or game_index is null then raise exception 'This room does not have that playlist game.'; end if;
  if game_index < (r.night->>'index')::integer then return public.game_state($1); end if;
  if game_index <> (r.night->>'index')::integer or (r.night->>'finished')::boolean then raise exception 'That playlist game is not active.'; end if;
  return public.ready_game($1,$3);
end;
$$;

revoke all on function public.create_game_night(text,jsonb,integer), public.advance_game_night(uuid,integer),
  public.answer_night_game(uuid,integer,integer,jsonb), public.ready_night_game(uuid,integer,integer) from public;
grant execute on function public.create_game_night(text,jsonb,integer), public.advance_game_night(uuid,integer),
  public.answer_night_game(uuid,integer,integer,jsonb), public.ready_night_game(uuid,integer,integer) to authenticated;
