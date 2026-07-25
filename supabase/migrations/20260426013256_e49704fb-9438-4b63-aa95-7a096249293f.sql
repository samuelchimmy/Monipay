ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_email   text,
  ADD COLUMN IF NOT EXISTS google_picture text;

CREATE INDEX IF NOT EXISTS idx_profiles_google_email ON public.profiles (google_email);