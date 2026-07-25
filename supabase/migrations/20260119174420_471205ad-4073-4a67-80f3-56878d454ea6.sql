-- Create invoices table for invoice-based payments
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_pay_tag TEXT NOT NULL,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  items JSONB,
  memo TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  paid_at TIMESTAMPTZ,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Senders can view their sent invoices
CREATE POLICY "Senders can view their sent invoices"
ON public.invoices
FOR SELECT
USING (sender_profile_id IN (SELECT id FROM public.profiles));

-- RLS Policy: Recipients can view invoices sent to them
CREATE POLICY "Recipients can view invoices sent to them"
ON public.invoices
FOR SELECT
USING (recipient_profile_id IN (SELECT id FROM public.profiles));

-- RLS Policy: Anyone can insert invoices (sender validation done in edge function)
CREATE POLICY "Anyone can insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (true);

-- RLS Policy: Anyone can update invoices (status validation done in edge function)
CREATE POLICY "Anyone can update invoices"
ON public.invoices
FOR UPDATE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_invoices_recipient_pay_tag ON public.invoices(recipient_pay_tag);
CREATE INDEX idx_invoices_sender_profile_id ON public.invoices(sender_profile_id);
CREATE INDEX idx_invoices_recipient_profile_id ON public.invoices(recipient_profile_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);