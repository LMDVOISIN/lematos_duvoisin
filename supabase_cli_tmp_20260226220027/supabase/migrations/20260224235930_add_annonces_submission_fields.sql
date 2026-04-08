-- Add listing submission fields used by create/edit listing form

ALTER TABLE IF EXISTS public.annonces
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS temporarily_disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS return_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS pickup_time_start text,
  ADD COLUMN IF NOT EXISTS pickup_time_end text,
  ADD COLUMN IF NOT EXISTS return_time_start text,
  ADD COLUMN IF NOT EXISTS return_time_end text,
  ADD COLUMN IF NOT EXISTS equipment_value numeric;

UPDATE public.annonces
SET temporarily_disabled = COALESCE(temporarily_disabled, false),
    pickup_days = COALESCE(pickup_days, '{}'::text[]),
    return_days = COALESCE(return_days, '{}'::text[])
WHERE temporarily_disabled IS NULL
   OR pickup_days IS NULL
   OR return_days IS NULL;

ALTER TABLE IF EXISTS public.annonces
  ALTER COLUMN temporarily_disabled SET DEFAULT false,
  ALTER COLUMN pickup_days SET DEFAULT '{}'::text[],
  ALTER COLUMN return_days SET DEFAULT '{}'::text[];
