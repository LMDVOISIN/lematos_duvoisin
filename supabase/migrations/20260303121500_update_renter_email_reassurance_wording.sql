-- Harmonize renter reassurance wording in transactional emails
-- Date: 2026-03-03
--
-- Adds a consistent reassurance sentence to renter-facing templates:
-- - reservation_accepted_renter
-- - payment_confirmed_renter
--
-- Compatibility:
-- - supports email_templates using either `key` or `template_key`
-- - appends only if sentence is not already present

DO $$
DECLARE
  v_id_column text;
  v_has_body_text boolean;
  v_notice_html text := '<p style="margin-top:16px;color:#1f2937;"><strong>Information importante :</strong> le montant est verse au propri?taire uniquement apr?s utilisation du mat?riel et validation de l''etat des lieux de retour par les deux parties.</p>';
  v_notice_text text := E'\n\nInformation importante : le montant est verse au propri?taire uniquement apr?s utilisation du mat?riel et validation de l''etat des lieux de retour par les deux parties.';
BEGIN
  IF to_regclass('public.email_templates') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'key'
  ) THEN
    v_id_column := 'key';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'template_key'
  ) THEN
    v_id_column := 'template_key';
  ELSE
    RETURN;
  END IF;

  v_has_body_text := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'body_text'
  );

  EXECUTE format(
    $sql$
      UPDATE public.email_templates
      SET
        body_html = coalesce(body_html, '') || %L,
        updated_at = now()
      WHERE %I IN ('reservation_accepted_renter', 'payment_confirmed_renter')
        AND position('etat des lieux de retour par les deux parties' in coalesce(body_html, '')) = 0
    $sql$,
    v_notice_html,
    v_id_column
  );

  IF v_has_body_text THEN
    EXECUTE format(
      $sql$
        UPDATE public.email_templates
        SET
          body_text = coalesce(body_text, '') || %L,
          updated_at = now()
        WHERE %I IN ('reservation_accepted_renter', 'payment_confirmed_renter')
          AND position('etat des lieux de retour par les deux parties' in coalesce(body_text, '')) = 0
      $sql$,
      v_notice_text,
      v_id_column
    );
  END IF;
END $$;
