-- AFTERHOURS v0.5 — The Tab v2 + Discord notifications
-- Run once in Supabase > SQL Editor, AFTER migrations 003 and 004.
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. THE TAB v2
--    • any member can be the payer ("o João pagou o jantar")
--    • who created the row can delete it (mistakes happen)
--    • settlements can be recorded by either side ("o Miguel pagou-me")
-- ─────────────────────────────────────────────────────────────
alter table public.expenses    add column if not exists created_by uuid references auth.users(id);
alter table public.settlements add column if not exists created_by uuid references auth.users(id);
update public.expenses    set created_by = paid_by  where created_by is null;
update public.settlements set created_by = payer_id where created_by is null;
alter table public.expenses    alter column created_by set default auth.uid();
alter table public.settlements alter column created_by set default auth.uid();

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (
  public.is_group_member(group_id) and (created_by = (select auth.uid()) or paid_by = (select auth.uid()))
);

drop policy if exists settlements_member_insert on public.settlements;
create policy settlements_member_insert on public.settlements for insert to authenticated with check (
  created_by = (select auth.uid())
  and ((select auth.uid()) in (payer_id, payee_id))
  and public.is_group_member(group_id)
  and exists(select 1 from public.group_members gm where gm.group_id = settlements.group_id and gm.user_id = settlements.payer_id)
  and exists(select 1 from public.group_members gm where gm.group_id = settlements.group_id and gm.user_id = settlements.payee_id)
);
drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements for delete to authenticated using (
  public.is_group_member(group_id) and created_by = (select auth.uid())
);

-- New create_expense: payer can be any member; split is equal, cents distributed fairly.
drop function if exists public.create_expense(uuid, text, numeric, uuid[]);
create or replace function public.create_expense(
  p_group uuid,
  p_description text,
  p_amount numeric,
  p_participants uuid[],
  p_paid_by uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payer uuid := coalesce(p_paid_by, auth.uid());
  new_expense uuid;
  n integer;
  total_cents bigint;
  base_cents bigint;
  extra integer;
  participant uuid;
  i integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_group_member(p_group) then raise exception 'Not a member of this community'; end if;
  if p_description is null or length(trim(p_description)) not between 1 and 120 then raise exception 'A descrição deve ter entre 1 e 120 caracteres'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'Valor inválido'; end if;
  if p_participants is null or cardinality(p_participants) < 1 then raise exception 'Escolhe pelo menos uma pessoa'; end if;
  if cardinality(p_participants) <> (select count(distinct x) from unnest(p_participants) x) then raise exception 'Participantes duplicados'; end if;
  if not exists(select 1 from public.group_members where group_id = p_group and user_id = payer) then raise exception 'Quem pagou tem de pertencer à comunidade'; end if;
  if exists(select 1 from unnest(p_participants) x where not exists(select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = x)) then
    raise exception 'Todos os participantes têm de pertencer à comunidade';
  end if;

  n := cardinality(p_participants);
  total_cents := round(p_amount * 100);
  base_cents := total_cents / n;
  extra := (total_cents - base_cents * n)::integer; -- leftover cents, 1 each to the first participants

  insert into public.expenses(group_id, paid_by, created_by, description, amount)
  values (p_group, payer, auth.uid(), trim(p_description), total_cents / 100.0)
  returning id into new_expense;

  foreach participant in array p_participants loop
    i := i + 1;
    insert into public.expense_shares(expense_id, user_id, amount_owed)
    values (new_expense, participant, (base_cents + case when i <= extra then 1 else 0 end) / 100.0);
  end loop;
  return new_expense;
end $$;

revoke all on function public.create_expense(uuid, text, numeric, uuid[], uuid) from public;
grant execute on function public.create_expense(uuid, text, numeric, uuid[], uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. DISCORD NOTIFICATIONS (webhook, no bot needed)
--    The community owner pastes a Discord channel webhook URL in the app.
--    Postgres posts to Discord directly via pg_net when something happens.
--    The URL is only readable by the owner.
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_net;

create table if not exists public.group_integrations (
  group_id uuid primary key references public.groups(id) on delete cascade,
  discord_webhook_url text check (
    discord_webhook_url is null
    or discord_webhook_url ~ '^https://(canary\.|ptb\.)?(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
  ),
  app_url text check (app_url is null or app_url ~ '^https?://[^\s]+$'),
  updated_at timestamptz not null default now()
);
alter table public.group_integrations enable row level security;
drop policy if exists integrations_owner_all on public.group_integrations;
create policy integrations_owner_all on public.group_integrations for all to authenticated
  using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

create or replace function public.discord_notify(p_group uuid, p_title text, p_description text, p_path text, p_color int default 10388479)
returns void language plpgsql security definer set search_path = '' as $$
declare cfg public.group_integrations%rowtype;
begin
  select * into cfg from public.group_integrations where group_id = p_group;
  if cfg.discord_webhook_url is null then return; end if;
  perform net.http_post(
    url := cfg.discord_webhook_url,
    body := jsonb_build_object(
      'username', 'Afterhours',
      'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'title', left(p_title, 250),
        'description', left(p_description, 1000),
        'url', case when cfg.app_url is not null then rtrim(cfg.app_url, '/') || p_path end,
        'color', p_color
      )))
    )
  );
