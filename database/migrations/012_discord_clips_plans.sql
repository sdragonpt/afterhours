-- AFTERHOURS — Discord: only clips + plans, video inline, nicer messages.
-- Run once after 011. Safe to re-run.
-- The signing secret is generated inside the DB by migration 013 (it never leaves Postgres).

create extension if not exists pgcrypto;

-- ── private secrets (no API access) ──────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_secrets (name text primary key, value text not null);
revoke all on private.app_secrets from public, anon, authenticated;

-- media Worker base URL (playback links are signed for Discord)
create table if not exists private.app_settings (name text primary key, value text not null);
revoke all on private.app_settings from public, anon, authenticated;

-- ── generic sender: adds name + avatar, posts any Discord payload ──
create or replace function public.discord_send(p_group uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare cfg public.group_integrations%rowtype;
begin
  select * into cfg from public.group_integrations where group_id = p_group;
  if cfg.discord_webhook_url is null then return; end if;
  perform net.http_post(
    url := cfg.discord_webhook_url,
    body := jsonb_strip_nulls(jsonb_build_object(
      'username', 'Afterhours',
      'avatar_url', case when cfg.app_url is not null then rtrim(cfg.app_url, '/') || '/discord-avatar.png' end,
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)
    )) || p_payload
  );
exception when others then
  raise warning 'discord_send failed: %', sqlerrm;
end $$;
revoke all on function public.discord_send(uuid, jsonb) from public, anon, authenticated;

-- signed, long-lived playback URL for an R2 clip (same HMAC as the media Worker)
create or replace function public.media_public_url(p_path text, p_days int default 365)
returns text language plpgsql stable security definer set search_path = '' as $$
declare base text; secret text; k text; ex bigint; sig text;
begin
  if p_path is null or left(p_path, 3) <> 'r2:' then return null; end if;
  select value into base from private.app_settings where name = 'media_url';
  select value into secret from private.app_secrets where name = 'media_signing_secret';
  if base is null or secret is null then return null; end if;
  k := substr(p_path, 4);
  ex := extract(epoch from now())::bigint + p_days * 86400;
  sig := rtrim(translate(encode(extensions.hmac(convert_to(k || ':' || ex, 'utf8'), convert_to(secret, 'utf8'), 'sha256'), 'base64'), '+/', '-_'), '=');
  return rtrim(base, '/') || '/m/' || k || '?exp=' || ex || '&sig=' || sig;
end $$;
revoke all on function public.media_public_url(text, int) from public, anon, authenticated;

-- ── stop: expenses, settlements, lobbies ─────────────────────
drop trigger if exists expense_discord on public.expenses;
drop trigger if exists settlement_discord on public.settlements;
create or replace function public.trg_game_call_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.game_call_players(call_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.trg_game_call_created() from public, anon, authenticated;

-- ── plans ────────────────────────────────────────────────────
create or replace function public.trg_event_discord() returns trigger language plpgsql security definer set search_path = '' as $$
declare app text; ts bigint := extract(epoch from new.starts_at)::bigint;
begin
  select rtrim(app_url, '/') into app from public.group_integrations where group_id = new.group_id;
  perform public.discord_send(new.group_id, jsonb_build_object(
    'content', 'Bora? 👀',
    'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'author', jsonb_build_object('name', 'Novo plano'),
      'title', left('📅 ' || new.title, 250),
      'url', case when app is not null then app || '/plans' end,
      'description', nullif(left(coalesce(new.description, ''), 600), ''),
      'color', 16734774, -- coral #FF5A36
      'fields', jsonb_build_array(
        jsonb_build_object('name', 'Quando', 'value', '<t:' || ts || ':F>' || E'\n' || '<t:' || ts || ':R>', 'inline', true),
        jsonb_build_object('name', 'Onde', 'value', coalesce(nullif(left(new.location, 200), ''), 'A combinar'), 'inline', true),
        jsonb_build_object('name', 'Lançado por', 'value', public.display_name_of(new.created_by), 'inline', true)
      ),
      'footer', jsonb_build_object('text', 'Responde na app: Tô dentro · Talvez · Não dá'),
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )))
  ));
  return new;
end $$;
drop trigger if exists event_discord on public.events;
create trigger event_discord after insert on public.events for each row execute function public.trg_event_discord();
revoke execute on function public.trg_event_discord() from public, anon, authenticated;

-- ── clips (video plays inline in Discord when stored on R2) ──
create or replace function public.trg_clip_discord() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.posts%rowtype; app text; video text; head text;
begin
  if new.media_type <> 'video' then return new; end if;
  select * into p from public.posts where id = new.post_id;
  select rtrim(app_url, '/') into app from public.group_integrations where group_id = new.group_id;
  video := public.media_public_url(new.storage_path);
  head := '🎮 **' || public.display_name_of(p.author_id) || '** mandou um clip' || coalesce(' · **' || new.game_title || '**', '');
  if video is not null then
    -- bare URL on its own line → Discord renders the video player
    perform public.discord_send(new.group_id, jsonb_build_object(
      'content', left(head
        || case when p.body is not null and p.body <> 'Olhem para isto 👀' then E'\n> ' || replace(left(p.body, 300), E'\n', ' ') else '' end
        || case when app is not null then E'\n-# [Reagir no Afterhours](<' || app || '/gaming>)' else '' end
        || E'\n' || video, 2000)
    ));
  else
    perform public.discord_send(new.group_id, jsonb_build_object(
      'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'title', left(coalesce(nullif(p.body, ''), 'Novo clip'), 250),
        'url', case when app is not null then app || '/gaming' end,
        'description', head || E'\n' || 'Vê o clip no Afterhours 👇',
        'color', 6081791 -- sky
      )))
    ));
  end if;
  return new;
end $$;
drop trigger if exists clip_discord on public.post_media;
create trigger clip_discord after insert on public.post_media for each row execute function public.trg_clip_discord();
revoke execute on function public.trg_clip_discord() from public, anon, authenticated;
