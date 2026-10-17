-- Run once in a new Supabase project's SQL editor. Enable anonymous sign-ins in Auth.
create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host uuid not null references auth.users(id),
  deck jsonb not null,
  round integer not null default 0,
  phase text not null default 'lobby' check (phase in ('lobby','answering','discussion','recap')),
  discussion_seconds integer not null check (discussion_seconds in (30,60,120,180)),
  discussion_until timestamptz,
  ready uuid[] not null default '{}',
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create table public.game_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 24),
  joined_at timestamptz not null default clock_timestamp(),
  has_left boolean not null default false,
  primary key (room_id,id)
);
create table public.game_answers (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round integer not null,
  player_id uuid not null,
  payload jsonb not null,
  primary key (room_id,round,player_id),
  foreign key (room_id,player_id) references public.game_players(room_id,id)
);
alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.game_answers enable row level security;
revoke all on public.game_rooms, public.game_players, public.game_answers from anon, authenticated;
grant select on public.game_rooms to authenticated;

create function public.is_game_member(room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.game_players p where p.room_id = $1 and p.id = auth.uid());
$$;
revoke all on function public.is_game_member(uuid) from public;
grant execute on function public.is_game_member(uuid) to authenticated;
create policy room_members_read on public.game_rooms for select to authenticated
using (public.is_game_member(id) and expires_at > now());

