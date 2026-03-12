-- ============================================================
-- CHAT CATCH-UP (CB only + Identity v?rification)
-- Date: 2026-03-03
--
-- Purpose:
-- - Consolidate DB changes discussed in this chat into one SQL script.
-- - Safe to run even if some migrations already ran (idempotent style).
--
-- Scope:
-- 1) Ensure identity document module exists (table/RLS/storage bucket)
-- 2) Force unique caution mode = CB (empreinte)
-- 3) Keep pickup checklist with identity gate before handover
-- 4) Enforce inspection validations on correct day (start/end)
-- 5) Align CGV/FAQ wording: empreinte = authorization, non-debited
-- ============================================================

-- ------------------------------------------------------------
-- 0) Identity documents module (required by pickup identity gate)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_documents_document_type_check
    CHECK (document_type IN ('identity', 'address', 'insurance', 'bank')),
  CONSTRAINT user_profile_documents_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_user_profile_documents_user_uploaded
  ON public.user_profile_documents(user_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profile_documents_user_type
  ON public.user_profile_documents(user_id, document_type);

ALTER TABLE public.user_profile_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_documents TO authenticated;

DROP POLICY IF EXISTS "users_view_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_view_own_profile_documents"
ON public.user_profile_documents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_insert_own_profile_documents"
ON public.user_profile_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_profile_documents" ON public.user_profile_documents;
CREATE POLICY "users_delete_own_profile_documents"
ON public.user_profile_documents
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_profile_documents" ON public.user_profile_documents;
CREATE POLICY "admins_manage_profile_documents"
ON public.user_profile_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-profile-documents',
  'user-profile-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER TABLE storage.objects ENABLE RLS (insufficient privilege)';
  END;

  BEGIN
    DROP POLICY IF EXISTS "users_upload_own_profile_documents_files" ON storage.objects;
    CREATE POLICY "users_upload_own_profile_documents_files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'user-profile-documents'
      AND name LIKE auth.uid()::text || '/%'
    );

    DROP POLICY IF EXISTS "users_view_own_profile_documents_files" ON storage.objects;
    CREATE POLICY "users_view_own_profile_documents_files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'user-profile-documents'
      AND name LIKE auth.uid()::text || '/%'
    );

    DROP POLICY IF EXISTS "users_delete_own_profile_documents_files" ON storage.objects;
    CREATE POLICY "users_delete_own_profile_documents_files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'user-profile-documents'
      AND name LIKE auth.uid()::text || '/%'
    );

    DROP POLICY IF EXISTS "admins_view_all_profile_documents_files" ON storage.objects;
    CREATE POLICY "admins_view_all_profile_documents_files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'user-profile-documents'
      AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = true
      )
    );

    DROP POLICY IF EXISTS "admins_delete_all_profile_documents_files" ON storage.objects;
    CREATE POLICY "admins_delete_all_profile_documents_files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'user-profile-documents'
      AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = true
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects profile-documents policies (insufficient privilege)';
  END;
END;
$$;

-- ------------------------------------------------------------
-- 1) Force reservations caution mode = cb (and no insurance path)
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS caution_mode text NOT NULL DEFAULT 'cb',
  ADD COLUMN IF NOT EXISTS insurance_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_amount numeric NOT NULL DEFAULT 0;

UPDATE public.reservations
SET caution_mode = 'cb'
WHERE caution_mode IS NULL
   OR lower(btrim(caution_mode)) <> 'cb';

UPDATE public.reservations
SET insurance_selected = false
WHERE coalesce(insurance_selected, false) IS DISTINCT FROM false;

UPDATE public.reservations
SET insurance_amount = 0
WHERE coalesce(insurance_amount, 0) <> 0;

ALTER TABLE IF EXISTS public.reservations
  ALTER COLUMN caution_mode SET DEFAULT 'cb',
  ALTER COLUMN caution_mode SET NOT NULL,
  ALTER COLUMN insurance_selected SET DEFAULT false,
  ALTER COLUMN insurance_selected SET NOT NULL,
  ALTER COLUMN insurance_amount SET DEFAULT 0,
  ALTER COLUMN insurance_amount SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_caution_mode_check'
  ) THEN
    ALTER TABLE public.reservations DROP CONSTRAINT reservations_caution_mode_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_check
    CHECK (caution_mode = 'cb');
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_caution_mode_insurance_flag_check'
  ) THEN
    ALTER TABLE public.reservations DROP CONSTRAINT reservations_caution_mode_insurance_flag_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_insurance_flag_check
    CHECK (insurance_selected = false);
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_caution_mode_insurance_amount_check'
  ) THEN
    ALTER TABLE public.reservations DROP CONSTRAINT reservations_caution_mode_insurance_amount_check;
  END IF;

  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_caution_mode_insurance_amount_check
    CHECK (insurance_amount = 0);
