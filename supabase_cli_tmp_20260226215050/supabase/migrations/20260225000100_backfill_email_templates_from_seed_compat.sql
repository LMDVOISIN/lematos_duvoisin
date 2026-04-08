-- Backfill email templates from full_data_seed with schema compatibility (key/template_key)
-- Generated from supabase/migrations/20260219152000_full_data_seed.sql

DO $$
DECLARE
  has_key boolean;
  has_template_key boolean;
  has_category boolean;
  has_variables boolean;
  category_is_nullable text;
  category_default text;
  category_fallback text;
  category_check_def text;
  variables_default text;
  variables_udt_name text;
  stmt text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'key'
  ) INTO has_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'template_key'
  ) INTO has_template_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'category'
  ) INTO has_category;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'variables'
  ) INTO has_variables;

  IF NOT has_key AND NOT has_template_key THEN
    RAISE EXCEPTION 'public.email_templates must contain key or template_key';
  END IF;

  -- Compat for newer schema: category is often NOT NULL and omitted by legacy seed inserts.
  IF has_category THEN
    SELECT c.column_default, c.is_nullable
    INTO category_default, category_is_nullable
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'email_templates'
      AND c.column_name = 'category';

    IF category_default IS NULL AND category_is_nullable = 'NO' THEN
      -- Reuse an existing category value when possible so we satisfy any CHECK constraint.
      EXECUTE 'SELECT category FROM public.email_templates WHERE category IS NOT NULL LIMIT 1'
      INTO category_fallback;

      IF category_fallback IS NULL THEN
        SELECT pg_get_constraintdef(c.oid)
        INTO category_check_def
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'email_templates'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%category%'
        LIMIT 1;

        IF category_check_def IS NOT NULL THEN
          -- Example parsed from: CHECK ((category = ANY (ARRAY['account'::text,'...'])))
          category_fallback := (regexp_match(category_check_def, $rx$'([^']+)'::text$rx$))[1];
          IF category_fallback IS NULL THEN
            category_fallback := (regexp_match(category_check_def, $rx$'([^']+)'$rx$))[1];
          END IF;
        END IF;
      END IF;

      IF category_fallback IS NULL OR btrim(category_fallback) = '' THEN
        category_fallback := 'account';
      END IF;

      EXECUTE format(
        'ALTER TABLE public.email_templates ALTER COLUMN category SET DEFAULT %L',
        category_fallback
      );
    END IF;
  END IF;

  -- Compat for schemas where variables exists and has no default.
  IF has_variables THEN
    SELECT c.column_default, c.udt_name
    INTO variables_default, variables_udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'email_templates'
      AND c.column_name = 'variables';

    IF variables_default IS NULL THEN
      IF variables_udt_name = 'jsonb' THEN
        EXECUTE 'ALTER TABLE public.email_templates ALTER COLUMN variables SET DEFAULT ''[]''::jsonb';
      ELSIF variables_udt_name = 'json' THEN
        EXECUTE 'ALTER TABLE public.email_templates ALTER COLUMN variables SET DEFAULT ''[]''::json';
      ELSIF variables_udt_name = '_text' THEN
        EXECUTE 'ALTER TABLE public.email_templates ALTER COLUMN variables SET DEFAULT ARRAY[]::text[]';
      END IF;
    END IF;
  END IF;

  stmt := $seed$INSERT INTO public.email_templates ("key", "subject", "body_html", "body_text", "enabled", "created_at", "updated_at") VALUES
