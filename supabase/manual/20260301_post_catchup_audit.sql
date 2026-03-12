-- =============================================================
-- Le Matos du Voisin - Post Catch-up Audit (read-only)
-- Date: 2026-03-01
--
-- Purpose:
-- - Verify schema, constraints, indexes, RLS, policies and trigger
--   after running 20260301_full_catchup_sync.sql
-- - Surface data anomalies that should be fixed manually
--
-- This script does not modify data.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Schema/infra checks (expected = ok=true)
-- -------------------------------------------------------------
WITH checks AS (
  -- Tables
  SELECT
    'table.public.annonces'::text AS check_name,
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'annonces'
    ) AS ok,
    'Table annonces exists'::text AS details

  UNION ALL
  SELECT
    'table.public.reservations',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
    ),
    'Table reservations exists'

  UNION ALL
  SELECT
    'table.public.reservation_deposit_strategy_b',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'reservation_deposit_strategy_b'
    ),
    'Strategy B table exists'

  UNION ALL
  SELECT
    'table.public.reservation_deposit_strategy_b_events',
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'reservation_deposit_strategy_b_events'
    ),
    'Strategy B events table exists'

  -- annonces.caution_mode
  UNION ALL
  SELECT
    'column.annonces.caution_mode',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'annonces'
        AND column_name = 'caution_mode'
    ),
    'Column annonces.caution_mode exists'

  UNION ALL
  SELECT
    'column.annonces.caution_mode.not_null',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'annonces'
        AND column_name = 'caution_mode'
        AND is_nullable = 'NO'
    ),
    'annonces.caution_mode is NOT NULL'

  UNION ALL
  SELECT
    'column.annonces.caution_mode.default_cb',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'annonces'
        AND column_name = 'caution_mode'
        AND coalesce(column_default, '') ILIKE '%cb%'
    ),
    'annonces.caution_mode default contains cb'

  -- reservations key columns used by payment/deposit flow
  UNION ALL
  SELECT
    'column.reservations.payment_intent_id',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'payment_intent_id'
    ),
    'Column reservations.payment_intent_id exists'

  UNION ALL
  SELECT
    'column.reservations.stripe_payment_intent_id',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'stripe_payment_intent_id'
    ),
    'Column reservations.stripe_payment_intent_id exists'

  UNION ALL
  SELECT
    'column.reservations.caution_amount',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'caution_amount'
    ),
    'Column reservations.caution_amount exists'

  UNION ALL
  SELECT
    'column.reservations.caution_mode',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'caution_mode'
    ),
    'Column reservations.caution_mode exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_status',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_status'
    ),
    'Column reservations.deposit_status exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_released_at',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_released_at'
    ),
    'Column reservations.deposit_released_at exists'

  UNION ALL
  SELECT
    'column.reservations.stripe_payment_status',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'stripe_payment_status'
    ),
    'Column reservations.stripe_payment_status exists'

  UNION ALL
  SELECT
    'column.reservations.tenant_payment_paid_at',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'tenant_payment_paid_at'
    ),
    'Column reservations.tenant_payment_paid_at exists'

  UNION ALL
  SELECT
    'column.reservations.insurance_selected',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'insurance_selected'
    ),
    'Column reservations.insurance_selected exists'

  UNION ALL
  SELECT
    'column.reservations.insurance_amount',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'insurance_amount'
    ),
    'Column reservations.insurance_amount exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_refund_status',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_refund_status'
    ),
    'Column reservations.deposit_refund_status exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_refund_id',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_refund_id'
    ),
    'Column reservations.deposit_refund_id exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_refunded_amount_cents',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_refunded_amount_cents'
    ),
    'Column reservations.deposit_refunded_amount_cents exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_refunded_at',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_refunded_at'
    ),
    'Column reservations.deposit_refunded_at exists'

  UNION ALL
  SELECT
    'column.reservations.deposit_last_refund_error',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'reservations'
        AND column_name = 'deposit_last_refund_error'
    ),
    'Column reservations.deposit_last_refund_error exists'

  -- Constraints
  UNION ALL
  SELECT
    'constraint.annonces_caution_mode_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'annonces'
        AND c.conname = 'annonces_caution_mode_check'
        AND pg_get_constraintdef(c.oid) ILIKE '%cb%'
        AND pg_get_constraintdef(c.oid) ILIKE '%cheque%'
        AND pg_get_constraintdef(c.oid) ILIKE '%assurance%'
    ),
    'annonces_caution_mode_check includes cb/cheque/assurance'

  UNION ALL
  SELECT
    'constraint.reservations_caution_mode_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_caution_mode_check'
        AND pg_get_constraintdef(c.oid) ILIKE '%cb%'
        AND pg_get_constraintdef(c.oid) ILIKE '%cheque%'
        AND pg_get_constraintdef(c.oid) ILIKE '%assurance%'
    ),
    'reservations_caution_mode_check includes cb/cheque/assurance'

  UNION ALL
  SELECT
    'constraint.reservations_deposit_status_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_deposit_status_check'
    ),
    'reservations_deposit_status_check exists'

  UNION ALL
  SELECT
    'constraint.reservations_deposit_refund_status_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_deposit_refund_status_check'
    ),
    'reservations_deposit_refund_status_check exists'

  UNION ALL
  SELECT
    'constraint.reservations_insurance_amount_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_insurance_amount_check'
    ),
    'reservations_insurance_amount_check exists'

  UNION ALL
  SELECT
    'constraint.reservations_caution_mode_insurance_flag_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_caution_mode_insurance_flag_check'
    ),
    'reservation mode/insurance_selected exclusivity check exists'

  UNION ALL
  SELECT
    'constraint.reservations_caution_mode_insurance_amount_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_caution_mode_insurance_amount_check'
    ),
    'reservation mode/insurance_amount exclusivity check exists'

  UNION ALL
  SELECT
    'constraint.reservations_owner_renter_distinct_check',
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t?ON t.oid = c.conrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_owner_renter_distinct_check'
    ),
    'reservations_owner_renter_distinct_check exists'

  -- Indexes
  UNION ALL
  SELECT
    'index.idx_reservations_deposit_refund_status',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'reservations'
        AND indexname = 'idx_reservations_deposit_refund_status'
    ),
    'Index on reservations deposit_refund_status exists'

  UNION ALL
  SELECT
    'index.idx_reservation_deposit_strategy_b_due',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b'
        AND indexname = 'idx_reservation_deposit_strategy_b_due'
    ),
    'Strategy B due index exists'

  UNION ALL
  SELECT
    'index.idx_reservation_deposit_strategy_b_reservation',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b'
        AND indexname = 'idx_reservation_deposit_strategy_b_reservation'
    ),
    'Strategy B reservation index exists'

  UNION ALL
  SELECT
    'index.idx_reservation_deposit_strategy_b_events_reservation',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b_events'
        AND indexname = 'idx_reservation_deposit_strategy_b_events_reservation'
    ),
    'Strategy B events reservation index exists'

  UNION ALL
  SELECT
    'index.idx_reservation_deposit_strategy_b_events_strategy',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b_events'
        AND indexname = 'idx_reservation_deposit_strategy_b_events_strategy'
    ),
    'Strategy B events strategy index exists'

  -- RLS / policies
  UNION ALL
  SELECT
    'rls.reservation_deposit_strategy_b',
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n?ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'reservation_deposit_strategy_b'
        AND c.relrowsecurity = true
    ),
    'RLS enabled on reservation_deposit_strategy_b'

  UNION ALL
  SELECT
    'rls.reservation_deposit_strategy_b_events',
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n?ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'reservation_deposit_strategy_b_events'
        AND c.relrowsecurity = true
    ),
    'RLS enabled on reservation_deposit_strategy_b_events'

  UNION ALL
  SELECT
    'policy.reservation_deposit_strategy_b_participants_select',
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b'
        AND policyname = 'reservation_deposit_strategy_b_participants_select'
    ),
    'Policy exists on reservation_deposit_strategy_b'

  UNION ALL
  SELECT
    'policy.reservation_deposit_strategy_b_events_participants_select',
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'reservation_deposit_strategy_b_events'
        AND policyname = 'reservation_deposit_strategy_b_events_participants_select'
    ),
    'Policy exists on reservation_deposit_strategy_b_events'

  -- Trigger/function
  UNION ALL
  SELECT
    'function.touch_reservation_deposit_strategy_b_updated_at',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n?ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'touch_reservation_deposit_strategy_b_updated_at'
    ),
    'Trigger function exists'

  UNION ALL
  SELECT
    'trigger.trg_touch_reservation_deposit_strategy_b',
    EXISTS (
      SELECT 1
      FROM pg_trigger tg
      JOIN pg_class t?ON t.oid = tg.tgrelid
      JOIN pg_namespace n?ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservation_deposit_strategy_b'
        AND tg.tgname = 'trg_touch_reservation_deposit_strategy_b'
        AND tg.tgisinternal = false
    ),
    'Trigger exists on reservation_deposit_strategy_b'

  -- Wording checks
  UNION ALL
  SELECT
    'legal.cgv_contains_3_modes',
    EXISTS (
      SELECT 1
      FROM public.legal_pages
      WHERE slug = 'cgv'
        AND lower(coalesce(content, '')) LIKE '%cb, cheque ou assurance%'
    ),
    'CGV contains CB / cheque / assurance wording'

  UNION ALL
  SELECT
    'faq.caution_question_updated',
    EXISTS (
      SELECT 1
      FROM public.faqs
      WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%'
        AND lower(coalesce(answer, '')) LIKE '%cb%'
        AND lower(coalesce(answer, '')) LIKE '%cheque%'
        AND lower(coalesce(answer, '')) LIKE '%assurance%'
    ),
    'FAQ caution answer references 3 modes'
)
SELECT
  check_name,
  ok,
  details
