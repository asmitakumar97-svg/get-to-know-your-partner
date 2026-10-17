-- Apply after 003. Keeps legacy two-option decks valid; choice 2 always means Both of us.
-- Enables 30/50-round mixed games and preserves legacy section-based Same Page decks.
-- New snapshots carry six reasoning options; older decks keep their four original choices.
-- Six verdict choices are snapshot-based too; existing five-choice meanings are unchanged.
begin;

create or replace function public.create_game(player_name text, scenario_deck jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_code text; deck_length integer; has_options boolean; scenario jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a room.'; end if;
  if player_name is null or length(trim(player_name)) not between 1 and 24 then raise exception 'Enter a name between 1 and 24 characters.'; end if;
  if scenario_deck is null or jsonb_typeof(scenario_deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  deck_length := jsonb_array_length(scenario_deck);
  has_options := exists(select 1 from jsonb_array_elements(scenario_deck) s where s ? 'options');
  if pg_column_size(scenario_deck) > 80000
    or (has_options and deck_length not in (3,5,10,20,30,50))
    or (not has_options and deck_length not in (3,5,10,15,20,25,30,50)) then raise exception 'Invalid scenario deck size.'; end if;
  if discussion_seconds is null or discussion_seconds not in (30,60,120,180) then raise exception 'Choose a valid discussion time.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where
    jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'title') is distinct from 'string' or
    jsonb_typeof(s->'category') is distinct from 'string' or jsonb_typeof(s->'text') is distinct from 'string' or
    jsonb_typeof(s->'prompt') is distinct from 'string') then raise exception 'Invalid scenario content.'; end if;
  for scenario in select value from jsonb_array_elements(scenario_deck) where value ? 'reasonOptions' loop
    if jsonb_typeof(scenario->'reasonOptions') is distinct from 'array' then raise exception 'Invalid reasoning options.'; end if;
    if jsonb_array_length(scenario->'reasonOptions') <> 6 then raise exception 'Expected six reasoning options.'; end if;
    if exists(select 1 from jsonb_array_elements(scenario->'reasonOptions') o where jsonb_typeof(o) <> 'string' or length(trim(o #>> '{}')) not between 1 and 120) then raise exception 'Invalid reasoning option.'; end if;
  end loop;
  for scenario in select value from jsonb_array_elements(scenario_deck) where value ? 'verdictOptions' loop
    if jsonb_typeof(scenario->'verdictOptions') is distinct from 'array' then raise exception 'Invalid verdict options.'; end if;
    if jsonb_array_length(scenario->'verdictOptions') not in (5,6) then raise exception 'Expected five or six verdict options.'; end if;
    if exists(select 1 from jsonb_array_elements(scenario->'verdictOptions') o where jsonb_typeof(o) <> 'string' or length(trim(o #>> '{}')) not between 1 and 120) then raise exception 'Invalid verdict option.'; end if;
  end loop;
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

create or replace function public.create_game_mode(player_name text, scenario_deck jsonb, discussion_seconds integer, game_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare created jsonb; new_id uuid; option_count integer;
begin
  if game_kind is null or game_kind not in ('same-brain','pick-my-poison','read-the-room','more-likely') then raise exception 'Choose an available game.'; end if;
  if scenario_deck is null or jsonb_typeof(scenario_deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  option_count := case when game_kind in ('same-brain','read-the-room') then 4 when game_kind = 'more-likely' then 3 else 2 end;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where jsonb_typeof(s->'options') is distinct from 'array') then raise exception 'Every question needs answer options.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where jsonb_array_length(s->'options') <> option_count
    and not (game_kind = 'more-likely' and jsonb_array_length(s->'options') = 2)) then raise exception 'Invalid number of answer options.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s, jsonb_array_elements(s->'options') o where jsonb_typeof(o) <> 'string' or length(o #>> '{}') not between 1 and 300) then raise exception 'Invalid answer option.'; end if;
  created := public.create_game(player_name, scenario_deck, discussion_seconds);
  new_id := (created->>'id')::uuid;
  update public.game_rooms set game_type = game_kind, revision = revision + 1 where id = new_id;
  return public.game_state(new_id);
end;
$$;

create or replace function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; stored_answer jsonb; option_count integer; verdict_count integer;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if exists(select 1 from public.game_answers a where a.room_id = $1 and a.round = $2 and a.player_id = auth.uid()) then return public.game_state($1); end if;
  if round_number is null or r.round <> round_number or r.phase <> 'answering' then raise exception 'This round is no longer accepting answers. Refresh your room.'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid answer.'; end if;
  if r.game_type = 'same-page' then
    option_count := case when r.deck->r.round ? 'reasonOptions' then jsonb_array_length(r.deck->r.round->'reasonOptions') else 4 end;
    verdict_count := case when r.deck->r.round ? 'verdictOptions' then jsonb_array_length(r.deck->r.round->'verdictOptions') else 5 end;
    if not (payload->>'verdict' ~ '^[0-5]$') or not (payload->>'emotion' ~ '^[0-4]$') or not (payload->>'factor' ~ '^[0-5]$')
      or not (payload ?& array['verdict','emotion','factor','explanation'])
      or jsonb_typeof(payload->'verdict') <> 'number' or jsonb_typeof(payload->'emotion') <> 'number' or jsonb_typeof(payload->'factor') <> 'number'
      or jsonb_typeof(payload->'explanation') <> 'string' or length(payload->>'explanation') > 600 then raise exception 'Please complete all three choices and keep explanations under 600 characters.'; end if;
    if (payload->>'verdict')::integer >= verdict_count then raise exception 'That verdict is not in this question.'; end if;
    if (payload->>'factor')::integer >= option_count then raise exception 'That reasoning choice is not in this question.'; end if;
    stored_answer := jsonb_build_object('verdict',payload->'verdict','emotion',payload->'emotion','factor',payload->'factor','explanation',payload->'explanation');
  else
    option_count := case when r.game_type = 'more-likely' then 3 else jsonb_array_length(r.deck->r.round->'options') end;
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

create or replace function public.create_game_night(player_name text, game_plan jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry jsonb; deck jsonb; kind text; option_count integer; created jsonb; clean_plan jsonb := '[]'::jsonb; scenario jsonb;
begin
  if game_plan is null or jsonb_typeof(game_plan) <> 'array' then raise exception 'Choose a game playlist.'; end if;
  if jsonb_array_length(game_plan) not between 2 and 5 or pg_column_size(game_plan) > 400000 then raise exception 'Choose two to five games.'; end if;
  if (select count(distinct e->>'gameType') from jsonb_array_elements(game_plan) e) <> jsonb_array_length(game_plan) then raise exception 'Choose different games for your playlist.'; end if;
  for entry in select value from jsonb_array_elements(game_plan) loop
    kind := entry->>'gameType'; deck := entry->'deck';
    if kind is null or kind not in ('same-page','same-brain','pick-my-poison','read-the-room','more-likely') then raise exception 'Choose an available game.'; end if;
    if deck is null or jsonb_typeof(deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
    if pg_column_size(deck) > 80000
      or (kind = 'same-page' and jsonb_array_length(deck) not in (3,5,10,15,20,25,30,50))
      or (kind <> 'same-page' and jsonb_array_length(deck) not in (3,5,10,20,30,50)) then raise exception 'Invalid scenario deck size.'; end if;
    if exists(select 1 from jsonb_array_elements(deck) s where
      jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'title') is distinct from 'string' or
      jsonb_typeof(s->'category') is distinct from 'string' or jsonb_typeof(s->'text') is distinct from 'string' or
      jsonb_typeof(s->'prompt') is distinct from 'string') then raise exception 'Invalid scenario content.'; end if;
    for scenario in select value from jsonb_array_elements(deck) where value ? 'reasonOptions' loop
      if jsonb_typeof(scenario->'reasonOptions') is distinct from 'array' then raise exception 'Invalid reasoning options.'; end if;
      if jsonb_array_length(scenario->'reasonOptions') <> 6 then raise exception 'Expected six reasoning options.'; end if;
      if exists(select 1 from jsonb_array_elements(scenario->'reasonOptions') o where jsonb_typeof(o) <> 'string' or length(trim(o #>> '{}')) not between 1 and 120) then raise exception 'Invalid reasoning option.'; end if;
    end loop;
    for scenario in select value from jsonb_array_elements(deck) where value ? 'verdictOptions' loop
      if jsonb_typeof(scenario->'verdictOptions') is distinct from 'array' then raise exception 'Invalid verdict options.'; end if;
      if jsonb_array_length(scenario->'verdictOptions') not in (5,6) then raise exception 'Expected five or six verdict options.'; end if;
      if exists(select 1 from jsonb_array_elements(scenario->'verdictOptions') o where jsonb_typeof(o) <> 'string' or length(trim(o #>> '{}')) not between 1 and 120) then raise exception 'Invalid verdict option.'; end if;
    end loop;
    if kind <> 'same-page' then
      option_count := case when kind in ('same-brain','read-the-room') then 4 when kind = 'more-likely' then 3 else 2 end;
      if exists(select 1 from jsonb_array_elements(deck) s where jsonb_typeof(s->'options') is distinct from 'array') then raise exception 'Every question needs answer options.'; end if;
      if exists(select 1 from jsonb_array_elements(deck) s where jsonb_array_length(s->'options') <> option_count
        and not (kind = 'more-likely' and jsonb_array_length(s->'options') = 2)) then raise exception 'Invalid number of answer options.'; end if;
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

revoke all on function public.create_game(text,jsonb,integer), public.create_game_mode(text,jsonb,integer,text), public.answer_game(uuid,integer,jsonb), public.create_game_night(text,jsonb,integer) from public;
grant execute on function public.create_game(text,jsonb,integer), public.create_game_mode(text,jsonb,integer,text), public.answer_game(uuid,integer,jsonb), public.create_game_night(text,jsonb,integer) to authenticated;

commit;
