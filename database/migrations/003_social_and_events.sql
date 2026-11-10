-- AFTERHOURS v0.3 — social features, private media and events
-- Run once in Supabase SQL Editor AFTER the v0.2 schema.

alter table public.posts add column if not exists category text not null default 'Random';

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx on public.post_comments(post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists post_comments_read on public.post_comments;
create policy post_comments_read on public.post_comments for select to authenticated using (public.is_group_member(group_id));
drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments for insert to authenticated with check (
  user_id = (select auth.uid()) and public.is_group_member(group_id)
  and exists (select 1 from public.posts p where p.id = post_comments.post_id and p.group_id = post_comments.group_id)
);
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default '🔥' check (length(reaction) <= 8),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions(post_id);
alter table public.post_reactions enable row level security;
drop policy if exists post_reactions_read on public.post_reactions;
create policy post_reactions_read on public.post_reactions for select to authenticated using (public.is_group_member(group_id));
drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions for insert to authenticated with check (
  user_id = (select auth.uid()) and public.is_group_member(group_id)
  and exists (select 1 from public.posts p where p.id = post_reactions.post_id and p.group_id = post_reactions.group_id)
);
drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default now()
);
alter table public.post_media add column if not exists game_title text;
create index if not exists post_media_post_idx on public.post_media(post_id);
alter table public.post_media enable row level security;
drop policy if exists post_media_read on public.post_media;
create policy post_media_read on public.post_media for select to authenticated using (public.is_group_member(group_id));
drop policy if exists post_media_insert on public.post_media;
create policy post_media_insert on public.post_media for insert to authenticated with check (
  public.is_group_member(group_id)
  and exists (select 1 from public.posts p where p.id = post_media.post_id and p.group_id = post_media.group_id and p.author_id = (select auth.uid()))
);
drop policy if exists post_media_delete on public.post_media;
create policy post_media_delete on public.post_media for delete to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 104857600, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 104857600, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_media_read on storage.objects;
create policy community_media_read on storage.objects for select to authenticated using (
  bucket_id = 'community-media' and public.is_group_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists community_media_insert on storage.objects;
create policy community_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_group_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists community_media_delete on storage.objects;
create policy community_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_group_member(((storage.foldername(name))[1])::uuid)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 100),
  description text check (description is null or length(description) <= 1000),
  location text check (location is null or length(location) <= 160),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists events_group_start_idx on public.events(group_id, starts_at);
alter table public.events enable row level security;
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (public.is_group_member(group_id));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (created_by = (select auth.uid()) and public.is_group_member(group_id));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated using (created_by = (select auth.uid()) and public.is_group_member(group_id)) with check (created_by = (select auth.uid()) and public.is_group_member(group_id));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (created_by = (select auth.uid()));

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going','maybe','declined')),
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
alter table public.event_rsvps enable row level security;
drop policy if exists event_rsvps_read on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and public.is_group_member(e.group_id))
);
drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and public.is_group_member(e.group_id))
);
drop policy if exists event_rsvps_update on public.event_rsvps;
create policy event_rsvps_update on public.event_rsvps for update to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and public.is_group_member(e.group_id))) with check (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and public.is_group_member(e.group_id)));
drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()));
