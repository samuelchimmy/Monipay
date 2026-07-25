-- Drop existing overly permissive policies (IF EXISTS to handle partial state)
DROP POLICY IF EXISTS "Authenticated uploads to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner uploads product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner updates product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner deletes product images" ON storage.objects;

-- Create ownership-scoped policies
CREATE POLICY "Owner uploads product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'monipay' AND
  (storage.foldername(name))[1] = 'product-images' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Owner updates product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'monipay' AND
  (storage.foldername(name))[1] = 'product-images' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Owner deletes product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'monipay' AND
  (storage.foldername(name))[1] = 'product-images' AND
  (storage.foldername(name))[2] = auth.uid()::text
);