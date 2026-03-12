-- Clarify the current deposit-hold model:
-- - no automatic fee while the card authorization remains uncaptured
-- - fees can apply only after a validated capture tied to a dispute

DO $$
BEGIN
  IF to_regclass('public.faqs') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'faqs'
        AND column_name = 'updated_at'
    ) THEN
      UPDATE public.faqs
      SET
        answer = 'La caution est geree uniquement via empreinte bancaire (CB). C''est une autorisation bancaire non debitee au paiement de la location, puis liberee automatiquement a la cloture sans litige. Aucun frais de traitement n''est applique tant qu''elle n''est pas capturee. En cas de dommage ou de non-restitution valide, elle peut etre capturee totalement ou partiellement selon le protocole officiel ; des frais de paiement sur le montant capture et, en cas de contestation ulterieure, d''eventuels frais de litige peuvent alors s''appliquer selon le reseau de carte.',
        updated_at = now()
      WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';
    ELSE
      UPDATE public.faqs
      SET
        answer = 'La caution est geree uniquement via empreinte bancaire (CB). C''est une autorisation bancaire non debitee au paiement de la location, puis liberee automatiquement a la cloture sans litige. Aucun frais de traitement n''est applique tant qu''elle n''est pas capturee. En cas de dommage ou de non-restitution valide, elle peut etre capturee totalement ou partiellement selon le protocole officiel ; des frais de paiement sur le montant capture et, en cas de contestation ulterieure, d''eventuels frais de litige peuvent alors s''appliquer selon le reseau de carte.'
      WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';
    END IF;
  END IF;
END;
$$;

UPDATE public.legal_pages
SET
  content = regexp_replace(
    coalesce(content, ''),
    '(<h2>8\\.|<h2>8 )',
    '<p>Aucun frais de traitement n''est applique tant que l''empreinte CB de caution n''est pas capturee. En cas de capture totale ou partielle apres litige valide, des frais de paiement sur le montant capture et, en cas de contestation ulterieure, d''eventuels frais de litige peuvent s''appliquer selon le reseau de carte.</p>\1',
    'i'
  ),
  updated_at = now()
WHERE slug = 'cgv'
  AND coalesce(content, '') NOT ILIKE '%Aucun frais de traitement n''est applique tant que l''empreinte CB de caution n''est pas capturee.%';

DO $$
DECLARE
  has_key boolean := false;
  has_template_key boolean := false;
  v_body text := '<h1>Paiement confirme</h1><p>Le paiement de {{amount}}EUR pour la location de {{item_title}} a ete recu.</p><p>Vous recevrez {{owner_net}}EUR apres deduction des frais applicables a la location (commission plateforme et frais de paiement de la location).</p><p>Aucun frais n''est applique sur l''empreinte CB tant qu''elle n''est pas capturee. En cas de capture validee apres litige, des frais de paiement sur le montant capture et, le cas echeant, des frais de litige peuvent s''appliquer selon le reseau de carte.</p>';
BEGIN
  IF to_regclass('public.email_templates') IS NOT NULL THEN
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
        body_html = v_body,
        updated_at = now()
      WHERE key = 'payment_received';
    END IF;

    IF has_template_key THEN
      UPDATE public.email_templates
      SET
        body_html = v_body,
        updated_at = now()
      WHERE template_key = 'payment_received';
    END IF;
  END IF;
END;
$$;
