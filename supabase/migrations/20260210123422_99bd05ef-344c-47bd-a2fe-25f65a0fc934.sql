-- Security linter fixes
-- 1) Make profiles_public a SECURITY INVOKER view (avoid SECURITY DEFINER behavior)
ALTER VIEW public.profiles_public SET (security_invoker = true);

-- 2) Add explicit deny-all RLS policies for tables with RLS enabled but no policies
-- (keeps current behavior: no direct client access)
DROP POLICY IF EXISTS "No access - service role only" ON public.bot_settings;
CREATE POLICY "No access - service role only"
ON public.bot_settings
FOR ALL
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No access - service role only" ON public.monibot_mission_stats;
CREATE POLICY "No access - service role only"
ON public.monibot_mission_stats
FOR ALL
USING (false)
WITH CHECK (false);

-- 3) Replace overly-permissive public INSERT policies (WITH CHECK true)
-- with minimal non-empty validation (preserves public submit behavior)
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
WITH CHECK (
  message IS NOT NULL AND char_length(btrim(message)) > 0 AND char_length(message) <= 2000
);

DROP POLICY IF EXISTS "Anyone can create tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
  pay_tag IS NOT NULL AND char_length(btrim(pay_tag)) > 0 AND
  subject IS NOT NULL AND char_length(btrim(subject)) > 0 AND char_length(subject) <= 200
);

DROP POLICY IF EXISTS "Anyone can send messages to tickets" ON public.support_messages;
CREATE POLICY "Anyone can send messages to tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (
  message IS NOT NULL AND char_length(btrim(message)) > 0 AND char_length(message) <= 4000 AND
  ticket_id IS NOT NULL
);