FROM checks
ORDER BY check_name;

-- -------------------------------------------------------------
-- 2) Data anomalies (expected counts = 0)
-- -------------------------------------------------------------
SELECT
  'annonces_invalid_caution_mode'::text AS anomaly,
  count(*)::bigint AS count_rows
FROM public.annonces
WHERE caution_mode IS NULL
   OR lower(btrim(caution_mode)) NOT IN ('cb', 'cheque', 'assurance')

UNION ALL

SELECT
  'reservations_invalid_caution_mode',
  count(*)::bigint
FROM public.reservations
WHERE caution_mode IS NULL
   OR lower(btrim(caution_mode)) NOT IN ('cb', 'cheque', 'assurance')

UNION ALL

SELECT
  'reservations_invalid_deposit_status',
  count(*)::bigint
FROM public.reservations
WHERE deposit_status IS NULL
   OR lower(btrim(deposit_status)) NOT IN ('none', 'pending', 'held', 'released', 'captured')

UNION ALL

SELECT
  'reservations_invalid_deposit_refund_status',
  count(*)::bigint
FROM public.reservations
WHERE deposit_refund_status IS NULL
   OR lower(btrim(deposit_refund_status)) NOT IN ('none', 'pending', 'succeeded', 'failed', 'not_required', 'captured')

