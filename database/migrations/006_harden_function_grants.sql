-- AFTERHOURS v0.5 — tighten function permissions (Supabase security advisor).
-- Run once after 005. Safe to re-run.

-- Logged-out visitors never need these RPCs.
revoke execute on function
  public.create_expense(uuid, text, numeric, uuid[], uuid),
  public.create_group(text),
  public.create_group_invite(uuid),
  public.join_group_by_invite(uuid),
  public.is_group_member(uuid),
  public.is_group_owner(uuid),
  public.discord_send_tab_reminder(uuid)
from anon;

-- Trigger functions are only fired by Postgres, never called through the API.
revoke execute on function
  public.handle_new_user(),
  public.trg_event_discord(),
  public.trg_clip_discord(),
  public.trg_expense_discord(),
  public.trg_settlement_discord()
from public, anon, authenticated;
