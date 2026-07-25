
-- 1. Explicit deny SELECT on arc_waitlist
CREATE POLICY "No select access for arc_waitlist"
ON public.arc_waitlist
FOR SELECT
USING (false);

-- 2. Tighten support_messages insert to require existing ticket
DROP POLICY IF EXISTS "Anyone can send messages to tickets" ON public.support_messages;

CREATE POLICY "Anyone can send messages to tickets"
ON public.support_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  message IS NOT NULL
  AND char_length(btrim(message)) > 0
  AND char_length(message) <= 4000
  AND ticket_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.support_tickets WHERE support_tickets.id = ticket_id
  )
);
