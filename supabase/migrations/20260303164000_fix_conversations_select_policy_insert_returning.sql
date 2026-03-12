-- ============================================================
-- Fix conversations SELECT/UPDATE RLS for INSERT ... RETURNING
-- Date: 2026-03-03
--
-- Why:
-- - Supabase `.insert().select()` uses INSERT ... RETURNING.
-- - The previous SELECT policy relied on chat_can_access_conversation(id,...)
--   which re-queries public.conversations by id.
-- - During INSERT ... RETURNING this can reject the newly inserted row,
--   causing: new row violates row-level security policy for table conversations.
--
-- Fix:
-- - Keep INSERT policy unchanged.
-- - Rebuild SELECT and UPDATE policies using inline checks on the row itself.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.conversations') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS conversations_select_eligible ON public.conversations;
  CREATE POLICY conversations_select_eligible
    ON public.conversations
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() IS NOT NULL
      AND public.chat_has_eligible_reservation_for_annonce(conversations.annonce_id, auth.uid())
      AND (
        NOT public.chat_conversation_has_participants(conversations.id)
        OR public.chat_is_conversation_participant(conversations.id, auth.uid())
      )
    );

  DROP POLICY IF EXISTS conversations_update_participants ON public.conversations;
  CREATE POLICY conversations_update_participants
    ON public.conversations
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() IS NOT NULL
      AND public.chat_has_eligible_reservation_for_annonce(conversations.annonce_id, auth.uid())
      AND (
        NOT public.chat_conversation_has_participants(conversations.id)
        OR public.chat_is_conversation_participant(conversations.id, auth.uid())
      )
    )
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND public.chat_has_eligible_reservation_for_annonce(conversations.annonce_id, auth.uid())
      AND (
        NOT public.chat_conversation_has_participants(conversations.id)
        OR public.chat_is_conversation_participant(conversations.id, auth.uid())
      )
    );
END $$;
