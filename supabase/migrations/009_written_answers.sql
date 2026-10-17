begin;

do $$ begin
  if to_regprocedure('public.answer_game_v008(uuid,integer,jsonb)') is null then
    alter function public.answer_game(uuid,integer,jsonb) rename to answer_game_v008;
  end if;
end $$;
revoke all on function public.answer_game_v008(uuid,integer,jsonb) from public, anon, authenticated;

create or replace function public.validated_response(payload jsonb, field_name text, text_name text, option_count integer) returns jsonb
language plpgsql set search_path = '' as $$
declare value integer; written text;
begin
  if jsonb_typeof(payload->field_name) is distinct from 'number' or coalesce(payload->>field_name,'') !~ '^-?[0-9]+$' then
    raise exception 'Choose a valid response before submitting.';
  end if;
  if length(payload->>field_name)>3 then raise exception 'That response is not in this question.'; end if;
  value := (payload->>field_name)::integer;
  if value=-2 then
    if jsonb_typeof(payload->text_name) is distinct from 'string' then raise exception 'Write your answer when you choose Other.'; end if;
    written := payload->>text_name;
    if length(btrim(written,U&' \0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))=0
      or length(written)>600 then raise exception 'Written answers must contain text and stay within 600 characters.'; end if;
    -- Browser maxlength counts supplementary Unicode characters as two UTF-16 units.
    if length(written)+(select count(*) from regexp_split_to_table(written,'') ch where ascii(ch)>65535)>600 then
      raise exception 'Written answers must stay within 600 characters.';
    end if;
    return jsonb_build_object(field_name,value,text_name,written);
  end if;
  if value<0 or value>=option_count or payload ? text_name then raise exception 'That response is not in this question. Use Other for a written answer.'; end if;
  return jsonb_build_object(field_name,value);
end;
$$;
revoke all on function public.validated_response(jsonb,text,text,integer) from public, anon, authenticated;

create or replace function public.answer_game(room_id uuid, round_number integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; stored jsonb; idx integer; n integer;
begin
  if not coalesce(payload ?| array['customVerdict','customEmotion','customFactor','customChoice','customPrediction']
    or payload->'verdict'='-2'::jsonb or payload->'emotion'='-2'::jsonb or payload->'factor'='-2'::jsonb
    or payload->'choice'='-2'::jsonb or payload->'prediction'='-2'::jsonb,false) then
    return public.answer_game_v008($1,$2,$3);
  end if;
  perform public.game_state($1);
  select * into r from public.game_rooms where id=$1 for update;
  perform public.assert_answer_question(r,$2,$3);
  idx := coalesce((r.night->>'index')::integer,0);
  if exists(select 1 from public.game_players p where p.room_id=$1 and p.has_left) then raise exception 'A player has left. Start a new session.'; end if;
  if exists(select 1 from public.game_skips s where s.room_id=$1 and s.game_index=idx and s.round_number=$2) then return public.game_state($1); end if;
  if exists(select 1 from public.game_answers a where a.room_id=$1 and a.round=$2 and a.player_id=auth.uid()) then return public.game_state($1); end if;
  if r.round is distinct from $2 or r.phase<>'answering' then raise exception 'This round is not accepting answers.'; end if;
  if r.game_type='us-against-the-world' then raise exception 'Adventure actions cannot be replaced with written answers.'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'explanation') is distinct from 'string'
    or length(payload->>'explanation')>600 then raise exception 'Keep explanations within 600 characters.'; end if;
  stored := jsonb_build_object('explanation',payload->'explanation');
  if r.game_type='same-page' then
    if payload ?| array['customChoice','customPrediction'] then raise exception 'Write separate answers for your take, feeling and main reason.'; end if;
    n := case when r.deck->r.round ? 'verdictOptions' then jsonb_array_length(r.deck->r.round->'verdictOptions') else 5 end;
    stored := stored || public.validated_response(payload,'verdict','customVerdict',n)
      || public.validated_response(payload,'emotion','customEmotion',5);
    n := case when r.deck->r.round ? 'reasonOptions' then jsonb_array_length(r.deck->r.round->'reasonOptions') else 4 end;
    stored := stored || public.validated_response(payload,'factor','customFactor',n);
  else
    if payload ?| array['customVerdict','customEmotion','customFactor'] then raise exception 'Use the written field beside your selected answer.'; end if;
    n := case when r.game_type='more-likely' then 3 else jsonb_array_length(r.deck->r.round->'options') end;
    stored := stored || public.validated_response(payload,'choice','customChoice',n);
    if r.game_type in ('pick-my-poison','if-i-were-you') then
      stored := stored || public.validated_response(payload,'prediction','customPrediction',n);
    elsif payload ? 'customPrediction' then raise exception 'This round does not accept a written partner prediction.';
    end if;
    if r.game_type='same-brain' and r.round=jsonb_array_length(r.deck)-1 then
      if jsonb_typeof(payload->'matchPrediction') is distinct from 'boolean' then raise exception 'Make your final-round match prediction before submitting.'; end if;
      stored := stored || jsonb_build_object('matchPrediction',payload->'matchPrediction');
    end if;
  end if;
  insert into public.game_answers(room_id,round,player_id,payload) values($1,$2,auth.uid(),stored);
  update public.game_rooms set revision=revision+1,updated_at=clock_timestamp(),
    phase=case when (select count(*) from public.game_answers a where a.room_id=$1 and a.round=$2)=2 then 'discussion' else 'answering' end,
    discussion_until=case when (select count(*) from public.game_answers a where a.room_id=$1 and a.round=$2)=2 then clock_timestamp()+make_interval(secs=>r.discussion_seconds) else null end where id=$1;
  return public.game_state($1);
end;
$$;
revoke all on function public.answer_game(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.answer_game(uuid,integer,jsonb) to authenticated;
commit;
