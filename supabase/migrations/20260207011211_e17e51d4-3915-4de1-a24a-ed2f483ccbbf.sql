-- Add metadata column to transactions table for MoniBot context
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the metadata structure
COMMENT ON COLUMN public.transactions.metadata IS 'Extra context: {monibot_type: "p2p"|"grant", tweet_id: string, campaign_id: string, campaign_name: string}';

-- Add index for efficient metadata queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_monibot_type ON public.transactions ((metadata->>'monibot_type'));

-- Extend source enum-like values to support monibot sources
-- (source column already exists as text, so we just use new values: 'monibot_p2p', 'monibot_grant')