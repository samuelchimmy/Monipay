-- =============================================
-- MoniPay Payment Gateway Schema Migration
-- =============================================

-- 1. Create api_keys table for merchant API credentials
CREATE TABLE public.api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL UNIQUE,
    secret_key_hash TEXT NOT NULL,
    secret_key_preview TEXT NOT NULL,
    webhook_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_api_keys_profile_id ON public.api_keys(profile_id);
CREATE INDEX idx_api_keys_public_key ON public.api_keys(public_key);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies - use edge functions for all operations (gatekeeper pattern)
CREATE POLICY "No direct SELECT - use edge functions"
ON public.api_keys FOR SELECT
USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.api_keys FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.api_keys FOR UPDATE
USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.api_keys FOR DELETE
USING (false);

-- 2. Create payment_links table for shareable product payment links
CREATE TABLE public.payment_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    link_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for faster lookups
CREATE INDEX idx_payment_links_profile_id ON public.payment_links(profile_id);
CREATE INDEX idx_payment_links_link_code ON public.payment_links(link_code);
CREATE INDEX idx_payment_links_product_id ON public.payment_links(product_id);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- RLS policies - public can view active links, mutations via edge functions
CREATE POLICY "Anyone can view active payment links"
ON public.payment_links FOR SELECT
USING (is_active = true);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.payment_links FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.payment_links FOR UPDATE
USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.payment_links FOR DELETE
USING (false);

-- 3. Create orders table for gateway payment tracking
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_ref TEXT NOT NULL UNIQUE,
    merchant_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payer_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payer_pay_tag TEXT,
    payer_wallet TEXT,
    payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    fee NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USDC',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    source TEXT NOT NULL CHECK (source IN ('payment_link', 'api', 'qr', 'invoice')),
    tx_hash TEXT,
    callback_url TEXT,
    webhook_url TEXT,
    webhook_sent_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    paid_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 minutes')
);

-- Add indexes for faster lookups
CREATE INDEX idx_orders_merchant_profile_id ON public.orders(merchant_profile_id);
CREATE INDEX idx_orders_payer_profile_id ON public.orders(payer_profile_id);
CREATE INDEX idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX idx_orders_payment_link_id ON public.orders(payment_link_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies - use edge functions for all operations (gatekeeper pattern)
CREATE POLICY "No direct SELECT - use edge functions"
ON public.orders FOR SELECT
USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.orders FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.orders FOR UPDATE
USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.orders FOR DELETE
USING (false);

-- 4. Add source column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'p2p' 
CHECK (source IN ('p2p', 'payment_link', 'online_order', 'invoice', 'external', 'withdrawal'));

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source);

-- 5. Create trigger for updated_at on new tables
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();