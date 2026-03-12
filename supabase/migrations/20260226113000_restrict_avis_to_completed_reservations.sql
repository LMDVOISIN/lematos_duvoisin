-- Lock review creation/update to real, completed reservations.
-- Enforces that:
-- 1) the reviewer is the authenticated user (except service_role),
-- 2) reviewer/reviewed are the 2 participants of the referenced reservation,
-- 3) the reservation is in a terminal "completed" state,
-- 4) annonce_id (if provided) matches the reservation annonce_id.

CREATE OR REPLACE FUNCTION public.validate_avis_reservation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_reservation record;
  v_auth_user_id uuid;
  v_auth_role text;
  v_status text;
BEGIN
  v_auth_user_id := auth.uid();
  v_auth_role := coalesce(auth.role(), '');

  IF NEW.reservation_id IS NULL THEN
    RAISE EXCEPTION 'reservation_id est obligatoire pour publier un avis';
  END IF;

  IF NEW.reviewer_id IS NULL OR NEW.reviewed_user_id IS NULL THEN
    RAISE EXCEPTION 'reviewer_id et reviewed_user_id sont obligatoires';
  END IF;

  IF NEW.reviewer_id = NEW.reviewed_user_id THEN
    RAISE EXCEPTION 'Un utilisateur ne peut pas se noter lui-meme';
  END IF;

  IF NEW.rating IS NULL OR NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'La note doit etre comprise entre 1 et 5';
  END IF;

  IF v_auth_role <> 'service_role' THEN
    IF v_auth_user_id IS NULL THEN
      RAISE EXCEPTION 'Authentification requise pour publier un avis';
    END IF;

    IF NEW.reviewer_id <> v_auth_user_id THEN
      RAISE EXCEPTION 'reviewer_id doit correspondre ? l?utilisateur connecte';
    END IF;
  END IF;

  SELECT r.id, r.annonce_id, r.owner_id, r.renter_id, r.status
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = NEW.reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable pour cet avis';
  END IF;

  v_status := translate(
    lower(coalesce(v_reservation.status, '')),
    'àâäáãåéèêëíìîïóòôöõúùûüýÿç',
    'aaaaaaeeeeiiiiooooouuuuyyc'
  );
  IF v_status NOT IN (
    'completed',
    'finished',
    'closed',
    'ended',
    'returned',
    'rendu',
    'terminee',
    'restitue',
    'restituee',
    'done'
  ) THEN
    RAISE EXCEPTION 'Un avis ne peut etre d?pose qu?apr?s une reservation terminee';
  END IF;

  IF NEW.reviewer_id NOT IN (v_reservation.owner_id, v_reservation.renter_id) THEN
    RAISE EXCEPTION 'Le reviewer_id n?est pas un participant de la reservation';
  END IF;

  IF NEW.reviewed_user_id NOT IN (v_reservation.owner_id, v_reservation.renter_id) THEN
    RAISE EXCEPTION 'Le reviewed_user_id n?est pas un participant de la reservation';
  END IF;

  IF NEW.reviewer_id = v_reservation.owner_id AND NEW.reviewed_user_id <> v_reservation.renter_id THEN
    RAISE EXCEPTION 'Le propri?taire ne peut noter que le locataire de cette reservation';
  END IF;

  IF NEW.reviewer_id = v_reservation.renter_id AND NEW.reviewed_user_id <> v_reservation.owner_id THEN
    RAISE EXCEPTION 'Le locataire ne peut noter que le propri?taire de cette reservation';
  END IF;

  IF NEW.annonce_id IS NULL THEN
    NEW.annonce_id := v_reservation.annonce_id;
  ELSIF NEW.annonce_id <> v_reservation.annonce_id THEN
    RAISE EXCEPTION 'annonce_id doit correspondre ? la reservation referencee';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.reservation_id IS DISTINCT FROM NEW.reservation_id THEN
      RAISE EXCEPTION 'reservation_id ne peut pas etre modifie';
    END IF;
    IF OLD.reviewer_id IS DISTINCT FROM NEW.reviewer_id THEN
      RAISE EXCEPTION 'reviewer_id ne peut pas etre modifie';
    END IF;
    IF OLD.reviewed_user_id IS DISTINCT FROM NEW.reviewed_user_id THEN
      RAISE EXCEPTION 'reviewed_user_id ne peut pas etre modifie';
    END IF;
    IF OLD.annonce_id IS DISTINCT FROM NEW.annonce_id THEN
      RAISE EXCEPTION 'annonce_id ne peut pas etre modifie';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_avis_reservation_integrity ON public.avis;
CREATE TRIGGER trg_validate_avis_reservation_integrity
BEFORE INSERT OR UPDATE ON public.avis
FOR EACH ROW
EXECUTE FUNCTION public.validate_avis_reservation_integrity();
