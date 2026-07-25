-- Create campaigns table for MoniBot autonomous campaign management
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE,                          -- Twitter tweet ID once posted
  type TEXT NOT NULL DEFAULT 'grant' CHECK (type IN ('grant', 'raffle', 'contest')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  grant_amount DECIMAL(10,2) NOT NULL,           -- USDC per user
  max_participants INTEGER,                       -- NULL = unlimited
  current_participants INTEGER DEFAULT 0,
  budget_allocated DECIMAL(10,2) NOT NULL,
  budget_spent DECIMAL(10,2) DEFAULT 0,
  message TEXT,                                   -- The actual tweet content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ                          -- Auto-close after this time
);

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Block direct access, require edge functions (service role bypasses RLS)
CREATE POLICY "No direct SELECT - use edge functions"
  ON public.campaigns
  FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.campaigns
  FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
  ON public.campaigns
  FOR DELETE
  USING (false);

-- Indexes for performance
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_type ON public.campaigns(type);
CREATE INDEX idx_campaigns_created_at ON public.campaigns(created_at DESC);
CREATE INDEX idx_campaigns_tweet_id ON public.campaigns(tweet_id) WHERE tweet_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.campaigns IS 'MoniBot autonomous campaign management - stores campaign state, budget tracking, and participant counts';