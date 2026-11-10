-- AFTERHOURS — lobbies last at most 3h after their start time, then delete themselves.
-- Run once after 017. Safe to re-run.
create extension if not exists pg_cron;

create or replace function public.purge_old_lobbies()
returns void language sql security definer set search_path = '' as $$
  delete from public.game_calls where starts_at < now() - interval '3 hours'
$$;
revoke all on function public.purge_old_lobbies() from public, anon, authenticated;

-- every 15 minutes
select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-lobbies';
select cron.schedule('purge-old-lobbies', '*/15 * * * *', $$select public.purge_old_lobbies()$$);

-- also clean up whenever someone opens a new lobby (belt and braces)
create or replace function public.trg_game_call_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.game_call_players(call_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  perform public.purge_old_lobbies();
  return new;
end $$;
revoke execute on function public.trg_game_call_created() from public, anon, authenticated;

-- a lobby can't be scheduled in the past or more than 7 days ahead
alter table public.game_calls drop constraint if exists game_calls_start_window;
alter table public.game_calls add constraint game_calls_start_window
  check (starts_at < created_at + interval '7 days' and starts_at > created_at - interval '1 hour') not valid;

select public.purge_old_lobbies();

-- widget: show lobbies for the same 3h window
do $$
declare def text := pg_get_functiondef('public.widget_data(uuid)'::regprocedure);
begin
  execute replace(def, 'c.starts_at > now() - interval ''2 hours''', 'c.starts_at > now() - interval ''3 hours''');
end $$;
