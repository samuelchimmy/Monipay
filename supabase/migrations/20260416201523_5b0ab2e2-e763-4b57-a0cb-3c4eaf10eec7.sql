ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS x_user_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_x_user_id ON public.profiles(x_user_id);