
-- Deduplicate any existing duplicate emails first (keep oldest)
DELETE FROM public.arc_waitlist a
USING public.arc_waitlist b
WHERE a.ctid > b.ctid
  AND lower(a.email) = lower(b.email);

-- Enforce unique email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS arc_waitlist_email_lower_unique
  ON public.arc_waitlist (lower(email));
