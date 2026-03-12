-- =============================================================
-- Le Matos du Voisin - Full Catch-up Sync (idempotent)
-- Date: 2026-03-01
--
-- Purpose:
-- - Repair missing payment/deposit schema pieces in production
-- - Unify caution modes: cb / cheque / assurance
-- - Ensure Strategy B tables exist (when expected by backend)
-- - Apply latest insurance + legal/FAQ wording updates
--
-- Safe to run multiple times.
-- =============================================================

BEGIN;

-- =============================================================
-- 1) annonces: caution_mode
-- =============================================================
ALTER TABLE IF EXISTS public.annonces
  ADD COLUMN IF NOT EXISTS caution_mode text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND column_name = 'caution_mode'
  ) THEN
    UPDATE public.annonces
    SET caution_mode = lower(btrim(caution_mode))
    WHERE caution_mode IS NOT NULL;

    UPDATE public.annonces
    SET caution_mode = 'cb'
    WHERE caution_mode IS NULL
      OR btrim(caution_mode) = ''
      OR caution_mode NOT IN ('cb', 'cheque', 'assurance');

    ALTER TABLE public.annonces
      ALTER COLUMN caution_mode SET DEFAULT 'cb';

    ALTER TABLE public.annonces
      ALTER COLUMN caution_mode SET NOT NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND constraint_name = 'annonces_caution_mode_check'
  ) THEN
    ALTER TABLE public.annonces
      DROP CONSTRAINT annonces_caution_mode_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND column_name = 'caution_mode'
  ) THEN
    ALTER TABLE public.annonces
      ADD CONSTRAINT annonces_caution_mode_check
      CHECK (caution_mode IN ('cb', 'cheque', 'assurance'));
  END IF;
END;
$$;

-- =============================================================
-- 2) reservations: payment/deposit/insurance/refund columns
-- =============================================================
ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS caution_amount numeric,
  ADD COLUMN IF NOT EXISTS caution_mode text NOT NULL DEFAULT 'cb',
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_status text,
  ADD COLUMN IF NOT EXISTS tenant_payment_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS insurance_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_refund_id text,
  ADD COLUMN IF NOT EXISTS deposit_refunded_amount_cents integer,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_last_refund_error text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'caution_mode'
  ) THEN
    UPDATE public.reservations
    SET caution_mode = lower(btrim(caution_mode))
    WHERE caution_mode IS NOT NULL;

    UPDATE public.reservations
    SET caution_mode = 'cb'
    WHERE caution_mode IS NULL
      OR btrim(caution_mode) = ''
      OR caution_mode NOT IN ('cb', 'cheque', 'assurance');
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'caution_mode'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'insurance_selected'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'insurance_amount'
  ) THEN
    -- Exclusivity rule:
    -- - assurance => insurance_selected = true
    -- - cb/cheque => insurance_selected = false
    UPDATE public.reservations
    SET insurance_selected = (caution_mode = 'assurance')
    WHERE insurance_selected IS DISTINCT FROM (caution_mode = 'assurance');

    -- Keep insurance amount only when assurance mode is active.
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
  END IF;
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

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'caution_mode'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'insurance_selected'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_caution_mode_insurance_flag_check
      CHECK (
        (caution_mode = 'assurance' AND insurance_selected = true)
        OR (caution_mode IN ('cb', 'cheque') AND insurance_selected = false)
      );
  END IF;
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

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'caution_mode'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'insurance_amount'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_caution_mode_insurance_amount_check
      CHECK (
        (caution_mode = 'assurance' AND insurance_amount >= 0)
        OR (caution_mode IN ('cb', 'cheque') AND insurance_amount = 0)
      );
  END IF;
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

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'caution_mode'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_caution_mode_check
      CHECK (caution_mode IN ('cb', 'cheque', 'assurance'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_deposit_status_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_deposit_status_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_deposit_status_check
    CHECK (deposit_status IN ('none', 'pending', 'held', 'released', 'captured'));
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_deposit_refund_status_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_deposit_refund_status_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_deposit_refund_status_check
    CHECK (deposit_refund_status IN ('none', 'pending', 'succeeded', 'failed', 'not_required', 'captured'));
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_insurance_amount_check'
  ) THEN
    ALTER TABLE public.reservations
      DROP CONSTRAINT reservations_insurance_amount_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_insurance_amount_check
    CHECK (insurance_amount >= 0);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reservations_deposit_refund_status
  ON public.reservations(deposit_refund_status, updated_at DESC);

-- =============================================================
-- 3) Strategy B tables (long-rental deposit orchestration)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.reservation_deposit_strategy_b (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  renter_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strategy text NOT NULL DEFAULT 'strategy_b',
  status text NOT NULL DEFAULT 'scheduled',
  currency text NOT NULL DEFAULT 'eur',
  deposit_amount_cents integer NOT NULL CHECK (deposit_amount_cents > 0),
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL,
  current_payment_intent_id text,
  current_capture_before timestamptz,
  hold_required_from timestamptz NOT NULL,
  hold_required_until timestamptz NOT NULL,
  next_reauthorization_due_at timestamptz NOT NULL,
  last_rotation_at timestamptz,
  cycle_index integer NOT NULL DEFAULT 0 CHECK (cycle_index >= 0),
  reauth_required_at timestamptz,
  released_at timestamptz,
  captured_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_deposit_strategy_b_unique_reservation UNIQUE (reservation_id),
  CONSTRAINT reservation_deposit_strategy_b_strategy_check CHECK (strategy IN ('strategy_b')),
  CONSTRAINT reservation_deposit_strategy_b_status_check CHECK (
    status IN (
      'scheduled',
      'active',
      'reauth_required',
      'released',
      'captured',
      'expired',
      'cancelled',
      'failed',
      'not_required'
    )
  ),
  CONSTRAINT reservation_deposit_strategy_b_window_check CHECK (hold_required_until >= hold_required_from)
);

