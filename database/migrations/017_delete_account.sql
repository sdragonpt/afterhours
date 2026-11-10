-- AFTERHOURS — "Apagar a minha conta" (GDPR right to erasure). Run once after 016.
-- Personal content is deleted. Money records (expenses/settlements) can't disappear without
-- breaking everyone else's balances, so they stay linked to an anonymised "Ex-membro":
-- the auth record is scrubbed (email, password, identities, sessions) and banned.
-- Media files (R2 / Storage) are removed by the app just before calling this.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g record; heir uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  -- communities I own: hand over to the longest-standing member, or delete if I'm alone
  for g in select id from public.groups where owner_id = uid loop
    select user_id into heir from public.group_members where group_id = g.id and user_id <> uid order by joined_at limit 1;
    if heir is null then
      delete from public.groups where id = g.id; -- cascades everything in it
    else
      update public.groups set owner_id = heir where id = g.id;
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
    end if;
  end loop;

  delete from public.posts where author_id = uid;            -- + media rows, comments, reactions, polls
  delete from public.post_comments where user_id = uid;
  delete from public.post_reactions where user_id = uid;
  delete from public.poll_votes where user_id = uid;
  delete from public.events where created_by = uid;          -- + RSVPs
  delete from public.event_rsvps where user_id = uid;
  delete from public.game_calls where created_by = uid;      -- + players
  delete from public.game_call_players where user_id = uid;
  delete from public.push_subscriptions where user_id = uid;
  delete from public.widget_tokens where user_id = uid;
  delete from public.group_invites where created_by = uid;
  delete from public.group_members where user_id = uid;

  update public.profiles
     set display_name = 'Ex-membro', vibe = null, vibe_note = null, vibe_until = null, avatar_color = 'lime'
   where id = uid;

  -- scrub + lock the login (row kept only so money records stay consistent)
  update auth.users set
    email = 'deleted-' || uid || '@deleted.invalid',
    phone = null,
    encrypted_password = '',
    email_confirmed_at = null,
    raw_user_meta_data = '{}'::jsonb,
    banned_until = 'infinity'
  where id = uid;
  delete from auth.identities where user_id = uid;
  delete from auth.sessions where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
