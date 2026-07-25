-- Add pinned column to products table for Quick Add prioritization
ALTER TABLE public.products 
ADD COLUMN pinned boolean NOT NULL DEFAULT false;

-- Add index for faster sorting by pinned status
CREATE INDEX idx_products_pinned ON public.products(pinned DESC, created_at DESC);