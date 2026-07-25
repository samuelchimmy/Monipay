-- Add missing columns to monibot_transactions
ALTER TABLE public.monibot_transactions 
ADD COLUMN IF NOT EXISTS recipient_pay_tag TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Index for faster polling (unreplied transactions)
CREATE INDEX IF NOT EXISTS idx_monibot_tx_replied 
ON public.monibot_transactions (replied) 
WHERE replied = false;

-- Index for active campaigns lookup
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
ON public.campaigns (status, tweet_id) 
WHERE status = 'active';