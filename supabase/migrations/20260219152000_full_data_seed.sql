-- Full data seed (non-empty and accessible tables)
-- Generated from current Supabase project via anon key
-- Generated at: 2026-02-19T14:48:35.334Z

BEGIN;
-- =============================================
-- profiles (2 rows)
-- =============================================
INSERT INTO public.profiles ("id", "pseudo", "email", "phone", "avatar_url", "address", "city", "postal_code", "is_admin", "stripe_account_id", "stripe_customer_id", "no_reply_strikes", "banned_at", "ban_reason", "created_at", "updated_at") VALUES
('30e9c1e9-061b-45d2-a379-a4b5f82ee241', 'Papa', 'rabii@loeni.com', '0661342454', NULL, '298 Route DES NICOUX - 19600 Saint-Pantaléon-de-Larche - France', 'Saint-Pantaléon-de-Larche', '19600', false, NULL, NULL, 0, NULL, NULL, '2025-11-07T12:05:08.64+00:00', '2026-02-16T20:36:37.199608+00:00'),
('99703091-35c8-4f80-a948-7472a56c6730', 'rabii', 'rabii@tellr.fr', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0, NULL, NULL, '2026-02-12T16:24:03.789+00:00', '2026-02-16T20:36:37.199608+00:00')
ON CONFLICT DO NOTHING;
SELECT COUNT(*) AS profiles_count FROM public.profiles;


-- =============================================
-- categories (10 rows)
-- =============================================
INSERT INTO public.categories ("id", "nom", "slug", "icon_url", "created_at") VALUES
(1, 'Jardinage', 'jardinage', NULL, '2026-02-14T17:00:22.015129+00:00'),
(2, 'Électroménager', 'electromenager', NULL, '2026-02-14T17:00:22.015129+00:00'),
(3, 'Bricolage', 'bricolage', NULL, '2026-02-14T17:00:22.015129+00:00'),
(4, 'Hi-Tech', 'hi-tech', NULL, '2026-02-14T17:00:22.015129+00:00'),
(5, 'Maison & Mobilier', 'maison-mobilier', NULL, '2026-02-14T17:00:22.015129+00:00'),
(6, 'Sports & Bien-être', 'sports-bien-etre', NULL, '2026-02-14T17:00:22.015129+00:00'),
(13, 'Fêtes & Événements', 'fetes-evenements', NULL, '2026-02-15T16:53:38.713381+00:00'),
(14, 'Cuisine', 'cuisine', NULL, '2026-02-15T16:53:38.713381+00:00'),
(15, 'Auto & Moto', 'auto-moto', NULL, '2026-02-15T16:53:38.713381+00:00'),
(16, 'Enfants & Bébés', 'enfants-bebes', NULL, '2026-02-15T16:53:38.713381+00:00')
ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.categories', 'id'), COALESCE((SELECT MAX(id) FROM public.categories), 1), true);
SELECT COUNT(*) AS categories_count FROM public.categories;


