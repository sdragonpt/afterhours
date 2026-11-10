-- AFTERHOURS — calendar feed (iPhone/Google Calendar subscription + "Pôr na agenda")
-- Run once after 007. Safe to re-run.
--
-- Each community gets an unguessable calendar token. Calendar apps can't log in,
-- so the feed is read with that secret token (like Google Calendar's "secret address").
-- Members can see the token (it's on their own group row); anyone without it sees nothing.

alter table public.groups add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists groups_calendar_token_idx on public.groups(calendar_token);

-- Plans of the community behind a token (from 30 days ago onwards).
-- Optional p_event narrows it to one plan (used by "Pôr na agenda").
create or replace function public.calendar_feed(p_token uuid, p_event uuid default null)
returns table (id uuid, title text, description text, location text, starts_at timestamptz, created_at timestamptz, group_name text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.description, e.location, e.starts_at, e.created_at, g.name
  from public.groups g
  left join public.events e on e.group_id = g.id
    and (p_event is null or e.id = p_event)
    and e.starts_at > now() - interval '30 days'
  where g.calendar_token = p_token
  order by e.starts_at nulls first
  limit 300
$$;
revoke all on function public.calendar_feed(uuid, uuid) from public;
grant execute on function public.calendar_feed(uuid, uuid) to anon, authenticated;

-- Owner can rotate the token if the link leaks.
create or replace function public.rotate_calendar_token(p_group uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t uuid := gen_random_uuid();
begin
  if not public.is_group_owner(p_group) then raise exception 'Only owners can reset the calendar link'; end if;
  update public.groups set calendar_token = t where id = p_group;
  return t;
end $$;
revoke all on function public.rotate_calendar_token(uuid) from public, anon;
grant execute on function public.rotate_calendar_token(uuid) to authenticated;
