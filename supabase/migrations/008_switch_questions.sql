-- Apply after 007. Replacements and submissions serialize on the same room lock.
begin;
create table if not exists public.game_question_switches (
  switch_id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  game_index integer not null,
  round_number integer not null,
  old_question jsonb not null,
  replacement_id text not null
);
create index if not exists game_question_switches_lookup
  on public.game_question_switches(room_id,game_index,round_number);
alter table public.game_question_switches enable row level security;
revoke all on public.game_question_switches from public, anon, authenticated;

do $$ begin
  if to_regprocedure('public.game_state_v007(uuid)') is null then
    alter function public.game_state(uuid) rename to game_state_v007;
    alter function public.answer_game(uuid,integer,jsonb) rename to answer_game_v007;
  end if;
end $$;
revoke all on function public.game_state_v007(uuid), public.answer_game_v007(uuid,integer,jsonb)
  from public, anon, authenticated;

create or replace function public.question_text_key(value text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(normalize(value,NFKC)),'[^a-z0-9]+',' ','g'));
$$;
revoke all on function public.question_text_key(text) from public, anon, authenticated;

create or replace function public.game_state(room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; idx integer; switched jsonb;
begin
  result := public.game_state_v007($1);
  idx := coalesce((result->'night'->>'index')::integer,0);
  select coalesce(jsonb_agg(jsonb_build_object('id',s.old_question->>'id','text',s.old_question->>'text') order by s.switch_id),'[]')
    into switched from public.game_question_switches s where s.room_id=$1 and s.game_index=idx;
  return result || jsonb_build_object('switchedQuestions',switched);
end;
$$;

create or replace function public.switch_game_question(
  room_id uuid, round_number integer, expected_question_id text, replacement jsonb, game_index integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; idx integer; current_question jsonb; next_deck jsonb; next_night jsonb;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id=$1 for update;
  if r.expires_at<=now() then raise exception 'This room has expired.'; end if;
  if not exists(select 1 from public.game_players p where p.room_id=$1 and p.id=auth.uid() and not p.has_left) or
    (select count(*) from public.game_players p where p.room_id=$1 and not p.has_left)<>2 then
    raise exception 'Both players must still be in this room.';
  end if;
  idx := coalesce((r.night->>'index')::integer,0);
  if (r.night is not null and $5 is distinct from idx) or (r.night is null and $5 is not null) then
    raise exception 'That playlist game has changed. Refresh before switching a question.';
  end if;
  if r.game_type='us-against-the-world' then raise exception 'Adventure chapters stay in story order.'; end if;
  if $2 is distinct from r.round or $3 is null then raise exception 'That question has changed. Refresh before switching.'; end if;
  current_question := r.deck->r.round;
  if current_question->>'id' is distinct from $3 then
    if current_question=$4 and exists(select 1 from public.game_question_switches s where s.room_id=$1 and s.game_index=idx
      and s.round_number=$2 and s.old_question->>'id'=$3 and s.replacement_id=current_question->>'id') then
      return public.game_state($1);
    end if;
    raise exception 'That question has changed. Refresh before switching.';
  end if;
  if r.phase<>'answering' or cardinality(r.ready)>0 or
    exists(select 1 from public.game_answers a where a.room_id=$1 and a.round=r.round) then
    raise exception 'Switch questions before either player submits an answer.';
  end if;
  if $4 is null or jsonb_typeof($4)<>'object' or $4 ? 'adventure' then raise exception 'Choose a valid replacement question.'; end if;
  next_deck := jsonb_set(r.deck,array[r.round::text],$4);
  perform public.validate_extended_deck(r.game_type,next_deck);
  if exists(select 1 from jsonb_array_elements(r.deck) q where q->>'id'=$4->>'id' or
    public.question_text_key(q->>'text')=public.question_text_key($4->>'text')) or
    exists(select 1 from public.game_question_switches s where s.room_id=$1 and s.game_index=idx and
      (s.old_question->>'id'=$4->>'id' or public.question_text_key(s.old_question->>'text')=public.question_text_key($4->>'text'))) then
    raise exception 'That question is already in this game or has been set aside. Choose another.';
  end if;
  if r.game_type='pick-my-poison' and $4->>'level' is distinct from current_question->>'level' then
    raise exception 'Keep the same dilemma difficulty when switching.';
  end if;
  if r.game_type in ('if-i-were-you','when-things-get-hard') and
    not exists(select 1 from jsonb_array_elements(r.deck) q where q->>'category' is distinct from current_question->>'category') and
    $4->>'category' is distinct from current_question->>'category' then
    raise exception 'Keep the selected situation category when switching.';
  end if;
  insert into public.game_question_switches(room_id,game_index,round_number,old_question,replacement_id)
    values($1,idx,$2,current_question,$4->>'id');
  next_night := case when r.night is null then null else jsonb_set(r.night,array['playlist',idx::text,'deck'],next_deck) end;
  update public.game_rooms set deck=next_deck,night=next_night,revision=revision+1 where id=$1;
  return public.game_state($1);
end;
$$;

create or replace function public.assert_answer_question(r public.game_rooms, round_number integer, payload jsonb) returns void
language plpgsql set search_path = '' as $$
declare idx integer; switched boolean;
begin
  idx := coalesce((r.night->>'index')::integer,0);
  if $2=r.round and r.phase='answering' then
    select exists(select 1 from public.game_question_switches s where s.room_id=r.id and s.game_index=idx and s.round_number=$2) into switched;
    if (($3 ? 'questionId') and (jsonb_typeof($3->'questionId') is distinct from 'string' or $3->>'questionId' is distinct from r.deck->r.round->>'id'))
      or (switched and not coalesce($3 ? 'questionId',false)) then
      raise exception 'This question was switched. Read the new question before submitting.';
    end if;
  end if;
end;
$$;
revoke all on function public.assert_answer_question(public.game_rooms,integer,jsonb) from public, anon, authenticated;

create or replace function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms;
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id=$1 for update;
  perform public.assert_answer_question(r,$2,$3);
  return public.answer_game_v007($1,$2,$3);
end;
$$;

revoke all on function public.game_state(uuid),public.answer_game(uuid,integer,jsonb),
  public.switch_game_question(uuid,integer,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.game_state(uuid),public.answer_game(uuid,integer,jsonb),
  public.switch_game_question(uuid,integer,text,jsonb,integer) to authenticated;
commit;
