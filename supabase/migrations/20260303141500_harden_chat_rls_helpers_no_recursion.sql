-- ============================================================
-- Harden chat RLS helper functions against recursion
-- Date: 2026-03-03
--
-- Why:
-- - Some environments still surface:
--   "infinite recursion detected in policy for relation conversation_participants"
-- - Force helper execution with row_security=off and simplify participant checks.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.conversations NO FORCE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.conversation_participants NO FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.chat_has_eligible_reservation_for_annonce(
  p_annonce_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.annonce_id = p_annonce_id
      AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
      AND p_user_id IN (r.owner_id, r.renter_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_has_participants(
  p_conversation_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_is_conversation_participant(
  p_conversation_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_can_access_conversation(
  p_conversation_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND public.chat_has_eligible_reservation_for_annonce(c.annonce_id, p_user_id)
      AND (
        NOT public.chat_conversation_has_participants(c.id)
        OR public.chat_is_conversation_participant(c.id, p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_can_read_participant_row(
  p_conversation_id bigint,
  p_row_user_id uuid,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.reservations r ON r.annonce_id = c.annonce_id
    WHERE c.id = p_conversation_id
      AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
      AND p_actor_user_id IN (r.owner_id, r.renter_id)
      AND p_row_user_id IN (r.owner_id, r.renter_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_can_manage_participant_row(
  p_conversation_id bigint,
  p_row_user_id uuid,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.reservations r ON r.annonce_id = c.annonce_id
    WHERE c.id = p_conversation_id
      AND r.status IN ('accepted', 'paid', 'active', 'ongoing')
      AND p_actor_user_id IN (r.owner_id, r.renter_id)
      AND p_row_user_id IN (r.owner_id, r.renter_id)
  );
$$;

REVOKE ALL ON FUNCTION public.chat_has_eligible_reservation_for_annonce(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_conversation_has_participants(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_is_conversation_participant(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_access_conversation(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_read_participant_row(bigint, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_can_manage_participant_row(bigint, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_has_eligible_reservation_for_annonce(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_has_participants(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_is_conversation_participant(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_access_conversation(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_read_participant_row(bigint, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_manage_participant_row(bigint, uuid, uuid) TO authenticated;
