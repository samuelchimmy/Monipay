
ALTER TABLE public.profiles
ADD COLUMN status text NOT NULL DEFAULT 'active',
ADD COLUMN deactivated_at timestamp with time zone;
