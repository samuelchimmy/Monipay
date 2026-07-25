ALTER TABLE public.wallet_profiles
  ADD COLUMN IF NOT EXISTS farcaster_fid bigint,
  ADD COLUMN IF NOT EXISTS farcaster_username text,
  ADD COLUMN IF NOT EXISTS x_verification_code text,
  ADD COLUMN IF NOT EXISTS x_verification_expires_at timestamptz;