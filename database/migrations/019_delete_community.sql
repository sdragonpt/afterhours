-- AFTERHOURS — the owner of a community can delete it. Run once after 018. Safe to re-run.
-- Every table that belongs to a community references groups(id) ON DELETE CASCADE, so one
-- delete removes posts, comments, reactions, polls, plans + RSVPs, lobbies, the Tab,
-- invites, Discord link and widgets. Photos/clips in R2 are wiped first by the media Worker
-- (DELETE /group), which asks owns_group() with the caller's own token.

create or replace function public.owns_group(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups where id = p_group and owner_id = auth.uid())
$$;
revoke all on function public.owns_group(uuid) from public, anon;
grant execute on function public.owns_group(uuid) to authenticated;

create or replace function public.delete_group(p_group uuid, p_confirm_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into g from public.groups where id = p_group;
  if g.id is null then raise exception 'Community not found'; end if;
  if g.owner_id <> auth.uid() then raise exception 'Only the owner can delete this community'; end if;
  if lower(trim(p_confirm_name)) <> lower(trim(g.name)) then raise exception 'Name does not match'; end if;
  delete from public.groups where id = p_group;
end $$;
revoke all on function public.delete_group(uuid, text) from public, anon;
grant execute on function public.delete_group(uuid, text) to authenticated;
