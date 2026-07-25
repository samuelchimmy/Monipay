
-- 1. feedback_prompts: dedupe ERC-8004 feedback prompts to users
CREATE TABLE public.feedback_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  platform TEXT NOT NULL,
  platform_user_id TEXT,
  tx_hash TEXT,
  agent_id TEXT NOT NULL DEFAULT '51818',
  registry TEXT NOT NULL DEFAULT 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  score SMALLINT,
  prompted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicked_at TIMESTAMPTZ,
  feedback_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.feedback_prompts TO service_role;

ALTER TABLE public.feedback_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all on feedback_prompts"
  ON public.feedback_prompts FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX idx_feedback_prompts_user_recent
  ON public.feedback_prompts (user_id, prompted_at DESC);
CREATE INDEX idx_feedback_prompts_platform_user
  ON public.feedback_prompts (platform, platform_user_id, prompted_at DESC);
CREATE UNIQUE INDEX idx_feedback_prompts_tx_unique
  ON public.feedback_prompts (tx_hash) WHERE tx_hash IS NOT NULL;

-- 2. agent_peer_feedback_queue: queue of giveFeedback() calls MoniBot owes peers
CREATE TABLE public.agent_peer_feedback_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peer_agent_id TEXT NOT NULL,
  peer_registry TEXT NOT NULL,
  score SMALLINT NOT NULL DEFAULT 5,
  receipt_uri TEXT,
  source_request_id TEXT,
  source_endpoint TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT ALL ON public.agent_peer_feedback_queue TO service_role;

ALTER TABLE public.agent_peer_feedback_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all on agent_peer_feedback_queue"
  ON public.agent_peer_feedback_queue FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX idx_agent_peer_feedback_queue_pending
  ON public.agent_peer_feedback_queue (status, created_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX idx_agent_peer_feedback_queue_dedupe
  ON public.agent_peer_feedback_queue (peer_agent_id, peer_registry, source_request_id)
  WHERE source_request_id IS NOT NULL;

CREATE TRIGGER update_agent_peer_feedback_queue_updated_at
  BEFORE UPDATE ON public.agent_peer_feedback_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
