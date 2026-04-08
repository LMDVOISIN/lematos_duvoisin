-- EMAIL SYSTEM COMPLETE - UTF-8 SAFE

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON public.email_queue(created_at);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all emails" ON public.email_queue;
CREATE POLICY "Admins can view all emails"
  ON public.email_queue FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "System can insert emails" ON public.email_queue;
CREATE POLICY "System can insert emails"
  ON public.email_queue FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update emails" ON public.email_queue;
CREATE POLICY "System can update emails"
  ON public.email_queue FOR UPDATE
  USING (true);

-- Repair email template encoding (accents, symbols, emojis)
-- Generated on 2026-02-19 from current DB data

INSERT INTO public.email_templates (key, subject, body_html, enabled) VALUES
(
  $k1$annonce_created_owner$k1$,
  $s1$Annonce créée - En attente de validation$s1$,
  $b1$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">Annonce créée avec succès !</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Votre annonce <strong>"{{annonce_title}}"</strong> a bien été créée et est en attente de validation par notre équipe de modération.</p>
    <p>Ce processus prend généralement <strong>24 à 48 heures</strong>. Vous recevrez un e-mail dès que votre annonce sera publiée.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">Merci de votre confiance,<br>L'équipe Le Matos du Voisin</p>
  </div>$b1$,
  true
),

(
  $k2$annonce_moderation_alert$k2$,
  $s2$[MODÉRATION] Nouvelle annonce à vérifier$s2$,
  $b2$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">🔍 Nouvelle annonce à modérer</h2>
    <p>Une nouvelle annonce nécessite votre validation :</p>
    <ul>
      <li><strong>Titre :</strong> {{annonce_title}}</li>
      <li><strong>Propriétaire :</strong> {{owner_name}} ({{owner_email}})</li>
      <li><strong>Catégorie :</strong> {{category}}</li>
      <li><strong>Prix :</strong> {{price}}€/jour</li>
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modérer maintenant</a></p>
  </div>$b2$,
  true
),

(
  $k3$annonce_published_owner$k3$,
  $s3$Annonce publiée avec succès !$s3$,
  $b3$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Votre annonce est en ligne !</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Bonne nouvelle ! Votre annonce <strong>"{{annonce_title}}"</strong> a été validée et est maintenant visible par tous les utilisateurs.</p>
    <p><strong>Prochaines étapes :</strong></p>
    <ul>
      <li>Répondre rapidement aux demandes (sous 48h)</li>
      <li>Tenir votre calendrier de disponibilités à jour</li>
      <li>Prendre des photos de l'état de l'équipement avant chaque location</li>
    </ul>
    <p><a href="{{annonce_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce publiée</a></p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">Bonne location !<br>L'équipe Le Matos du Voisin</p>
  </div>$b3$,
  true
),

(
  $k4$annonce_rejected_owner$k4$,
  $s4$Annonce refusée - Action requise$s4$,
  $b4$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Annonce refusée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Malheureusement, votre annonce <strong>"{{annonce_title}}"</strong> n'a pas pu être validée.</p>
    <p><strong>Motif :</strong> {{rejection_reason}}</p>
    <p>Vous pouvez modifier votre annonce et la soumettre à nouveau pour validation.</p>
    <p><a href="{{annonce_edit_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modifier mon annonce</a></p>
  </div>$b4$,
  true
),

(
  $k5$annonce_status_change_internal$k5$,
  $s5$[INFO] Changement statut annonce$s5$,
  $b5$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">ℹ️ Changement de statut</h2>
    <p>Une annonce a changé de statut :</p>
    <ul>
      <li><strong>Annonce :</strong> {{annonce_title}} ({{annonce_id}})</li>
      <li><strong>Ancien statut :</strong> {{old_status}}</li>
      <li><strong>Nouveau statut :</strong> {{new_status}}</li>
      <li><strong>Propriétaire :</strong> {{owner_name}} ({{owner_email}})</li>
    </ul>
  </div>$b5$,
  true
),

