-- Add stock_quantity column to products table
-- NULL = unlimited stock, 0 = out of stock, >0 = specific quantity
ALTER TABLE public.products
ADD COLUMN stock_quantity integer DEFAULT NULL;