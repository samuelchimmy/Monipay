-- =============================================
-- SECURITY HARDENING: Edge Function Gatekeeper Pattern
-- All mutations go through Edge Functions with SERVICE_ROLE_KEY
-- =============================================

-- 1. PROFILES TABLE - Create public view and lock down base table
-- =============================================

-- Create a safe public view that excludes encrypted_private_key
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  pay_tag,
  wallet_address,
  preferred_mode,
  created_at,
  updated_at
FROM public.profiles;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read of pay_tag and wallet_address" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create restrictive policies (Edge Functions bypass RLS with service role)
CREATE POLICY "Deny direct SELECT - use view or edge functions"
  ON public.profiles FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.profiles FOR UPDATE
  USING (false);

-- 2. INVOICES TABLE - Lock down mutations
-- =============================================

DROP POLICY IF EXISTS "Anyone can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anyone can update invoices" ON public.invoices;

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.invoices FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.invoices FOR UPDATE
  USING (false);

-- 3. PRODUCTS TABLE - Lock down mutations (keep SELECT open for catalogs)
-- =============================================

DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.products FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE - use edge functions"
  ON public.products FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE - use edge functions"
  ON public.products FOR DELETE
  USING (false);

-- 4. TRANSACTIONS TABLE - Lock down inserts
-- =============================================

DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;

CREATE POLICY "No direct INSERT - use edge functions"
  ON public.transactions FOR INSERT
  WITH CHECK (false);