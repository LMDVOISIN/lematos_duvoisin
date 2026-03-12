-- Enforce exclusive usage of caution mode:
-- exactly one mode is active per reservation:
-- - cb OR cheque OR assurance
-- and insurance fields are consistent with that mode.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS caution_mode text NOT NULL DEFAULT 'cb',
  ADD COLUMN IF NOT EXISTS insurance_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_amount numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  UPDATE public.reservations
  SET caution_mode = lower(btrim(caution_mode))
  WHERE caution_mode IS NOT NULL;

  UPDATE public.reservations
  SET caution_mode = 'cb'
  WHERE caution_mode IS NULL
    OR btrim(caution_mode) = ''
    OR caution_mode NOT IN ('cb', 'cheque', 'assurance');

  UPDATE public.reservations
  SET insurance_selected = (caution_mode = 'assurance')
  WHERE insurance_selected IS DISTINCT FROM (caution_mode = 'assurance');

  UPDATE public.reservations
  SET insurance_amount = CASE
    WHEN caution_mode = 'assurance' THEN greatest(coalesce(insurance_amount, 0), 0)
    ELSE 0
  END
  WHERE (
    caution_mode = 'assurance'
    AND coalesce(insurance_amount, 0) < 0
  ) OR (
    caution_mode IN ('cb', 'cheque')
    AND coalesce(insurance_amount, 0) <> 0
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND constraint_name = 'reservations_caution_mode_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_caution_mode_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_check
    CHECK (caution_mode IN ('cb', 'cheque', 'assurance'));
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_caution_mode_insurance_flag_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_caution_mode_insurance_flag_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_insurance_flag_check
    CHECK (
      (caution_mode = 'assurance' AND insurance_selected = true)
      OR (caution_mode IN ('cb', 'cheque') AND insurance_selected = false)
    );
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_caution_mode_insurance_amount_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_caution_mode_insurance_amount_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_insurance_amount_check
    CHECK (
      (caution_mode = 'assurance' AND insurance_amount >= 0)
      OR (caution_mode IN ('cb', 'cheque') AND insurance_amount = 0)
    );
END;
$$;