exception when others then
  -- never block the user's action because Discord is down
  raise warning 'discord_notify failed: %', sqlerrm;
end $$;
revoke all on function public.discord_notify(uuid, text, text, text, int) from public, authenticated, anon;

create or replace function public.display_name_of(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select display_name from public.profiles where id = p_user), 'Alguém')
$$;
revoke all on function public.display_name_of(uuid) from public, anon, authenticated;

-- New plan
create or replace function public.trg_event_discord() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.discord_notify(
    new.group_id,
    '📅 ' || new.title,
    public.display_name_of(new.created_by) || ' criou um plano para **' ||
      to_char(new.starts_at at time zone 'Europe/Lisbon', 'DD/MM "às" HH24:MI') || '**' ||
      coalesce(E'\n📍 ' || new.location, '') ||
      E'\nVais? Responde na app 👇',
    '/plans', 6333946);
  return new;
end $$;
drop trigger if exists event_discord on public.events;
create trigger event_discord after insert on public.events for each row execute function public.trg_event_discord();

-- New clip (videos only — photos would be spammy)
create or replace function public.trg_clip_discord() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.posts%rowtype;
begin
  if new.media_type <> 'video' then return new; end if;
  select * into p from public.posts where id = new.post_id;
  perform public.discord_notify(
    new.group_id,
    '🎮 Novo clip' || coalesce(' — ' || new.game_title, ''),
    public.display_name_of(p.author_id) || ': ' || coalesce(p.body, ''),
    '/gaming', 10388479);
  return new;
end $$;
drop trigger if exists clip_discord on public.post_media;
create trigger clip_discord after insert on public.post_media for each row execute function public.trg_clip_discord();

-- New expense
create or replace function public.trg_expense_discord() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.discord_notify(
    new.group_id,
    '💸 ' || new.description || ' — ' || to_char(new.amount, 'FM999G990D00') || ' €',
    public.display_name_of(new.paid_by) || ' pagou. Vê quanto deves no The Tab.',
    '/tab', 5625504);
  return new;
end $$;
drop trigger if exists expense_discord on public.expenses;
create trigger expense_discord after insert on public.expenses for each row execute function public.trg_expense_discord();

-- Settlement
create or replace function public.trg_settlement_discord() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.discord_notify(
    new.group_id,
    '✅ Contas acertadas',
    public.display_name_of(new.payer_id) || ' pagou ' || to_char(new.amount, 'FM999G990D00') || ' € a ' || public.display_name_of(new.payee_id),
    '/tab', 5625504);
  return new;
end $$;
drop trigger if exists settlement_discord on public.settlements;
create trigger settlement_discord after insert on public.settlements for each row execute function public.trg_settlement_discord();

-- Manual "lembrete" from The Tab: posts who is in the red to Discord. Any member can trigger it.
create or replace function public.discord_send_tab_reminder(p_group uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare lines text;
begin
  if not public.is_group_member(p_group) then raise exception 'Not a member of this community'; end if;
  if not exists(select 1 from public.group_integrations where group_id = p_group and discord_webhook_url is not null) then return false; end if;

  with movements as (
    select paid_by as uid, amount as delta from public.expenses where group_id = p_group
    union all
    select s.user_id, -s.amount_owed from public.expense_shares s join public.expenses e on e.id = s.expense_id where e.group_id = p_group
    union all
    select payer_id, amount from public.settlements where group_id = p_group
    union all
    select payee_id, -amount from public.settlements where group_id = p_group
  ), balances as (
    select uid, sum(delta) as bal from movements group by uid
  )
  select string_agg(
    case when bal < 0 then '🔴 **' || public.display_name_of(uid) || '** deve ' || to_char(-bal, 'FM999G990D00') || ' €'
         else '🟢 **' || public.display_name_of(uid) || '** tem a receber ' || to_char(bal, 'FM999G990D00') || ' €' end,
    E'\n' order by bal)
  into lines
  from balances where abs(bal) >= 0.01;

  perform public.discord_notify(p_group, '🧾 Lembrete do The Tab', coalesce(lines, 'Está tudo acertado. Milagre. 🙏'), '/tab', 16763904);
  return true;
end $$;
revoke all on function public.discord_send_tab_reminder(uuid) from public, anon;
grant execute on function public.discord_send_tab_reminder(uuid) to authenticated;
