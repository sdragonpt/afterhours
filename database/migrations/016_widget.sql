-- AFTERHOURS — iPhone home-screen widget (Scriptable). Run once after 015. Safe to re-run.
-- Each user gets a personal secret token tied to one community. The widget calls
-- /api/widget?t=<token>, which reads widget_data(token): next plans, open lobbies, own balance.

create table if not exists public.widget_tokens (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.widget_tokens enable row level security;
drop policy if exists widget_tokens_own on public.widget_tokens;
create policy widget_tokens_own on public.widget_tokens for select to authenticated using (user_id = (select auth.uid()));

-- create/refresh my token for a community (p_rotate = new secret)
create or replace function public.widget_token(p_group uuid, p_rotate boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  if auth.uid() is null or not public.is_group_member(p_group) then raise exception 'Not a member of this community'; end if;
  insert into public.widget_tokens(user_id, group_id) values (auth.uid(), p_group)
  on conflict (user_id) do update
    set group_id = excluded.group_id,
        token = case when p_rotate then gen_random_uuid() else public.widget_tokens.token end
  returning token into t;
  return t;
end $$;
revoke all on function public.widget_token(uuid, boolean) from public, anon;
grant execute on function public.widget_token(uuid, boolean) to authenticated;

create or replace function public.widget_data(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.widget_tokens%rowtype; bal numeric; owes jsonb;
begin
  select * into w from public.widget_tokens where token = p_token;
  if w.user_id is null or not exists (select 1 from public.group_members where group_id = w.group_id and user_id = w.user_id) then return null; end if;

  -- my net balance (same rules as the app)
  select coalesce(sum(delta), 0) into bal from (
    select amount as delta from public.expenses where group_id = w.group_id and paid_by = w.user_id
    union all select -s.amount_owed from public.expense_shares s join public.expenses e on e.id = s.expense_id where e.group_id = w.group_id and s.user_id = w.user_id
    union all select amount from public.settlements where group_id = w.group_id and payer_id = w.user_id
    union all select -amount from public.settlements where group_id = w.group_id and payee_id = w.user_id
  ) m;

  return jsonb_build_object(
    'group', (select name from public.groups where id = w.group_id),
    'me', public.display_name_of(w.user_id),
    'balance', round(bal, 2),
    'plans', coalesce((
      select jsonb_agg(p order by p->>'starts_at') from (
        select jsonb_build_object(
          'title', e.title, 'starts_at', e.starts_at, 'location', e.location,
          'going', (select count(*) from public.event_rsvps r where r.event_id = e.id and r.status = 'going'),
          'me_going', exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = w.user_id and r.status = 'going')
        ) as p
        from public.events e
        where e.group_id = w.group_id and e.starts_at > now() - interval '2 hours'
        order by e.starts_at limit 3
      ) x), '[]'::jsonb),
    'lobbies', coalesce((
      select jsonb_agg(l order by l->>'starts_at') from (
        select jsonb_build_object(
          'game', c.game, 'starts_at', c.starts_at, 'slots', c.slots,
          'players', (select count(*) from public.game_call_players p where p.call_id = c.id)
        ) as l
        from public.game_calls c
        where c.group_id = w.group_id and c.starts_at > now() - interval '2 hours'
        order by c.starts_at limit 3
      ) y), '[]'::jsonb),
    'updated_at', now()
  );
end $$;
revoke all on function public.widget_data(uuid) from public;
grant execute on function public.widget_data(uuid) to anon;
