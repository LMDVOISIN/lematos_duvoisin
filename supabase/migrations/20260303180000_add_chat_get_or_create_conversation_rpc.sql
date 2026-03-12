-- ============================================================
-- Add RPC to get/create one canonical chat conversation per pair
-- Date: 2026-03-03
--
-- Why:
-- - Historical RLS inconsistencies could leave conversation rows with
--   missing participants, which can lead to duplicate conversations
--   for the same annonce + user pair.
-- - Frontend then shows each user in a different thread.
--
-- This migration creates a SECURITY DEFINER RPC that:
-- 1) validates reservation eligibility between auth.uid() and target user
-- 2) finds existing canonical conversation (prefer both participants)
-- 3) repairs missing participant rows
-- 4) creates conversation only if none exists
-- ============================================================

CREATE OR REPLACE FUNCTION public.chat_get_or_create_conversation(
  p_annonce_id bigint,
  p_other_user_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_conversation_id bigint;
  v_has_eligible_link boolean;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_annonce_id IS NULL OR p_other_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing annonce or participant';
  END IF;

  IF v_actor_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Conversation requires two distinct users';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.annonce_id = p_annonce_id
      AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
      AND (
        (r.owner_id = v_actor_user_id AND r.renter_id = p_other_user_id)
        OR
        (r.owner_id = p_other_user_id AND r.renter_id = v_actor_user_id)
      )
  )
  INTO v_has_eligible_link;

  IF NOT v_has_eligible_link THEN
    RAISE EXCEPTION 'Messaging not allowed for this annonce/user pair';
  END IF;

  -- 1) Prefer conversation already containing both participants
  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.annonce_id = p_annonce_id
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_a
      WHERE cp_a.conversation_id = c.id
        AND cp_a.user_id = v_actor_user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_b
      WHERE cp_b.conversation_id = c.id
        AND cp_b.user_id = p_other_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_other
      WHERE cp_other.conversation_id = c.id
        AND cp_other.user_id NOT IN (v_actor_user_id, p_other_user_id)
    )
  ORDER BY c.id
  LIMIT 1;

  -- 2) Else reuse a partial conversation for this pair (legacy broken rows)
  IF v_conversation_id IS NULL THEN
    SELECT c.id
    INTO v_conversation_id
    FROM public.conversations c
    WHERE c.annonce_id = p_annonce_id
      AND EXISTS (
        SELECT 1
        FROM public.conversation_participants cp_pair
        WHERE cp_pair.conversation_id = c.id
          AND cp_pair.user_id IN (v_actor_user_id, p_other_user_id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversation_participants cp_other
        WHERE cp_other.conversation_id = c.id
          AND cp_other.user_id NOT IN (v_actor_user_id, p_other_user_id)
      )
    ORDER BY c.id
    LIMIT 1;
  END IF;

  -- 3) Else create a new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (annonce_id, created_at, updated_at)
    VALUES (p_annonce_id, now(), now())
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Ensure both participants exist on the canonical conversation
  INSERT INTO public.conversation_participants (conversation_id, user_id, created_at)
  SELECT v_conversation_id, v_actor_user_id, now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.user_id = v_actor_user_id
  );

  INSERT INTO public.conversation_participants (conversation_id, user_id, created_at)
  SELECT v_conversation_id, p_other_user_id, now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.user_id = p_other_user_id
  );

  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_get_or_create_conversation(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_get_or_create_conversation(bigint, uuid) TO authenticated;
