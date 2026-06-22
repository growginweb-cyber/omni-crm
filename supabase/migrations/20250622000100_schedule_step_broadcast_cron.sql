-- Schedule process-step-broadcast Edge Function (every minute)
-- Before running: register Vault secrets on Supabase Dashboard → Project Settings → Vault
--   project_url       = https://<project-ref>.supabase.co
--   service_role_key  = <service-role-key>

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-step-broadcast') then
    perform cron.unschedule('process-step-broadcast');
  end if;
exception
  when undefined_table then null;
end $$;

select cron.schedule(
  'process-step-broadcast',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/process-step-broadcast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
