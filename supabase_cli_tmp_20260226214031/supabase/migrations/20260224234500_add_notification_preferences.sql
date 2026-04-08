-- Notification channel preferences per user
-- Persists "Centre de notifications > Preferences"

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_category_check
    CHECK (category IN (
      'bookingRequests',
      'messages',
      'payments',
      'reminders',
      'documents',
      'marketing'
    )),
  CONSTRAINT notification_preferences_user_category_key
    UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;

DROP POLICY IF EXISTS "users_view_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_view_own_notification_preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_insert_own_notification_preferences"
ON public.notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_update_own_notification_preferences"
ON public.notification_preferences
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_delete_own_notification_preferences"
ON public.notification_preferences
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_notification_preferences" ON public.notification_preferences;
CREATE POLICY "admins_manage_notification_preferences"
ON public.notification_preferences
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
