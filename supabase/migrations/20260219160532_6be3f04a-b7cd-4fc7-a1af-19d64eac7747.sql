-- Add product image URL column
ALTER TABLE public.products
ADD COLUMN image_url TEXT;

-- Create merchant_subscriptions table for Pro features
CREATE TABLE public.merchant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro',
  amount NUMERIC NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Deny all direct access (use edge functions)
CREATE POLICY "No direct SELECT - use edge functions"
ON public.merchant_subscriptions
FOR SELECT USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
ON public.merchant_subscriptions
FOR INSERT WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
ON public.merchant_subscriptions
FOR UPDATE USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
ON public.merchant_subscriptions
FOR DELETE USING (false);

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_subscriptions_updated_at
BEFORE UPDATE ON public.merchant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast lookups
CREATE INDEX idx_merchant_subscriptions_profile ON public.merchant_subscriptions(profile_id);
CREATE INDEX idx_merchant_subscriptions_status ON public.merchant_subscriptions(status, expires_at);

-- Storage bucket for product images (using existing monipay bucket)
-- Create RLS policies for product-images path in the existing monipay bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'monipay' AND (storage.foldername(name))[1] = 'product-images');

CREATE POLICY "Authenticated uploads to product-images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'monipay' AND (storage.foldername(name))[1] = 'product-images');

CREATE POLICY "Users can update their product images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'monipay' AND (storage.foldername(name))[1] = 'product-images');

CREATE POLICY "Users can delete their product images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'monipay' AND (storage.foldername(name))[1] = 'product-images');