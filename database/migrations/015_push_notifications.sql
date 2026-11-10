-- AFTERHOURS — Web Push notifications (iPhone home-screen app, Android, desktop).
-- Run once after 014. Safe to re-run.
--
-- Flow: a trigger queues a message (with a random one-time token) and pings the
-- Vercel function /api/push with {id, token}. The function redeems it via
-- push_take() — only a fresh, unclaimed (id, token) pair returns the payload and the
-- recipients' push endpoints — and sends with the VAPID key it keeps to itself.
-- No secret is shared between Postgres and the function.

-- ── subscriptions (one per device) ───────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_own_select on public.push_subscriptions;
create policy push_subs_own_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_subs_own_insert on public.push_subscriptions;
create policy push_subs_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists push_subs_own_update on public.push_subscriptions;
create policy push_subs_own_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists push_subs_own_delete on public.push_subscriptions;
create policy push_subs_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- ── queue (private) ──────────────────────────────────────────
create table if not exists private.push_queue (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  recipients uuid[] not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  taken_at timestamptz
);
revoke all on private.push_queue from public, anon, authenticated;

insert into private.app_settings(name, value) values ('push_url', 'https://afterhours-malta.vercel.app/api/push')
on conflict (name) do update set value = excluded.value;

-- queue + ping. p_recipients: explicit users; actor is always excluded.
create or replace function private.push_send(p_recipients uuid[], p_actor uuid, p_title text, p_body text, p_url text, p_tag text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r uuid[]; qid uuid; tok text := encode(extensions.gen_random_bytes(24), 'hex'); url text;
begin
  select array_agg(distinct x) into r
  from unnest(p_recipients) x
  where x is not null and x is distinct from p_actor
    and exists (select 1 from public.push_subscriptions s where s.user_id = x);
  if r is null or cardinality(r) = 0 then return; end if;
  select value into url from private.app_settings where name = 'push_url';
  if url is null then return; end if;
  insert into private.push_queue(token, recipients, payload)
  values (tok, r, jsonb_strip_nulls(jsonb_build_object('title', left(p_title, 120), 'body', left(coalesce(p_body, ''), 240), 'url', coalesce(p_url, '/'), 'tag', p_tag)))
  returning id into qid;
  perform net.http_post(url := url, body := jsonb_build_object('id', qid, 'token', tok));
  -- housekeeping: old queue rows
  delete from private.push_queue where created_at < now() - interval '2 days';
exception when others then
  raise warning 'push_send failed: %', sqlerrm;
end $$;
revoke all on function private.push_send(uuid[], uuid, text, text, text, text) from public, anon, authenticated;

create or replace function private.group_member_ids(p_group uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(user_id), '{}') from public.group_members where group_id = p_group
$$;
revoke all on function private.group_member_ids(uuid) from public, anon, authenticated;

-- ── redeem (called by /api/push with the anon key) ───────────
create or replace function public.push_take(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q private.push_queue%rowtype;
begin
  update private.push_queue set taken_at = now()
  where id = p_id and token = p_token and taken_at is null and created_at > now() - interval '10 minutes'
  returning * into q;
  if q.id is null then return null; end if;
  return jsonb_build_object(
    'payload', q.payload,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                      from public.push_subscriptions s where s.user_id = any(q.recipients)), '[]'::jsonb)
  );
end $$;
revoke all on function public.push_take(uuid, text) from public;
grant execute on function public.push_take(uuid, text) to anon;

-- dead endpoints (410/404 from the push service) are removed, only for a redeemed message
create or replace function public.push_report(p_id uuid, p_token text, p_dead text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.push_queue where id = p_id and token = p_token and taken_at is not null) then return; end if;
  delete from public.push_subscriptions s
  using private.push_queue q
  where q.id = p_id and s.endpoint = any(p_dead) and s.user_id = any(q.recipients);
end $$;
revoke all on function public.push_report(uuid, text, text[]) from public;
grant execute on function public.push_report(uuid, text, text[]) to anon;

-- ── what notifies ────────────────────────────────────────────
-- new plan → everyone in the community
create or replace function public.trg_push_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push_send(private.group_member_ids(new.group_id), new.created_by,
    '📅 ' || public.display_name_of(new.created_by) || ' lançou um plano',
    new.title || ' · ' || to_char(new.starts_at at time zone 'Europe/Lisbon', 'DD/MM "às" HH24:MI') || coalesce(' · ' || new.location, ''),
    '/plans', 'plan-' || new.id);
  return new;
end $$;
drop trigger if exists push_event on public.events;
create trigger push_event after insert on public.events for each row execute function public.trg_push_event();

-- new clip → everyone
create or replace function public.trg_push_clip() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.posts%rowtype;
begin
  if new.media_type <> 'video' then return new; end if;
  select * into p from public.posts where id = new.post_id;
  perform private.push_send(private.group_member_ids(new.group_id), p.author_id,
    '🎮 ' || public.display_name_of(p.author_id) || ' mandou um clip' || coalesce(' · ' || new.game_title, ''),
    case when p.body = 'Olhem para isto 👀' then 'Vai ver 👀' else p.body end,
    '/gaming', 'clip-' || new.id);
  return new;
end $$;
drop trigger if exists push_clip on public.post_media;
create trigger push_clip after insert on public.post_media for each row execute function public.trg_push_clip();

-- comment on your post → post author
create or replace function public.trg_push_comment() returns trigger language plpgsql security definer set search_path = '' as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform private.push_send(array[author], new.user_id,
    '💬 ' || public.display_name_of(new.user_id) || ' comentou o teu post',
    case when new.media_path is not null and new.body = '📷' then '📷 Foto' else new.body end,
    '/', 'comments-' || new.post_id);
  return new;
end $$;
drop trigger if exists push_comment on public.post_comments;
create trigger push_comment after insert on public.post_comments for each row execute function public.trg_push_comment();

-- someone joined your lobby → lobby creator
create or replace function public.trg_push_lobby_join() returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.game_calls%rowtype; n int;
begin
  select * into c from public.game_calls where id = new.call_id;
  if c.created_by = new.user_id then return new; end if;
  select count(*) into n from public.game_call_players where call_id = new.call_id;
  perform private.push_send(array[c.created_by], new.user_id,
    '🎮 ' || public.display_name_of(new.user_id) || ' entrou no teu lobby',
    c.game || ' · ' || n || '/' || c.slots || case when n >= c.slots then ' · cheio, GG!' else '' end,
    '/gaming', 'lobby-' || c.id);
  return new;
end $$;
drop trigger if exists push_lobby_join on public.game_call_players;
create trigger push_lobby_join after insert on public.game_call_players for each row execute function public.trg_push_lobby_join();

-- someone is going to your plan → plan creator
create or replace function public.trg_push_rsvp() returns trigger language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype;
begin
  if new.status <> 'going' or (tg_op = 'UPDATE' and old.status = 'going') then return new; end if;
  select * into e from public.events where id = new.event_id;
  perform private.push_send(array[e.created_by], new.user_id,
    '✅ ' || public.display_name_of(new.user_id) || ' vai ao teu plano',
    e.title, '/plans', 'rsvp-' || e.id);
  return new;
end $$;
drop trigger if exists push_rsvp on public.event_rsvps;
create trigger push_rsvp after insert or update on public.event_rsvps for each row execute function public.trg_push_rsvp();

revoke execute on function public.trg_push_event(), public.trg_push_clip(), public.trg_push_comment(), public.trg_push_lobby_join(), public.trg_push_rsvp() from public, anon, authenticated;