UNION ALL

SELECT
  'reservations_negative_insurance_amount',
  count(*)::bigint
FROM public.reservations
WHERE coalesce(insurance_amount, 0) < 0

UNION ALL

SELECT
  'reservations_mode_vs_insurance_selected_mismatch',
  count(*)::bigint
FROM public.reservations
WHERE (
  caution_mode = 'assurance'
  AND coalesce(insurance_selected, false) <> true
) OR (
  caution_mode IN ('cb', 'cheque')
  AND coalesce(insurance_selected, false) <> false
)

UNION ALL

SELECT
  'reservations_non_assurance_with_insurance_amount',
  count(*)::bigint
FROM public.reservations
WHERE caution_mode IN ('cb', 'cheque')
  AND coalesce(insurance_amount, 0) <> 0

UNION ALL

SELECT
  'reservations_self_rental_rows',
  count(*)::bigint
FROM public.reservations
WHERE owner_id IS NOT NULL
  AND renter_id IS NOT NULL
  AND owner_id = renter_id

UNION ALL

SELECT
  'strategy_b_rows_missing_required_links',
  count(*)::bigint
FROM public.reservation_deposit_strategy_b
WHERE reservation_id IS NULL
   OR renter_user_id IS NULL
   OR stripe_customer_id IS NULL
   OR stripe_payment_method_id IS NULL;

-- -------------------------------------------------------------
-- 3) Human-readable status snapshot
-- -------------------------------------------------------------
SELECT
  r.id,
  r.caution_mode,
  r.caution_amount,
  r.deposit_status,
  r.deposit_refund_status,
  r.insurance_selected,
  r.insurance_amount,
  r.stripe_payment_status,
  r.payment_intent_id,
  r.stripe_payment_intent_id,
  r.updated_at
FROM public.reservations r
ORDER BY r.updated_at DESC
LIMIT 30;
