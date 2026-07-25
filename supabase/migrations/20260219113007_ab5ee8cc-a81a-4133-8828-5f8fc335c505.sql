
-- Remove public SELECT on products (all reads go through edge functions)
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;

CREATE POLICY "No direct SELECT - use edge functions"
ON public.products
FOR SELECT
USING (false);

-- Remove public SELECT on payment_links (all reads go through edge functions)
DROP POLICY IF EXISTS "Anyone can view active payment links" ON public.payment_links;

CREATE POLICY "No direct SELECT - use edge functions"
ON public.payment_links
FOR SELECT
USING (false);
