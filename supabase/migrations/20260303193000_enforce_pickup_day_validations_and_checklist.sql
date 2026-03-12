-- ============================================================
-- Enforce pickup-day validations and explicit pickup checklist
-- Date: 2026-03-03
--
-- Goals:
-- - Inspection presence/finalization is valid only on the matching day
--   (start phase on start_date, end phase on end_date).
-- - Pickup start flow is explicit:
--   1) empreinte CB deja geree au paiement
--   2) etat des lieux start valide via official protocol (not manual)
--   3) mat?riel remis au locataire (manual)
--   4) debut de location confirme (manual)
--   5) location en cours is derived by frontend once 2..4 are done
-- ============================================================

ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS pickup_handover_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_rental_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.confirm_reservation_pickup_step(
  p_reservation_id uuid,
  p_step text
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_step text := lower(coalesce(trim(p_step), ''));
  v_reservation public.reservations;
  v_start_session_closed_at timestamptz;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF v_role = 'anon' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF v_step NOT IN ('handover_completed', 'rental_started') THEN
    RAISE EXCEPTION 'Etape de demarrage invalide';
  END IF;

  SELECT r.*
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable';
  END IF;

  IF v_user_id NOT IN (v_reservation.owner_id, v_reservation.renter_id) THEN
    RAISE EXCEPTION 'Utilisateur non autorise pour cette reservation';
  END IF;

  IF lower(coalesce(v_reservation.status, '')) IN ('cancelled', 'cancelled_tenant_no_payment', 'rejected', 'refused', 'completed') THEN
    RAISE EXCEPTION 'Reservation non modifiable dans son etat actuel';
  END IF;

  IF v_reservation.start_date IS NULL THEN
    RAISE EXCEPTION 'Date de debut manquante';
  END IF;

  IF v_reservation.start_date::date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Ces validations ne sont possibles que le jour de la location';
  END IF;

  SELECT s.closed_at
  INTO v_start_session_closed_at
  FROM public.reservation_inspection_sessions s
  WHERE s.reservation_id = p_reservation_id
    AND s.phase = 'start'
  ORDER BY s.closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_step IN ('handover_completed', 'rental_started')
     AND v_start_session_closed_at IS NULL THEN
    RAISE EXCEPTION 'Etat des lieux de remise requis via le protocole officiel';
  END IF;

  IF v_step = 'rental_started' THEN
    IF v_reservation.pickup_handover_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Mat?riel remis au locataire non confirme';
    END IF;
  END IF;

  UPDATE public.reservations r
  SET
    pickup_handover_confirmed_at = CASE
      WHEN v_step = 'handover_completed'
      THEN coalesce(r.pickup_handover_confirmed_at, now())
      ELSE r.pickup_handover_confirmed_at
    END,
    pickup_rental_started_at = CASE
      WHEN v_step = 'rental_started'
      THEN coalesce(r.pickup_rental_started_at, now())
      ELSE r.pickup_rental_started_at
    END,
    status = CASE
      WHEN v_step = 'rental_started' AND lower(coalesce(r.status, '')) IN ('accepted', 'paid')
      THEN 'active'
      ELSE r.status
    END,
    updated_at = now()
  WHERE r.id = p_reservation_id;

  SELECT r.*
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  RETURN v_reservation;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_reservation_pickup_step(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_pickup_step(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_inspection_phase_day_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_reservation_id uuid;
  v_phase text;
  v_start_date date;
  v_end_date date;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_should_check boolean := false;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'reservation_inspection_presence_confirmations' THEN
    v_reservation_id := NEW.reservation_id;
    v_phase := lower(coalesce(NEW.phase, ''));
    v_should_check := true;
  ELSIF TG_TABLE_NAME = 'reservation_inspection_sessions' THEN
    v_reservation_id := NEW.reservation_id;
    v_phase := lower(coalesce(NEW.phase, ''));

    IF TG_OP = 'INSERT' THEN
      v_should_check := (
        NEW.owner_presence_confirmed_at IS NOT NULL
        OR NEW.renter_presence_confirmed_at IS NOT NULL
        OR NEW.owner_photos_finalized_at IS NOT NULL
        OR NEW.renter_photos_finalized_at IS NOT NULL
      );
    ELSE
      v_should_check := (
        (NEW.owner_presence_confirmed_at IS DISTINCT FROM OLD.owner_presence_confirmed_at AND NEW.owner_presence_confirmed_at IS NOT NULL)
        OR (NEW.renter_presence_confirmed_at IS DISTINCT FROM OLD.renter_presence_confirmed_at AND NEW.renter_presence_confirmed_at IS NOT NULL)
        OR (NEW.owner_photos_finalized_at IS DISTINCT FROM OLD.owner_photos_finalized_at AND NEW.owner_photos_finalized_at IS NOT NULL)
        OR (NEW.renter_photos_finalized_at IS DISTINCT FROM OLD.renter_photos_finalized_at AND NEW.renter_photos_finalized_at IS NOT NULL)
      );
    END IF;
  END IF;

  IF NOT v_should_check THEN
    RETURN NEW;
  END IF;

  SELECT r.start_date::date, coalesce(r.end_date::date, r.start_date::date)
  INTO v_start_date, v_end_date
  FROM public.reservations r
  WHERE r.id = v_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable';
  END IF;

  IF v_phase = 'start' AND v_start_date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Validation debut autoris?e uniquement le jour de remise';
  END IF;

  IF v_phase = 'end' AND v_end_date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Validation fin autoris?e uniquement le jour de restitution';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.reservation_inspection_presence_confirmations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_inspection_phase_day_window_presence ON public.reservation_inspection_presence_confirmations;
    CREATE TRIGGER trg_enforce_inspection_phase_day_window_presence
    BEFORE INSERT OR UPDATE ON public.reservation_inspection_presence_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_inspection_phase_day_window();
  END IF;

  IF to_regclass('public.reservation_inspection_sessions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_inspection_phase_day_window_sessions ON public.reservation_inspection_sessions;
    CREATE TRIGGER trg_enforce_inspection_phase_day_window_sessions
    BEFORE INSERT OR UPDATE ON public.reservation_inspection_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_inspection_phase_day_window();
  END IF;
END
$$;
