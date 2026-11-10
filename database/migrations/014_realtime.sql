-- AFTERHOURS — live updates (Supabase Realtime). Run once after 013. Safe to re-run.
-- Realtime respects RLS: each client only receives changes for rows it can read.
do $$
declare t text;
begin
  foreach t in array array[
    'posts','post_media','post_reactions','post_comments','poll_votes',
    'events','event_rsvps','game_calls','game_call_players',
    'expenses','expense_shares','settlements','profiles','group_members'
  ] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
