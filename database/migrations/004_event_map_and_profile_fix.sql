-- AFTERHOURS v0.4: event map coordinates.
-- Run once in Supabase SQL Editor after migration 003.

alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_coordinates_pair_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_coordinates_pair_check
      check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null));
  end if;
end $$;

create index if not exists events_coordinates_idx
  on public.events (latitude, longitude)
  where latitude is not null and longitude is not null;

-- Ensure the signed-in user can create their own profile row if the auth trigger
-- did not create it. Existing profile RLS policies already allow self insert/update.
