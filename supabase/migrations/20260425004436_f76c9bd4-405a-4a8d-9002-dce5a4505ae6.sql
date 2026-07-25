CREATE TABLE IF NOT EXISTS public.gas_spend_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_role text NOT NULL,
  chain text NOT NULL,
  balance_wei numeric NOT NULL DEFAULT 0,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gas_spend_snapshots_role_chain_time
  ON public.gas_spend_snapshots (wallet_role, chain, taken_at DESC);

ALTER TABLE public.gas_spend_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access"
  ON public.gas_spend_snapshots
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
