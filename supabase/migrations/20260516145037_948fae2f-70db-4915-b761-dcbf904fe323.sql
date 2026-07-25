-- Arc early-access waitlist
CREATE TABLE public.arc_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  monitag text,
  source text NOT NULL DEFAULT 'arc_landing',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX arc_waitlist_email_lower_idx
  ON public.arc_waitlist (lower(email));

ALTER TABLE public.arc_waitlist ENABLE ROW LEVEL SECURITY;

-- Public insert (waitlist signup is intentionally open)
CREATE POLICY "Anyone can join the Arc waitlist"
  ON public.arc_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 254
    AND (monitag IS NULL OR length(monitag) <= 32)
  );

-- No SELECT/UPDATE/DELETE policies = client cannot read or modify entries.
-- Edge functions using the service role key bypass RLS for admin reads.