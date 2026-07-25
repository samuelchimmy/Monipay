-- Drop foreign key constraints on sender_id and receiver_id to allow referencing both public.profiles and public.wallet_profiles
ALTER TABLE public.monibot_transactions
  DROP CONSTRAINT IF EXISTS monibot_transactions_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS monibot_transactions_receiver_id_fkey;

-- Make receiver_id nullable if it isn't already, because receiver_id might not exist for some transaction types
ALTER TABLE public.monibot_transactions
  ALTER COLUMN receiver_id DROP NOT NULL;
