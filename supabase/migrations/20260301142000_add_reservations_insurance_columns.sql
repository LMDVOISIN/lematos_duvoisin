-- Optional insurance fields for reservation checkout flow.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS insurance_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_amount numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_insurance_amount_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_insurance_amount_check
      CHECK (insurance_amount >= 0);
  END IF;
END;
$$;
