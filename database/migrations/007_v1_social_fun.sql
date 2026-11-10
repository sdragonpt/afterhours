-- AFTERHOURS v1.0 — vibes, multi-emoji reactions, polls, "Quem joga?" lobbies.
-- Run once after 006. Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Profiles: avatar colour + "vibe" (status that expires)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_color text not null default 'lime'
  check (avatar_color in ('lime','coral','sky','pink','sun','mint'));
alter table public.profiles add column if not exists vibe text
  check (vibe is null or vibe in ('sair','jogar','casa','ocupado','fome'));
alter table public.profiles add column if not exists vibe_note text check (vibe_note is null or length(vibe_note) <= 60);
alter table public.profiles add column if not exists vibe_until timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 2. Reactions: several different emoji per person per post
-- ─────────────────────────────────────────────────────────────
alter table public.post_reactions drop constraint if exists post_reactions_post_id_user_id_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'post_reactions_unique_emoji') then
    alter table public.post_reactions add constraint post_reactions_unique_emoji unique (post_id, user_id, reaction);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Polls attached to a post
-- ─────────────────────────────────────────────────────────────
create table if not exists public.post_polls (
  post_id uuid primary key references public.posts(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  options text[] not null check (cardinality(options) between 2 and 6)
);
alter table public.post_polls enable row level security;
drop policy if exists post_polls_read on public.post_polls;
create policy post_polls_read on public.post_polls for select to authenticated using (public.is_group_member(group_id));
drop policy if exists post_polls_insert on public.post_polls;
create policy post_polls_insert on public.post_polls for insert to authenticated with check (
  public.is_group_member(group_id)
  and exists (select 1 from public.posts p where p.id = post_polls.post_id and p.group_id = post_polls.group_id and p.author_id = (select auth.uid()))
);

create table if not exists public.poll_votes (
  post_id uuid not null references public.post_polls(post_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index int not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes for select to authenticated using (
  exists (select 1 from public.post_polls pp where pp.post_id = poll_votes.post_id and public.is_group_member(pp.group_id))
);
drop policy if exists poll_votes_write on public.poll_votes;
create policy poll_votes_write on public.poll_votes for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.post_polls pp where pp.post_id = poll_votes.post_id and public.is_group_member(pp.group_id) and poll_votes.option_index < cardinality(pp.options))
);
drop policy if exists poll_votes_update on public.poll_votes;
create policy poll_votes_update on public.poll_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.post_polls pp where pp.post_id = poll_votes.post_id and poll_votes.option_index < cardinality(pp.options)));
drop policy if exists poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes for delete to authenticated using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 4. "Quem joga?" lobbies
-- ─────────────────────────────────────────────────────────────
create table if not exists public.game_calls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game text not null check (length(trim(game)) between 1 and 60),
  starts_at timestamptz not null,
  slots int not null default 5 check (slots between 2 and 20),
  created_at timestamptz not null default now()
);
create index if not exists game_calls_group_start_idx on public.game_calls(group_id, starts_at);
alter table public.game_calls enable row level security;
drop policy if exists game_calls_read on public.game_calls;
create policy game_calls_read on public.game_calls for select to authenticated using (public.is_group_member(group_id));
drop policy if exists game_calls_insert on public.game_calls;
create policy game_calls_insert on public.game_calls for insert to authenticated with check (created_by = (select auth.uid()) and public.is_group_member(group_id));
drop policy if exists game_calls_delete on public.game_calls;
create policy game_calls_delete on public.game_calls for delete to authenticated using (created_by = (select auth.uid()));

create table if not exists public.game_call_players (
  call_id uuid not null references public.game_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
alter table public.game_call_players enable row level security;
drop policy if exists game_call_players_read on public.game_call_players;
create policy game_call_players_read on public.game_call_players for select to authenticated using (
  exists (select 1 from public.game_calls c where c.id = call_id and public.is_group_member(c.group_id))
);
drop policy if exists game_call_players_join on public.game_call_players;
create policy game_call_players_join on public.game_call_players for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.game_calls c where c.id = call_id and public.is_group_member(c.group_id)
              and (select count(*) from public.game_call_players p where p.call_id = c.id) < c.slots)
);
drop policy if exists game_call_players_leave on public.game_call_players;
create policy game_call_players_leave on public.game_call_players for delete to authenticated using (user_id = (select auth.uid()));

-- Creator auto-joins their own lobby + Discord ping
create or replace function public.trg_game_call_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.game_call_players(call_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  perform public.discord_notify(
    new.group_id,
    '🎮 Quem joga ' || new.game || '?',
    public.display_name_of(new.created_by) || ' abriu lobby para as **' ||
      to_char(new.starts_at at time zone 'Europe/Lisbon', 'HH24:MI') || '** (' || new.slots || ' lugares). Entra na app 👇',
    '/gaming', 6081791);
  return new;
end $$;
drop trigger if exists game_call_created on public.game_calls;
create trigger game_call_created after insert on public.game_calls for each row execute function public.trg_game_call_created();
revoke execute on function public.trg_game_call_created() from public, anon, authenticated;
