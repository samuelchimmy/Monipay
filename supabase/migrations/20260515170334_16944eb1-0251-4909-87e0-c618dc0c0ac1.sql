DROP POLICY IF EXISTS "Users can view own IOUs" ON public.ious;

CREATE POLICY "Users can view own IOUs"
ON public.ious
FOR SELECT
TO authenticated
USING (
  ((sender_profile_id)::text = (auth.uid())::text)
  OR ((recipient_profile_id)::text = (auth.uid())::text)
  OR (platform_user_id IN (
    SELECT profiles.discord_id FROM profiles WHERE profiles.id = auth.uid()
    UNION
    SELECT profiles.telegram_id FROM profiles WHERE profiles.id = auth.uid()
    UNION
    SELECT profiles.x_user_id FROM profiles WHERE profiles.id = auth.uid()
    UNION
    SELECT profiles.bluesky_id FROM profiles WHERE profiles.id = auth.uid()
  ))
);