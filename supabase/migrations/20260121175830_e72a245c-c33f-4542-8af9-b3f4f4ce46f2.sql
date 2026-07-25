-- Create customers table for merchant CRM/ERP features
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  pay_tag TEXT,
  wallet_address TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  total_spent NUMERIC NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, pay_tag),
  UNIQUE(profile_id, wallet_address)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - all operations through edge functions only
CREATE POLICY "No direct SELECT - use edge functions"
ON public.customers
FOR SELECT
USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.customers
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.customers
FOR UPDATE
USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.customers
FOR DELETE
USING (false);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_customers_profile_id ON public.customers(profile_id);
CREATE INDEX idx_customers_pay_tag ON public.customers(pay_tag);
CREATE INDEX idx_customers_wallet_address ON public.customers(wallet_address);