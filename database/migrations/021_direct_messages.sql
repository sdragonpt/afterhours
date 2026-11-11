-- AFTERHOURS — direct messages (Instagram-style). Run once after 020. Safe to re-run.
-- You can message anyone you share a community with. Nobody else can read a conversation.

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists dm_pair_idx on public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index if not exists dm_recipient_unread_idx on public.direct_messages (recipient_id) where read_at is null;
alter table public.direct_messages enable row level security;

create or replace function private.shares_group(a uuid, b uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members x join public.group_members y on y.group_id = x.group_id where x.user_id = a and y.user_id = b)
$$;
revoke all on function private.shares_group(uuid, uuid) from public, anon, authenticated;
-- callable from the RLS policy (runs as the signed-in user)
create or replace function public.can_message(p_other uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.shares_group(auth.uid(), p_other)
$$;
revoke all on function public.can_message(uuid) from public, anon;
grant execute on function public.can_message(uuid) to authenticated;

drop policy if exists dm_read on public.direct_messages;
create policy dm_read on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
drop policy if exists dm_send on public.direct_messages;
create policy dm_send on public.direct_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and read_at is null and public.can_message(recipient_id));
drop policy if exists dm_delete_own on public.direct_messages;
create policy dm_delete_own on public.direct_messages for delete to authenticated
  using (sender_id = (select auth.uid()));
-- no update policy: reading is marked through dm_mark_read()

-- simple flood guard: max 30 messages per minute per sender
create or replace function public.trg_dm_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.direct_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Calma! Demasiadas mensagens seguidas.';
  end if;
  new.body := trim(new.body);
  return new;
end $$;
revoke execute on function public.trg_dm_guard() from public, anon, authenticated;
drop trigger if exists dm_guard on public.direct_messages;
create trigger dm_guard before insert on public.direct_messages for each row execute function public.trg_dm_guard();

-- conversation list: one row per person, newest first
create or replace function public.dm_threads()
returns table (other_id uuid, name text, color text, last_body text, last_at timestamptz, last_from_me boolean, unread int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as other_id, *
    from public.direct_messages where auth.uid() in (sender_id, recipient_id)
  ), last as (
    select distinct on (other_id) other_id, body, created_at, sender_id = auth.uid() as from_me from mine order by other_id, created_at desc
  )
  select l.other_id, coalesce(p.display_name, 'Alguém'), coalesce(p.avatar_color, 'lime'), l.body, l.created_at, l.from_me,
         (select count(*)::int from mine m where m.other_id = l.other_id and m.recipient_id = auth.uid() and m.read_at is null)
  from last l left join public.profiles p on p.id = l.other_id
  order by l.created_at desc
$$;
revoke all on function public.dm_threads() from public, anon;
grant execute on function public.dm_threads() to authenticated;

-- people you can message (share at least one community)
create or replace function public.dm_contacts()
returns table (user_id uuid, name text, color text)
language sql stable security definer set search_path = '' as $$
  select distinct y.user_id, coalesce(p.display_name, 'Alguém'), coalesce(p.avatar_color, 'lime')
  from public.group_members x
  join public.group_members y on y.group_id = x.group_id and y.user_id <> x.user_id
  left join public.profiles p on p.id = y.user_id
  where x.user_id = auth.uid()
  order by 2
$$;
revoke all on function public.dm_contacts() from public, anon;
grant execute on function public.dm_contacts() to authenticated;

create or replace function public.dm_mark_read(p_other uuid)
returns void language sql security definer set search_path = '' as $$
  update public.direct_messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null
$$;
revoke all on function public.dm_mark_read(uuid) from public, anon;
grant execute on function public.dm_mark_read(uuid) to authenticated;

create or replace function public.dm_unread_count()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.direct_messages where recipient_id = auth.uid() and read_at is null
$$;
revoke all on function public.dm_unread_count() from public, anon;
grant execute on function public.dm_unread_count() to authenticated;

-- push: new message → recipient
create or replace function public.trg_push_dm() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push_send(array[new.recipient_id], new.sender_id,
    '💬 ' || public.display_name_of(new.sender_id), new.body, '/messages/' || new.sender_id, 'dm-' || new.sender_id);
  return new;
end $$;
revoke execute on function public.trg_push_dm() from public, anon, authenticated;
drop trigger if exists push_dm on public.direct_messages;
create trigger push_dm after insert on public.direct_messages for each row execute function public.trg_push_dm();

-- live updates
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;
alter table public.direct_messages replica identity full;

-- account deletion also removes DMs (cascade on auth.users handles hard deletes; scrubbed accounts lose theirs here)
do $$
declare def text := pg_get_functiondef('public.delete_my_account()'::regprocedure);
begin
  if position('direct_messages' in def) = 0 then
    execute replace(def, 'delete from public.push_subscriptions where user_id = uid;',
      'delete from public.push_subscriptions where user_id = uid;' || chr(10) || '  delete from public.direct_messages where uid in (sender_id, recipient_id);');
  end if;
end $$;
