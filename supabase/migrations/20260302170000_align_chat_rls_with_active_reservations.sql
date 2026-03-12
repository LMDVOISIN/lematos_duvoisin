-- ============================================================
-- Align chat RLS with reservation lifecycle (active statuses)
-- Date: 2026-03-02
--
-- Problem solved:
-- - "new row violates row-level security policy for table conversations"
--   when participants already have an active reservation link by status.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS conversations_active_reservation_insert ON public.conversations;
    CREATE POLICY conversations_active_reservation_insert
      ON public.conversations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.annonce_id = conversations.annonce_id
            AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
            AND auth.uid() IN (r.owner_id, r.renter_id)
        )
      );

    DROP POLICY IF EXISTS conversations_participant_update ON public.conversations;
    CREATE POLICY conversations_participant_update
      ON public.conversations
      FOR UPDATE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = conversations.id
            AND cp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = conversations.id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS conversation_participants_active_reservation_insert ON public.conversation_participants;
    CREATE POLICY conversation_participants_active_reservation_insert
      ON public.conversation_participants
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.conversations c
          JOIN public.reservations r ON r.annonce_id = c.annonce_id
          WHERE c.id = conversation_participants.conversation_id
            AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
            AND auth.uid() IN (r.owner_id, r.renter_id)
            AND conversation_participants.user_id IN (r.owner_id, r.renter_id)
        )
      );
  END IF;
END $$;

