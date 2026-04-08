-- Create test-screenshots storage bucket for problem report screenshots

-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-screenshots',
  'test-screenshots',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload screenshots
DROP POLICY IF EXISTS "Authenticated users can upload test screenshots" ON storage.objects;
CREATE POLICY "Authenticated users can upload test screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'test-screenshots'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can view their own screenshots
DROP POLICY IF EXISTS "Users can view test screenshots" ON storage.objects;
CREATE POLICY "Users can view test screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'test-screenshots'
);

-- Policy: Admins can delete screenshots
DROP POLICY IF EXISTS "Admins can delete test screenshots" ON storage.objects;
CREATE POLICY "Admins can delete test screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'test-screenshots'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
