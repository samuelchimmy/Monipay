-- Schedule daily gas snapshot at 03:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gas-snapshot-daily') THEN
    PERFORM cron.unschedule('gas-snapshot-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'gas-snapshot-daily',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/gas-snapshot-cron',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYWVvanhvbnFtemVqd2lpb2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzk0NjksImV4cCI6MjA4NDMxNTQ2OX0.mzda_ZFMjtOybd47jTIwHlwWpDtv0LCdh4X5WaqjDKM"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
