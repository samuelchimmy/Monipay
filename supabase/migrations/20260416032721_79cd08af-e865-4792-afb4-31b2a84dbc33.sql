-- Add social identity columns to ious table
ALTER TABLE public.ious 
ADD COLUMN platform text,
ADD COLUMN platform_user_id text;

-- Index for fast lookups when checking pending IOUs on social account link
CREATE INDEX idx_ious_platform_user ON public.ious(platform, platform_user_id) WHERE status = 'pending';