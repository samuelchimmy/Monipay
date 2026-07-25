-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job to run scheduled-executor every minute
SELECT cron.schedule(
  'execute-scheduled-jobs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/scheduled-executor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYWVvanhvbnFtemVqd2lpb2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzk0NjksImV4cCI6MjA4NDMxNTQ2OX0.mzda_ZFMjtOybd47jTIwHlwWpDtv0LCdh4X5WaqjDKM"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);