-- AFTERHOURS — media link signing lives entirely in Postgres (secret never leaves the DB).
-- Run once after 012. Safe to re-run.
--   media_sign(keys)            → called by the media Worker with the USER's token; only keys
--                                  in communities the user belongs to get a signed query string
--   media_verify(key, exp, sig) → called by the Worker on playback (anon); validity check only
--   media_public_url(path)      → long-lived link used in Discord posts

-- generate the secret in the DB, once
insert into private.app_secrets(name, value)
values ('media_signing_secret', encode(extensions.gen_random_bytes(36), 'base64'))
on conflict (name) do nothing;

insert into private.app_settings(name, value)
values ('media_url', 'https://afterhours-media.sergionunoribeiro.workers.dev')
on conflict (name) do update set value = excluded.value;

create or replace function private.media_sig(p_key text, p_exp bigint)
returns text language sql stable security definer set search_path = '' as $$
  select rtrim(translate(encode(extensions.hmac(
    convert_to(p_key || ':' || p_exp, 'utf8'),
    convert_to((select value from private.app_secrets where name = 'media_signing_secret'), 'utf8'),
    'sha256'), 'base64'), '+/', '-_'), '=')
$$;
revoke all on function private.media_sig(text, bigint) from public, anon, authenticated;

-- key layout: <group_id>/<user_id>/<uuid>-<name>
create or replace function public.media_sign(p_keys text[], p_ttl_seconds int default 21600)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare k text; g uuid; ex bigint := extract(epoch from now())::bigint + least(greatest(p_ttl_seconds, 60), 86400); out jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return out; end if;
  foreach k in array coalesce(p_keys[1:200], '{}') loop
    begin g := split_part(k, '/', 1)::uuid; exception when others then continue; end;
    if public.is_group_member(g) then
      out := out || jsonb_build_object(k, 'exp=' || ex || '&sig=' || private.media_sig(k, ex));
    end if;
  end loop;
  return out;
end $$;
revoke all on function public.media_sign(text[], int) from public, anon;
grant execute on function public.media_sign(text[], int) to authenticated;

create or replace function public.media_verify(p_key text, p_exp bigint, p_sig text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_exp > extract(epoch from now()) and p_sig = private.media_sig(p_key, p_exp)
$$;
revoke all on function public.media_verify(text, bigint, text) from public;
grant execute on function public.media_verify(text, bigint, text) to anon, authenticated;

create or replace function public.media_public_url(p_path text, p_days int default 365)
returns text language plpgsql stable security definer set search_path = '' as $$
declare base text; k text; ex bigint;
begin
  if p_path is null or left(p_path, 3) <> 'r2:' then return null; end if;
  select value into base from private.app_settings where name = 'media_url';
  if base is null then return null; end if;
  k := substr(p_path, 4);
  ex := extract(epoch from now())::bigint + p_days * 86400;
  return rtrim(base, '/') || '/m/' || k || '?exp=' || ex || '&sig=' || private.media_sig(k, ex);
end $$;
revoke all on function public.media_public_url(text, int) from public, anon, authenticated;
