-- Create activation_fundings table to track wallets that have been funded
CREATE TABLE public.activation_fundings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(id),
  funded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tx_hash TEXT,
  amount_wei TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activation_fundings ENABLE ROW LEVEL SECURITY;

-- No direct access - all via edge functions
CREATE POLICY "No direct SELECT - use edge functions"
ON public.activation_fundings
FOR SELECT
USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.activation_fundings
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.activation_fundings
FOR UPDATE
USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.activation_fundings
FOR DELETE
USING (false);

-- Create index for faster lookups
CREATE INDEX idx_activation_fundings_wallet ON public.activation_fundings(wallet_address);
CREATE INDEX idx_activation_fundings_profile ON public.activation_fundings(profile_id);