(
  $k6$cancellations_owner_summary$k6$,
  $s6$[ADMIN] Récapitulatif annulations propriétaires$s6$,
  $b6$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">📊 Récapitulatif annulations propriétaires</h2>
    <p>Récapitulatif des annulations côté propriétaires :</p>
    <ul>
      {{cancellations_list}}
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le détail</a></p>
  </div>$b6$,
  true
),

(
  $k7$cancellations_renter_summary$k7$,
  $s7$[MODÉRATION] Récapitulatif annulations locataires$s7$,
  $b7$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📊 Récapitulatif annulations</h2>
    <p>Récapitulatif des annulations côté locataires :</p>
    <ul>
      {{cancellations_list}}
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le détail</a></p>
  </div>$b7$,
  true
),

(
  $k8$demande_created_renter$k8$,
  $s8$Demande de location envoyée$s8$,
  $b8$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
  </div>$b8$,
  true
),

(
  $k9$demande_moderation_alert$k9$,
  $s9$[MODÉRATION] Nouvelle demande de location à vérifier$s9$,
  $b9$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">🔍 Nouvelle demande à modérer</h2>
    <p>Une nouvelle demande de location nécessite votre validation :</p>
    <ul>
      <li><strong>Équipement :</strong> {{annonce_title}}</li>
      <li><strong>Demandeur :</strong> {{renter_name}} ({{renter_email}})</li>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Montant :</strong> {{total_price}}€</li>
    </ul>
    <p><a href="{{admin_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Modérer maintenant</a></p>
  </div>$b9$,
  true
),

(
  $k10$demande_rejected_renter$k10$,
  $s10$Demande refusée$s10$,
  $b10$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Demande refusée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Malheureusement, votre demande pour <strong>"{{annonce_title}}"</strong> n'a pas pu être acceptée.</p>
    <p><strong>Motif :</strong> {{rejection_reason}}</p>
    <p>Vous pouvez rechercher d'autres équipements similaires disponibles aux mêmes dates.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>$b10$,
  true
),

(
  $k11$demande_validated_renter$k11$,
  $s11$Demande validée !$s11$,
  $b11$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Demande validée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre demande pour <strong>"{{annonce_title}}"</strong> a été validée par notre équipe.</p>
    <p>Le propriétaire peut maintenant accepter ou refuser votre demande. Vous serez notifié de sa décision.</p>
    <p><a href="{{demande_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma demande</a></p>
  </div>$b11$,
  true
),

(
  $k12$deposit_released$k12$,
  $s12$✅ Caution libérée$s12$,
  $b12$<h1>Caution libérée</h1><p>La caution de {{deposit_amount}}€ pour la location de {{item_title}} a été libérée.</p><p>Merci d'avoir utilisé Le Matos du Voisin !</p>$b12$,
  true
),

(
  $k13$documents_complete_owner$k13$,
  $s13$Dossier locataire complet$s13$,
  $b13$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Dossier complet</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> est maintenant complet et validé.</p>
    <p><strong>Réservation :</strong> {{annonce_title}}</p>
    <p><strong>Dates :</strong> du {{start_date}} au {{end_date}}</p>
    <p>Vous pouvez finaliser la réservation et organiser le retrait de l'équipement.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Finaliser la réservation</a></p>
  </div>$b13$,
  true
),

(
  $k14$documents_incomplete_owner$k14$,
  $s14$Dossier locataire incomplet$s14$,
  $b14$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Dossier incomplet</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> pour la réservation de <strong>"{{annonce_title}}"</strong> est incomplet.</p>
    <p><strong>Documents manquants :</strong> {{missing_documents}}</p>
    <p>Le locataire a jusqu'au {{deadline}} pour compléter son dossier.</p>
    <p><a href="{{reservation_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>$b14$,
  true
),

(
  $k15$documents_incomplete_renter$k15$,
  $s15$Dossier incomplet - Action requise$s15$,
  $b15$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Dossier incomplet</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre dossier pour la réservation de <strong>"{{annonce_title}}"</strong> est incomplet.</p>
    <p><strong>Documents manquants :</strong></p>
    <ul>
      {{missing_documents_list}}
    </ul>
    <p><strong>⚠️ Vous avez jusqu'au {{deadline}} pour compléter votre dossier</strong>, sinon la réservation sera annulée.</p>
    <p><a href="{{documents_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Compléter mon dossier</a></p>
  </div>$b15$,
  true
),

