
-- Bot logs table for Railway webhook log drain
CREATE TABLE public.bot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL, -- 'worker-bot', 'worker-bot-bsc', 'vp-social', 'reply-bot-bsc'
  level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'debug'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast querying by service and time
CREATE INDEX idx_bot_logs_service_created ON public.bot_logs(service, created_at DESC);
CREATE INDEX idx_bot_logs_level ON public.bot_logs(level);

-- Auto-cleanup: keep only last 7 days of logs
-- (run manually or via cron)

-- Enable RLS
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (Railway webhook)
-- Admin can read via edge function (wallet-signature verified)
CREATE POLICY "Deny all client access to bot_logs"
  ON public.bot_logs
  FOR ALL
  USING (false);
