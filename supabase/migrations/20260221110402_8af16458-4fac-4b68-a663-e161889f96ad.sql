
-- Infrastructure subscription reminders for admin
CREATE TABLE public.infra_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL, -- e.g. 'railway', 'lovable', 'gemini', 'supabase', 'x_api', 'other'
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL DEFAULT 'monthly', -- monthly, yearly, one-time
  next_due_date timestamp with time zone,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.infra_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role only - admin access via edge functions
CREATE POLICY "No direct client access" ON public.infra_subscriptions
FOR ALL USING (false) WITH CHECK (false);

-- Auto-update timestamp
CREATE TRIGGER update_infra_subscriptions_updated_at
BEFORE UPDATE ON public.infra_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Revenue/overhead tracking table
CREATE TABLE public.app_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL, -- '2026-02' format
  revenue numeric NOT NULL DEFAULT 0,
  overhead numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(month)
);

ALTER TABLE public.app_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access" ON public.app_financials
FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER update_app_financials_updated_at
BEFORE UPDATE ON public.app_financials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
