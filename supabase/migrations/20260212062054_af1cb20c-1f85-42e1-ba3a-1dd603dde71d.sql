
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule hourly cleanup of bot_logs older than 24 hours
SELECT cron.schedule(
  'cleanup-bot-logs-24h',
  '0 * * * *',
  $$DELETE FROM public.bot_logs WHERE created_at < now() - interval '24 hours';$$
);
