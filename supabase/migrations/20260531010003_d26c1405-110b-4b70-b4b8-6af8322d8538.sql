ALTER TABLE public.monibot_transactions
  ADD COLUMN IF NOT EXISTS sender_source TEXT,
  ADD COLUMN IF NOT EXISTS magicpay_claim_mode TEXT;

ALTER TABLE public.monibot_transactions
  DROP CONSTRAINT IF EXISTS monibot_transactions_sender_source_check;
ALTER TABLE public.monibot_transactions
  ADD CONSTRAINT monibot_transactions_sender_source_check
  CHECK (sender_source IS NULL OR sender_source IN ('profiles', 'wallet_profiles'));

ALTER TABLE public.monibot_transactions
  DROP CONSTRAINT IF EXISTS monibot_transactions_magicpay_claim_mode_check;
ALTER TABLE public.monibot_transactions
  ADD CONSTRAINT monibot_transactions_magicpay_claim_mode_check
  CHECK (magicpay_claim_mode IS NULL OR magicpay_claim_mode IN ('mandatory', 'optional', 'default'));