-- =============================================
-- faqs (68 rows)
-- =============================================
INSERT INTO public.faqs ("id", "question", "answer", "sort_order", "published", "created_at") VALUES
(2, 'Comment annuler une réservation ?', 'Connectez-vous à votre compte, allez dans Mes réservations, sélectionnez la réservation concernée puis cliquez sur Annuler la réservation. Le remboursement ou la libération de la caution s’effectue automatiquement selon le statut et les conditions d’annulation.', 20, true, '2025-08-23T20:32:57.601574+00:00'),
(1, 'Comment fonctionne la caution ?', 'La caution depend du mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver. Mode CB : caution pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige. Mode cheque : cheque de caution remis en main propre au propri?taire lors de la remise du mat?riel, avec conservation d?une pi?ce d?identit? et v?rification CNI. Mode assurance : pas de caution CB ni cheque, protection via assurance. Les modes CB et cheque sont gratuits pour le locataire.', 10, true, '2025-08-23T20:32:57.601574+00:00'),
(5, 'Quels types d''objets puis-je louer ?', 'Outils, jardinage, mobilier, electronique, evenementiel ou demenagement : les annonces couvrent tous les besoins du quotidien.', 21, true, '2025-12-29T20:43:01.321557+00:00'),
(19, 'Que se passe-t-il si je rends l’objet avant la date de fin ?', 'L’objet peut être restitué avant la date prévue, mais aucun remboursement partiel n’est effectué pour une restitution anticipée. Pour éviter de payer l’intégralité de la période réservée, il est fortement conseillé d’annuler directement sur la plateforme les jours non utilisés, ce qui permet de limiter le coût?aux seuls frais d’annulation applicables.', 9, true, '2026-01-09T09:51:49.164924+00:00'),
(7, 'Que se passe-t-il apr?s la demande ?', 'Vous recevez une reponse dans votre espace, puis vous finalisez la location avec un calendrier et un suivi clair.', 23, true, '2025-12-29T20:44:31.896248+00:00'),
(9, 'Comment puis je déterminer un prix efficace de location?', 'Pour déterminer un prix de location efficace, basez-vous sur le prix neuf de l’objet, la durée d’utilisation et la demande locale, puis ajustez après vos premières locations. Un simulateur de prix est mis à votre disposition sur la plateforme pour vous aider à définir un tarif juste, attractif et cohérent avec le marché local.', 25, true, '2025-12-30T10:31:39.734425+00:00'),
(3, 'Je ne reçoit pas d''email de confirmation ou tout autre email !', 'Si vous avez une adresse Free, cela peut poser des problèmes car Free bloque régulièrement de notre prestataire d’emailing, nous conseillons d’utiliser une autre adresse email, si vous devez absolument utiliser une adresse free vous pouvez nous contacter sur notre page assistance pour débloquer votre email.', 0, true, '2025-08-25T11:21:45.185659+00:00'),
(10, 'Que se passe t''il si mon locataire ne vient pas récupérer l''objet?', 'Si le locataire ne se présente pas pour récupérer l’objet, la réservation est considérée comme honorée et aucun remboursement n’est dû, sauf accord amiable entre les parties. Le propriétaire est alors indemnisé selon les conditions prévues, et l’équipe de modération peut intervenir en cas de litige.', 26, true, '2025-12-30T10:34:04.178119+00:00'),
(11, 'Comment réserver un objet ?', 'Choisissez une annonce, sélectionnez vos dates, puis finalisez la réservation. La réservation est enregistrée dès lors que toutes les étapes requises (paiement, documents, conditions éventuelles) sont complétées dans les délais demandés.', 1, true, '2026-01-09T09:51:49.164924+00:00'),
(12, 'Puis-je réserver pour quelqu’un d’autre ?', 'Oui, mais la personne qui effectue la réservation reste entièrement responsable. En cas de litige, dommage ou non-respect des conditions, le compte ayant réservé est tenu responsable, même si l’objet est utilisé par un tiers.', 2, true, '2026-01-09T09:51:49.164924+00:00'),
(16, 'Le calendrier est-il mis à jour en temps réel ?', 'Oui, toute réservation ou blocage est immédiatement reflété sur le calendrier de l’annonce.', 6, true, '2026-01-09T09:51:49.164924+00:00'),
(13, 'Puis-je réserver longtemps à l’avance ?', 'Oui, tant que le calendrier de l’annonce est ouvert. Toutes les modalités de réservation (paiement, documents, conditions) doivent être complétées dans les délais demandés, faute de quoi la réservation peut être annulée automatiquement.', 3, true, '2026-01-09T09:51:49.164924+00:00'),
(14, 'Puis-je réserver le jour même ?', 'Oui, si l’annonce l’autorise et si toutes les conditions peuvent être validées à temps.', 4, true, '2026-01-09T09:51:49.164924+00:00'),
(15, 'Pourquoi certaines dates sont-elles indisponibles ?', 'Les dates peuvent être indisponibles si elles sont déjà réservées, bloquées par le propriétaire, ou hors des jours autorisés pour la remise ou la restitution.', 5, true, '2026-01-09T09:51:49.164924+00:00'),
(17, 'Puis-je modifier les dates après réservation ?', 'Non. Une réservation validée ne peut pas être modifiée. Il est nécessaire d’annuler la réservation existante et d’en créer une nouvelle avec les bonnes dates.', 7, true, '2026-01-09T09:51:49.164924+00:00'),
(18, 'Puis-je annuler une réservation ?', 'Oui, depuis votre espace personnel. Les conséquences (frais, remboursement éventuel) dépendent du moment de l’annulation et des règles applicables.', 8, true, '2026-01-09T09:51:49.164924+00:00'),
(20, 'Quand suis-je débité(e) ?', 'Toute réservation implique un paiement. Le débit intervient lors de la validation de la réservation, selon le mode de paiement prévu.', 10, true, '2026-01-09T09:51:49.164924+00:00'),
(6, 'Comment contacter un propri?taire ?', 'Chaque annonce propose un bouton de contact pour échanger avec le propriétaire de l''objet.', 22, true, '2025-12-29T20:43:56.984814+00:00'),
(8, 'Puis-je proposer mon matériel ?', 'Oui, publiez votre annonce en quelques minutes et gerer vos disponibilites depuis votre compte.', 24, true, '2025-12-29T20:44:56.150687+00:00'),
(22, 'Pourquoi le montant final peut-il différer du prix affiché ?', 'Le montant total peut inclure des frais de service et, selon le mode choisi, une caution bancaire (mode CB) ou une assurance. En mode cheque, aucune caution n?est d?bit?e en ligne : le cheque est remis en main propre au propri?taire avec conservation d?une pi?ce d?identit? et v?rification CNI.', 12, true, '2026-01-09T09:51:49.164924+00:00'),
(23, 'Vais-je recevoir une facture ?', 'Un récapitulatif de paiement est disponible depuis la réservation. Il ne s’agit pas d’une facture au sens strict : seuls les frais de service de la plateforme peuvent faire l’objet d’une facture.', 13, true, '2026-01-09T09:51:49.164924+00:00'),
(26, 'Quand la caution est-elle restituée ?', 'Mode CB : la caution est rembours?e automatiquement ? la cl?ture sans litige. Mode cheque : le cheque est restitue au locataire ? la fin de location si aucun dommage ni litige n?est constate. Mode assurance : aucune caution CB ni cheque n?est restituee car la protection passe par l?assurance.', 16, true, '2026-01-09T09:51:49.164924+00:00'),
(27, 'Pourquoi certains documents sont-ils demandés??', 'Certains objets nécessitent des justificatifs (identité, assurance, etc.) afin de sécuriser la location.', 17, true, '2026-01-09T09:51:49.164924+00:00'),
(28, 'Que se passe-t-il si je ne fournis pas les documents à temps ?', 'La réservation peut être annulée automatiquement si les conditions ne sont pas remplies dans les délais.', 18, true, '2026-01-09T09:51:49.164924+00:00'),
(29, 'Où transmettre mes documents ?', 'Directement depuis la réservation concernée, dans l’espace prévu à cet effet.', 19, true, '2026-01-09T09:51:49.164924+00:00'),
(30, 'Comment s’organise la remise et le retour de l’objet ?', 'Les modalités (lieu, heure, conditions) sont définies vi? la messagerie de la réservation.', 20, true, '2026-01-09T09:51:49.164924+00:00'),
(32, 'Que faire en cas de retard ?', 'Prévenez immédiatement l’autre partie vi? la messagerie. Un retard peut compromettre la remise ou la restitution.', 22, true, '2026-01-09T09:51:49.164924+00:00'),
(33, 'Comment contacter l’autre partie ?', 'Chaque réservation donne accès à une messagerie dédiée pour échanger avant, pendant et après la location.', 23, true, '2026-01-09T09:51:49.164924+00:00'),
(34, 'Pourquoi utiliser la messagerie de la plateforme ?', 'Elle permet de conserver un historique officiel des échanges en cas de litige.', 24, true, '2026-01-09T09:51:49.164924+00:00'),
(35, 'Que faire si l’objet ne correspond pas à l’annonce ?', 'Signalez-le immédiatement depuis la réservation, avec photos si possible.', 25, true, '2026-01-09T09:51:49.164924+00:00'),
(36, 'Que faire si l’objet tombe en panne pendant la location ?', 'Le problème doit être signalé rapidement afin qu’une solution adaptée puisse être proposée.', 26, true, '2026-01-09T09:51:49.164924+00:00'),
(37, 'Que se passe-t-il si l’objet est rendu abîmé ?', 'Le propriétaire peut signaler un incident. La caution peut être utilisée après?analyse des éléments fournis.', 27, true, '2026-01-09T09:51:49.164924+00:00'),
(38, 'Que faire si l’objet n’est pas restitué ?', 'L’incident doit être signalé depuis la réservation afin que l’équipe puisse intervenir.', 28, true, '2026-01-09T09:51:49.164924+00:00'),
(39, 'Comment déclarer un litige ?', 'Depuis la réservation concernée, en expliquant la situation et en ajoutant les preuves disponibles (photos, messages).', 29, true, '2026-01-09T09:51:49.164924+00:00'),
(40, 'Puis-je être locataire et propriétaire avec le même compte ?', 'Oui, un même compte peut à la fois louer et proposer du matériel.', 30, true, '2026-01-09T09:51:49.164924+00:00'),
(31, 'L’état des lieux est-il obligatoire ?', 'Oui, l’état des lieux est obligatoire. Il permet de constater l’état de l’objet au départ et au retour et sert de référence en cas de litige.', 21, true, '2026-01-09T09:51:49.164924+00:00'),
(25, 'Qui est responsable en cas de vol ou de dommage ?', 'La personne en possession de l’objet au moment des faits est responsable. En cas de litige, la responsabilité du remboursement et de l''annulation s’applique à l’utilisateur qui a l’objet sous sa garde à ce moment-là.', 15, true, '2026-01-09T09:51:49.164924+00:00'),
(21, 'Puis-je payer en plusieurs fois ?', 'Une réservation implique un paiement. Si la location s’étend sur plusieurs jours, un paiement jour par jour est possible uniquement si le calendrier le permet et que les contraintes du propriétaire l’autorisent. Sinon, la période doit être réglée selon les modalités prévues.', 11, true, '2026-01-09T09:51:49.164924+00:00'),
(41, 'Dois-je créer un compte pour réserver un objet ?', 'Oui. La création d’un compte est indispensable pour pouvoir réserver un objet. Le compte permet d’identifier les parties, de sécuriser les paiements, de gérer les documents éventuels et de conserver l’historique des échanges et des réservations. Sans compte, il est uniquement possible de consulter les annonces.', 31, true, '2026-01-09T11:47:44.868715+00:00'),
(42, 'Puis-je consulter une annonce sans être inscrit ?', 'Oui, les annonces sont accessibles librement sans inscription. Cependant, pour réserver un objet, envoyer des messages ou effectuer un paiement, un compte utilisateur est obligatoire.', 32, true, '2026-01-09T11:47:44.868715+00:00'),
(43, 'Puis-je réserver un objet indisponible en envoyant un message ?', 'Non. Seules les dates ouvertes et visibles sur le calendrier peuvent faire l’objet d’une réservation. Les échanges par messagerie ne permettent pas de bloquer des dates ni de contourner les règles de disponibilité.', 33, true, '2026-01-09T11:47:44.868715+00:00'),
(44, 'Puis-je réserver plusieurs fois le même objet ?', 'Oui, vous pouvez effectuer plusieurs réservations pour un même objet, à condition que les créneaux souhaités soient disponibles au calendrier et qu’aucune réservation ne se chevauche.', 34, true, '2026-01-09T11:47:44.868715+00:00'),
(45, 'Le propriétaire peut-il modifier son annonce pendant une réservation ?', 'Non. Lorsqu’une réservation est en cours ou confirmée, l’annonce correspondante est verrouillée. Cela garantit que les conditions (prix, description, règles) restent identiques pour toute la durée de la réservation.', 35, true, '2026-01-09T11:47:44.868715+00:00'),
(69, 'Puis-je signaler un abus ou un comportement suspect ?', 'Oui. Tout comportement abusif ou suspect peut être signalé depuis la réservation concernée ou via le support.', 59, true, '2026-01-09T11:47:44.868715+00:00'),
(46, 'Pourquoi certaines annonces disparaissent temporairement ?', 'Une annonce peut disparaître si elle est désactivée par le propriétaire, si toutes les dates sont indisponibles ou si elle ne correspond plus aux filtres de recherche sélectionnés (localisation, dates, catégorie).', 36, true, '2026-01-09T11:47:44.868715+00:00'),
(47, 'Le propriétaire peut-il imposer des conditions spécifiques ?', 'Oui. Le propriétaire peut définir des conditions particulières (documents requis, usage autorisé, règles spécifiques), à condition qu’elles soient clairement indiquées avant la réservation. Ces conditions font partie intégrante de l’accord de location.', 37, true, '2026-01-09T11:47:44.868715+00:00'),
(48, 'Puis-je refuser une remise si les conditions ne sont pas respectées ?', 'Non. Sur la plateforme, une remise ne peut avoir lieu que si la réservation est entièrement conforme : paiement validé, documents requis fournis, conditions acceptées dans les délais. Si l’une de ces conditions n’est pas remplie, la réservation ne peut pas être finalisée et la remise n’est tout simplement pas possible. En cas de doute, la situation doit être signalée depuis la réservation.', 38, true, '2026-01-09T11:47:44.868715+00:00'),
(49, 'Que se passe-t-il si mon paiement est refusé ?', 'Si le paiement échoue, la réservation ne peut pas être validée. Les dates restent disponibles tant que le paiement n’a pas abouti. Vous pouvez réessayer avec un autre moyen de paiement si celui-ci est proposé.', 39, true, '2026-01-09T11:47:44.868715+00:00'),
(50, 'Puis-je changer de moyen de paiement ?', 'Oui, tant que la réservation n’est pas finalisée. Une fois la réservation confirmée, le moyen de paiement ne peut plus être modifié pour cette réservation.', 40, true, '2026-01-09T11:47:44.868715+00:00'),
(51, 'Les paiements sont-ils sécurisés??', 'Oui. Les paiements sont traités via des prestataires de paiement sécurisés, conformes aux standards en vigueur. La plateforme ne stocke pas directement les informations bancaires des utilisateurs. Pour plus de détails sur les mesures de sécurité, les prestataires utilisés?et le cadre applicable, il est recommandé de consulter les Conditions Générales de Vente (CGV) accessibles sur la plateforme.', 41, true, '2026-01-09T11:47:44.868715+00:00'),
(52, 'Puis-je obtenir un remboursement si la location n’a pas lieu ?', 'Le remboursement dépend uniquement de l’origine de l’annulation. Si vous êtes à l’origine de l’annulation, des frais d’annulation peuvent s’appliquer, conformément aux règles prévues. Si l’annulation ne vient pas du locataire, le locataire est intégralement remboursé. Les règles applicables sont indiquées lors du parcours de réservation et dans les conditions de la plateforme.', 42, true, '2026-01-09T11:47:44.868715+00:00'),
(53, 'Puis-je prolonger une location déjà commencée ?', 'Oui, uniquement si le calendrier de l’annonce le permet. La prolongation nécessite une nouvelle réservation sur les dates supplémentaires disponibles. Le calendrier fait foi, indépendamment de l’accord verbal entre les parties.', 43, true, '2026-01-09T11:47:44.868715+00:00'),
(54, 'Que se passe-t-il si je dépasse la durée prévue ?', 'Les dates et horaires définis dans la réservation doivent être strictement respectés. Si le propriétaire n’est pas prévenu d’un dépassement, il est en droit de réclamer le déblocage total de la caution, sans que le locataire puisse s’y opposer. Il est donc impératif de prévenir le propriétaire vi? la messagerie avant tout dépassement.', 44, true, '2026-01-09T11:47:44.868715+00:00'),
(55, 'Puis-je réserver une demi-journée ou quelques heures ?', 'Cela dépend des paramètres définis dans l’annonce. Certaines annonces autorisent des durées courtes, d’autres imposent une durée minimale de location.', 45, true, '2026-01-09T11:47:44.868715+00:00'),
(56, 'Les heures de remise sont-elles flexibles ?', 'Les horaires peuvent être ajustés?uniquement dans le cadre prévu par l’annonce ou d’un échange vi? la messagerie. Toute modification doit rester compatible avec les contraintes du calendrier.', 46, true, '2026-01-09T11:47:44.868715+00:00'),
(57, 'Que faire si l’objet est sale au retour ?', 'Si l’objet est restitué dans un état ne correspondant pas aux conditions prévues, le propriétaire peut signaler un manquement. Des éléments (photos, messages) peuvent être demandés pour évaluer la situation.', 47, true, '2026-01-09T11:47:44.868715+00:00'),
(58, 'Puis-je refuser un objet endommagé à la remise ?', 'Oui. Lors de la remise, l’état des lieux permet de vérifier la conformité de l’objet. Si un dommage est constaté et avéré, la remise peut être refusée. Dans ce cas, le locataire est intégralement remboursé, et les frais d’annulation peuvent être réclamés?au propriétaire si sa responsabilité est engagée. La situation doit être signalée immédiatement depuis la réservation, avec les éléments disponibles.', 48, true, '2026-01-09T11:47:44.868715+00:00'),
(59, 'Que faire si un accessoire manque ?', 'Tout accessoire manquant doit être signalé au moment de l’état des lieux. Sans preuve constatée lors de l’état des lieux, aucune action ne pourra être engagée a posteriori. Il est donc fortement recommandé d’être vigilant lors de la remise et de la restitution, et de vérifier l’ensemble des éléments inclus dans la location.', 49, true, '2026-01-09T11:47:44.868715+00:00'),
(60, 'Puis-je être sanctionné en cas de non-respect des règles ?', 'Oui. En cas de non-respect des règles de la plateforme ou des conditions de location, des mesures peuvent être prises selon la gravité de la situation, allant de l’avertissement à la restriction de certaines fonctionnalités, jusqu’au bannissement définitif du compte.', 50, true, '2026-01-09T11:47:44.868715+00:00'),
(61, 'Puis-je contacter le support sans réservation ?', 'Oui. Le support peut être contacté pour toute question générale liée au fonctionnement de la plateforme, même sans réservation active.', 51, true, '2026-01-09T11:47:44.868715+00:00'),
(62, 'Quand dois-je contacter le support ?', 'Le support doit être contacté lorsqu’une situation ne peut pas être résolue entre les parties, en cas de blocage, d’incident ou de litige.', 52, true, '2026-01-09T11:47:44.868715+00:00'),
(63, 'Les messages sont-ils conservés?après la location ?', 'Oui. Les échanges vi? la messagerie restent accessibles après la fin de la location afin de conserver un historique utile en cas de besoin.', 53, true, '2026-01-09T11:47:44.868715+00:00'),
(64, 'Puis-je supprimer une conversation ?', 'Non. Les conversations ne peuvent pas être supprimées afin de garantir la traçabilité des échanges.', 54, true, '2026-01-09T11:47:44.868715+00:00'),
(65, 'Puis-je modifier mes informations personnelles ?', 'Oui. Vous pouvez modifier vos informations personnelles à tout moment depuis les paramètres de votre compte.', 55, true, '2026-01-09T11:47:44.868715+00:00'),
(66, 'Puis-je suspendre temporairement mon compte ?', 'Oui. Certaines fonctionnalités peuvent être désactivées temporairement. Toutefois, aucune réservation en cours ne doit être impactée.', 56, true, '2026-01-09T11:47:44.868715+00:00'),
(67, 'Que se passe-t-il en cas de compte inactif ?', 'Un compte resté inactif sur une longue période peut être désactivé, conformément aux règles de la plateforme.', 57, true, '2026-01-09T11:47:44.868715+00:00'),
(68, 'La plateforme est-elle responsable des objets loués??', 'Non. La plateforme agit uniquement comme intermédiaire entre les utilisateurs. Elle n’est ni propriétaire des objets ni responsable de leur usage, sauf dans le cadre de l’application de ses règles.', 58, true, '2026-01-09T11:47:44.868715+00:00'),
(70, 'Où trouver les règles complètes de la plateforme ?', 'Les règles complètes sont disponibles dans les conditions générales accessibles directement sur la plateforme.', 60, true, '2026-01-09T11:47:44.868715+00:00')
ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.faqs', 'id'), COALESCE((SELECT MAX(id) FROM public.faqs), 1), true);
SELECT COUNT(*) AS faqs_count FROM public.faqs;