END;
$$;

-- ------------------------------------------------------------
-- 2) Force annonces caution_mode = cb when column exists
-- ------------------------------------------------------------
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
    SET caution_mode = 'cb'
    WHERE caution_mode IS NULL
       OR lower(btrim(caution_mode)) <> 'cb';

    ALTER TABLE public.annonces
      ALTER COLUMN caution_mode SET DEFAULT 'cb',
      ALTER COLUMN caution_mode SET NOT NULL;

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

    ALTER TABLE public.annonces
      ADD CONSTRAINT annonces_caution_mode_check
      CHECK (caution_mode = 'cb');
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 3) Pickup columns cleanup
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.reservations
  ADD COLUMN IF NOT EXISTS pickup_handover_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_rental_started_at timestamptz,
  DROP COLUMN IF EXISTS pickup_caution_verified_at;

-- ------------------------------------------------------------
-- 4) Pickup checklist RPC with identity gate
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_reservation_pickup_step(
  p_reservation_id uuid,
  p_step text
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_step text := lower(coalesce(trim(p_step), ''));
  v_reservation public.reservations;
  v_start_session_closed_at timestamptz;
  v_identity_documents_available boolean := to_regclass('public.user_profile_documents') IS NOT NULL;
  v_renter_identity_verified boolean := false;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF v_role = 'anon' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF v_step NOT IN ('handover_completed', 'rental_started') THEN
    RAISE EXCEPTION 'Etape de demarrage invalide';
  END IF;

  SELECT r.*
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable';
  END IF;

  IF v_user_id NOT IN (v_reservation.owner_id, v_reservation.renter_id) THEN
    RAISE EXCEPTION 'Utilisateur non autorise pour cette reservation';
  END IF;

  IF lower(coalesce(v_reservation.status, '')) IN ('cancelled', 'cancelled_tenant_no_payment', 'rejected', 'refused', 'completed') THEN
    RAISE EXCEPTION 'Reservation non modifiable dans son etat actuel';
  END IF;

  IF v_reservation.start_date IS NULL THEN
    RAISE EXCEPTION 'Date de debut manquante';
  END IF;

  IF v_reservation.start_date::date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Ces validations ne sont possibles que le jour de la location';
  END IF;

  IF lower(coalesce(v_reservation.status, '')) NOT IN ('paid', 'active', 'ongoing', 'completed') THEN
    RAISE EXCEPTION 'Paiement confirme requis avant remise du mat?riel';
  END IF;

  IF NOT v_identity_documents_available THEN
    RAISE EXCEPTION '[IDENTITY_REQUIRED] Module de v?rification d?identit? indisponible. Impossible de valider la remise.';
  END IF;

  EXECUTE $q$
    SELECT EXISTS (
      SELECT 1
      FROM public.user_profile_documents d
      WHERE d.user_id = $1
        AND d.document_type = 'identity'
        AND d.status = 'approved'
    )
  $q$
  INTO v_renter_identity_verified
  USING v_reservation.renter_id;

  IF NOT v_renter_identity_verified THEN
    RAISE EXCEPTION '[IDENTITY_REQUIRED] V?rification d?identit? du locataire requise avant remise du mat?riel. D?posez une pi?ce d?identit? via /verification-identite-location.';
  END IF;

  SELECT s.closed_at
  INTO v_start_session_closed_at
  FROM public.reservation_inspection_sessions s
  WHERE s.reservation_id = p_reservation_id
    AND s.phase = 'start'
  ORDER BY s.closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_start_session_closed_at IS NULL THEN
    RAISE EXCEPTION 'Etat des lieux de remise requis via le protocole officiel';
  END IF;

  IF v_step = 'rental_started' AND v_reservation.pickup_handover_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Mat?riel remis au locataire non confirme';
  END IF;

  UPDATE public.reservations r
  SET
    pickup_handover_confirmed_at = CASE
      WHEN v_step = 'handover_completed'
      THEN coalesce(r.pickup_handover_confirmed_at, now())
      ELSE r.pickup_handover_confirmed_at
    END,
    pickup_rental_started_at = CASE
      WHEN v_step = 'rental_started'
      THEN coalesce(r.pickup_rental_started_at, now())
      ELSE r.pickup_rental_started_at
    END,
    status = CASE
      WHEN v_step = 'rental_started' AND lower(coalesce(r.status, '')) IN ('accepted', 'paid')
      THEN 'active'
      ELSE r.status
    END,
    updated_at = now()
  WHERE r.id = p_reservation_id;

  SELECT r.*
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  RETURN v_reservation;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_reservation_pickup_step(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_pickup_step(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 5) Enforce start/end inspection validations on matching day
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_inspection_phase_day_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_reservation_id uuid;
  v_phase text;
  v_start_date date;
  v_end_date date;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_should_check boolean := false;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'reservation_inspection_presence_confirmations' THEN
    v_reservation_id := NEW.reservation_id;
    v_phase := lower(coalesce(NEW.phase, ''));
    v_should_check := true;
  ELSIF TG_TABLE_NAME = 'reservation_inspection_sessions' THEN
    v_reservation_id := NEW.reservation_id;
    v_phase := lower(coalesce(NEW.phase, ''));

    IF TG_OP = 'INSERT' THEN
      v_should_check := (
        NEW.owner_presence_confirmed_at IS NOT NULL
        OR NEW.renter_presence_confirmed_at IS NOT NULL
        OR NEW.owner_photos_finalized_at IS NOT NULL
        OR NEW.renter_photos_finalized_at IS NOT NULL
      );
    ELSE
      v_should_check := (
        (NEW.owner_presence_confirmed_at IS DISTINCT FROM OLD.owner_presence_confirmed_at AND NEW.owner_presence_confirmed_at IS NOT NULL)
        OR (NEW.renter_presence_confirmed_at IS DISTINCT FROM OLD.renter_presence_confirmed_at AND NEW.renter_presence_confirmed_at IS NOT NULL)
        OR (NEW.owner_photos_finalized_at IS DISTINCT FROM OLD.owner_photos_finalized_at AND NEW.owner_photos_finalized_at IS NOT NULL)
        OR (NEW.renter_photos_finalized_at IS DISTINCT FROM OLD.renter_photos_finalized_at AND NEW.renter_photos_finalized_at IS NOT NULL)
      );
    END IF;
  END IF;

  IF NOT v_should_check THEN
    RETURN NEW;
  END IF;

  SELECT r.start_date::date, coalesce(r.end_date::date, r.start_date::date)
  INTO v_start_date, v_end_date
  FROM public.reservations r
  WHERE r.id = v_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable';
  END IF;

  IF v_phase = 'start' AND v_start_date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Validation debut autoris?e uniquement le jour de remise';
  END IF;

  IF v_phase = 'end' AND v_end_date IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'Validation fin autoris?e uniquement le jour de restitution';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.reservation_inspection_presence_confirmations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_inspection_phase_day_window_presence ON public.reservation_inspection_presence_confirmations;
    CREATE TRIGGER trg_enforce_inspection_phase_day_window_presence
    BEFORE INSERT OR UPDATE ON public.reservation_inspection_presence_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_inspection_phase_day_window();
  END IF;

  IF to_regclass('public.reservation_inspection_sessions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_inspection_phase_day_window_sessions ON public.reservation_inspection_sessions;
    CREATE TRIGGER trg_enforce_inspection_phase_day_window_sessions
    BEFORE INSERT OR UPDATE ON public.reservation_inspection_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_inspection_phase_day_window();
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 6) Legal wording (CGV + FAQ) aligned with non-debited imprint
-- ------------------------------------------------------------
UPDATE public.legal_pages
SET
  content = regexp_replace(
    coalesce(content, ''),
    'Une caution peut[^<]*\\.',
    'La caution est garantie uniquement par empreinte bancaire (CB) : il s?agit d?une autorisation bancaire non d?bit?e au paiement de la location. Elle est lib?r?e automatiquement ? la cl?ture sans litige. En cas de litige valide, elle peut etre capturee totalement ou partiellement selon le protocole officiel.',
    'gi'
  ),
  updated_at = now()
WHERE slug = 'cgv';

UPDATE public.faqs
SET
  answer = 'La caution est geree uniquement via empreinte bancaire (CB). C?est une autorisation bancaire non d?bit?e au paiement de la location. Elle est lib?r?e automatiquement ? la cl?ture sans litige.'
WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';

UPDATE public.faqs
SET
  answer = 'La caution n?est pas d?bit?e au paiement de la location : elle est autoris?e puis lib?r?e automatiquement ? la cl?ture sans litige, selon le workflow officiel.'
WHERE lower(coalesce(question, '')) LIKE 'quand la caution est-elle restitu%';

UPDATE public.faqs
SET
  answer = 'Le montant total d?bit? inclut les frais de service. L?empreinte bancaire (CB) de garantie, lorsqu elle est applicable, est autoris?e mais non d?bit?e.'
WHERE lower(coalesce(question, '')) LIKE 'pourquoi le montant final peut-il diff%';

UPDATE public.legal_pages
SET
  content = CASE
    WHEN position('V?rification d?identit? obligatoire apr?s paiement' in coalesce(content, '')) > 0
      THEN coalesce(content, '')
    ELSE coalesce(content, '')
      || '<h2>V?rification d?identit? obligatoire apr?s paiement</h2><p>Apr?s paiement, le locataire doit d?poser une pi?ce d?identit? valide sur la plateforme avant la remise du mat?riel. Sans validation, la remise ne peut pas etre confirm?e.</p><p>La caution par empreinte CB est une autorisation bancaire non d?bit?e au paiement de la location. En cas de non-restitution, fausse declaration, opposition bancaire abusive ou usurpation d?identit?, la plateforme peut conserver les preuves techniques, transmettre les elements aux autorites competentes et engager les recours civils et penaux applicables.</p>'
  END,
  updated_at = now()
WHERE slug = 'cgv';

UPDATE public.faqs
SET
  answer = 'La v?rification d?identit? (pi?ce d?identit?) est demandee pour prevenir la fraude, proteger le propri?taire et s?curiser juridiquement la transaction. Cette v?rification est obligatoire apr?s paiement et avant la remise du mat?riel. L?empreinte CB de caution reste une autorisation non d?bit?e.'
WHERE lower(coalesce(question, '')) LIKE 'pourquoi certains documents sont-ils demand%';

UPDATE public.faqs
SET
  answer = 'Si les documents obligatoires ne sont pas fournis ou valides a temps, la remise est bloqu?e et la reservation peut etre annul?e selon les r?gles de la plateforme.'
WHERE lower(coalesce(question, '')) LIKE 'que se passe-t-il si je ne fournis pas les documents a temps%';

INSERT INTO public.faqs (question, answer, sort_order, published, created_at)
SELECT
  'Pourquoi la v?rification d?identit? est-elle obligatoire apr?s paiement ?',
  'Apr?s paiement, le d?p?t d?une pi?ce d?identit? valide est obligatoire avant remise. Cette etape limite la fraude, renforce les preuves en cas de litige et protege les deux parties.',
  17,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.faqs
  WHERE lower(coalesce(question, '')) LIKE 'pourquoi la v?rification d?identit? est-elle obligatoire apr?s paiement%'
);

-- ------------------------------------------------------------
-- 7) Confidentiality precision for identity documents
-- ------------------------------------------------------------
UPDATE public.legal_pages
SET
  content = regexp_replace(
    coalesce(content, ''),
    'La caution par empreinte CB[^<]*\\.',
    'La caution par empreinte CB est une autorisation bancaire non debitee au paiement de la location. La piece d identite n est jamais communiquee aux proprietaires ni a des tiers externes a la plateforme, sauf obligation legale ou fraude etablie pour enclencher la procedure officielle. En cas de non-restitution, fausse declaration, opposition bancaire abusive ou usurpation d identite, la plateforme peut conserver les preuves techniques, transmettre les elements aux autorites competentes et engager les recours civils et penaux applicables.',
    'gi'
  ),
  updated_at = now()
WHERE slug = 'cgv';

UPDATE public.faqs
SET
  answer = 'La verification d identite (piece d identite) est demandee pour prevenir la fraude, proteger le proprietaire et securiser juridiquement la transaction. Cette verification est obligatoire apres paiement et avant la remise du materiel. La piece d identite n est jamais communiquee aux proprietaires ni a des tiers externes a la plateforme, sauf obligation legale ou fraude etablie pour enclencher la procedure officielle.'
WHERE lower(coalesce(question, '')) LIKE 'pourquoi certains documents sont-ils demand%';
