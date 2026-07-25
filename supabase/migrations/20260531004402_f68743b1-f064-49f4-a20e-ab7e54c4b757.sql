-- 1. Backfill: ensure every wallet_profiles row has a preferred_network
UPDATE public.wallet_profiles
SET preferred_network = 'celo'
WHERE preferred_network IS NULL OR btrim(preferred_network) = '';

-- 2. Lookup indexes used by MoniBot resolvers (Telegram / Discord / X)
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_pay_tag_lower
  ON public.wallet_profiles (lower(pay_tag))
  WHERE pay_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_telegram_id
  ON public.wallet_profiles (telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_discord_id
  ON public.wallet_profiles (discord_id)
  WHERE discord_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_x_user_id
  ON public.wallet_profiles (x_user_id)
  WHERE x_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_x_username_lower
  ON public.wallet_profiles (lower(x_username))
  WHERE x_username IS NOT NULL;

-- 3. Uniqueness guards: prevent duplicate MoniTags / duplicate social links within wallet_profiles
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_profiles_pay_tag_lower
  ON public.wallet_profiles (lower(pay_tag))
  WHERE pay_tag IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_profiles_telegram_id
  ON public.wallet_profiles (telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_profiles_discord_id
  ON public.wallet_profiles (discord_id)
  WHERE discord_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_profiles_x_user_id
  ON public.wallet_profiles (x_user_id)
  WHERE x_user_id IS NOT NULL;