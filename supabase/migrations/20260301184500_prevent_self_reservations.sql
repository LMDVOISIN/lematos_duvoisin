-- Prevent self-rentals at database level.
-- Use NOT VALID so legacy bad rows can be cleaned manually without blocking deploy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t?ON t.oid = c.conrelid
    JOIN pg_namespace n?ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
      AND c.conname = 'reservations_owner_renter_distinct_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_owner_renter_distinct_check
      CHECK (
        owner_id IS NULL
        OR renter_id IS NULL
        OR owner_id <> renter_id
      ) NOT VALID;
  END IF;
END;
$$;
