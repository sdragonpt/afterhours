-- AFTERHOURS — DMs: photos + delivered/seen receipts. Run once after 021. Safe to re-run.
--
-- Photos live in R2 under dm/<sender>/<recipient>/… (uploaded through the media Worker,
-- which checks can_message()). media_sign() only signs those keys for the two people.
-- delivered_at is set when the recipient's app receives the message; read_at when they open it.

alter table public.direct_messages add column if not exists media_path text;
alter table public.direct_messages add column if not exists delivered_at timestamptz;

alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages drop constraint if exists dm_body_or_photo;
alter table public.direct_messages add constraint dm_body_or_photo
  check (char_length(body) <= 2000 and (char_length(trim(body)) > 0 or media_path is not null));

-- a photo can only point at the sender's own dm/<sender>/<recipient>/ folder
drop policy if exists dm_send on public.direct_messages;
create policy dm_send on public.direct_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and read_at is null and delivered_at is null
    and public.can_message(recipient_id)
    and (media_path is null or media_path like 'r2:dm/' || sender_id || '/' || recipient_id || '/%')
  );

create or replace function public.dm_mark_delivered()
returns void language sql security definer set search_path = '' as $$
  update public.direct_messages set delivered_at = now()
  where recipient_id = auth.uid() and delivered_at is null
$$;
revoke all on function public.dm_mark_delivered() from public, anon;
grant execute on function public.dm_mark_delivered() to authenticated;

create or replace function public.dm_mark_read(p_other uuid)
returns void language sql security definer set search_path = '' as $$
  update public.direct_messages set read_at = now(), delivered_at = coalesce(delivered_at, now())
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null
$$;

-- conversation list shows "📷 Foto" for photo-only messages
create or replace function public.dm_threads()
returns table (other_id uuid, name text, color text, last_body text, last_at timestamptz, last_from_me boolean, unread int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as other_id, *
    from public.direct_messages where auth.uid() in (sender_id, recipient_id)
  ), last as (
    select distinct on (other_id) other_id,
      case when trim(body) = '' then '📷 Foto' when media_path is not null then '📷 ' || body else body end as body,
      created_at, sender_id = auth.uid() as from_me
    from mine order by other_id, created_at desc
  )
  select l.other_id, coalesce(p.display_name, 'Alguém'), coalesce(p.avatar_color, 'lime'), l.body, l.created_at, l.from_me,
         (select count(*)::int from mine m where m.other_id = l.other_id and m.recipient_id = auth.uid() and m.read_at is null)
  from last l left join public.profiles p on p.id = l.other_id
  order by l.created_at desc
$$;

create or replace function public.trg_push_dm() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push_send(array[new.recipient_id], new.sender_id,
    '💬 ' || public.display_name_of(new.sender_id),
    case when trim(new.body) = '' then '📷 Foto' when new.media_path is not null then '📷 ' || new.body else new.body end,
    '/messages/' || new.sender_id, 'dm-' || new.sender_id);
  return new;
end $$;

-- sign DM photo keys for the two participants only
create or replace function public.media_sign(p_keys text[], p_ttl_seconds integer default 21600)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare k text; g uuid; a uuid; b uuid; ok boolean;
  ex bigint := extract(epoch from now())::bigint + least(greatest(p_ttl_seconds, 60), 86400); out jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return out; end if;
  foreach k in array coalesce(p_keys[1:200], '{}') loop
    ok := false;
    begin
      if split_part(k, '/', 1) = 'dm' then
        a := split_part(k, '/', 2)::uuid; b := split_part(k, '/', 3)::uuid;
        ok := auth.uid() in (a, b);
      else
        g := split_part(k, '/', 1)::uuid;
        ok := public.is_group_member(g);
      end if;
    exception when others then continue; end;
    if ok then
      out := out || jsonb_build_object(k, 'exp=' || ex || '&sig=' || private.media_sig(k, ex));
    end if;
  end loop;
  return out;
end $$;
