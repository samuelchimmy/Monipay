
-- Store customization settings table
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL UNIQUE,
  tagline TEXT DEFAULT NULL,
  accent_color TEXT DEFAULT '#0052FF',
  banner_url TEXT DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  social_twitter TEXT DEFAULT NULL,
  social_instagram TEXT DEFAULT NULL,
  social_website TEXT DEFAULT NULL,
  social_telegram TEXT DEFAULT NULL,
  show_branding BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Edge functions only (service role)
CREATE POLICY "No direct client access to store_settings"
  ON public.store_settings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger for updated_at
CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
