-- Expand caution modes to include assurance and align wording.
-- Safe to run multiple times.

-- 1) Reservations caution_mode normalization + constraint
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

-- 2) annonces caution_mode normalization + constraint (if column exists)
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
      CHECK (caution_mode IN ('cb', 'cheque', 'assurance'));
  END IF;
END;
$$;

-- 3) Legal wording updates
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