(
  $k16$documents_validation_owner$k16$,
  $s16$Dossier locataire en validation$s16$,
  $b16$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔍 Dossier en validation</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le dossier de <strong>{{renter_name}}</strong> pour la réservation de <strong>"{{annonce_title}}"</strong> est en cours de validation.</p>
    <p>Vous recevrez un e-mail dès que le dossier sera validé et que vous pourrez finaliser la réservation.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>$b16$,
  true
),

(
  $k17$documents_validation_renter$k17$,
  $s17$Dossier en cours de validation$s17$,
  $b17$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔍 Dossier en validation</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre dossier pour la réservation de <strong>"{{annonce_title}}"</strong> est en cours de validation par notre équipe.</p>
    <p>Ce processus prend généralement <strong>24h</strong>. Vous recevrez un e-mail dès que votre dossier sera validé.</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Suivre ma réservation</a></p>
  </div>$b17$,
  true
),

(
  $k18$email_failure_documents$k18$,
  $s18$[ALERTE] Échec envoi e-mail dossier complet$s18$,
  $b18$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Échec envoi e-mail</h2>
    <p>L'e-mail de confirmation de dossier complet n'a pas pu être envoyé :</p>
    <ul>
      <li><strong>Destinataire :</strong> {{recipient_email}}</li>
      <li><strong>Utilisateur :</strong> {{user_id}}</li>
      <li><strong>Erreur :</strong> {{error_message}}</li>
    </ul>
    <p>Action requise : Vérifier et renvoyer manuellement.</p>
  </div>$b18$,
  true
),

(
  $k19$email_failure_reservation$k19$,
  $s19$[ALERTE] Échec envoi e-mail réservation$s19$,
  $b19$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Échec envoi e-mail</h2>
    <p>L'e-mail de réservation n'a pas pu être envoyé :</p>
    <ul>
      <li><strong>Destinataire :</strong> {{recipient_email}}</li>
      <li><strong>Template :</strong> {{template_key}}</li>
      <li><strong>Réservation :</strong> {{reservation_id}}</li>
      <li><strong>Erreur :</strong> {{error_message}}</li>
    </ul>
    <p>Action requise : Vérifier et renvoyer manuellement.</p>
  </div>$b19$,
  true
),

(
  $k20$message_received$k20$,
  $s20$Nouveau message de {{sender_name}}$s20$,
  $b20$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">💬 Nouveau message</h2>
    <p>Bonjour {{recipient_name}},</p>
    <p>Vous avez reçu un nouveau message de <strong>{{sender_name}}</strong> :</p>
    <blockquote style="background-color: #f3f4f6; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
      {{message_preview}}
    </blockquote>
    <p><a href="{{message_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Lire et répondre</a></p>
  </div>$b20$,
  true
),

(
  $k21$message_unread_reminder$k21$,
  $s21$Message non lu de {{sender_name}}$s21$,
  $b21$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⏰ Rappel : Message non lu</h2>
    <p>Bonjour {{recipient_name}},</p>
    <p>Vous avez un message non lu de <strong>{{sender_name}}</strong> depuis {{hours_ago}} heures.</p>
    <p>Une réponse rapide améliore l'expérience de tous les utilisateurs !</p>
    <p><a href="{{message_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Répondre maintenant</a></p>
  </div>$b21$,
  true
),

(
  $k22$notifications_digest$k22$,
  $s22$Notifications non lues$s22$,
  $b22$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⏰ Notifications non lues</h2>
    <p>Bonjour {{user_name}},</p>
    <p>Vous avez <strong>{{unread_count}} notifications non lues</strong> depuis plus de 24h.</p>
    <p><a href="{{notifications_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Consulter maintenant</a></p>
  </div>$b22$,
  true
),

(
  $k23$notifications_summary$k23$,
  $s23$Résumé de vos notifications$s23$,
  $b23$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">📬 Résumé de vos notifications</h2>
    <p>Bonjour {{user_name}},</p>
    <p>Vous avez <strong>{{notification_count}} notifications</strong> en attente :</p>
    <ul>
      {{notifications_list}}
    </ul>
    <p><a href="{{notifications_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir toutes mes notifications</a></p>
  </div>$b23$,
  true
),

