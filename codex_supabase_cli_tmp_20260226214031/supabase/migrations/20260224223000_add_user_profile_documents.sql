-- User profile documents (identity/address/insurance/bank)
-- Real persistent storage for "Mon Compte > Documents"

-- -----------------------------------------------------
-- Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_documents_document_type_check
    CHECK (document_type IN ('identity', 'address', 'insurance', 'bank')),
  CONSTRAINT user_profile_documents_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_user_profile_documents_user_uploaded
  ON public.user_profile_documents(user_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profile_documents_user_type
  ON public.user_profile_documents(user_id, document_type);

-- -----------------------------------------------------
-- Permissions + RLS
-- -----------------------------------------------------
ALTER TABLE public.user_profile_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_documents TO authenticated;

DROP POLICY IF EXISTS "users_view_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_view_own_profile_documents"
ON public.user_profile_documents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_insert_own_profile_documents"
ON public.user_profile_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_delete_own_profile_documents"
ON public.user_profile_documents
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_profile_documents" ON public.user_profile_documents;
CREATE POLICY "admins_manage_profile_documents"
ON public.user_profile_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);

-- -----------------------------------------------------
-- Storage bucket (private)
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-profile-documents',
  'user-profile-documents',
  false,
  5242880, -- 5MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_upload_own_profile_documents_files" ON storage.objects;
CREATE POLICY "users_upload_own_profile_documents_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-profile-documents'
  AND name LIKE auth.uid()::text || '/%'
);

DROP POLICY IF EXISTS "users_view_own_profile_documents_files" ON storage.objects;
CREATE POLICY "users_view_own_profile_documents_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-profile-documents'
  AND name LIKE auth.uid()::text || '/%'
);

DROP POLICY IF EXISTS "users_delete_own_profile_documents_files" ON storage.objects;
CREATE POLICY "users_delete_own_profile_documents_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-profile-documents'
  AND name LIKE auth.uid()::text || '/%'
);

DROP POLICY IF EXISTS "admins_view_all_profile_documents_files" ON storage.objects;
CREATE POLICY "admins_view_all_profile_documents_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-profile-documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);

DROP POLICY IF EXISTS "admins_delete_all_profile_documents_files" ON storage.objects;
CREATE POLICY "admins_delete_all_profile_documents_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-profile-documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);
