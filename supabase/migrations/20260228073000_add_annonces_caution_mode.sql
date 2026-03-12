ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS caution_mode text;

UPDATE public.annonces
SET caution_mode = 'cb'
WHERE caution_mode IS NULL OR btrim(caution_mode) = '';

UPDATE public.annonces
SET caution_mode = lower(btrim(caution_mode))
WHERE caution_mode IS NOT NULL;

UPDATE public.annonces
SET caution_mode = 'cb'
WHERE caution_mode NOT IN ('cb', 'cheque', 'assurance');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND column_name = 'caution_mode'
  ) THEN
    ALTER TABLE public.annonces
      ALTER COLUMN caution_mode SET DEFAULT 'cb';

    ALTER TABLE public.annonces
      ALTER COLUMN caution_mode SET NOT NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND constraint_name = 'annonces_caution_mode_check'
  ) THEN
    ALTER TABLE public.annonces
      ADD CONSTRAINT annonces_caution_mode_check
      CHECK (caution_mode IN ('cb', 'cheque', 'assurance'));
  END IF;
END;
$$;
