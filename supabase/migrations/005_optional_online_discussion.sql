-- Online discussion time is a suggestion; both players must still opt in to continue.
-- Applies to single games and the index-checked ready_night_game wrapper.
create or replace function public.ready_game(room_id uuid, round_number integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.game_rooms; next_ready uuid[];
begin
  perform public.game_state($1);
  select * into r from public.game_rooms where id = $1 for update;
  if exists(select 1 from public.game_players p where p.room_id = r.id and p.has_left) then raise exception 'A player has left. Create a new room.'; end if;
  if $2 < r.round or r.phase = 'recap' then return public.game_state($1); end if;
  if $2 is null or r.round <> $2 or r.phase <> 'discussion' then raise exception 'Discussion is not active.'; end if;
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
revoke all on function public.ready_game(uuid,integer) from public;
grant execute on function public.ready_game(uuid,integer) to authenticated;
