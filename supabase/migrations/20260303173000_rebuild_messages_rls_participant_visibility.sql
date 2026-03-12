-- ============================================================
-- Rebuild messages RLS so both chat participants can read rows
-- Date: 2026-03-03
--
-- Why:
-- - Current behavior shows messages to sender only in some projects.
-- - Reservation chat must show all messages in the conversation to both users.
--
-- This migration is idempotent and does:
-- 1) enable RLS on public.messages
-- 2) create SECURITY DEFINER helpers (row_security=off)
-- 3) rebuild messages policies for authenticated role
-- 4) grant explicit table/sequence privileges
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.messages NO FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.chat_can_access_conversation(bigint,uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.chat_can_access_conversation(bigint,uuid). Apply chat conversation RLS migrations first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.chat_can_access_message_conversation(
  p_conversation_id bigint,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_actor_user_id IS NOT NULL
     AND public.chat_can_access_conversation(p_conversation_id, p_actor_user_id);
$$;

CREATE OR REPLACE FUNCTION public.chat_can_insert_message_row(
  p_conversation_id bigint,
  p_sender_id uuid,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_actor_user_id IS NOT NULL
     AND p_sender_id = p_actor_user_id
     AND public.chat_can_access_conversation(p_conversation_id, p_actor_user_id);
$$;

CREATE OR REPLACE FUNCTION public.chat_can_delete_message_row(
  p_conversation_id bigint,
  p_sender_id uuid,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_actor_user_id IS NOT NULL
     AND p_sender_id = p_actor_user_id
     AND public.chat_can_access_conversation(p_conversation_id, p_actor_user_id);
$$;

REVOKE ALL ON FUNCTION public.chat_can_access_message_conversation(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_insert_message_row(bigint, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_delete_message_row(bigint, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_can_access_message_conversation(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_insert_message_row(bigint, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_delete_message_row(bigint, uuid, uuid) TO authenticated;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'messages'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', policy_row.policyname);
    END LOOP;

    CREATE POLICY messages_select_participant_conversation
      ON public.messages
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND public.chat_can_access_message_conversation(messages.conversation_id, auth.uid())
      );

    CREATE POLICY messages_insert_sender_participant
      ON public.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND public.chat_can_insert_message_row(
          messages.conversation_id,
          messages.sender_id,
          auth.uid()
        )
      );

    CREATE POLICY messages_delete_sender_participant
      ON public.messages
      FOR DELETE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND public.chat_can_delete_message_row(
          messages.conversation_id,
          messages.sender_id,
          auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    GRANT SELECT, INSERT, DELETE ON TABLE public.messages TO authenticated;
  END IF;

  IF to_regclass('public.messages_id_seq') IS NOT NULL THEN
    GRANT USAGE, SELECT ON SEQUENCE public.messages_id_seq TO authenticated;
  END IF;
END $$;
