-- Apply after 006. New games reuse the room lock, private answer table and readiness RPCs.
begin;
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check check (game_type in
  ('same-page','same-brain','pick-my-poison','read-the-room','more-likely','if-i-were-you','when-things-get-hard','us-against-the-world'));

create table if not exists public.game_reflections (
  room_id uuid references public.game_rooms(id) on delete cascade,
  game_index integer not null, round_number integer not null, player_id uuid not null,
  payload jsonb not null, shared boolean not null default false,
  primary key(room_id,game_index,round_number,player_id)
);
create table if not exists public.game_skips (
  room_id uuid references public.game_rooms(id) on delete cascade,
  game_index integer not null, round_number integer not null,
  primary key(room_id,game_index,round_number)
);
create table if not exists public.game_clues (
  room_id uuid references public.game_rooms(id) on delete cascade,
  game_index integer not null, round_number integer not null, role_index integer not null check(role_index in (0,1)),
  clue text not null, primary key(room_id,game_index,round_number,role_index)
);
alter table public.game_reflections enable row level security;
alter table public.game_skips enable row level security;
alter table public.game_clues enable row level security;
revoke all on public.game_reflections, public.game_skips, public.game_clues from public, anon, authenticated;

do $$ begin
  if to_regprocedure('public.game_state_v006(uuid)') is null then
    alter function public.game_state(uuid) rename to game_state_v006;
    alter function public.create_game_mode(text,jsonb,integer,text) rename to create_game_mode_v006;
    alter function public.answer_game(uuid,integer,jsonb) rename to answer_game_v006;
    alter function public.create_game_night(text,jsonb,integer) rename to create_game_night_v006;
    alter function public.advance_game_night(uuid,integer) rename to advance_game_night_v006;
  end if;
end $$;
revoke all on function public.game_state_v006(uuid), public.create_game_mode_v006(text,jsonb,integer,text),
  public.answer_game_v006(uuid,integer,jsonb), public.create_game_night_v006(text,jsonb,integer), public.advance_game_night_v006(uuid,integer) from public, authenticated;

create or replace function public.shared_game_reflections(room_id uuid, game_index integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(x.round_number::text,x.notes),'{}'::jsonb) from (
    select n.round_number,jsonb_object_agg(n.player_id::text,n.payload) notes
    from public.game_reflections n where n.room_id=$1 and n.game_index=$2 and n.shared group by n.round_number
  ) x;
