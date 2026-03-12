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

DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER TABLE storage.objects ENABLE RLS (insufficient privilege)';
  END;

  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload test screenshots" ON storage.objects;
    CREATE POLICY "Authenticated users can upload test screenshots"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'test-screenshots'
      AND auth.role() = 'authenticated'
    );

    DROP POLICY IF EXISTS "Users can view test screenshots" ON storage.objects;
    CREATE POLICY "Users can view test screenshots"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'test-screenshots'
    );

    DROP POLICY IF EXISTS "Admins can delete test screenshots" ON storage.objects;
    CREATE POLICY "Admins can delete test screenshots"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'test-screenshots'
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects policy update (insufficient privilege)';
  END;
END;
$$;
