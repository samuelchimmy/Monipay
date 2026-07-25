-- Add chain column to activation_fundings to track Base vs BSC funding separately
ALTER TABLE public.activation_fundings ADD COLUMN chain text NOT NULL DEFAULT 'BASE';

-- Drop the existing unique-ish constraint (wallet_address alone) so we can fund same wallet on both chains
-- Create a unique index on (wallet_address, chain) to prevent duplicate funding per chain
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_fundings_wallet_chain 
  ON public.activation_fundings (lower(wallet_address), chain);