$$;
create or replace function public.game_state(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; idx integer; skipped jsonb; completed jsonb := '[]'; saved jsonb; i integer := 0;
begin
  result := public.game_state_v006($1);
  idx := coalesce((result->'night'->>'index')::integer,0);
  select coalesce(jsonb_agg(s.round_number),'[]'::jsonb) into skipped from public.game_skips s where s.room_id=$1 and s.game_index=idx;
  result := result || jsonb_build_object('skippedRounds',skipped,'reflections',public.shared_game_reflections($1,idx));
  result := jsonb_set(result,'{answers}',(result->'answers') - array(select jsonb_array_elements_text(skipped)));
  if result ? 'night' then
    for saved in select value from jsonb_array_elements(result->'night'->'completed') loop
      completed := completed || jsonb_build_array(saved || jsonb_build_object('reflections',public.shared_game_reflections($1,i)));
      i := i+1;
    end loop;
    result := jsonb_set(result,'{night,completed}',completed);
  end if;
  return result;
end;
$$;
create or replace function public.my_game_notes(room_id uuid, game_index integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare state jsonb; idx integer; role_idx integer;
begin
  state := public.game_state($1); idx := coalesce($2,(state->'night'->>'index')::integer,0);
  if idx<0 or idx>coalesce((state->'night'->>'index')::integer,0) then raise exception 'That game has not started.'; end if;
  select p.position-1 into role_idx from (
    select id,row_number() over(order by joined_at,id)::integer position from public.game_players where game_players.room_id=$1
  ) p where p.id=auth.uid();
  return jsonb_build_object(
    'reflections',(select coalesce(jsonb_object_agg(n.round_number::text,n.payload),'{}') from public.game_reflections n where n.room_id=$1 and n.game_index=idx and n.player_id=auth.uid()),
    'clues',(select coalesce(jsonb_object_agg(c.round_number::text,c.clue),'{}') from public.game_clues c where c.room_id=$1 and c.game_index=idx and c.role_index=role_idx));
end;
$$;
create or replace function public.validate_extended_deck(kind text, deck jsonb) returns void
language plpgsql set search_path = '' as $$
declare s jsonb; a jsonb; n integer;
begin
  if kind is null or kind not in ('same-page','same-brain','pick-my-poison','read-the-room','more-likely','if-i-were-you','when-things-get-hard','us-against-the-world') then raise exception 'Choose an available game.'; end if;
  if deck is null or jsonb_typeof(deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  n := jsonb_array_length(deck);
  if pg_column_size(deck)>80000 or n not in (3,5,10,15,20,25,30,50) or
    (kind='us-against-the-world' and n<>5) or
    (kind in ('if-i-were-you','when-things-get-hard') and n not in (3,5,10,20,30)) or
    (kind not in ('same-page','us-against-the-world') and n not in (3,5,10,20,30,50)) then raise exception 'Invalid scenario deck size.'; end if;
  for s in select value from jsonb_array_elements(deck) loop
    if exists(select 1 from unnest(array['id','title','text','category','prompt']) k where jsonb_typeof(s->k) is distinct from 'string' or length(s->>k) not between 1 and 1000) then raise exception 'Invalid scenario content.'; end if;
    if s ? 'reasonOptions' and (jsonb_typeof(s->'reasonOptions') <> 'array' or jsonb_array_length(s->'reasonOptions')<>6) then raise exception 'Invalid reasoning options.'; end if;
    if s ? 'verdictOptions' and (jsonb_typeof(s->'verdictOptions') <> 'array' or jsonb_array_length(s->'verdictOptions') not in (5,6)) then raise exception 'Invalid verdict options.'; end if;
    if s ? 'reasonOptions' and exists(select 1 from jsonb_array_elements(s->'reasonOptions') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}')) not between 1 and 120) then raise exception 'Invalid reasoning option.'; end if;
    if s ? 'verdictOptions' and exists(select 1 from jsonb_array_elements(s->'verdictOptions') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}')) not between 1 and 120) then raise exception 'Invalid verdict option.'; end if;
    if kind <> 'same-page' then
      if jsonb_typeof(s->'options') is distinct from 'array' then raise exception 'Every question needs options.'; end if;
      if jsonb_array_length(s->'options') not between 2 and 6 or
        (kind in ('if-i-were-you','when-things-get-hard') and jsonb_array_length(s->'options')<>5) or
        (kind in ('same-brain','read-the-room') and jsonb_array_length(s->'options')<>4) or
        (kind='pick-my-poison' and jsonb_array_length(s->'options')<>2) or
        (kind='more-likely' and jsonb_array_length(s->'options') not in (2,3)) then raise exception 'Invalid answer option count.'; end if;
      if exists(select 1 from jsonb_array_elements(s->'options') o where jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 300) then raise exception 'Invalid answer option.'; end if;
    end if;
    if kind in ('if-i-were-you','when-things-get-hard') then
      if jsonb_typeof(s->'tags') is distinct from 'array' or jsonb_array_length(s->'tags')<>5 then raise exception 'Missing response meanings.'; end if;
      if exists(select 1 from jsonb_array_elements(s->'tags') t where jsonb_typeof(t)<>'string' or length(t#>>'{}') not between 1 and 60) then raise exception 'Invalid response meaning.'; end if;
    end if;
    if kind='pick-my-poison' and (jsonb_typeof(s->'level') is distinct from 'number' or coalesce(s->>'level','') !~ '^[0-3]$') then raise exception 'Invalid dilemma level.'; end if;
    if kind='us-against-the-world' then
      a := s->'adventure';
      if jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'world','') not in ('stranded','restaurant','aliens','spaceship') or a->>'world' is distinct from deck->0->'adventure'->>'world' or
        a->>'initial' is distinct from '12' or jsonb_typeof(a->'actions') is distinct from 'array' or
        jsonb_array_length(a->'actions')<>jsonb_array_length(s->'options') or
        jsonb_typeof(a->'clues') is distinct from 'array' or jsonb_array_length(a->'clues')<>2 then raise exception 'Invalid adventure rules or clues.'; end if;
      if exists(select 1 from jsonb_array_elements(a->'clues') c where jsonb_typeof(c)<>'string' or length(c#>>'{}') not between 1 and 500) then raise exception 'Invalid clue.'; end if;
      if exists(select 1 from jsonb_array_elements(a->'actions') with ordinality x(value,position) where jsonb_typeof(value->'label') is distinct from 'string' or value->>'label' is distinct from s->'options'->>(position::integer-1) or jsonb_typeof(value->'cost') is distinct from 'number' or coalesce(value->>'cost','') !~ '^[0-3]$' or jsonb_typeof(value->'grants') is distinct from 'array') then raise exception 'Invalid action effects.'; end if;
      if exists(select 1 from jsonb_array_elements(a->'actions') x where jsonb_array_length(x->'grants')>8 or (x ? 'requires' and (jsonb_typeof(x->'requires') is distinct from 'string' or length(x->>'requires') not between 1 and 60))) or
        exists(select 1 from jsonb_array_elements(a->'actions') x cross join lateral jsonb_array_elements(x->'grants') g where jsonb_typeof(g)<>'string' or length(g#>>'{}') not between 1 and 60) then raise exception 'Invalid action requirements or flags.'; end if;
      if jsonb_typeof(a->'resource') is distinct from 'string' or length(a->>'resource') not between 1 and 60 or (a ? 'kit' and jsonb_typeof(a->'kit') is distinct from 'boolean') then raise exception 'Invalid resource or item rules.'; end if;
      if a ? 'surprise' and (coalesce(a->'surprise'->>'cost','') !~ '^[0-3]$' or jsonb_typeof(a->'surprise'->'unless') is distinct from 'string') then raise exception 'Invalid surprise.'; end if;
      if a ? 'surprise' and exists(select 1 from unnest(array['prepared','unprepared']) k where jsonb_typeof(a->'surprise'->k) is distinct from 'string' or length(a->'surprise'->>k) not between 1 and 500) then raise exception 'Invalid surprise feedback.'; end if;
    end if;
  end loop;
end;
$$;
create or replace function public.store_adventure_clues(room_id uuid, game_index integer, deck jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare clean jsonb := '[]'; s jsonb; i integer := 0;
begin
  for s in select value from jsonb_array_elements(deck) loop
    if s ? 'adventure' then
      insert into public.game_clues values($1,$2,i,0,s->'adventure'->'clues'->>0),($1,$2,i,1,s->'adventure'->'clues'->>1)
        on conflict on constraint game_clues_pkey do update set clue=excluded.clue;
      s := s #- '{adventure,clues}';
    end if;
    clean := clean || jsonb_build_array(s); i := i+1;
  end loop;
  return clean;
end;
$$;
create or replace function public.create_game_mode(player_name text, scenario_deck jsonb, discussion_seconds integer, game_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare created jsonb; rid uuid; clean jsonb;
begin
  if game_kind not in ('if-i-were-you','when-things-get-hard','us-against-the-world') or game_kind is null then
    return public.create_game_mode_v006($1,$2,$3,$4);
  end if;
  perform public.validate_extended_deck(game_kind,scenario_deck);
  select jsonb_agg(s #- '{adventure,clues}') into clean from jsonb_array_elements(scenario_deck) s;
  created := public.create_game($1,clean,$3); rid := (created->>'id')::uuid;
  clean := public.store_adventure_clues(rid,0,scenario_deck);
  update public.game_rooms set game_type=game_kind,deck=clean,revision=revision+1 where id=rid;
  return public.game_state(rid);
end;
$$;
create or replace function public.create_game_night(player_name text, game_plan jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e jsonb; clean jsonb := '[]'; created jsonb; rid uuid; i integer := 0; deck jsonb;
begin
  if game_plan is null or jsonb_typeof(game_plan)<>'array' then raise exception 'Choose a playlist.'; end if;
  if jsonb_array_length(game_plan) not between 2 and 8 or pg_column_size(game_plan)>640000 or
    (select count(distinct x->>'gameType') from jsonb_array_elements(game_plan) x)<>jsonb_array_length(game_plan) then raise exception 'Choose two to eight different games.'; end if;
  for e in select value from jsonb_array_elements(game_plan) loop perform public.validate_extended_deck(e->>'gameType',e->'deck'); end loop;
  e := game_plan->0;
  created := case when e->>'gameType'='same-page' then public.create_game(player_name,e->'deck',discussion_seconds)
    else public.create_game_mode(player_name,e->'deck',discussion_seconds,e->>'gameType') end;
  rid := (created->>'id')::uuid;
  for e in select value from jsonb_array_elements(game_plan) loop
    deck := public.store_adventure_clues(rid,i,e->'deck');
    clean := clean || jsonb_build_array(jsonb_build_object('gameType',e->'gameType','deck',deck)); i := i+1;
  end loop;
  update public.game_rooms set night=jsonb_build_object('playlist',clean,'index',0,'completed','[]'::jsonb,'finished',false),revision=revision+1 where id=rid;
  return public.game_state(rid);
end;
$$;
create or replace function public.adventure_before(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; s jsonb; a jsonb; pair jsonb[]; flags text[] := '{}'; resource integer := 12; i integer; j integer; role_idx integer; kit integer[] := '{}'; item integer;
begin
  select * into r from public.game_rooms where id=$1;
  for i in 0..r.round loop
    s := r.deck->i->'adventure';
    if s ? 'surprise' and not (s->'surprise'->>'unless'=any(flags)) then resource:=greatest(0,resource-(s->'surprise'->>'cost')::integer); end if;
    exit when i=r.round;
    select array_agg(x.payload order by p.joined_at,p.id) into pair from public.game_answers x join public.game_players p on p.room_id=x.room_id and p.id=x.player_id where x.room_id=$1 and x.round=i;
    if coalesce(cardinality(pair),0)<>2 then raise exception 'An earlier adventure chapter is incomplete.'; end if;
    if coalesce((s->>'kit')::boolean,false) then
      for j in 0..2 loop
        for role_idx in 1..2 loop
          item := (pair[role_idx]->'items'->>j)::integer;
          if cardinality(kit)<3 and not item=any(kit) then
            kit:=array_append(kit,item);
            flags:=flags || array(select jsonb_array_elements_text(s->'actions'->item->'grants'));
          end if;
        end loop;
      end loop;
    else
      foreach a in array pair loop
        resource := resource-(s->'actions'->((a->>'choice')::integer)->>'cost')::integer;
        flags := flags || array(select jsonb_array_elements_text(s->'actions'->((a->>'choice')::integer)->'grants'));
      end loop;
    end if;
  end loop;
  return jsonb_build_object('resources',resource,'flags',to_jsonb(flags));
end;
$$;
create or replace function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; stored jsonb; idx integer; n integer; actor uuid; context jsonb; selected jsonb; item jsonb;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id=$1 for update;
  if r.game_type not in ('if-i-were-you','when-things-get-hard','us-against-the-world') then return public.answer_game_v006($1,$2,$3); end if;
  idx:=coalesce((r.night->>'index')::integer,0);
  if exists(select 1 from public.game_skips s where s.room_id=$1 and s.game_index=idx and s.round_number=$2) then return public.game_state($1); end if;
  if exists(select 1 from public.game_players p where p.room_id=$1 and p.has_left) then raise exception 'A player has left. Start a new session.'; end if;
  if payload->'skip'='true'::jsonb and r.game_type='when-things-get-hard' then
    if r.round is distinct from $2 or r.phase<>'answering' then raise exception 'This question has already revealed.'; end if;
    insert into public.game_skips values($1,idx,$2) on conflict do nothing;
    update public.game_rooms set phase='discussion',discussion_until=clock_timestamp(),ready='{}',revision=revision+1 where id=$1;
    return public.game_state($1);
  end if;
  if exists(select 1 from public.game_answers a where a.room_id=$1 and a.round=$2 and a.player_id=auth.uid()) then return public.game_state($1); end if;
  if r.round is distinct from $2 or r.phase<>'answering' then raise exception 'This round is not accepting answers.'; end if;
  n:=jsonb_array_length(r.deck->r.round->'options');
  if payload is null or jsonb_typeof(payload)<>'object' or jsonb_typeof(payload->'choice') is distinct from 'number' or
    coalesce(payload->>'choice','') !~ '^[0-5]$' or (payload->>'choice')::integer>=n or
    jsonb_typeof(payload->'explanation') is distinct from 'string' or length(payload->>'explanation')>600 then raise exception 'Choose a valid answer and keep explanations under 600 characters.'; end if;
  stored:=jsonb_build_object('choice',payload->'choice','explanation',payload->'explanation');
  if r.game_type='if-i-were-you' then
    if jsonb_typeof(payload->'prediction') is distinct from 'number' or coalesce(payload->>'prediction','') !~ '^[0-4]$' then raise exception 'Choose what you would select for your partner too.'; end if;
    stored:=stored || jsonb_build_object('prediction',payload->'prediction');
  end if;
  if r.game_type='us-against-the-world' then
    select p.id into actor from public.game_players p where p.room_id=$1 order by p.joined_at,p.id offset (select count(*) from public.game_answers a where a.room_id=$1 and a.round=$2) limit 1;
    if actor is distinct from auth.uid() then raise exception 'Wait for your partner''s turn.'; end if;
    if coalesce((r.deck->r.round->'adventure'->>'kit')::boolean,false) then
      if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items')<>3 then raise exception 'Choose exactly three items in priority order.'; end if;
      if (select count(distinct x) from jsonb_array_elements(payload->'items') x)<>3 or payload->'choice' is distinct from payload->'items'->0 then raise exception 'Choose three different item priorities.'; end if;
      for item in select value from jsonb_array_elements(payload->'items') loop
        if jsonb_typeof(item)<>'number' or item#>>'{}' !~ '^[0-5]$' or (item#>>'{}')::integer>=n then raise exception 'Invalid survival item.'; end if;
      end loop;
      stored:=stored || jsonb_build_object('items',payload->'items');
    else
      context:=public.adventure_before($1);
      selected:=r.deck->r.round->'adventure'->'actions'->((payload->>'choice')::integer);
      if (selected->>'cost')::integer>floor((context->>'resources')::numeric/2) or
        (selected ? 'requires' and not (context->'flags' ? (selected->>'requires'))) then raise exception 'That action needs more resources or earlier equipment.'; end if;
    end if;
  end if;
  insert into public.game_answers(room_id,round,player_id,payload) values($1,$2,auth.uid(),stored);
  update public.game_rooms set revision=revision+1,updated_at=clock_timestamp(),
    phase=case when (select count(*) from public.game_answers a where a.room_id=$1 and a.round=$2)=2 then 'discussion' else 'answering' end,
    discussion_until=case when (select count(*) from public.game_answers a where a.room_id=$1 and a.round=$2)=2 then clock_timestamp()+make_interval(secs=>r.discussion_seconds) else null end where id=$1;
  return public.game_state($1);
end;
$$;
create or replace function public.save_game_reflection(room_id uuid, round_number integer, payload jsonb, game_index integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; idx integer; stored jsonb;
begin
  perform public.game_state($1); select * into r from public.game_rooms where id=$1 for update;
  idx:=coalesce((r.night->>'index')::integer,0);
  if (r.night is not null and game_index is distinct from idx) or r.game_type not in ('if-i-were-you','when-things-get-hard','us-against-the-world') or
    r.phase<>'discussion' or r.round is distinct from $2 or exists(select 1 from public.game_players p where p.room_id=$1 and p.has_left) or
    exists(select 1 from public.game_skips s where s.room_id=$1 and s.game_index=idx and s.round_number=$2) then raise exception 'Reflections are available for the current revealed round only.'; end if;
  if jsonb_typeof(payload->'explanation') is distinct from 'string' or length(payload->>'explanation')>600 or
    jsonb_typeof(payload->'shared') is distinct from 'boolean' then raise exception 'Invalid reflection or sharing consent.'; end if;
  if payload ? 'reaction' and (jsonb_typeof(payload->'reaction') is distinct from 'string' or r.game_type='when-things-get-hard' or payload->>'reaction' not in ('That feels right','It''s more complicated','Tell me more')) then raise exception 'Invalid reaction.'; end if;
  if payload ? 'kind' and (jsonb_typeof(payload->'kind') is distinct from 'string' or r.game_type<>'when-things-get-hard' or payload->>'kind' not in ('This is what usually happens','This is what I wish would happen','A little of both','Not sure yet')) then raise exception 'Invalid reflection type.'; end if;
  if not payload ? 'reaction' and not payload ? 'kind' and length(trim(payload->>'explanation'))=0 then raise exception 'Choose a reflection or add a note.'; end if;
  stored:=jsonb_build_object('explanation',payload->'explanation','shared',payload->'shared');
  if payload ? 'reaction' then stored:=stored || jsonb_build_object('reaction',payload->'reaction'); end if;
  if payload ? 'kind' then stored:=stored || jsonb_build_object('kind',payload->'kind'); end if;
  insert into public.game_reflections values($1,idx,$2,auth.uid(),stored,(payload->>'shared')::boolean)
    on conflict on constraint game_reflections_pkey do update set payload=excluded.payload,shared=excluded.shared;
  update public.game_rooms set revision=revision+1,updated_at=clock_timestamp() where id=$1;
  return public.game_state($1);
end;
$$;
create or replace function public.advance_game_night(room_id uuid, game_index integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  result:=public.advance_game_night_v006($1,$2);
  update public.game_rooms set night=jsonb_set(night,'{completed}',(select coalesce(jsonb_agg(x-'reflections'),'[]') from jsonb_array_elements(night->'completed') x)) where id=$1 and night is not null;
  return public.game_state($1);
end;
$$;
revoke all on function public.shared_game_reflections(uuid,integer), public.validate_extended_deck(text,jsonb),
  public.store_adventure_clues(uuid,integer,jsonb),public.adventure_before(uuid) from public,authenticated;
revoke all on function public.game_state(uuid),public.my_game_notes(uuid,integer),public.create_game_mode(text,jsonb,integer,text),
  public.answer_game(uuid,integer,jsonb),public.create_game_night(text,jsonb,integer),public.advance_game_night(uuid,integer),
  public.save_game_reflection(uuid,integer,jsonb,integer) from public;
grant execute on function public.game_state(uuid),public.my_game_notes(uuid,integer),public.create_game_mode(text,jsonb,integer,text),
  public.answer_game(uuid,integer,jsonb),public.create_game_night(text,jsonb,integer),public.advance_game_night(uuid,integer),
  public.save_game_reflection(uuid,integer,jsonb,integer) to authenticated;
commit;