(
  $k24$owner_auto_banned_alert$k24$,
  $s24$[MODÉRATION] Propriétaire banni automatiquement$s24$,
  $b24$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">🚫 Bannissement automatique</h2>
    <p><strong>{{owner_name}}</strong> ({{owner_email}}) a été banni automatiquement après {{penalty_count}} pénalités.</p>
    <p><strong>Raison :</strong> Non-réponses répétées aux demandes de réservation</p>
    <p>Action requise : Vérifier le compte et décider de la suite.</p>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Gérer le compte</a></p>
  </div>$b24$,
  true
),

(
  $k25$owner_no_reply_warning$k25$,
  $s25$⚠️ Rappel : Demande en attente$s25$,
  $b25$<h1>Vous avez une demande en attente</h1><p>{{renter_pseudo}} attend votre réponse pour {{item_title}}.</p><p>Attention : Sans réponse sous 48h, vous recevrez un strike.</p><p><a href="{{reservation_link}}">Répondre maintenant</a></p>$b25$,
  true
),

(
  $k26$owner_penalties_alert$k26$,
  $s26$[MODÉRATION] Propriétaire avec pénalités$s26$,
  $b26$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">⚠️ Alerte pénalités</h2>
    <p><strong>{{owner_name}}</strong> ({{owner_email}}) a cumulé <strong>{{penalty_count}} pénalités</strong> pour non-réponse.</p>
    <p><strong>Dernière pénalité :</strong> {{last_penalty_date}}</p>
    <p>Action recommandée : Vérifier le compte et contacter le propriétaire.</p>
    <p><a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir le profil</a></p>
  </div>$b26$,
  true
),

(
  $k27$payment_confirmed_owner$k27$,
  $s27$Paiement reçu pour votre location$s27$,
  $b27$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">💰 Paiement reçu</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>Le paiement de <strong>{{renter_name}}</strong> pour la location de <strong>"{{annonce_title}}"</strong> a été confirmé.</p>
    <p><strong>Montant :</strong> {{amount}}€</p>
    <p>Le montant sera transféré sur votre compte après la fin de la location.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>$b27$,
  true
),

(
  $k28$payment_confirmed_renter$k28$,
  $s28$Paiement confirmé$s28$,
  $b28$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Paiement confirmé</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre paiement de <strong>{{amount}}€</strong> pour la location de <strong>"{{annonce_title}}"</strong> a bien été reçu.</p>
    <p><strong>Montant provisionné :</strong> {{amount}}€ (caution incluse)</p>
    <p>La caution sera débloquée après la restitution de l'équipement en bon état.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma réservation</a></p>
  </div>$b28$,
  true
),

(
  $k29$payment_received$k29$,
  $s29$💰 Paiement reçu !$s29$,
  $b29$<h1>Paiement confirmé</h1><p>Le paiement de {{amount}}€ pour la location de {{item_title}} a été reçu.</p><p>Vous recevrez {{owner_net}}€ après déduction de la commission (13,5% + 0,25€).</p>$b29$,
  true
),

(
  $k30$photo_pickup_reminder$k30$,
  $s30$Rappel : Photos obligatoires au retrait$s30$,
  $b30$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📸 Photos obligatoires</h2>
    <p>Bonjour {{user_name}},</p>
    <p><strong>Rappel important :</strong> Vous devez prendre des photos de l'état de l'équipement <strong>"{{annonce_title}}"</strong> lors du retrait.</p>
    <p><strong>Date de retrait :</strong> {{pickup_date}}</p>
    <p>Ces photos sont essentielles pour protéger les deux parties en cas de litige.</p>
    <p><a href="{{photos_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Prendre les photos</a></p>
  </div>$b30$,
  true
),

(
  $k31$photo_return_reminder$k31$,
  $s31$Rappel : Photos obligatoires à la restitution$s31$,
  $b31$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📸 Photos de restitution obligatoires</h2>
    <p>Bonjour {{user_name}},</p>
    <p><strong>Rappel important :</strong> Vous devez prendre des photos de l'état de l'équipement <strong>"{{annonce_title}}"</strong> lors de la restitution.</p>
    <p><strong>Date de restitution :</strong> {{return_date}}</p>
    <p>Ces photos permettent de vérifier l'état de l'équipement et de débloquer la caution.</p>
    <p><a href="{{photos_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Prendre les photos</a></p>
  </div>$b31$,
  true
),

