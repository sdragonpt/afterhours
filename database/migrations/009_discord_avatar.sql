-- AFTERHOURS — Discord messages always show the Afterhours name + avatar.
-- Run once after 008. Safe to re-run.
create or replace function public.discord_notify(p_group uuid, p_title text, p_description text, p_path text, p_color int default 10388479)
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
      'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'title', left(p_title, 250),
        'description', left(p_description, 1000),
        'url', case when cfg.app_url is not null then rtrim(cfg.app_url, '/') || p_path end,
        'color', p_color
      )))
    ))
  );
exception when others then
  raise warning 'discord_notify failed: %', sqlerrm;
end $$;
revoke all on function public.discord_notify(uuid, text, text, text, int) from public, authenticated, anon;
