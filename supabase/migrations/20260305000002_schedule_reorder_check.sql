-- Enable the pg_cron and pg_net extensions (available on Supabase Pro/Team plans).
-- pg_cron schedules the job; pg_net makes the HTTP call to the Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the check-reorders Edge Function to run every 15 minutes.
select cron.schedule(
  'check-reorders-every-15min',
  '*/15 * * * *',
  $$
    select net.http_post(
      url      := 'https://kxlkgtxcyoyeferrxetr.supabase.co/functions/v1/check-reorders',
      headers  := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
      body     := '{}'::jsonb
    );
  $$
);