(
  $k32$reminder_documents$k32$,
  $s32$📄 Documents manquants$s32$,
  $b32$<h1>Documents requis</h1><p>Pour finaliser votre réservation de {{item_title}}, merci de fournir les documents suivants :<br>{{missing_docs}}</p><p>Date limite : {{deadline}}</p><p><a href="{{upload_link}}">Uploader mes documents</a></p>$b32$,
  true
),

(
  $k33$reminder_return$k33$,
  $s33$🔔 Rappel : Retour équipement$s33$,
  $b33$<h1>Retour dans 2 jours</h1><p>N'oubliez pas de rendre {{item_title}} le {{return_date}}.</p><p>Pensez à prendre des photos de l'état de l'équipement avant le retour.</p>$b33$,
  true
),

(
  $k34$rental_auto_completed_owner$k34$,
  $s34$Location terminée automatiquement$s34$,
  $b34$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée automatiquement</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La location de <strong>"{{annonce_title}}"</strong> à <strong>{{renter_name}}</strong> a été clôturée automatiquement.</p>
    <p>Le paiement sera transféré sur votre compte sous 48h.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>$b34$,
  true
),

(
  $k35$rental_auto_completed_renter$k35$,
  $s35$Location terminée automatiquement$s35$,
  $b35$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée automatiquement</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre location de <strong>"{{annonce_title}}"</strong> a été clôturée automatiquement car la date de fin est dépassée.</p>
    <p>Votre caution sera débloquée sous 48h si aucun problème n'est signalé.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>$b35$,
  true
),

(
  $k36$rental_completed_owner$k36$,
  $s36$Location terminée$s36$,
  $b36$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La location de <strong>"{{annonce_title}}"</strong> à <strong>{{renter_name}}</strong> est terminée.</p>
    <p>Le paiement de <strong>{{amount}}€</strong> sera transféré sur votre compte sous 48h.</p>
    <p><strong>Laissez un avis :</strong> Partagez votre expérience avec ce locataire.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>$b36$,
  true
),

(
  $k37$rental_completed_renter$k37$,
  $s37$Location terminée - Merci !$s37$,
  $b37$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Location terminée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre location de <strong>"{{annonce_title}}"</strong> est terminée.</p>
    <p>Merci d'avoir utilisé notre plateforme ! Votre caution sera débloquée sous 48h après vérification de l'état de l'équipement.</p>
    <p><strong>Laissez un avis :</strong> Partagez votre expérience pour aider la communauté.</p>
    <p><a href="{{review_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Laisser un avis</a></p>
  </div>$b37$,
  true
),

(
  $k38$reservation_accepted$k38$,
  $s38$✅ Votre réservation est acceptée !$s38$,
  $b38$<h1>Bonne nouvelle !</h1><p>{{owner_pseudo}} a accepté votre demande de réservation pour {{item_title}}.</p><p>Prochaines étapes :<br>1. Payer la location<br>2. Fournir les documents requis<br>3. Convenir des modalités de remise</p><p><a href="{{reservation_link}}">Voir ma réservation</a></p>$b38$,
  true
),

