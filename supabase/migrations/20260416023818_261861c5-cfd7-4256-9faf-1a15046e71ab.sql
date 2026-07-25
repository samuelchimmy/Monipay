
-- Create IOU status type
DO $$ BEGIN
  CREATE TYPE public.iou_status AS ENUM ('pending', 'claimed', 'expired', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create IOUs table
CREATE TABLE public.ious (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iou_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_identifier TEXT NOT NULL,
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_pay_tag TEXT NOT NULL,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token TEXT NOT NULL,
  token_symbol TEXT NOT NULL DEFAULT 'USDC',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  chain TEXT NOT NULL DEFAULT 'base',
  status public.iou_status NOT NULL DEFAULT 'pending',
  expiry TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  tx_hash_create TEXT,
  tx_hash_claim TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (iou_id, chain)
);

-- Indexes
CREATE INDEX idx_ious_recipient_id ON public.ious(recipient_id);
CREATE INDEX idx_ious_sender_profile_id ON public.ious(sender_profile_id);
CREATE INDEX idx_ious_recipient_profile_id ON public.ious(recipient_profile_id);
CREATE INDEX idx_ious_status ON public.ious(status);

-- Enable RLS
ALTER TABLE public.ious ENABLE ROW LEVEL SECURITY;

-- Users can view IOUs they sent or are the recipient of
CREATE POLICY "Users can view own IOUs"
ON public.ious
FOR SELECT
TO authenticated
USING (
  sender_profile_id::text = auth.uid()::text
  OR recipient_profile_id::text = auth.uid()::text
);

-- Only service role can insert (via edge functions)
-- No INSERT policy for authenticated = deny by default

-- Updated_at trigger
CREATE TRIGGER update_ious_updated_at
BEFORE UPDATE ON public.ious
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
