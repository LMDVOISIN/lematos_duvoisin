ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deposit_refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_refund_id text,
  ADD COLUMN IF NOT EXISTS deposit_refunded_amount_cents integer,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_last_refund_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_deposit_refund_status_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_deposit_refund_status_check
      CHECK (deposit_refund_status IN ('none', 'pending', 'succeeded', 'failed', 'not_required', 'captured'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reservations_deposit_refund_status
  ON public.reservations(deposit_refund_status, updated_at DESC);
