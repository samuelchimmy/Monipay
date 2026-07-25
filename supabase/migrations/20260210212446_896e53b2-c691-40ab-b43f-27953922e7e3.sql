
-- Drop the single-column unique constraint
ALTER TABLE activation_fundings DROP CONSTRAINT IF EXISTS activation_fundings_wallet_address_key;

-- Add composite unique constraint for wallet + chain
ALTER TABLE activation_fundings ADD CONSTRAINT activation_fundings_wallet_chain_unique UNIQUE (wallet_address, chain);

-- Now insert BSC records for profiles that don't have them
INSERT INTO activation_fundings (wallet_address, profile_id, status, amount_wei, chain, funded_at)
SELECT lower(p.wallet_address), p.id, 'funded', '210000000000000', 'BSC', now()
FROM profiles p
LEFT JOIN activation_fundings af ON lower(af.wallet_address) = lower(p.wallet_address) AND af.chain = 'BSC'
WHERE af.id IS NULL
ON CONFLICT (wallet_address, chain) DO NOTHING;