('annonce_moderation_alert', '[MODÉRATION] Nouvelle annonce à vérifier', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">🔍 Nouvelle annonce à modérer</h2>
    <p>Une nouvelle annonce nécessite votre validation :</p>
    <ul>
      <li><strong>Titre :</strong> {{annonce_title}}</li>
      <li><strong>Propriétaire :</strong> {{owner_name}} ({{owner_email}})</li>
      <li><strong>Catégorie :</strong> {{category}}</li>
      <li><strong>Prix :</strong> {{price}}€/jour</li>
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modérer maintenant</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('annonce_published_owner', 'Annonce publiée avec succès !', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Votre annonce est en ligne !</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Bonne nouvelle ! Votre annonce <strong>"{{annonce_title}}"</strong> a été validée et est maintenant visible par tous les utilisateurs.</p>
    <p><strong>Prochaines étapes :</strong></p>
    <ul>
      <li>Répondre rapidement aux demandes (sous 48h)</li>
      <li>Tenir votre calendrier de disponibilités à jour</li>
      <li>Prendre des photos de l''état de l''équipement avant chaque location</li>
    </ul>
    <p><a href="{{annonce_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce publiée</a></p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">Bonne location !<br>L''équipe Le Matos du Voisin</p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('annonce_rejected_owner', 'Annonce refusée - Action requise', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Annonce refusée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Malheureusement, votre annonce <strong>"{{annonce_title}}"</strong> n''a pas pu être validée.</p>
    <p><strong>Motif :</strong> {{rejection_reason}}</p>
    <p>Vous pouvez modifier votre annonce et la soumettre à nouveau pour validation.</p>
    <p><a href="{{annonce_edit_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modifier mon annonce</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('cancellations_owner_summary', '[ADMIN] Récapitulatif annulations propriétaires', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">📊 Récapitulatif annulations propriétaires</h2>
    <p>Récapitulatif des annulations côté propriétaires :</p>
    <ul>
      {{cancellations_list}}
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le détail</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('cancellations_renter_summary', '[MODÉRATION] Récapitulatif annulations locataires', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📊 Récapitulatif annulations</h2>
    <p>Récapitulatif des annulations côté locataires :</p>
    <ul>
      {{cancellations_list}}
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le détail</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('demande_created_renter', 'Demande de location envoyée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">Demande envoyée !</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre demande de location pour <strong>"{{annonce_title}}"</strong> a bien été reçue.</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Prix total :</strong> {{total_price}}€</li>
    </ul>
    <p>Le propriétaire a été notifié et vous répondra sous 48h maximum.</p>
    <p><a href="{{demande_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Suivre ma demande</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('demande_moderation_alert', '[MODÉRATION] Nouvelle demande de location à vérifier', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">🔍 Nouvelle demande à modérer</h2>
    <p>Une nouvelle demande de location nécessite votre validation :</p>
    <ul>
      <li><strong>Équipement :</strong> {{annonce_title}}</li>
      <li><strong>Demandeur :</strong> {{renter_name}} ({{renter_email}})</li>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Montant :</strong> {{total_price}}€</li>
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modérer maintenant</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('demande_rejected_renter', 'Demande refusée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Demande refusée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Malheureusement, votre demande pour <strong>"{{annonce_title}}"</strong> n''a pas pu être acceptée.</p>
    <p><strong>Motif :</strong> {{rejection_reason}}</p>
    <p>Vous pouvez rechercher d''autres équipements similaires disponibles aux mêmes dates.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('demande_validated_renter', 'Demande validée !', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Demande validée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre demande pour <strong>"{{annonce_title}}"</strong> a été validée par notre équipe.</p>
    <p>Le propriétaire peut maintenant accepter ou refuser votre demande. Vous serez notifié de sa décision.</p>
    <p><a href="{{demande_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma demande</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('deposit_released', '✅ Caution libérée', '<h1>Caution libérée</h1><p>La caution de {{deposit_amount}}€ pour la location de {{item_title}} a été libérée.</p><p>Merci d''avoir utilisé Le Matos du Voisin !</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('documents_complete_owner', 'Dossier locataire complet', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Dossier complet</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> est maintenant complet et validé.</p>
    <p><strong>Réservation :</strong> {{annonce_title}}</p>
    <p><strong>Dates :</strong> du {{start_date}} au {{end_date}}</p>
    <p>Vous pouvez finaliser la réservation et organiser le retrait de l''équipement.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Finaliser la réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('documents_incomplete_owner', 'Dossier locataire incomplet', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Dossier incomplet</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> pour la réservation de <strong>"{{annonce_title}}"</strong> est incomplet.</p>
    <p><strong>Documents manquants :</strong> {{missing_documents}}</p>
    <p>Le locataire a jusqu''au {{deadline}} pour compléter son dossier.</p>
    <p><a href="{{reservation_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('documents_incomplete_renter', 'Dossier incomplet - Action requise', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Dossier incomplet</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre dossier pour la réservation de <strong>"{{annonce_title}}"</strong> est incomplet.</p>
    <p><strong>Documents manquants :</strong></p>
    <ul>
      {{missing_documents_list}}
    </ul>
    <p><strong>⚠️ Vous avez jusqu''au {{deadline}} pour compléter votre dossier</strong>, sinon la réservation sera annulée.</p>
    <p><a href="{{documents_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Compléter mon dossier</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('documents_validation_owner', 'Dossier locataire en validation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔍 Dossier en validation</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> pour la réservation de <strong>"{{annonce_title}}"</strong> est en cours de validation.</p>
    <p>Vous recevrez un e-mail dès que le dossier sera validé et que vous pourrez finaliser la réservation.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('documents_validation_renter', 'Dossier en cours de validation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔍 Dossier en validation</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre dossier pour la réservation de <strong>"{{annonce_title}}"</strong> est en cours de validation par notre équipe.</p>
    <p>Ce processus prend généralement <strong>24h</strong>. Vous recevrez un e-mail dès que votre dossier sera validé.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Suivre ma réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('message_received', 'Nouveau message de {{sender_name}}', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">💬 Nouveau message</h2>
    <p>Bonjour {{recipient_name}},</p>
    <p>Vous avez reçu un nouveau message de <strong>{{sender_name}}</strong> :</p>
    <blockquote style="background-color: #f3f4f6; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
      {{message_preview}}
    </blockquote>
    <p><a href="{{message_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Lire et répondre</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('message_unread_reminder', 'Message non lu de {{sender_name}}', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⏰ Rappel : Message non lu</h2>
    <p>Bonjour {{recipient_name}},</p>
    <p>Vous avez un message non lu de <strong>{{sender_name}}</strong> depuis {{hours_ago}} heures.</p>
    <p>Une réponse rapide améliore l''expérience de tous les utilisateurs !</p>
    <p><a href="{{message_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Répondre maintenant</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('notifications_digest', 'Notifications non lues', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⏰ Notifications non lues</h2>
    <p>Bonjour {{user_name}},</p>
    <p>Vous avez <strong>{{unread_count}} notifications non lues</strong> depuis plus de 24h.</p>
    <p><a href="{{notifications_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Consulter maintenant</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('owner_auto_banned_alert', '[MODÉRATION] Propriétaire banni automatiquement', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">🚫 Bannissement automatique</h2>
    <p><strong>{{owner_name}}</strong> ({{owner_email}}) a été banni automatiquement après {{penalty_count}} pénalités.</p>
    <p><strong>Raison :</strong> Non-réponses répétées aux demandes de réservation</p>
    <p>Action requise : Vérifier le compte et décider de la suite.</p>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Gérer le compte</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('owner_no_reply_warning', '⚠️ Rappel : Demande en attente', '<h1>Vous avez une demande en attente</h1><p>{{renter_pseudo}} attend votre réponse pour {{item_title}}.</p><p>Attention : Sans réponse sous 48h, vous recevrez un strike.</p><p><a href="{{reservation_link}}">Répondre maintenant</a></p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('owner_penalties_alert', '[MODÉRATION] Propriétaire avec pénalités', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Alerte pénalités</h2>
    <p><strong>{{owner_name}}</strong> ({{owner_email}}) a cumulé <strong>{{penalty_count}} pénalités</strong> pour non-réponse.</p>
    <p><strong>Dernière pénalité :</strong> {{last_penalty_date}}</p>
    <p>Action recommandée : Vérifier le compte et contacter le propriétaire.</p>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le profil</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('payment_confirmed_owner', 'Paiement reçu pour votre location', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">💰 Paiement reçu</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le paiement de <strong>{{renter_name}}</strong> pour la location de <strong>"{{annonce_title}}"</strong> a été confirmé.</p>
    <p><strong>Montant :</strong> {{amount}}€</p>
    <p>Le montant sera transféré sur votre compte après la fin de la location.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('payment_confirmed_renter', 'Paiement confirmé', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Paiement confirmé</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre paiement de <strong>{{amount}}€</strong> pour la location de <strong>"{{annonce_title}}"</strong> a bien été reçu.</p>
    <p><strong>Montant provisionné :</strong> {{amount}}€ (caution incluse)</p>
    <p>La caution sera débloquée après la restitution de l''équipement en bon état.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('payment_received', '💰 Paiement reçu !', '<h1>Paiement confirmé</h1><p>Le paiement de {{amount}}€ pour la location de {{item_title}} a été reçu.</p><p>Vous recevrez {{owner_net}}€ après déduction de la commission (13,5% + 0,25€).</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('photo_pickup_reminder', 'Rappel : Photos obligatoires au retrait', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📸 Photos obligatoires</h2>
    <p>Bonjour {{user_name}},</p>
    <p><strong>Rappel important :</strong> Vous devez prendre des photos de l''état de l''équipement <strong>"{{annonce_title}}"</strong> lors du retrait.</p>
    <p><strong>Date de retrait :</strong> {{pickup_date}}</p>
    <p>Ces photos sont essentielles pour protéger les deux parties en cas de litige.</p>
    <p><a href="{{photos_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Prendre les photos</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('photo_return_reminder', 'Rappel : Photos obligatoires à la restitution', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📸 Photos de restitution obligatoires</h2>
    <p>Bonjour {{user_name}},</p>
    <p><strong>Rappel important :</strong> Vous devez prendre des photos de l''état de l''équipement <strong>"{{annonce_title}}"</strong> lors de la restitution.</p>
    <p><strong>Date de restitution :</strong> {{return_date}}</p>
    <p>Ces photos permettent de vérifier l''état de l''équipement et de débloquer la caution.</p>
    <p><a href="{{photos_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Prendre les photos</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reminder_documents', '📄 Documents manquants', '<h1>Documents requis</h1><p>Pour finaliser votre réservation de {{item_title}}, merci de fournir les documents suivants :<br>{{missing_docs}}</p><p>Date limite : {{deadline}}</p><p><a href="{{upload_link}}">Uploader mes documents</a></p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reminder_return', '🔔 Rappel : Retour équipement', '<h1>Retour dans 2 jours</h1><p>N''oubliez pas de rendre {{item_title}} le {{return_date}}.</p><p>Pensez à prendre des photos de l''état de l''équipement avant le retour.</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('rental_auto_completed_owner', 'Location terminée automatiquement', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée automatiquement</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La location de <strong>"{{annonce_title}}"</strong> à <strong>{{renter_name}}</strong> a été clôturée automatiquement.</p>
    <p>Le paiement sera transféré sur votre compte sous 48h.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('rental_auto_completed_renter', 'Location terminée automatiquement', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée automatiquement</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre location de <strong>"{{annonce_title}}"</strong> a été clôturée automatiquement car la date de fin est dépassée.</p>
    <p>Votre caution sera débloquée sous 48h si aucun problème n''est signalé.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_accepted', '✅ Votre réservation est acceptée !', '<h1>Bonne nouvelle !</h1><p>{{owner_pseudo}} a accepté votre demande de réservation pour {{item_title}}.</p><p>Prochaines étapes :<br>1. Payer la location<br>2. Fournir les documents requis<br>3. Convenir des modalités de remise</p><p><a href="{{reservation_link}}">Voir ma réservation</a></p>', NULL, true, '2026-02-14T17:00:22.015129+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_accepted_renter', 'Réservation acceptée !', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">🎉 Réservation acceptée !</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Bonne nouvelle ! Le propriétaire a accepté votre réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Prochaines étapes :</strong></p>
    <ol>
      <li>Complétez vos documents (pièce d''identité, justificatif de domicile)</li>
      <li>Effectuez le paiement sécurisé</li>
      <li>Prenez rendez-vous avec le propriétaire pour le retrait</li>
    </ol>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Finaliser ma réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_cancelled_documents_owner', 'Réservation annulée - Documents non fournis', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> a été annulée automatiquement.</p>
    <p><strong>Raison :</strong> Documents non fournis dans les délais</p>
    <p>Votre équipement est à nouveau disponible aux dates concernées.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_cancelled_documents_renter', 'Réservation annulée - Documents manquants', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation annulée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> a été annulée car vous n''avez pas fourni les documents requis dans les délais.</p>
    <p><strong>Documents manquants :</strong> {{missing_documents}}</p>
    <p>Vous pouvez effectuer une nouvelle demande si l''équipement est toujours disponible.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir l''annonce</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_cancelled_owner', 'Réservation annulée par le locataire', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p><strong>{{renter_name}}</strong> a annulé sa réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Dates concernées :</strong> du {{start_date}} au {{end_date}}</p>
    <p>Votre équipement est à nouveau disponible à ces dates.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_cancelled_renter', 'Réservation annulée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation annulée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> a été annulée.</p>
    <p><strong>Raison :</strong> {{cancellation_reason}}</p>
    <p>Si un paiement a été effectué, il sera remboursé sous 5 à 7 jours ouvrés.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_confirmed_owner', 'Réservation confirmée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Réservation confirmée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> est confirmée.</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Contact locataire :</strong> {{renter_contact}}</li>
    </ul>
    <p><strong>N''oubliez pas :</strong> Prenez des photos de l''état de l''équipement au retrait et à la restitution.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_confirmed_renter', 'Réservation confirmée !', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">🎉 Réservation confirmée !</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> est confirmée !</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Lieu de retrait :</strong> {{pickup_location}}</li>
      <li><strong>Contact propriétaire :</strong> {{owner_contact}}</li>
    </ul>
    <p><strong>N''oubliez pas :</strong> Prenez des photos de l''état de l''équipement au retrait et à la restitution.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_extended_owner', 'Demande de prolongation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">📅 Demande de prolongation</h2>
    <p>Bonjour {{owner_name}},</p>
    <p><strong>{{renter_name}}</strong> souhaite prolonger sa location de <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Nouvelle date de fin :</strong> {{new_end_date}}</p>
    <p><strong>Coût supplémentaire :</strong> {{additional_price}}€</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Accepter ou refuser</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_new_owner', 'Nouvelle demande de réservation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">📅 Nouvelle demande de réservation</h2>
    <p>Bonjour {{owner_name}},</p>
    <p><strong>{{renter_name}}</strong> souhaite louer votre équipement <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Prix total :</strong> {{total_price}}€</li>
    </ul>
    <p><strong>⚠️ Vous avez 48h pour répondre</strong>, sinon vous recevrez une pénalité.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la demande</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_received_renter', 'Demande de réservation envoyée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">✅ Demande envoyée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre demande de réservation pour <strong>"{{annonce_title}}"</strong> a bien été envoyée au propriétaire.</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Prix total :</strong> {{total_price}}€</li>
    </ul>
    <p>Le propriétaire a 48h pour répondre. Vous serez notifié de sa décision.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Suivre ma réservation</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_refused', '❌ Réservation refusée', '<h1>Réservation refusée</h1><p>Malheureusement, {{owner_pseudo}} ne peut pas accepter votre demande pour {{item_title}}.</p><p>Raison : {{refusal_reason}}</p><p>Explorez d''autres annonces similaires sur la plateforme.</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_refused_cancelled_owner', 'Réservation annulée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> a été annulée.</p>
    <p><strong>Raison :</strong> {{cancellation_reason}}</p>
    <p>Votre équipement est à nouveau disponible aux dates concernées.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_refused_renter', 'Réservation refusée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation refusée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Malheureusement, le propriétaire a refusé votre demande de réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Motif :</strong> {{refusal_reason}}</p>
    <p>Vous pouvez rechercher d''autres équipements similaires disponibles.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('reservation_request', '🔔 Nouvelle demande de réservation', '<h1>Vous avez reçu une nouvelle demande !</h1><p>{{renter_pseudo}} souhaite louer votre {{item_title}} du {{start_date}} au {{end_date}}.</p><p>Montant : {{total_price}}€</p><p><a href="{{reservation_link}}">Voir la demande</a></p><p>⚠️ Vous avez 48h pour répondre.</p>', NULL, true, '2026-02-14T17:00:22.015129+00:00', '2026-02-19T10:15:35.266528+00:00'),
('strike_notification', '⚠️ Strike reçu', '<h1>Vous avez reçu un strike</h1><p>Raison : {{strike_reason}}</p><p>Nombre total de strikes : {{total_strikes}}/3</p><p>⚠️ 3 strikes entraînent une suspension de compte.</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
('welcome', 'Bienvenue sur Le Matos du Voisin ! 🎉', '<h1>Bienvenue sur Le Matos du Voisin !</h1><p>Merci de rejoindre notre communauté de partage. Vous pouvez maintenant créer des annonces ou réserver du matériel près de chez vous.</p><p>Besoin d''aide ? Consultez notre FAQ ou contactez-nous.</p>', NULL, true, '2026-02-14T17:00:22.015129+00:00', '2026-02-19T10:15:35.266528+00:00'),
('notifications_summary', 'Résumé de vos notifications', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">📬 Résumé de vos notifications</h2>
    <p>Bonjour {{user_name}},</p>
    <p>Vous avez <strong>{{notification_count}} notifications</strong> en attente :</p>
    <ul>
      {{notifications_list}}
    </ul>
    <p><a href="{{notifications_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir toutes mes notifications</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('annonce_created_owner', 'Annonce créée - En attente de validation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">Annonce créée avec succès !</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Votre annonce <strong>"{{annonce_title}}"</strong> a bien été créée et est en attente de validation par notre équipe de modération.</p>
    <p>Ce processus prend généralement <strong>24 à 48 heures</strong>. Vous recevrez un e-mail dès que votre annonce sera publiée.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">Merci de votre confiance,<br>L''équipe Le Matos du Voisin</p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('rental_completed_owner', 'Location terminée', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La location de <strong>"{{annonce_title}}"</strong> à <strong>{{renter_name}}</strong> est terminée.</p>
    <p>Le paiement de <strong>{{amount}}€</strong> sera transféré sur votre compte sous 48h.</p>
    <p><strong>Laissez un avis :</strong> Partagez votre expérience avec ce locataire.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('rental_completed_renter', 'Location terminée - Merci !', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre location de <strong>"{{annonce_title}}"</strong> est terminée.</p>
    <p>Merci d''avoir utilisé notre plateforme ! Votre caution sera débloquée sous 48h après vérification de l''état de l''équipement.</p>
    <p><strong>Laissez un avis :</strong> Partagez votre expérience pour aider la communauté.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('annonce_status_change_internal', '[INFO] Changement statut annonce', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">ℹ️ Changement de statut</h2>
    <p>Une annonce a changé de statut :</p>
    <ul>
      <li><strong>Annonce :</strong> {{annonce_title}} ({{annonce_id}})</li>
      <li><strong>Ancien statut :</strong> {{old_status}}</li>
      <li><strong>Nouveau statut :</strong> {{new_status}}</li>
      <li><strong>Propriétaire :</strong> {{owner_name}} ({{owner_email}})</li>
    </ul>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('email_failure_documents', '[ALERTE] Échec envoi e-mail dossier complet', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Échec envoi e-mail</h2>
    <p>L''e-mail de confirmation de dossier complet n''a pas pu être envoyé :</p>
    <ul>
      <li><strong>Destinataire :</strong> {{recipient_email}}</li>
      <li><strong>Utilisateur :</strong> {{user_id}}</li>
      <li><strong>Erreur :</strong> {{error_message}}</li>
    </ul>
    <p>Action requise : Vérifier et renvoyer manuellement.</p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('email_failure_reservation', '[ALERTE] Échec envoi e-mail réservation', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Échec envoi e-mail</h2>
    <p>L''e-mail de réservation n''a pas pu être envoyé :</p>
    <ul>
      <li><strong>Destinataire :</strong> {{recipient_email}}</li>
      <li><strong>Template :</strong> {{template_key}}</li>
      <li><strong>Réservation :</strong> {{reservation_id}}</li>
      <li><strong>Erreur :</strong> {{error_message}}</li>
    </ul>
    <p>Action requise : Vérifier et renvoyer manuellement.</p>
  </div>', NULL, true, '2026-02-17T18:26:41.733096+00:00', '2026-02-19T10:15:35.266528+00:00'),
('test_admin', 'Test e-mail administrateur', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🧪 E-mail de test</h2>
    <p>Ceci est un e-mail de test envoyé depuis l''interface d''administration.</p>
    <p><strong>Date :</strong> {{test_date}}</p>
    <p><strong>Envoyé par :</strong> {{admin_name}}</p>
    <p>Si vous recevez cet e-mail, le système d''envoi fonctionne correctement.</p>
  </div>', NULL, true, '2026-02-18T20:10:56.641295+00:00', '2026-02-19T10:15:35.266528+00:00'),
('test_manual', 'Test manuel système', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔧 Test manuel</h2>
    <p>E-mail de test manuel pour contrôle de fonctionnement.</p>
    <p><strong>Message personnalisé :</strong> {{custom_message}}</p>
  </div>', NULL, true, '2026-02-18T20:10:56.641295+00:00', '2026-02-19T10:15:35.266528+00:00'),
('test_moderation_ping', '[TEST] Ping modération', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📡 Ping modération</h2>
    <p>Test de connectivité avec la boîte de modération.</p>
    <p><strong>Timestamp :</strong> {{timestamp}}</p>
  </div>', NULL, true, '2026-02-18T20:10:56.641295+00:00', '2026-02-19T10:15:35.266528+00:00'),
('test_technical', 'Test technique système e-mail', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Test technique</h2>
    <p>Test de vérification technique du système d''e-mails.</p>
    <p><strong>Variables testées :</strong></p>
    <ul>
      <li>Variable 1 : {{test_var_1}}</li>
      <li>Variable 2 : {{test_var_2}}</li>
    </ul>
  </div>', NULL, true, '2026-02-18T20:10:56.641295+00:00', '2026-02-19T10:15:35.266528+00:00')
ON CONFLICT DO NOTHING;
$seed$;

  IF has_template_key AND NOT has_key THEN
    stmt := replace(
      stmt,
      'INSERT INTO public.email_templates ("key", "subject", "body_html", "body_text", "enabled", "created_at", "updated_at")',
      'INSERT INTO public.email_templates ("template_key", "subject", "body_html", "body_text", "enabled", "created_at", "updated_at")'
    );
  END IF;

  EXECUTE stmt;
END $$;

SELECT COUNT(*) AS email_templates_count FROM public.email_templates;
