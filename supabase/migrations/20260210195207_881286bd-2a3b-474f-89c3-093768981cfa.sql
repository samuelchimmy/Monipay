
-- Add chain column to monibot_transactions for multi-chain filtering
ALTER TABLE public.monibot_transactions 
ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'BASE';

-- Index for efficient BSC polling
CREATE INDEX IF NOT EXISTS idx_monibot_transactions_bsc_unreplied 
ON public.monibot_transactions (chain, replied, retry_count, created_at) 
WHERE chain = 'BSC' AND replied = false AND retry_count < 3;
