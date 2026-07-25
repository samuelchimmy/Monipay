
CREATE TABLE public.wallet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  preferred_name TEXT,
  preferred_network TEXT NOT NULL DEFAULT 'celo',
  pay_tag TEXT UNIQUE,
  x_username TEXT,
  x_user_id TEXT,
  x_verified BOOLEAN DEFAULT FALSE,
  discord_id TEXT,
  discord_username TEXT,
  telegram_id TEXT,
  telegram_username TEXT,
  bluesky_id TEXT,
  bluesky_username TEXT,
  bot_allowance_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_profiles_wallet_address ON public.wallet_profiles(wallet_address);
CREATE INDEX idx_wallet_profiles_pay_tag ON public.wallet_profiles(pay_tag);

GRANT ALL ON public.wallet_profiles TO service_role;

ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct SELECT - use edge functions"
  ON public.wallet_profiles FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.wallet_profiles FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.wallet_profiles FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
  ON public.wallet_profiles FOR DELETE
  USING (false);

CREATE TRIGGER update_wallet_profiles_updated_at
  BEFORE UPDATE ON public.wallet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
