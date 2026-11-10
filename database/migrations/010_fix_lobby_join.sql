-- AFTERHOURS — fix "Entrar" in game lobbies.
-- The join policy counted rows of game_call_players from inside a policy on
-- game_call_players → Postgres: "infinite recursion detected in policy".
-- The slot check now lives in a SECURITY DEFINER helper (no RLS recursion).

create or replace function public.game_call_can_join(p_call uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.game_calls c
    where c.id = p_call
      and public.is_group_member(c.group_id)
      and (select count(*) from public.game_call_players p where p.call_id = c.id) < c.slots
  )
$$;
revoke all on function public.game_call_can_join(uuid) from public, anon;
grant execute on function public.game_call_can_join(uuid) to authenticated;

drop policy if exists game_call_players_join on public.game_call_players;
create policy game_call_players_join on public.game_call_players for insert to authenticated with check (
  user_id = (select auth.uid()) and public.game_call_can_join(call_id)
);
