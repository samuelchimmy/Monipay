-- Fix migration after view replace error
-- 1) Add preferred_network column (idempotent)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_network text NOT NULL DEFAULT 'base';

-- 2) Update profiles_public view WITHOUT reordering existing columns
-- Existing order: id, pay_tag, wallet_address, preferred_mode, created_at, updated_at
-- Append preferred_network at the end to avoid rename errors.
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  pay_tag,
  wallet_address,
  preferred_mode,
  created_at,
  updated_at,
  preferred_network
FROM public.profiles;