-- Align public wording after the deposit model switch:
-- caution is captured at payment and refunded on reservation closure (without dispute).

UPDATE public.legal_pages
SET
  content = regexp_replace(
    regexp_replace(
      coalesce(content, ''),
      'Frais de service plateforme : 15 ?%',
      'Commission plateforme : 12% du prix de location',
      'gi'
    ),
    'Une caution peut[^.]*autoris[^.]*\\.',
    'Une caution peut etre demandee et est pr?lev?e au moment du paiement, puis rembours?e automatiquement ? la cl?ture sans litige.',
    'gi'
  ),
  updated_at = now()
WHERE slug = 'cgv';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'faqs'
      AND column_name = 'updated_at'
  ) THEN
    UPDATE public.faqs
    SET
      answer = 'La caution est pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige. En cas de dommage ou de non-restitution, la decision de retenue suit le parcours officiel d''etat des lieux et de moderation.',
      updated_at = now()
    WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';
  ELSE
    UPDATE public.faqs
    SET
      answer = 'La caution est pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige. En cas de dommage ou de non-restitution, la decision de retenue suit le parcours officiel d''etat des lieux et de moderation.'
    WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';
  END IF;
END;
$$;

DO $$
DECLARE
  has_key boolean := false;
  has_template_key boolean := false;
  v_replacement text := 'apr?s deduction des frais applicables (commission plateforme et frais techniques de caution le cas echeant).';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'key'
  ) INTO has_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'template_key'
  ) INTO has_template_key;

  IF has_key THEN
    UPDATE public.email_templates
    SET
      body_html = regexp_replace(
        regexp_replace(
          coalesce(body_html, ''),
          'apr.{0,6}s d.{0,6}duction de la commission \\(13,5% \\+ 0,25.{0,6}\\)\\.',
          v_replacement,
          'gi'
        ),
        'apr.{0,6}s d.{0,6}duction de la commission \\(13\\.5% \\+ 0\\.25.{0,6}\\)\\.',
        v_replacement,
        'gi'
      ),
      updated_at = now()
    WHERE key = 'payment_received';
  END IF;

  IF has_template_key THEN
    UPDATE public.email_templates
    SET
      body_html = regexp_replace(
        regexp_replace(
          coalesce(body_html, ''),
          'apr.{0,6}s d.{0,6}duction de la commission \\(13,5% \\+ 0,25.{0,6}\\)\\.',
          v_replacement,
          'gi'
        ),
        'apr.{0,6}s d.{0,6}duction de la commission \\(13\\.5% \\+ 0\\.25.{0,6}\\)\\.',
        v_replacement,
        'gi'
      ),
      updated_at = now()
    WHERE template_key = 'payment_received';
  END IF;
END;
$$;
