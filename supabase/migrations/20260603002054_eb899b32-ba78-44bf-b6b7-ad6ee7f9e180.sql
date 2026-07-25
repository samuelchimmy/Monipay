-- Reduce scheduled job execution lag by polling every 30 seconds instead of every minute.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-scheduled-jobs') THEN
    PERFORM cron.unschedule('execute-scheduled-jobs');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-scheduled-jobs-30s') THEN
    PERFORM cron.unschedule('execute-scheduled-jobs-30s');
  END IF;
END $$;

SELECT cron.schedule(
  'execute-scheduled-jobs-30s',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/scheduled-executor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYWVvanhvbnFtemVqd2lpb2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzk0NjksImV4cCI6MjA4NDMxNTQ2OX0.mzda_ZFMjtOybd47jTIwHlwWpDtv0LCdh4X5WaqjDKM"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);