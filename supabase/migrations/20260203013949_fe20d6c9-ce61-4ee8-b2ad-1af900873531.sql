-- Add MoniBot AI social identity columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS farcaster_fid BIGINT,
ADD COLUMN IF NOT EXISTS farcaster_username TEXT,
ADD COLUMN IF NOT EXISTS x_username TEXT,
ADD COLUMN IF NOT EXISTS x_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS x_verification_code TEXT,
ADD COLUMN IF NOT EXISTS x_verification_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bot_allowance_amount NUMERIC DEFAULT 0;

-- Create unique index for farcaster_fid (one Farcaster account per MoniTag)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_farcaster_fid_unique 
ON public.profiles (farcaster_fid) 
WHERE farcaster_fid IS NOT NULL;

-- Create unique index for verified X usernames (one verified X account per MoniTag)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_x_username_verified_unique 
ON public.profiles (LOWER(x_username)) 
WHERE x_verified = true AND x_username IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.farcaster_fid IS 'Unique Farcaster ID linked to this profile';
COMMENT ON COLUMN public.profiles.farcaster_username IS 'Farcaster username/handle';
COMMENT ON COLUMN public.profiles.x_username IS 'X/Twitter username';
COMMENT ON COLUMN public.profiles.x_verified IS 'Whether X account ownership has been verified';
COMMENT ON COLUMN public.profiles.x_verification_code IS 'Temporary verification code for X linking';
COMMENT ON COLUMN public.profiles.x_verification_expires_at IS 'Expiry time for X verification code (24 hours)';
COMMENT ON COLUMN public.profiles.bot_allowance_amount IS 'USDC amount authorized for MoniBot to spend';