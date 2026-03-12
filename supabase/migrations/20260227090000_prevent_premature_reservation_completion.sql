-- Guardrail: block impossible state transitions where a reservation is marked
-- completed before its start date.

CREATE OR REPLACE FUNCTION public.prevent_premature_reservation_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_new_status text := lower(coalesce(NEW.status, ''));
  v_old_status text := null;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_status := lower(coalesce(OLD.status, ''));
  END IF;

  IF v_new_status = 'completed'
     AND (TG_OP = 'INSERT' OR v_old_status IS DISTINCT FROM 'completed')
     AND NEW.start_date IS NOT NULL
     AND NEW.start_date::date > current_date THEN
    RAISE EXCEPTION 'Une reservation ne peut pas etre terminee avant sa date de debut';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_premature_reservation_completion ON public.reservations;
CREATE TRIGGER trg_prevent_premature_reservation_completion
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_premature_reservation_completion();
