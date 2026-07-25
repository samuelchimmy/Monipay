ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS encrypted_solana_key TEXT;