(
  $k39$reservation_accepted_renter$k39$,
  $s39$Réservation acceptée !$s39$,
  $b39$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">🎉 Réservation acceptée !</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Bonne nouvelle ! Le propriétaire a accepté votre réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Prochaines étapes :</strong></p>
    <ol>
      <li>Complétez vos documents (pièce d'identité, justificatif de domicile)</li>
      <li>Effectuez le paiement sécurisé</li>
      <li>Prenez rendez-vous avec le propriétaire pour le retrait</li>
    </ol>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Finaliser ma réservation</a></p>
  </div>$b39$,
  true
),

(
  $k40$reservation_cancelled_documents_owner$k40$,
  $s40$Réservation annulée - Documents non fournis$s40$,
  $b40$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> a été annulée automatiquement.</p>
    <p><strong>Raison :</strong> Documents non fournis dans les délais</p>
    <p>Votre équipement est à nouveau disponible aux dates concernées.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>$b40$,
  true
),

(
  $k41$reservation_cancelled_documents_renter$k41$,
  $s41$Réservation annulée - Documents manquants$s41$,
  $b41$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation annulée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> a été annulée car vous n'avez pas fourni les documents requis dans les délais.</p>
    <p><strong>Documents manquants :</strong> {{missing_documents}}</p>
    <p>Vous pouvez effectuer une nouvelle demande si l'équipement est toujours disponible.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir l'annonce</a></p>
  </div>$b41$,
  true
),

(
  $k42$reservation_cancelled_owner$k42$,
  $s42$Réservation annulée par le locataire$s42$,
  $b42$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p><strong>{{renter_name}}</strong> a annulé sa réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Dates concernées :</strong> du {{start_date}} au {{end_date}}</p>
    <p>Votre équipement est à nouveau disponible à ces dates.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>$b42$,
  true
),

(
  $k43$reservation_cancelled_renter$k43$,
  $s43$Réservation annulée$s43$,
  $b43$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation annulée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> a été annulée.</p>
    <p><strong>Raison :</strong> {{cancellation_reason}}</p>
    <p>Si un paiement a été effectué, il sera remboursé sous 5 à 7 jours ouvrés.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>$b43$,
  true
),

(
  $k44$reservation_confirmed_owner$k44$,
  $s44$Réservation confirmée$s44$,
  $b44$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Réservation confirmée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> est confirmée.</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Contact locataire :</strong> {{renter_contact}}</li>
    </ul>
    <p><strong>N'oubliez pas :</strong> Prenez des photos de l'état de l'équipement au retrait et à la restitution.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir la réservation</a></p>
  </div>$b44$,
  true
),

(
  $k45$reservation_confirmed_renter$k45$,
  $s45$Réservation confirmée !$s45$,
  $b45$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">🎉 Réservation confirmée !</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Votre réservation pour <strong>"{{annonce_title}}"</strong> est confirmée !</p>
    <p><strong>Détails :</strong></p>
    <ul>
      <li><strong>Dates :</strong> du {{start_date}} au {{end_date}}</li>
      <li><strong>Lieu de retrait :</strong> {{pickup_location}}</li>
      <li><strong>Contact propriétaire :</strong> {{owner_contact}}</li>
    </ul>
    <p><strong>N'oubliez pas :</strong> Prenez des photos de l'état de l'équipement au retrait et à la restitution.</p>
    <p><a href="{{reservation_url}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir ma réservation</a></p>
  </div>$b45$,
  true
),

(
  $k46$reservation_extended_owner$k46$,
  $s46$Demande de prolongation$s46$,
  $b46$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">📅 Demande de prolongation</h2>
    <p>Bonjour {{owner_name}},</p>
    <p><strong>{{renter_name}}</strong> souhaite prolonger sa location de <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Nouvelle date de fin :</strong> {{new_end_date}}</p>
    <p><strong>Coût supplémentaire :</strong> {{additional_price}}€</p>
    <p><a href="{{reservation_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Accepter ou refuser</a></p>
  </div>$b46$,
  true
),

(
  $k47$reservation_new_owner$k47$,
  $s47$Nouvelle demande de réservation$s47$,
  $b47$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
  </div>$b47$,
  true
),

(
  $k48$reservation_received_renter$k48$,
  $s48$Demande de réservation envoyée$s48$,
  $b48$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
  </div>$b48$,
  true
),

(
  $k49$reservation_refused$k49$,
  $s49$❌ Réservation refusée$s49$,
  $b49$<h1>Réservation refusée</h1><p>Malheureusement, {{owner_pseudo}} ne peut pas accepter votre demande pour {{item_title}}.</p><p>Raison : {{refusal_reason}}</p><p>Explorez d'autres annonces similaires sur la plateforme.</p>$b49$,
  true
),

(
  $k50$reservation_refused_cancelled_owner$k50$,
  $s50$Réservation annulée$s50$,
  $b50$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">⚠️ Réservation annulée</h2>
    <p>Bonjour {{owner_name}},</p>
    <p>La réservation de <strong>{{renter_name}}</strong> pour <strong>"{{annonce_title}}"</strong> a été annulée.</p>
    <p><strong>Raison :</strong> {{cancellation_reason}}</p>
    <p>Votre équipement est à nouveau disponible aux dates concernées.</p>
    <p><a href="{{annonce_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Voir mon annonce</a></p>
  </div>$b50$,
  true
),

(
  $k51$reservation_refused_renter$k51$,
  $s51$Réservation refusée$s51$,
  $b51$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #dc2626;">❌ Réservation refusée</h2>
    <p>Bonjour {{renter_name}},</p>
    <p>Malheureusement, le propriétaire a refusé votre demande de réservation pour <strong>"{{annonce_title}}"</strong>.</p>
    <p><strong>Motif :</strong> {{refusal_reason}}</p>
    <p>Vous pouvez rechercher d'autres équipements similaires disponibles.</p>
    <p><a href="{{search_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Rechercher un équipement</a></p>
  </div>$b51$,
  true
),

(
  $k52$reservation_request$k52$,
  $s52$🔔 Nouvelle demande de réservation$s52$,
  $b52$<h1>Vous avez reçu une nouvelle demande !</h1><p>{{renter_pseudo}} souhaite louer votre {{item_title}} du {{start_date}} au {{end_date}}.</p><p>Montant : {{total_price}}€</p><p><a href="{{reservation_link}}">Voir la demande</a></p><p>⚠️ Vous avez 48h pour répondre.</p>$b52$,
  true
),

(
  $k53$strike_notification$k53$,
  $s53$⚠️ Strike reçu$s53$,
  $b53$<h1>Vous avez reçu un strike</h1><p>Raison : {{strike_reason}}</p><p>Nombre total de strikes : {{total_strikes}}/3</p><p>⚠️ 3 strikes entraînent une suspension de compte.</p>$b53$,
  true
),

(
  $k54$test_admin$k54$,
  $s54$Test e-mail administrateur$s54$,
  $b54$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🧪 E-mail de test</h2>
    <p>Ceci est un e-mail de test envoyé depuis l'interface d'administration.</p>
    <p><strong>Date :</strong> {{test_date}}</p>
    <p><strong>Envoyé par :</strong> {{admin_name}}</p>
    <p>Si vous recevez cet e-mail, le système d'envoi fonctionne correctement.</p>
  </div>$b54$,
  true
),

(
  $k55$test_manual$k55$,
  $s55$Test manuel système$s55$,
  $b55$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">🔧 Test manuel</h2>
    <p>E-mail de test manuel pour contrôle de fonctionnement.</p>
    <p><strong>Message personnalisé :</strong> {{custom_message}}</p>
  </div>$b55$,
  true
),

(
  $k56$test_moderation_ping$k56$,
  $s56$[TEST] Ping modération$s56$,
  $b56$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">📡 Ping modération</h2>
    <p>Test de connectivité avec la boîte de modération.</p>
    <p><strong>Timestamp :</strong> {{timestamp}}</p>
  </div>$b56$,
  true
),

(
  $k57$test_technical$k57$,
  $s57$Test technique système e-mail$s57$,
  $b57$<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">✅ Test technique</h2>
    <p>Test de vérification technique du système d'e-mails.</p>
    <p><strong>Variables testées :</strong></p>
    <ul>
      <li>Variable 1 : {{test_var_1}}</li>
      <li>Variable 2 : {{test_var_2}}</li>
    </ul>
  </div>$b57$,
  true
),

(
  $k58$welcome$k58$,
  $s58$Bienvenue sur Le Matos du Voisin ! 🎉$s58$,
  $b58$<h1>Bienvenue sur Le Matos du Voisin !</h1><p>Merci de rejoindre notre communauté de partage. Vous pouvez maintenant créer des annonces ou réserver du matériel près de chez vous.</p><p>Besoin d'aide ? Consultez notre FAQ ou contactez-nous.</p>$b58$,
  true
)

ON CONFLICT (key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

SELECT COUNT(*) AS email_templates_count FROM public.email_templates;
