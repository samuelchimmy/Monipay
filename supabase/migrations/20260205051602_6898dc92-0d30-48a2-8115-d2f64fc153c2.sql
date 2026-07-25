-- TABLE 1: campaign_grants
-- Track which users have received grants in each campaign to prevent duplicates
CREATE TABLE public.campaign_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent same user getting multiple grants in one campaign
  UNIQUE (campaign_id, profile_id)
);

-- Index for fast campaign lookups
CREATE INDEX idx_campaign_grants_campaign_id ON public.campaign_grants(campaign_id);

-- Enable RLS
ALTER TABLE public.campaign_grants ENABLE ROW LEVEL SECURITY;

-- RLS: Only edge functions can access (via service role)
CREATE POLICY "No direct SELECT - use edge functions"
  ON public.campaign_grants FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.campaign_grants FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.campaign_grants FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
  ON public.campaign_grants FOR DELETE
  USING (false);


-- TABLE 2: monibot_transactions
-- Log all USDC transfers executed by MoniBot (campaign grants and P2P commands)
CREATE TABLE public.monibot_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(20, 6) NOT NULL,
  fee DECIMAL(20, 6) NOT NULL DEFAULT 0,
  tx_hash TEXT NOT NULL,
  campaign_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('grant', 'p2p_command')),
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_monibot_tx_sender_id ON public.monibot_transactions(sender_id);
CREATE INDEX idx_monibot_tx_receiver_id ON public.monibot_transactions(receiver_id);
CREATE INDEX idx_monibot_tx_created_at ON public.monibot_transactions(created_at DESC);
CREATE INDEX idx_monibot_tx_hash ON public.monibot_transactions(tx_hash);

-- Enable RLS
ALTER TABLE public.monibot_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: Only edge functions can write
CREATE POLICY "No direct INSERT - use edge functions"
  ON public.monibot_transactions FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.monibot_transactions FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
  ON public.monibot_transactions FOR DELETE
  USING (false);

-- RLS: Users can view transactions where they are sender or receiver
CREATE POLICY "Users can view own transactions"
  ON public.monibot_transactions FOR SELECT
  USING (
    sender_id IN (SELECT id FROM public.profiles) OR
    receiver_id IN (SELECT id FROM public.profiles)
  );