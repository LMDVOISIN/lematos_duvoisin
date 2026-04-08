-- Fix RLS policies that read auth.users directly.
-- Direct reads from auth.users can fail for anon/authenticated roles
-- with "42501 permission denied for table users".
-- This migration switches email checks to JWT claims.

-- -----------------------------------------------------
-- Cleanup legacy policies still referencing auth.users
-- -----------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_testers',
        'test_sessions',
        'page_responses',
        'test_reports',
        'debrief_notes'
      )
      AND (
        coalesce(qual, '') ILIKE '%auth.users%'
        OR coalesce(with_check, '') ILIKE '%auth.users%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  END LOOP;
END $$;

-- -----------------------------------------------------
-- User testers
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_view_own_record" ON public.user_testers;
CREATE POLICY "testers_view_own_record"
ON public.user_testers
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "testers_update_own_record" ON public.user_testers;
CREATE POLICY "testers_update_own_record"
ON public.user_testers
FOR UPDATE
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- -----------------------------------------------------
-- Test sessions
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_manage_own_sessions" ON public.test_sessions;
CREATE POLICY "testers_manage_own_sessions"
ON public.test_sessions
FOR ALL
TO authenticated
USING (
  tester_id IN (
    SELECT id
    FROM public.user_testers
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
WITH CHECK (
  tester_id IN (
    SELECT id
    FROM public.user_testers
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- -----------------------------------------------------
-- Page responses
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_manage_own_responses" ON public.page_responses;
CREATE POLICY "testers_manage_own_responses"
ON public.page_responses
FOR ALL
TO authenticated
USING (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
)
WITH CHECK (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

-- -----------------------------------------------------
-- Test reports
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_manage_own_reports" ON public.test_reports;
CREATE POLICY "testers_manage_own_reports"
ON public.test_reports
FOR ALL
TO authenticated
USING (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
)
WITH CHECK (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

-- -----------------------------------------------------
-- Debrief notes
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_manage_own_debriefs" ON public.debrief_notes;
CREATE POLICY "testers_manage_own_debriefs"
ON public.debrief_notes
FOR ALL
TO authenticated
USING (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
)
WITH CHECK (
  session_id IN (
    SELECT id
    FROM public.test_sessions
    WHERE tester_id IN (
      SELECT id
      FROM public.user_testers
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

-- -----------------------------------------------------
-- Storage objects (test screenshots)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "testers_upload_screenshots" ON storage.objects;
CREATE POLICY "testers_upload_screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'test-screenshots'
  AND EXISTS (
    SELECT 1
    FROM public.user_testers
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND is_active = true
  )
);
