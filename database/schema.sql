-- AFTERHOURS database schema (fresh project)
-- Run this entire file once in Supabase > SQL Editor.
create extension if not exists pgcrypto;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Membro'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Communities
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses int not null default 10 check(max_uses > 0),
  uses int not null default 0 check(uses >= 0),
  created_at timestamptz not null default now()
);

-- The Tab: expenses paid by one member and split between selected members.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  paid_by uuid not null references auth.users(id),
  description text not null check(length(trim(description)) between 1 and 120),
  amount numeric(12,2) not null check(amount > 0),
  created_at timestamptz not null default now()
);

create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount_owed numeric(12,2) not null check(amount_owed >= 0),
  unique(expense_id,user_id)
);

-- A settlement means payer_id paid payee_id to reduce an outstanding balance.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_id uuid not null references auth.users(id),
  payee_id uuid not null references auth.users(id),
  amount numeric(12,2) not null check(amount > 0),
  note text check(note is null or length(note) <= 120),
  created_at timestamptz not null default now(),
  check(payer_id <> payee_id)
);

create index group_members_user_idx on public.group_members(user_id);
create index posts_group_created_idx on public.posts(group_id, created_at desc);
create index group_invites_token_idx on public.group_invites(token);
create index expenses_group_created_idx on public.expenses(group_id, created_at desc);
create index expense_shares_user_idx on public.expense_shares(user_id);
create index settlements_group_created_idx on public.settlements(group_id, created_at desc);

-- Security helpers
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members where group_id=p_group and user_id=(select auth.uid()))
$$;

create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.groups where id=p_group and owner_id=(select auth.uid()))
$$;

revoke all on function public.is_group_member(uuid), public.is_group_owner(uuid) from public;
grant execute on function public.is_group_member(uuid), public.is_group_owner(uuid) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.group_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_shared_group_select on public.profiles for select to authenticated using (
  exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id=mine.group_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=profiles.id
  )
);
create policy profiles_self_insert on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create policy groups_member_read on public.groups for select to authenticated using (public.is_group_member(id));
create policy members_read on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy posts_read on public.posts for select to authenticated using (public.is_group_member(group_id));
create policy posts_create on public.posts for insert to authenticated with check (author_id=(select auth.uid()) and public.is_group_member(group_id));
create policy posts_delete on public.posts for delete to authenticated using (author_id=(select auth.uid()) and public.is_group_member(group_id));

create policy expenses_member_read on public.expenses for select to authenticated using (public.is_group_member(group_id));
create policy expense_shares_member_read on public.expense_shares for select to authenticated using (
  exists(select 1 from public.expenses e where e.id=expense_id and public.is_group_member(e.group_id))
);
create policy settlements_member_read on public.settlements for select to authenticated using (public.is_group_member(group_id));
create policy settlements_member_insert on public.settlements for insert to authenticated with check (
  payer_id=(select auth.uid())
  and public.is_group_member(group_id)
  and exists(select 1 from public.group_members gm where gm.group_id=public.settlements.group_id and gm.user_id=public.settlements.payee_id)
);

-- Community creation and invitation management through validated RPCs only.
create or replace function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) not between 1 and 60 then raise exception 'Invalid group name'; end if;
  insert into public.groups(name,owner_id) values(trim(p_name),auth.uid()) returning id into gid;
  insert into public.group_members(group_id,user_id,role) values(gid,auth.uid(),'owner');
  return gid;
end $$;

create or replace function public.create_group_invite(p_group uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or not public.is_group_owner(p_group) then raise exception 'Only owners can create invites'; end if;
  insert into public.group_invites(group_id,created_by) values(p_group,auth.uid()) returning token into result;
  return result;
end $$;

create or replace function public.join_group_by_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite_row public.group_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invite_row from public.group_invites where token=p_token for update;
  if not found or invite_row.expires_at <= now() or invite_row.uses >= invite_row.max_uses then raise exception 'Invalid or expired invite'; end if;
  if not exists(select 1 from public.group_members where group_id=invite_row.group_id and user_id=auth.uid()) then
    insert into public.group_members(group_id,user_id) values(invite_row.group_id,auth.uid());
    update public.group_invites set uses=uses+1 where id=invite_row.id;
  end if;
  return invite_row.group_id;
end $$;

-- Atomically create an expense and split it equally between selected group members.
-- p_participants must include the person who paid and at least one participant.
create or replace function public.create_expense(
  p_group uuid,
  p_description text,
  p_amount numeric,
  p_participants uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_expense uuid;
  participant_count integer;
  base_share numeric(12,2);
  allocated numeric(12,2) := 0;
  participant uuid;
  i integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_group_member(p_group) then raise exception 'Not a member of this community'; end if;
  if p_description is null or length(trim(p_description)) not between 1 and 120 then raise exception 'Description must contain 1 to 120 characters'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'Invalid amount'; end if;
  if p_participants is null or cardinality(p_participants) < 1 then raise exception 'Select at least one participant'; end if;
  if cardinality(p_participants) <> (select count(distinct x) from unnest(p_participants) x) then raise exception 'Duplicate participants'; end if;
  if not (auth.uid() = any(p_participants)) then raise exception 'The payer must be included in the split'; end if;
  if exists(select 1 from unnest(p_participants) x where not exists(select 1 from public.group_members gm where gm.group_id=p_group and gm.user_id=x)) then
    raise exception 'All participants must belong to this community';
  end if;

  participant_count := cardinality(p_participants);
  base_share := floor((p_amount / participant_count) * 100) / 100;
  insert into public.expenses(group_id,paid_by,description,amount)
  values(p_group,auth.uid(),trim(p_description),round(p_amount,2)) returning id into new_expense;

  foreach participant in array p_participants loop
    i := i + 1;
    if i = participant_count then
      insert into public.expense_shares(expense_id,user_id,amount_owed)
      values(new_expense,participant,round(p_amount,2)-allocated);
    else
      insert into public.expense_shares(expense_id,user_id,amount_owed)
      values(new_expense,participant,base_share);
      allocated := allocated + base_share;
    end if;
  end loop;
  return new_expense;
end $$;

revoke all on function public.create_group(text), public.create_group_invite(uuid), public.join_group_by_invite(uuid), public.create_expense(uuid,text,numeric,uuid[]) from public;
grant execute on function public.create_group(text), public.create_group_invite(uuid), public.join_group_by_invite(uuid), public.create_expense(uuid,text,numeric,uuid[]) to authenticated;
