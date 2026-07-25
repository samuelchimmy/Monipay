-- Add sort_order column for custom product ordering in Quick Add
ALTER TABLE public.products 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;