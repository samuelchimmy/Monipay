-- Explicit anon deny on ious (defense-in-depth; authenticated SELECT policy unchanged)
CREATE POLICY "Deny anon access to ious"
ON public.ious
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- monipay_xyz_tweets: service-role only
CREATE POLICY "No client access to monipay_xyz_tweets"
ON public.monipay_xyz_tweets
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- telegram_user_cache: service-role only
CREATE POLICY "No client access to telegram_user_cache"
ON public.telegram_user_cache
FOR ALL
TO public
USING (false)
WITH CHECK (false);