create function public.game_state(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; result jsonb;
begin
  select * into r from public.game_rooms where id = $1;
  if not found or not public.is_game_member($1) then raise exception 'Room not found or you are not a member.'; end if;
  if r.expires_at <= now() then raise exception 'This room has expired. Please create a new room.'; end if;
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'mode', 'online', 'revision', r.revision,
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

create function public.create_game(player_name text, scenario_deck jsonb, discussion_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_code text;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a room.'; end if;
  if player_name is null or length(trim(player_name)) not between 1 and 24 then raise exception 'Enter a name between 1 and 24 characters.'; end if;
  if scenario_deck is null or jsonb_typeof(scenario_deck) <> 'array' then raise exception 'Invalid scenario deck.'; end if;
  if jsonb_array_length(scenario_deck) not in (3,5,10,20) or pg_column_size(scenario_deck) > 40000 then raise exception 'Invalid scenario deck size.'; end if;
  if discussion_seconds is null or discussion_seconds not in (30,60,120,180) then raise exception 'Choose a valid discussion time.'; end if;
  if exists(select 1 from jsonb_array_elements(scenario_deck) s where
    jsonb_typeof(s->'id') is distinct from 'string' or
    jsonb_typeof(s->'title') is distinct from 'string' or
    jsonb_typeof(s->'category') is distinct from 'string' or
    jsonb_typeof(s->'text') is distinct from 'string' or
    jsonb_typeof(s->'prompt') is distinct from 'string') then raise exception 'Invalid scenario content.'; end if;
  if (select count(*) from public.game_rooms where host = auth.uid() and expires_at > now()) >= 20 then raise exception 'Room limit reached. Please reuse a recent room or try again later.'; end if;
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into public.game_rooms(code,host,deck,discussion_seconds) values(new_code,auth.uid(),scenario_deck,discussion_seconds) returning id into new_id;
      exit;
    exception when unique_violation then
      -- Retry the random invite code; never reuse an existing room.
    end;
  end loop;
  insert into public.game_players(room_id,id,name) values(new_id,auth.uid(),trim(player_name));
  return public.game_state(new_id);
end;
$$;

create function public.join_game(room_code text, player_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  if auth.uid() is null then raise exception 'Sign in before joining a room.'; end if;
  select * into r from public.game_rooms where code = upper(trim(room_code)) for update;
  if not found or r.expires_at <= now() then raise exception 'Room not found or expired. Check the invite code.'; end if;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.id = auth.uid() and not p.has_left) then return public.game_state(r.id); end if;
  if r.phase <> 'lobby' or (select count(*) from public.game_players p where p.room_id = r.id) >= 2 then raise exception 'This room is full or has already started.'; end if;
  if player_name is null or length(trim(player_name)) not between 1 and 24 then raise exception 'Enter a name between 1 and 24 characters.'; end if;
  insert into public.game_players(room_id,id,name) values(r.id,auth.uid(),trim(player_name));
  update public.game_rooms set updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  return public.game_state(r.id);
end;
$$;

create function public.start_game(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if r.host <> auth.uid() then raise exception 'Only the room creator can start.'; end if;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if r.phase <> 'lobby' then return public.game_state(r.id); end if;
  if (select count(*) from public.game_players p where p.room_id = r.id) <> 2 then raise exception 'Wait for your partner to join.'; end if;
  update public.game_rooms set phase = 'answering', updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  return public.game_state(r.id);
end;
$$;

create function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if exists(select 1 from public.game_answers a where a.room_id = $1 and a.round = $2 and a.player_id = auth.uid()) then return public.game_state($1); end if;
  if round_number is null or r.round <> round_number or r.phase <> 'answering' then raise exception 'This round is no longer accepting answers. Refresh your room.'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid answer.'; end if;
  if not (payload->>'verdict' ~ '^[0-4]$') or not (payload->>'emotion' ~ '^[0-4]$') or not (payload->>'factor' ~ '^[0-3]$')
    or not (payload ?& array['verdict','emotion','factor','explanation'])
    or jsonb_typeof(payload->'verdict') <> 'number' or jsonb_typeof(payload->'emotion') <> 'number' or jsonb_typeof(payload->'factor') <> 'number'
    or jsonb_typeof(payload->'explanation') <> 'string' or length(payload->>'explanation') > 600 then raise exception 'Please complete all three choices and keep explanations under 600 characters.'; end if;
  insert into public.game_answers(room_id,round,player_id,payload) values($1,$2,auth.uid(),$3);
  if (select count(*) from public.game_answers a where a.room_id = r.id and a.round = r.round) = 2 then
    update public.game_rooms set phase = 'discussion', discussion_until = clock_timestamp() + make_interval(secs => r.discussion_seconds), updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  else
    update public.game_rooms set updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  end if;
  return public.game_state(r.id);
end;
$$;

create function public.ready_game(room_id uuid, round_number integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; next_ready uuid[];
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if $2 < r.round or r.phase = 'recap' then return public.game_state($1); end if;
  if $2 is null or r.round <> $2 or r.phase <> 'discussion' then raise exception 'Discussion is not active.'; end if;
  if clock_timestamp() < r.discussion_until then raise exception 'Take a little time to discuss before continuing.'; end if;
  if auth.uid() = any(r.ready) then return public.game_state($1); end if;
  next_ready := array_append(r.ready,auth.uid());
  if cardinality(next_ready) = 2 then
    update public.game_rooms set
      phase = case when r.round + 1 >= jsonb_array_length(r.deck) then 'recap' else 'answering' end,
      round = case when r.round + 1 >= jsonb_array_length(r.deck) then r.round else r.round + 1 end,
      ready = '{}', discussion_until = null, updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  else
    update public.game_rooms set ready = next_ready, updated_at = clock_timestamp(), revision = revision + 1 where id = r.id;
  end if;
  return public.game_state(r.id);
end;
$$;

create function public.leave_game(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.game_state($1);
  perform 1 from public.game_rooms where id = $1 for update;
  update public.game_players set has_left = true where game_players.room_id = $1 and id = auth.uid();
  update public.game_rooms set updated_at = clock_timestamp(), revision = revision + 1 where id = $1;
  return public.game_state($1);
end;
$$;

revoke all on function public.game_state(uuid), public.create_game(text,jsonb,integer), public.join_game(text,text),
  public.start_game(uuid), public.answer_game(uuid,integer,jsonb), public.ready_game(uuid,integer), public.leave_game(uuid) from public;
grant execute on function public.game_state(uuid), public.create_game(text,jsonb,integer), public.join_game(text,text),
  public.start_game(uuid), public.answer_game(uuid,integer,jsonb), public.ready_game(uuid,integer), public.leave_game(uuid) to authenticated;

-- Only room metadata is broadcast. Private answers never enter the realtime stream.
alter publication supabase_realtime add table public.game_rooms;
