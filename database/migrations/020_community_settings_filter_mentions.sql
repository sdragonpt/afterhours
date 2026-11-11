-- AFTERHOURS — per-community settings, optional language filter, @mentions. Run once after 019. Safe to re-run.
--
-- groups.features: which tabs a community uses. "Hoje" (feed) is always on.
-- groups.filter_messages: when on, swear words in posts and comments are masked (****)
--   by a trigger, so it applies to every client, not just the app.
-- posts.mentions / post_comments.mentions: user ids tagged with @. The trigger keeps only
--   members of that community and notifies them.

alter table public.groups add column if not exists features jsonb not null default '{"plans": true, "gaming": true, "tab": true}'::jsonb;
alter table public.groups add column if not exists filter_messages boolean not null default false;
alter table public.posts add column if not exists mentions uuid[] not null default '{}';
alter table public.post_comments add column if not exists mentions uuid[] not null default '{}';

-- ── create / edit ────────────────────────────────────────────
create or replace function private.clean_features(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'plans',  coalesce((p->>'plans')::boolean, true),
    'gaming', coalesce((p->>'gaming')::boolean, true),
    'tab',    coalesce((p->>'tab')::boolean, true))
$$;

drop function if exists public.create_group(text);
create or replace function public.create_group(p_name text, p_features jsonb default null, p_filter boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) not between 1 and 60 then raise exception 'Invalid group name'; end if;
  insert into public.groups(name, owner_id, features, filter_messages)
  values (trim(p_name), auth.uid(), private.clean_features(coalesce(p_features, '{}')), coalesce(p_filter, false))
  returning id into gid;
  insert into public.group_members(group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;
revoke all on function public.create_group(text, jsonb, boolean) from public, anon;
grant execute on function public.create_group(text, jsonb, boolean) to authenticated;

create or replace function public.update_group(p_group uuid, p_name text, p_features jsonb, p_filter boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Only the owner can edit this community';
  end if;
  if length(trim(p_name)) not between 1 and 60 then raise exception 'Invalid group name'; end if;
  update public.groups
     set name = trim(p_name), features = private.clean_features(coalesce(p_features, '{}')), filter_messages = coalesce(p_filter, false)
   where id = p_group;
end $$;
revoke all on function public.update_group(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.update_group(uuid, text, jsonb, boolean) to authenticated;

-- ── language filter ──────────────────────────────────────────
-- PT-PT, PT-BR and EN. Patterns are matched as whole words, case-insensitive.
create table if not exists private.bad_words (pattern text primary key);
revoke all on private.bad_words from public, anon, authenticated;
insert into private.bad_words(pattern) values
  ('caralh[oa]s?'), ('crl'), ('foda[- ]?se'), ('fod[aei]\w*'), ('fudid[oa]s?'), ('putas?'), ('put[ao]\s+que\s+pariu'), ('pqp'),
  ('merdas?'), ('merdoso'), ('conas?'), ('piças?'), ('cabr[aã]o'), ('cabr[oõ]es'), ('filh[oa]s?\s+da\s+puta'), ('fdp'),
  ('porra'), ('ot[aá]ri[oa]s?'), ('paneleir[oa]s?'), ('panascas?'), ('maricas'), ('viad[oa]s?'), ('bucetas?'), ('arrombad[oa]s?'),
  ('cornos?'), ('cornud[oa]s?'), ('vadias?'), ('badalhoc[oa]s?'), ('punhet\w*'), ('chupa[- ]?mos'), ('cuz[aã]o'), ('desgraçad[oa]s?'),
  ('fuck\w*'), ('motherfuck\w*'), ('shit\w*'), ('bitch\w*'), ('cunts?'), ('assholes?'), ('dicks?'), ('bastards?'), ('sluts?'),
  ('whores?'), ('nigg\w*'), ('faggots?'), ('fags?'), ('retards?'), ('wtf'), ('stfu')
on conflict do nothing;

create or replace function private.censor(t text) returns text language plpgsql stable set search_path = '' as $$
declare w text; m text; out text := t;
begin
  if t is null or t = '' then return t; end if;
  for w in select pattern from private.bad_words loop
    -- mask each match with the same number of asterisks, keeping the first letter
    for m in select distinct (regexp_matches(out, '\m(' || w || ')\M', 'gi'))[1] loop
      out := replace(out, m, left(m, 1) || repeat('*', greatest(char_length(m) - 1, 2)));
    end loop;
  end loop;
  return out;
end $$;
revoke all on function private.censor(text) from public, anon, authenticated;

-- ── before insert/update: filter + clean mentions ────────────
create or replace function public.trg_post_text() returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype; author uuid;
begin
  select * into g from public.groups where id = new.group_id;
  if tg_table_name = 'posts' then author := new.author_id; else author := new.user_id; end if;
  if g.filter_messages then new.body := private.censor(new.body); end if;
  -- only members of this community, never yourself, at most 20
  select coalesce(array_agg(distinct m), '{}') into new.mentions
  from (select unnest(coalesce(new.mentions, '{}')) as m limit 50) x
  where m is distinct from author
    and exists (select 1 from public.group_members gm where gm.group_id = new.group_id and gm.user_id = x.m);
  if cardinality(new.mentions) > 20 then new.mentions := new.mentions[1:20]; end if;
  return new;
end $$;
revoke execute on function public.trg_post_text() from public, anon, authenticated;
drop trigger if exists post_text on public.posts;
create trigger post_text before insert or update of body, mentions on public.posts for each row execute function public.trg_post_text();
drop trigger if exists comment_text on public.post_comments;
create trigger comment_text before insert or update of body, mentions on public.post_comments for each row execute function public.trg_post_text();

-- poll options and plan titles follow the same filter
create or replace function public.trg_title_filter() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.groups where id = new.group_id and filter_messages) then
    if tg_table_name = 'events' then new.title := private.censor(new.title); new.description := private.censor(new.description);
    elsif tg_table_name = 'post_polls' then new.options := (select array_agg(private.censor(o) order by i) from unnest(new.options) with ordinality as u(o, i));
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.trg_title_filter() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'description') then
    drop trigger if exists event_filter on public.events;
    create trigger event_filter before insert or update on public.events for each row execute function public.trg_title_filter();
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'post_polls' and column_name = 'options') then
    drop trigger if exists poll_filter on public.post_polls;
    create trigger poll_filter before insert or update on public.post_polls for each row execute function public.trg_title_filter();
  end if;
end $$;

-- ── mention notifications ────────────────────────────────────
create or replace function public.trg_push_mention() returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; who uuid[]; post_author uuid;
begin
  if cardinality(new.mentions) = 0 then return new; end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(m), '{}') into who from unnest(new.mentions) m where not (m = any(old.mentions));
  else who := new.mentions; end if;
  if tg_table_name = 'posts' then
    actor := new.author_id;
  else
    actor := new.user_id;
    select author_id into post_author from public.posts where id = new.post_id;
    who := array_remove(who, post_author); -- already notified by the comment push
  end if;
  if cardinality(who) = 0 then return new; end if;
  perform private.push_send(who, actor,
    '📣 ' || public.display_name_of(actor) || ' mencionou-te',
    new.body, '/', 'mention-' || new.id);
  return new;
end $$;
revoke execute on function public.trg_push_mention() from public, anon, authenticated;
drop trigger if exists push_mention on public.posts;
create trigger push_mention after insert or update of mentions on public.posts for each row execute function public.trg_push_mention();
drop trigger if exists push_mention on public.post_comments;
create trigger push_mention after insert or update of mentions on public.post_comments for each row execute function public.trg_push_mention();