CREATE INDEX IF NOT EXISTS idx_reservation_deposit_strategy_b_due
  ON public.reservation_deposit_strategy_b(status, next_reauthorization_due_at);

CREATE INDEX IF NOT EXISTS idx_reservation_deposit_strategy_b_reservation
  ON public.reservation_deposit_strategy_b(reservation_id);

CREATE TABLE IF NOT EXISTS public.reservation_deposit_strategy_b_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  strategy_id bigint REFERENCES public.reservation_deposit_strategy_b(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  cycle_index integer NOT NULL DEFAULT 0,
  event_type text NOT NULL,
  stripe_payment_intent_id text,
  capture_before timestamptz,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_deposit_strategy_b_events_event_type_check CHECK (
    event_type IN (
      'scheduled',
      'authorization_created',
      'authorization_rotated',
      'authorization_cancelled',
      'authorization_released',
      'authorization_captured',
      'authorization_expired',
      'requires_action',
      'failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_reservation_deposit_strategy_b_events_reservation
  ON public.reservation_deposit_strategy_b_events(reservation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_deposit_strategy_b_events_strategy
  ON public.reservation_deposit_strategy_b_events(strategy_id, created_at DESC);

ALTER TABLE public.reservation_deposit_strategy_b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_deposit_strategy_b_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_deposit_strategy_b_participants_select" ON public.reservation_deposit_strategy_b;
CREATE POLICY "reservation_deposit_strategy_b_participants_select"
  ON public.reservation_deposit_strategy_b
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.id = reservation_id
        AND auth.uid() IN (r.owner_id, r.renter_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "reservation_deposit_strategy_b_events_participants_select" ON public.reservation_deposit_strategy_b_events;
CREATE POLICY "reservation_deposit_strategy_b_events_participants_select"
  ON public.reservation_deposit_strategy_b_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.id = reservation_id
        AND auth.uid() IN (r.owner_id, r.renter_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.touch_reservation_deposit_strategy_b_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_reservation_deposit_strategy_b ON public.reservation_deposit_strategy_b;
CREATE TRIGGER trg_touch_reservation_deposit_strategy_b
BEFORE UPDATE ON public.reservation_deposit_strategy_b
FOR EACH ROW
EXECUTE FUNCTION public.touch_reservation_deposit_strategy_b_updated_at();

-- =============================================================
-- 4) Legal + FAQ wording (CB / cheque / assurance)
-- =============================================================
DO $$
BEGIN
  UPDATE public.legal_pages
  SET content = replace(
        content,
        'Aucune assurance compl?mentaire n?est proposee par la plateforme.',
        'Une assurance optionnelle peut etre souscrite par le locataire.'
      ),
      updated_at = now()
  WHERE content LIKE '%Aucune assurance compl?mentaire n?est proposee par la plateforme.%';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

DO $$
BEGIN
  UPDATE public.legal_pages
  SET
    content = regexp_replace(
      content,
      'Une caution peut[^<]*\\.',
      'Une caution peut etre demandee selon le mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver : mode CB = caution bancaire pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige ; mode cheque = cheque de caution remis en main propre au propri?taire (conservation d?une pi?ce d?identit? et v?rification CNI) ; mode assurance = pas de caution CB ni cheque, couverture via assurance. Les modes CB et cheque sont gratuits pour le locataire.',
      'gi'
    ),
    updated_at = now()
  WHERE slug = 'cgv';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

DO $$
BEGIN
  UPDATE public.faqs
  SET
    answer = 'La caution depend du mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver. Mode CB : caution pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige. Mode cheque : cheque de caution remis en main propre au propri?taire lors de la remise du mat?riel, avec conservation d?une pi?ce d?identit? et v?rification CNI. Mode assurance : pas de caution CB ni cheque, protection via assurance. Les modes CB et cheque sont gratuits pour le locataire.'
  WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';

  UPDATE public.faqs
  SET
    answer = 'Mode CB : la caution est rembours?e automatiquement ? la cl?ture sans litige, selon le workflow officiel. Mode cheque : le cheque est restitue au locataire ? la fin de location si aucun dommage ni litige n?est constate. Mode assurance : aucune caution CB ni cheque n?est restituee car la protection passe par l?assurance.'
  WHERE lower(coalesce(question, '')) LIKE 'quand la caution est-elle restitu%';

  UPDATE public.faqs
  SET
    answer = 'Le montant total peut inclure les frais de service et, selon le mode choisi, une caution bancaire (mode CB) ou une assurance. En mode cheque, aucune caution n?est d?bit?e en ligne : le cheque est remis en main propre au propri?taire avec conservation d?une pi?ce d?identit? et v?rification CNI.'
  WHERE lower(coalesce(question, '')) LIKE 'pourquoi le montant final peut-il diff%';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

COMMIT;

-- =============================================================
-- 5) Quick v?rification
-- =============================================================
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'annonces'
      AND column_name = 'caution_mode'
  ) AS annonces_caution_mode_ok,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'payment_intent_id'
  ) AS reservations_payment_intent_id_ok,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'insurance_selected'
  ) AS reservations_insurance_selected_ok,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'reservation_deposit_strategy_b'
  ) AS strategy_b_table_ok,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'reservation_deposit_strategy_b_events'
  ) AS strategy_b_events_table_ok,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_caution_mode_insurance_flag_check'
  ) AS reservation_mode_flag_exclusive_ok,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_caution_mode_insurance_amount_check'
  ) AS reservation_mode_amount_exclusive_ok;
