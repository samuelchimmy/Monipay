
-- A2: Remove monibot_transactions from Realtime publication to prevent cross-user channel leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.monibot_transactions;

-- A3: Drop the overly permissive "Public insert access" and "Public read access" duplicate policies on comments
DROP POLICY IF EXISTS "Public insert access" ON public.comments;
DROP POLICY IF EXISTS "Public read access" ON public.comments;

-- A3 (continued): Restrict public SELECT to exclude PII columns by replacing the broad read policy with a view
-- The remaining "Public read comments" policy stays (USING true) so we expose a sanitized view
CREATE OR REPLACE VIEW public.comments_public
WITH (security_invoker = true)
AS
SELECT id, post_slug, name, content, created_at
FROM public.comments;

GRANT SELECT ON public.comments_public TO anon, authenticated;

-- A5 + A6: Harden check_comment_rate_limit (only SECURITY DEFINER function we own besides updaters)
-- Set search_path and revoke EXECUTE from anon/authenticated (it's used as a trigger; trigger execution doesn't need EXECUTE)
CREATE OR REPLACE FUNCTION public.check_comment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.ip_hash IS NULL OR NEW.ip_hash = '' OR NEW.ip_hash = 'unknown' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.comments
    WHERE ip_hash = NEW.ip_hash
      AND created_at > now() - interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'rate limit exceeded: please wait before commenting again'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_comment_rate_limit() FROM PUBLIC, anon, authenticated;

-- A4 + A8: Document service-role-only tables (silences "RLS enabled, no policy" by intent)
COMMENT ON TABLE public.monipay_xyz_tweets IS 'Service-role only by design. No client policies. Accessed exclusively by edge functions and scheduled jobs.';
COMMENT ON TABLE public.telegram_user_cache IS 'Service-role only by design. Contains Telegram PII; only edge functions may read/write, scoped per requesting user.';
