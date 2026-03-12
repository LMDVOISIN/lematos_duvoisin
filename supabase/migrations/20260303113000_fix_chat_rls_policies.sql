-- ============================================================
-- Fix chat RLS policies for conversations and participants
-- Date: 2026-03-03
--
-- Goals:
-- - remove conflicting legacy policies
-- - allow chat creation when a valid reservation link exists
-- - keep access limited to reservation participants
-- ============================================================

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'conversations'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', policy_row.policyname);
    END LOOP;

    CREATE POLICY conversations_select_eligible
      ON public.conversations
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.annonce_id = conversations.annonce_id
            AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
            AND auth.uid() IN (r.owner_id, r.renter_id)
        )
        AND (
          NOT EXISTS (
            SELECT 1
            FROM public.conversation_participants cp0
            WHERE cp0.conversation_id = conversations.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.conversation_participants cp1
            WHERE cp1.conversation_id = conversations.id
              AND cp1.user_id = auth.uid()
          )
        )
      );

    CREATE POLICY conversations_insert_eligible
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

    CREATE POLICY conversations_update_participants
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
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.annonce_id = conversations.annonce_id
            AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
            AND auth.uid() IN (r.owner_id, r.renter_id)
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
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.annonce_id = conversations.annonce_id
            AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
            AND auth.uid() IN (r.owner_id, r.renter_id)
        )
      );
  END IF;

  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'conversation_participants'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_participants', policy_row.policyname);
    END LOOP;

    CREATE POLICY conversation_participants_select_eligible
      ON public.conversation_participants
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND conversation_participants.conversation_id IN (
          SELECT cp_self.conversation_id
          FROM public.conversation_participants cp_self
          WHERE cp_self.user_id = auth.uid()
        )
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

    CREATE POLICY conversation_participants_insert_eligible
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