-- =============================================
-- legal_pages (8 rows)
-- =============================================
INSERT INTO public.legal_pages ("slug", "title", "content", "updated_at") VALUES
('mentions-legales', 'Mentions legales', '<h1>Mentions legales</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Editeur du site</h2>
<ul>
  <li><strong>Raison sociale :</strong> Le Matos du Voisin SAS</li>
  <li><strong>Capital social :</strong> 50 000 EUR</li>
  <li><strong>Siege social :</strong> 123 Avenue de la Republique, 69003 Lyon, France</li>
  <li><strong>SIRET :</strong> 123 456 789 00012</li>
  <li><strong>RCS :</strong> Lyon B 123 456 789</li>
  <li><strong>TVA intracommunautaire :</strong> FR12 123456789</li>
  <li><strong>Telephone :</strong> +33 (0)4 XX XX XX XX</li>
  <li><strong>E-mail :</strong> contact@lematosduvoisin.fr</li>
</ul>
<h2>Hebergeur</h2>
<ul>
  <li><strong>Raison sociale :</strong> OVH SAS</li>
  <li><strong>Siege social :</strong> 2 rue Kellermann, 59100 Roubaix, France</li>
  <li><strong>Telephone :</strong> +33 (0)9 72 10 10 07</li>
  <li><strong>Site web :</strong> www.ovh.com</li>
</ul>
<h2>Directeur de publication</h2>
<p>Le directeur de la publication du site est <strong>Jean Dupont</strong>, en qualite de President de Le Matos du Voisin SAS.</p>
<h2>Contact</h2>
<ul>
  <li><strong>Par e-mail :</strong> contact@lematosduvoisin.fr</li>
  <li><strong>Par telephone :</strong> +33 (0)4 XX XX XX XX (du lundi au vendredi, 9h-18h)</li>
  <li><strong>Par courrier :</strong> Le Matos du Voisin SAS, 123 Avenue de la Republique, 69003 Lyon, France</li>
</ul>
<h2>Propriete intellectuelle</h2>
<p>L''ensemble du contenu du site (textes, images, videos, logos, icones, etc.) est la propriete exclusive de Le Matos du Voisin SAS ou de ses partenaires.</p>
<p>Toute reproduction, distribution, modification, adaptation, retransmission ou publication est interdite sans accord ?crit pr?alable.</p>
<h2>Donnees personnelles</h2>
<p>Le traitement de vos donnees personnelles est regi par la politique de confidentialite disponible sur le site.</p>
<p>Conform?ment au RGPD et ? la loi Informatique et Libertes, vous disposez d''un droit d''acc?s, de rectification, de suppression et d''opposition.</p>
<p>Pour exercer ces droits : dpo@lematosduvoisin.fr</p>', '2026-02-19T14:16:56.402695+00:00'),
('cgu', 'Conditions Generales d''Utilisation (CGU)', '<h1>Conditions Generales d''Utilisation (CGU)</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Objet</h2>
<p>Les presentes CGU definissent les conditions d''utilisation de la plateforme Le Matos du Voisin.</p>
<h2>2. Acceptation des CGU</h2>
<p>L''utilisation de la plateforme implique l''acceptation pleine et entiere des presentes CGU.</p>
<h2>3. Inscription et compte utilisateur</h2>
<ul>
  <li>Fournir des informations exactes et a jour</li>
  <li>Conserver la confidentialite des identifiants</li>
  <li>Informer sans delai en cas d''usage non autorise</li>
  <li>Etre age d''au moins 18 ans</li>
</ul>
<h2>4. Description des services</h2>
<ul>
  <li>Publication d''annonces</li>
  <li>Recherche et reservation d''objets</li>
  <li>Messagerie entre utilisateurs</li>
  <li>Paiement s?curis?</li>
  <li>Gestion des cautions</li>
</ul>
<h2>5. Obligations des utilisateurs</h2>
<ul>
  <li>Respecter les lois en vigueur</li>
  <li>Ne pas publier de contenu illicite ou offensant</li>
  <li>Respecter les conditions de location</li>
  <li>Restituer les objets dans l''etat convenu</li>
</ul>
<h2>6. Responsabilite</h2>
<p>Le Matos du Voisin agit comme interm?diaire entre utilisateurs.</p>
<h2>7. Propriete intellectuelle</h2>
<p>Tous les elements de la plateforme sont proteges par le droit de la propriete intellectuelle.</p>
<h2>8. Modification des CGU</h2>
<p>Les CGU peuvent etre modifi?es a tout moment. La poursuite de l''utilisation vaut acceptation des nouvelles conditions.</p>
<h2>9. Resiliation</h2>
<p>Le compte peut etre r?sili? par l''utilisateur ou suspendu en cas de violation des CGU.</p>', '2026-02-19T14:16:56.402695+00:00'),
('cgv', 'Conditions Generales de Vente (CGV)', '<h1>Conditions Generales de Vente (CGV)</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Objet</h2>
<p>Les presentes CGV regissent les transactions entre loueurs et locataires sur la plateforme.</p>
<h2>2. Tarifs et paiement</h2>
<ul>
  <li>Prix affiches en euros TTC</li>
  <li>Paiement en ligne s?curis?</li>
  <li>Commission plateforme : 12% du prix de location</li>
</ul>
<h2>3. Reservation</h2>
<ol>
  <li>Demande du locataire</li>
  <li>Acceptation ou refus du loueur</li>
  <li>Paiement a confirmation</li>
  <li>Organisation de la remise</li>
</ol>
<h2>4. Caution</h2>
<p>Une caution peut etre demandee selon le mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver : mode CB = caution bancaire pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige ; mode cheque = cheque de caution remis en main propre au propri?taire (conservation d?une pi?ce d?identit? et v?rification CNI) ; mode assurance = pas de caution CB ni cheque, couverture via assurance. Les modes CB et cheque sont gratuits pour le locataire.</p>
<h2>5. Assurance</h2>
<p>Une assurance peut etre souscrite par le locataire ; elle devient obligatoire si le locataire choisit le mode assurance.</p>
<h2>6. Annulation et remboursement</h2>
<p>Les r?gles de remboursement varient selon la date d''annulation.</p>
<h2>7. Restitution</h2>
<p>Le locataire restitue l''objet dans l''etat convenu, ? la date prevue.</p>
<h2>8. Resolution des litiges</h2>
<p>Une m?diation est proposee. A d?faut d''accord, comp?tence des tribunaux du si?ge social.</p>', '2026-02-19T14:16:56.402695+00:00'),
('politique-confidentialite', 'Politique de confidentialite', '<h1>Politique de confidentialite</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Donnees collectees</h2>
<ul>
  <li>Donnees d''identification (nom, e-mail, telephone, adresse)</li>
  <li>Donnees de v?rification (identit?, domicile, paiement via prestataire s?curis?)</li>
  <li>Donnees d''utilisation (annonces, reservations, messages, avis)</li>
</ul>
<h2>2. Utilisation des donnees</h2>
<p>Creation de compte, execution des transactions, lutte contre la fraude, notifications et amelioration du service.</p>
<h2>3. Partage des donnees</h2>
<p>Partage limite aux utilisateurs, prestataires necessaires et autorites legalement competentes.</p>
<h2>4. Conservation des donnees</h2>
<ul>
  <li>Compte actif : pendant la duree d''utilisation</li>
  <li>Transactions : 10 ans</li>
  <li>V?rification : 5 ans</li>
</ul>
<h2>5. Vos droits</h2>
<p>Acces, rectification, effacement, limitation, portabilite et opposition.</p>
<p>Contact DPO : dpo@lematosduvoisin.fr</p>
<h2>6. Securite</h2>
<p>Mesures techniques et organisationnelles de protection des donnees.</p>
<h2>7. Cookies</h2>
<p>Voir la politique cookies.</p>
<h2>8. Contact</h2>
<p>Le Matos du Voisin SAS - 123 Avenue de la Republique, 69003 Lyon, France.</p>', '2026-02-19T14:16:56.402695+00:00'),
('politique-cookies', 'Politique cookies', '<h1>Politique cookies</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Qu''est-ce qu''un cookie ?</h2>
<p>Un cookie est un petit fichier texte d?pose sur votre appareil lors de la visite d''un site web.</p>
<h2>Types de cookies utilises</h2>
<ul>
  <li><strong>Essentiels :</strong> fonctionnement, s?curit?, session</li>
  <li><strong>Fonctionnels :</strong> preferences utilisateur</li>
  <li><strong>Analytiques :</strong> statistiques de frequentation</li>
  <li><strong>Marketing :</strong> personnalisation publicitaire</li>
</ul>
<h2>Finalites</h2>
<p>Assurer le bon fonctionnement du site, s?curiser les transactions et ameliorer l''experience utilisateur.</p>
<h2>Gestion des cookies</h2>
<p>Vous pouvez configurer vos preferences vi? la banniere cookies et les param?tres de votre navigateur.</p>
<h2>Duree de conservation</h2>
<ul>
  <li>Session : fermeture du navigateur</li>
  <li>Fonctionnels : 12 mois</li>
  <li>Analytiques : 13 mois</li>
  <li>Marketing : 13 mois</li>
</ul>', '2026-02-19T14:16:56.402695+00:00'),
('confidentialite', 'Politique de confidentialite', '<h1>Politique de confidentialite</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Donnees collectees</h2>
<ul>
  <li>Donnees d''identification (nom, e-mail, telephone, adresse)</li>
  <li>Donnees de v?rification (identit?, domicile, paiement via prestataire s?curis?)</li>
  <li>Donnees d''utilisation (annonces, reservations, messages, avis)</li>
</ul>
<h2>2. Utilisation des donnees</h2>
<p>Creation de compte, execution des transactions, lutte contre la fraude, notifications et amelioration du service.</p>
<h2>3. Partage des donnees</h2>
<p>Partage limite aux utilisateurs, prestataires necessaires et autorites legalement competentes.</p>
<h2>4. Conservation des donnees</h2>
<ul>
  <li>Compte actif : pendant la duree d''utilisation</li>
  <li>Transactions : 10 ans</li>
  <li>V?rification : 5 ans</li>
</ul>
<h2>5. Vos droits</h2>
<p>Acces, rectification, effacement, limitation, portabilite et opposition.</p>
<p>Contact DPO : dpo@lematosduvoisin.fr</p>
<h2>6. Securite</h2>
<p>Mesures techniques et organisationnelles de protection des donnees.</p>
<h2>7. Cookies</h2>
<p>Voir la politique cookies.</p>
<h2>8. Contact</h2>
<p>Le Matos du Voisin SAS - 123 Avenue de la Republique, 69003 Lyon, France.</p>', '2026-02-19T14:16:56.402695+00:00'),
('cookies', 'Politique cookies', '<h1>Politique cookies</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Qu''est-ce qu''un cookie ?</h2>
<p>Un cookie est un petit fichier texte d?pose sur votre appareil lors de la visite d''un site web.</p>
<h2>Types de cookies utilises</h2>
<ul>
  <li><strong>Essentiels :</strong> fonctionnement, s?curit?, session</li>
  <li><strong>Fonctionnels :</strong> preferences utilisateur</li>
  <li><strong>Analytiques :</strong> statistiques de frequentation</li>
  <li><strong>Marketing :</strong> personnalisation publicitaire</li>
</ul>
<h2>Finalites</h2>
<p>Assurer le bon fonctionnement du site, s?curiser les transactions et ameliorer l''experience utilisateur.</p>
<h2>Gestion des cookies</h2>
<p>Vous pouvez configurer vos preferences vi? la banniere cookies et les param?tres de votre navigateur.</p>
<h2>Duree de conservation</h2>
<ul>
  <li>Session : fermeture du navigateur</li>
  <li>Fonctionnels : 12 mois</li>
  <li>Analytiques : 13 mois</li>
  <li>Marketing : 13 mois</li>
</ul>', '2026-02-19T14:16:56.402695+00:00'),
('politique-temoins-connexion', 'Politique cookies', '<h1>Politique cookies</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Qu''est-ce qu''un cookie ?</h2>
<p>Un cookie est un petit fichier texte d?pose sur votre appareil lors de la visite d''un site web.</p>
<h2>Types de cookies utilises</h2>
<ul>
  <li><strong>Essentiels :</strong> fonctionnement, s?curit?, session</li>
  <li><strong>Fonctionnels :</strong> preferences utilisateur</li>
  <li><strong>Analytiques :</strong> statistiques de frequentation</li>
  <li><strong>Marketing :</strong> personnalisation publicitaire</li>
</ul>
<h2>Finalites</h2>
<p>Assurer le bon fonctionnement du site, s?curiser les transactions et ameliorer l''experience utilisateur.</p>
<h2>Gestion des cookies</h2>
<p>Vous pouvez configurer vos preferences vi? la banniere cookies et les param?tres de votre navigateur.</p>
<h2>Duree de conservation</h2>
<ul>
  <li>Session : fermeture du navigateur</li>
  <li>Fonctionnels : 12 mois</li>
  <li>Analytiques : 13 mois</li>
  <li>Marketing : 13 mois</li>
</ul>', '2026-02-19T14:16:56.402695+00:00')
ON CONFLICT DO NOTHING;
SELECT COUNT(*) AS legal_pages_count FROM public.legal_pages;


-- =============================================
-- email_templates (58 rows)
-- =============================================
INSERT INTO public.email_templates ("key", "subject", "body_html", "body_text", "enabled", "created_at", "updated_at") VALUES
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
('payment_received', '💰 Paiement reçu !', '<h1>Paiement confirmé</h1><p>Le paiement de {{amount}}€ pour la location de {{item_title}} a été reçu.</p><p>Vous recevrez {{owner_net}}€ apr?s deduction des frais applicables (commission plateforme et frais techniques de caution le cas echeant).</p>', NULL, true, '2026-02-15T16:53:38.713381+00:00', '2026-02-19T10:15:35.266528+00:00'),
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
SELECT COUNT(*) AS email_templates_count FROM public.email_templates;


-- =============================================
-- test_scenarios (33 rows)
-- =============================================
INSERT INTO public.test_scenarios ("id", "title", "objective", "expected_result", "instructions", "pages", "is_active", "created_at", "updated_at") VALUES
('d6235dc4-5e96-49c1-8b4a-0f04a83a41c3', 'Parcours de réservation', 'Tester le processus complet de réservation d''équipement', 'L''utilisateur doit pouvoir réserver un équipement sans blocage', 'Suivez le parcours de recherche jusqu''à la confirmation de réservation', '[{"url":"/home-search","order":1,"title":"Page de recherche","required":true,"exit_questions":["Avez-vous trouvé la barre de recherche facilement ?","Les filtres sont-ils clairs ?"],"coherence_question":"Comprenez-vous comment rechercher un équipement ?"},{"url":"/equipment-detail","order":2,"title":"Détail équipement","required":true,"exit_questions":["Savez-vous comment réserver cet équipement ?","Le prix est-il clair ?"],"coherence_question":"Les informations affichées sont-elles suffisantes ?"},{"url":"/booking-request","order":3,"title":"Demande de réservation","required":true,"exit_questions":["Toutes les informations demandées sont-elles justifiées ?","Le processus de paiement est-il rassurant ?"],"coherence_question":"Le formulaire de réservation est-il compréhensible ?"}]'::jsonb, true, '2026-02-17T17:46:22.223383+00:00', '2026-02-17T17:46:22.223383+00:00'),
('5ae4e63b-6655-4d55-a2ef-966e3786c252', 'Création d''annonce', 'Tester la création d''une nouvelle annonce d''équipement', 'L''utilisateur doit pouvoir créer une annonce complète', 'Créez une annonce pour un équipement de votre choix', '[{"url":"/create-listing","order":1,"title":"Création annonce","required":true,"exit_questions":["Les champs du formulaire sont-ils clairs ?","L''upload de photos fonctionne-t-il bien ?"],"coherence_question":"Comprenez-vous les étapes de création ?"}]'::jsonb, true, '2026-02-17T17:46:22.223383+00:00', '2026-02-17T17:46:22.223383+00:00'),
('a0271135-9d3c-5a48-82c5-af0c61f605a7', 'Annulation par le propriétaire', 'Scenario source NH02 (cancel_by_owner)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH02. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH02","source_code":"cancel_by_owner","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('461abaf3-b7fd-48f9-883b-0622b5dbae48', 'Inscription et Réservation', 'Tester le parcours complet d''un nouvel utilisateur qui souhaite louer un équipement', 'L''utilisateur crée un compte, trouve un équipement, et finalise une réservation', 'Imaginez que vous recherchez une perceuse pour le week-end. Suivez le parcours naturel depuis l''inscription jusqu''à la réservation.', '[{"url":"/","order":1,"title":"Page d''accueil","required":true},{"url":"/signup","order":2,"title":"Inscription","required":true},{"url":"/home-search","order":3,"title":"Recherche équipement","required":true},{"url":"/equipment-detail/:id","order":4,"title":"Détail annonce","required":true},{"url":"/reservation-create","order":5,"title":"Créer réservation","required":true},{"url":"/user-profile-documents","order":6,"title":"Documents requis","required":true}]'::jsonb, true, '2026-02-17T17:58:19.666836+00:00', '2026-02-17T17:58:19.666836+00:00'),
('999eee41-5324-437d-9ce3-7022b27f03fb', 'Création d''Annonce', 'Tester le processus de mise en location d''un équipement', 'L''utilisateur crée une annonce complète avec photos et informations', 'Vous possédez une tondeuse que vous souhaitez mettre en location. Créez une annonce complète.', '[{"url":"/","order":1,"title":"Page d''accueil","required":true},{"url":"/login","order":2,"title":"Connexion","required":true},{"url":"/create-listing","order":3,"title":"Création annonce - Étape 1","required":true},{"url":"/create-listing-step2","order":4,"title":"Upload photos","required":true},{"url":"/create-listing-step3","order":5,"title":"Tarification","required":true},{"url":"/mes-annonces","order":6,"title":"Mes annonces","required":true}]'::jsonb, true, '2026-02-17T17:58:19.666836+00:00', '2026-02-17T17:58:19.666836+00:00'),
('baeab87e-dc97-42b7-9c7e-842eac638429', 'Communication entre utilisateurs', 'Tester la messagerie et les notifications', 'L''utilisateur envoie et reçoit des messages, comprend les notifications', 'Contactez un propriétaire pour poser des questions sur son équipement avant de réserver.', '[{"url":"/equipment-detail/:id","order":1,"title":"Détail annonce","required":true},{"url":"/messages","order":2,"title":"Messagerie","required":true},{"url":"/notifications","order":3,"title":"Notifications","required":false}]'::jsonb, true, '2026-02-17T17:58:19.666836+00:00', '2026-02-17T17:58:19.666836+00:00'),
('af358c11-4426-4829-bbd5-4303af621baa', 'Modération Admin', 'Tester les fonctionnalités de modération et gestion', 'L''admin peut modérer les annonces, gérer les utilisateurs et voir les stats', 'Vous êtes administrateur. Modérez les annonces en attente et vérifiez les statistiques.', '[{"url":"/admin","order":1,"title":"Dashboard admin","required":true},{"url":"/admin/annonces","order":2,"title":"Modération annonces","required":true},{"url":"/admin/users","order":3,"title":"Gestion utilisateurs","required":true},{"url":"/admin/reservations","order":4,"title":"Suivi réservations","required":false}]'::jsonb, true, '2026-02-17T17:58:19.666836+00:00', '2026-02-17T17:58:19.666836+00:00'),
('85978be1-15db-590b-aaba-01d40423964a', 'Transaction aboutie complète', 'Scenario source HP01 (transaction_complete)', 'Parcours attendu sans incident.', 'Importer depuis source: HP01. Changement de device requis | Upload photo requis', '[{"is_happy":true,"source_id":"HP01","source_code":"transaction_complete","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('53572f5e-c6d0-5641-9e64-f3290812b301', 'Annulation par le locataire', 'Scenario source NH01 (cancel_by_renter)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH01. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH01","source_code":"cancel_by_renter","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('0d79cf47-6fa2-58d8-95e9-3ce557b4c1ac', 'Refus de l’objet au RDV (non conforme)', 'Scenario source NH05 (refuse_object_at_pickup)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH05. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH05","source_code":"refuse_object_at_pickup","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('c4c99f8b-b490-5252-9d90-76e35f6d6aec', 'Panne pendant la location', 'Scenario source NH10 (breakdown_during_use)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH10. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH10","source_code":"breakdown_during_use","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('4f6a1f27-9c43-5653-a6c9-ffe28c5777bb', 'Refus de restitution par le locataire', 'Scenario source NH14 (renter_refuse_return)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH14. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH14","source_code":"renter_refuse_return","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('c12cb9d2-c7d6-51f8-bbb8-8669b956becf', 'Restitution partielle (élément manquant)', 'Scenario source NH15 (partial_return_missing_item)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH15. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH15","source_code":"partial_return_missing_item","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('0ea1478a-32f4-55ce-a02f-6d2a19e30955', 'RDV de prise : locataire en retard (fenêtre dépassée)', 'Scenario source NH16 (pickup_renter_late)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH16. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH16","source_code":"pickup_renter_late","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('09194741-5876-5991-8192-4223836213dc', 'RDV de prise : propriétaire en retard (fenêtre dépassée)', 'Scenario source NH17 (pickup_owner_late)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH17. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH17","source_code":"pickup_owner_late","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('8134a5ac-3f1c-52cb-8e61-823a854af8c2', 'RDV de prise : locataire ne se présente pas (no-show)', 'Scenario source NH18 (pickup_renter_no_show)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH18. Changement de device requis', '[{"is_happy":false,"source_id":"NH18","source_code":"pickup_renter_no_show","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('3a65fc08-f039-5bc7-9f50-02b48b1cee91', 'RDV de prise : propriétaire ne se présente pas (no-show)', 'Scenario source NH19 (pickup_owner_no_show)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH19. Changement de device requis', '[{"is_happy":false,"source_id":"NH19","source_code":"pickup_owner_no_show","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('61d04afd-a659-5b0a-a08a-536f9c9288c8', 'RDV de prise : lieu/accès?impossible (erreur lieu, fermé, etc.)', 'Scenario source NH20 (pickup_meeting_impossible)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH20. Changement de device requis', '[{"is_happy":false,"source_id":"NH20","source_code":"pickup_meeting_impossible","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('67701085-bc2e-503b-919b-62dda242a7fe', 'Photos : permission caméra refusée (prise/restitution impossible)', 'Scenario source NH21 (photo_camera_permission_denied)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH21. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH21","source_code":"photo_camera_permission_denied","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('8bba0700-30fb-5199-835e-97e0a180b678', 'Photos : upload KO au moment de la prise (réseau/timeout)', 'Scenario source NH22 (photo_upload_fail_pickup)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH22. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH22","source_code":"photo_upload_fail_pickup","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('17b6097b-c77f-53ba-bc14-43b2f506654c', 'Photos : upload KO au moment de la restitution (réseau/timeout)', 'Scenario source NH23 (photo_upload_fail_return)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH23. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH23","source_code":"photo_upload_fail_return","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('08b87852-3e54-5b93-8a13-a46027b9b76b', 'Photos : non conformes (floues/invalides) → rejet & reprise obligatoire', 'Scenario source NH24 (photo_quality_rejected)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH24. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH24","source_code":"photo_quality_rejected","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('8b655eb2-0868-574c-a1c1-f2376d7b83b9', 'Photos : session expirée / déconnexion pendant l’étape photo', 'Scenario source NH25 (photo_step_session_expired)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH25. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH25","source_code":"photo_step_session_expired","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('7193b2d9-4b39-5aab-b4bc-120b0f9f8bda', 'Pendant la location : objet endommagé (déclaré par le locataire)', 'Scenario source NH26 (damage_during_rental_declared)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH26. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH26","source_code":"damage_during_rental_declared","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('d0b19810-8307-52b3-9e74-d3554f5fed9e', 'Pendant la location : objet perdu ou volé', 'Scenario source NH27 (lost_or_stolen)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH27. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH27","source_code":"lost_or_stolen","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('a2ef55a6-5f1c-5181-a838-8c1c44f826bd', 'Pendant la location : usage non conforme signalé', 'Scenario source NH28 (misuse_reported)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH28. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH28","source_code":"misuse_reported","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('21f682d4-801e-50db-afef-3635a9631445', 'Restitution : en retard (pénalité / gestion du dépassement)', 'Scenario source NH29 (late_return_penalty)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH29. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH29","source_code":"late_return_penalty","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('37e6a06d-c5a7-5c47-abc3-066fb5649829', 'Restitution : demande de prolongation refusée (indispo propriétaire)', 'Scenario source NH30 (extension_request_refused)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH30. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH30","source_code":"extension_request_refused","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('58ec0c9d-785f-5265-9177-08d905d58627', 'Restitution : restitution anticipée refusée (indispo propriétaire)', 'Scenario source NH31 (early_return_refused)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH31. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH31","source_code":"early_return_refused","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('fbd425cf-9bc5-51ee-9937-7bee36e0e580', 'Litige : désaccord sur l’état à la restitution (photos contradictoires)', 'Scenario source NH32 (dispute_condition_return)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH32. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH32","source_code":"dispute_condition_return","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('92ac0009-df9e-54d4-a67a-d386b117f281', 'Litige : désaccord sur frais additionnels (réparation/nettoyage/pénalité)', 'Scenario source NH33 (dispute_extra_charges)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH33. Changement de device requis | Upload photo requis', '[{"is_happy":false,"source_id":"NH33","source_code":"dispute_extra_charges","source_system":"location-app","requires_photo_upload":true,"requires_device_switch":true}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('219217c5-87c4-5fed-b5cd-a66bdf13ffcc', 'Remboursement : rejeté ou partiel (cas limite / politique)', 'Scenario source NH34 (refund_rejected_or_partial)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH34. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH34","source_code":"refund_rejected_or_partial","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00'),
('2ccc75b3-860a-5f15-a45b-1a4efa8637ba', 'Support : escalade obligatoire (workflow bloqué jusqu’à décision)', 'Scenario source NH35 (support_escalation_required)', 'Parcours de gestion d''incident ? valider.', 'Importer depuis source: NH35. Aucun pr?requis technique sp?cifique', '[{"is_happy":false,"source_id":"NH35","source_code":"support_escalation_required","source_system":"location-app","requires_photo_upload":false,"requires_device_switch":false}]'::jsonb, true, '2026-02-17T18:50:28.17+00:00', '2026-02-17T18:50:28.17+00:00')
ON CONFLICT DO NOTHING;
SELECT COUNT(*) AS test_scenarios_count FROM public.test_scenarios;


-- =============================================
-- annonces (7 rows)
-- =============================================
INSERT INTO public.annonces ("id", "owner_id", "titre", "description", "categorie", "prix_jour", "caution", "photos", "latitude", "longitude", "address", "city", "postal_code", "statut", "published", "moderation_reason", "slug", "type", "unavailable_dates", "created_at", "updated_at") VALUES
(319, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', 'Location : Meuleuse coudée électrique 1400 W – 230 V (verte)', 'Mettez la main sur une meuleuse coudée performante et maniable, idéale pour vos travaux de découpe, ponçage ou ébarbage.
Compacte et puissante, elle offre un excellent confort d’utilisation, même pour les travaux prolongés.

⚙️ Caractéristiques techniques

Puissance : 1400 W (1,9 CV)

Alimentation : Électrique – 230 V

Vitesse de rotation : jusqu’à 11 500 tr/min

Style : coudé, pour un meilleur angle de travail

Poids : 2,2 kg

Dimensions : 37 × 12,5 × 12,5 cm

Couleur : vert

💪 Les plus

Légère et facile à prendre en main

Adaptée aux disques standards

Idéale pour les petits chantiers, les découpes métalliques ou la rénovation', 'Bricolage & BTP', 4, 100, ARRAY['319/photos/1763381211833_3.jpg', '319/photos/1763381210406_0.jpg', '319/photos/1763381211247_1.jpg', '319/photos/1763381211569_2.jpg', '319/photos/1763381212158_4.jpg']::text[], 45.1406943, 1.446519, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-location-meuleuse-coud-e-lectrique-1400-w-230-v-verte-saint-pantal-on-de-larche', 'offre', NULL, '2025-11-17T12:06:47.68+00:00', '2026-02-16T20:36:37.353044+00:00'),
(341, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🛶 Canoë / Kayak Gonflable 3 places – Prêt à naviguer !', 'Je propose à la location un canoë-kayak gonflable de randonnée 2 à 3 places, idéal pour les balades sur lacs, rivières calmes et plans d’eau. Parfait pour une sortie en famille ou entre amis.

📍 Modèle : Canoë-kayak gonflable de randonnée 2/3 places – Itiwit (Decathlon)
👥 Capacité : 2 adultes + 1 enfant (ou 3 personnes légères)
⚖️ Charge maximale : 230 kg
📏 Dimensions gonflé : env. 3,82 m x 1,08 m
🎒 Transport : se range facilement dans son sac de transport
⏱️ Installation rapide : environ 10 minutes

🚣 Confort & stabilité

Très bonne stabilité grâce aux boudins latéraux larges

Sièges confortables et surélevés

Convient aussi bien aux débutants qu’aux utilisateurs occasionnels

📦 Équipement inclus dans la location
✅ Canoë-kayak gonflable
✅ Pompe de gonflage
✅ 1 pagaie
✅ Sac de transport
✅ Dérives
✅ Kit de réparation', 'Sports & Bien-être', 12, 300, ARRAY['341/photos/1766231100397_0.jpg', '341/photos/1766164898619_0.jpg', '341/photos/1766164899005_2.jpg', '341/photos/1766164899200_3.jpg']::text[], NULL, NULL, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-cano-kayak-gonflable-3-places-pr-t-naviguer-saint-pantal-on-de-larche', 'offre', ARRAY[]::date[], '2025-12-19T17:18:03.259+00:00', '2026-02-16T20:36:37.353044+00:00'),
(342, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🔴 RÂPE / ÉMINCEUR ÉLECTRIQUE MOULINEX FRESH EXPRESS – 3 EN 1 🔴', 'Je propose à la location un éminceur-râpe électrique Moulinex Fresh Express, idéal pour gagner du temps en cuisine et obtenir des découpes nettes et régulières.

✅ Ce qui est inclus (conforme à la photo) :
	•	1 bloc moteur Moulinex Fresh Express (200 W)
	•	3 cônes interchangeables :
	•	🟡 Râpe fine (fromage, carottes, chocolat…)
	•	🟠 Râpe grossière (pommes de terre, courgettes, fromage…)
	•	🟢 Éminceur / trancheur (concombres, légumes, fruits…)
	•	1 goulotte transparente avec poussoir pour une utilisation sécurisée

🍽️ Utilisation :
	•	Râper, trancher ou émincer directement dans un bol ou un saladier
	•	Idéal pour : salades, gratins, légumes, fromage, fruits, préparations', 'Électroménager', 5, 150, ARRAY['342/photos/1766926885090_4.jpeg', '342/photos/1766926839498_0.jpeg', '342/photos/1766926855314_1.jpeg', '342/photos/1766926862955_2.jpeg', '342/photos/1766926873152_3.jpeg']::text[], NULL, NULL, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-r-pe-minceur-lectrique-moulinex-fresh-express-3-en-1-saint-pantal-on-de-larche', 'offre', NULL, '2025-12-28T13:00:37.568+00:00', '2026-02-16T20:36:37.353044+00:00'),
(343, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🍲 SOUP MAKER / BLENDER CHAUFFANT – PROGRAMMES AUTOMATIQUES 🍲', 'Je propose à la location un blender chauffant type “soup maker”, idéal pour préparer facilement des soupes, compotes et veloutés maison.

✅ Fonctions visibles sur l’appareil :
	•	🥣 Soupe veloutée (creamed soup)
	•	🥕 Soupe avec morceaux (soup with pieces)
	•	🍎 Compote
	•	🔄 Mixage / Blend
	•	🔥 Maintien au chaud (keep warm)
	•	✨ Nettoyage automatique (easy cleaning)

🎛️ Utilisation :
	•	Panneau de commande tactile simple et intuitif
	•	Bouton Start / Stop central
	•	Programmes automatiques : il suffit d’ajouter les ingrédients et de lancer le programme

🍽️ Idéal pour :
	•	Soupes chaudes ou froides
	•	Veloutés, potages
	•	Compotes de fruits
	•	Préparations maison rapides et sans surveillance

ℹ️ État :
	•	Appareil fonctionnel
	•	Traces d’usage visibles normales (voir photo), sans impact sur le fonctionnement', 'Électroménager', 3, 150, ARRAY['343/photos/1766927214259_2.jpeg', '343/photos/1766927211386_0.jpeg', '343/photos/1766927213130_1.jpeg', '343/photos/1766927217807_3.jpeg']::text[], 45.1406943, 1.446519, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-soup-maker-blender-chauffant-programmes-automatiques-saint-pantal-on-de-larche', 'offre', NULL, '2025-12-28T13:06:49.519+00:00', '2026-02-16T20:36:37.353044+00:00'),
(344, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🪟 NETTOYEUR DE VITRES ÉLECTRIQUE KÄRCHER WV 2 – BLACK EDITION 🖤', 'Je propose à la location un nettoyeur de vitres électrique Kärcher WV 2 Black Edition, idéal pour un nettoyage rapide, efficace et sans traces.

✅ Inclus (conforme à la photo) :
	•	1 nettoyeur de vitres électrique Kärcher WV2 (sans fil)
	•	1 buse aspirante intégrée pour vitres
	•	1 bouteille pulvérisateur avec microfibre (visible sur la boîte)
	•	Boîte d’origine Kärcher

🧼 Utilisation :
	•	Aspire l’eau sale directement après pulvérisation
	•	Nettoyage sans coulures ni traces
	•	Fonctionne sur :
	•	Vitres et baies vitrées
	•	Miroirs
	•	Parois de douche
	•	Carrelage lisse
	•	Tables vitrées

👍 Avantages :
	•	Sans fil, léger et maniable
	•	Gain de temps considérable
	•	Résultat propre et uniforme
	•	Prise en main facile, même pour un usage occasionnel

ℹ️ État :
	•	Bon état général
	•	Appareil fonctionnel
	•	Usure normale liée à l’utilisatio', 'Maison & Mobilier', 2, 100, ARRAY['344/photos/1766953434770_2.jpeg', '344/photos/1766953434370_1.jpeg', '344/photos/1766927624904_0.jpeg', '344/photos/1766953433826_0.jpeg']::text[], NULL, NULL, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-nettoyeur-de-vitres-lectrique-k-rcher-wv-2-black-edition-saint-pantal-on-de-larche', 'offre', NULL, '2025-12-28T13:13:42.966+00:00', '2026-02-16T20:36:37.353044+00:00'),
(346, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🏗️ VIBREUR À BÉTON ÉLECTRIQUE AVEC AIGUILLE FLEXIBLE 🏗️', 'Je propose à la location un vibreur à béton électrique, idéal pour les travaux de maçonnerie nécessitant un béton bien homogène et sans bulles d’air.

✅ Description (conforme à la photo) :

Vibreur à béton électrique filaire

Aiguille vibrante montée sur flexible métallique

Boîtier moteur compact avec poignée

Câble d’alimentation électrique

Outil posé au sol, prêt à l’emploi

🧱 Utilisation :

Vibrage du béton frais

Élimination des bulles d’air

Meilleure répartition du béton dans les coffrages

Convient pour :

Dalles

Fondations

Poteaux

Murets

Petits et moyens travaux de maçonnerie

👍 Avantages :

Permet un béton plus solide et durable

Aiguille flexible pour atteindre les zones difficiles

Outil indispensable pour un travail propre et professionnel

ℹ️ État :

Appareil fonctionnel

Traces d’usage visibles normales pour un outil de chantier

Loué tel que visible sur la photo', 'Bricolage & BTP', 3, 100, ARRAY['346/photos/1767119958107_0.jpeg', '346/photos/1767119958597_1.jpeg', '346/photos/1767119958937_2.jpeg']::text[], 45.1406943, 1.446519, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-vibreur-b-ton-lectrique-avec-aiguille-flexible-saint-pantal-on-de-larche', 'offre', NULL, '2025-12-30T18:39:17.847+00:00', '2026-02-16T20:36:37.353044+00:00'),
(345, '30e9c1e9-061b-45d2-a379-a4b5f82ee241', '🥁 DJEMBÉ TRADITIONNEL – SON PUISSANT & AUTHENTIQUE 🥁', 'Je propose à la location un djembé, idéal pour les amateurs de percussion, les musiciens, les ateliers rythmiques ou les événements festifs.

✅ Description :
	•	Djembé traditionnel
	•	Fût?en bois sculpté
	•	Peau naturelle tendue à la main
	•	Sonorité chaude, puissante et bien équilibrée (basses, tons et claqués)

🎶 Utilisation :
	•	Pratique musicale (débutant ou confirmé)
	•	Ateliers percussion / écoles / associations
	•	Animations, soirées, événements culturels
	•	Méditation, expression corporelle, team building

👍 Avantages :
	•	Instrument robuste et stable
	•	Bonne projection sonore
	•	Prise en main agréable
	•	Convient aussi bien à l’intérieur qu’à l’extérieur

ℹ️ État :
	•	Bon état général
	•	Instrument fonctionnel et accordé
	•	Traces d’usage possibles sans impact sur le so´', 'Événementiel & Loisirs', 6, 180, ARRAY['345/photos/1767019192751_4.jpeg', '345/photos/1767019190296_0.jpeg', '345/photos/1767019191320_1.jpeg', '345/photos/1767019191979_2.jpeg', '345/photos/1767019192360_3.jpeg']::text[], 45.1406943, 1.446519, NULL, 'Saint-Pantaléon-de-Larche', '19600', 'en_attente', true, NULL, 'location-djemb-traditionnel-son-puissant-authentique-saint-pantal-on-de-larche', 'offre', NULL, '2025-12-29T14:39:48.269+00:00', '2026-02-18T13:06:15.547055+00:00')
ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.annonces', 'id'), COALESCE((SELECT MAX(id) FROM public.annonces), 1), true);
SELECT COUNT(*) AS annonces_count FROM public.annonces;

COMMIT;

-- =============================================
-- Export summary
-- =============================================
-- INCLUDED: profiles (2)
-- INCLUDED: categories (10)
-- INCLUDED: faqs (68)
-- INCLUDED: legal_pages (8)
-- INCLUDED: email_templates (58)
-- INCLUDED: test_scenarios (33)
-- INCLUDED: annonces (7)
-- SKIPPED: email_queue (empty)
-- SKIPPED: feedback (empty)
-- SKIPPED: demandes (empty)
-- SKIPPED: reservations (empty)
-- SKIPPED: bookings (empty)
-- SKIPPED: notifications (empty)
-- SKIPPED: user_sanctions (empty)
-- SKIPPED: reservation_photos (empty)
-- SKIPPED: messages (empty)
-- SKIPPED: conversations (empty)
-- SKIPPED: subcategories (PGRST205 Could not find the table 'public.subcategories' in the schema cache)
-- SKIPPED: tenant_documents (PGRST205 Could not find the table 'public.tenant_documents' in the schema cache)
-- SKIPPED: reservation_docs (PGRST205 Could not find the table 'public.reservation_docs' in the schema cache)
-- SKIPPED: job_runs (PGRST205 Could not find the table 'public.job_runs' in the schema cache)
-- SKIPPED: payments (PGRST205 Could not find the table 'public.payments' in the schema cache)
-- SKIPPED: proposals (PGRST205 Could not find the table 'public.proposals' in the schema cache)
-- SKIPPED: user_testers (42501 permission denied for table users)
-- SKIPPED: test_sessions (42501 permission denied for table users)
-- SKIPPED: page_responses (42501 permission denied for table users)
-- SKIPPED: test_reports (42501 permission denied for table users)
-- SKIPPED: debrief_notes (42501 permission denied for table users)





