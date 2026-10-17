-- Generation quotas contain no player answers or generated question text.
create table if not exists public.question_generation_usage (
  scope text not null,
  day date not null default current_date,
  requests integer not null default 0,
  primary key (scope, day)
);
alter table public.question_generation_usage enable row level security;
revoke all on public.question_generation_usage from anon, authenticated;

create or replace function public.claim_question_generation(player_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  if player_id is null or not exists (select 1 from auth.users where id = player_id) then
    raise exception 'A valid player identity is required.';
  end if;
  insert into public.question_generation_usage as usage (scope, day, requests)
    values (player_id::text, current_date, 1)
    on conflict (scope, day) do update set requests = usage.requests + 1 where usage.requests < 20
    returning requests into claimed;
  if claimed is null then return false; end if;
  claimed := null;
  insert into public.question_generation_usage as usage (scope, day, requests)
    values ('global', current_date, 1)
    on conflict (scope, day) do update set requests = usage.requests + 1 where usage.requests < 200
    returning requests into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_question_generation(uuid) from public, anon, authenticated;
grant execute on function public.claim_question_generation(uuid) to service_role;
