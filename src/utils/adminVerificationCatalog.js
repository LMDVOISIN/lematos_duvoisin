const CATEGORY_META = Object.freeze({
  public: { label: 'Public', shortLabel: 'Public' },
  account: { label: 'Authentification et compte', shortLabel: 'Compte' },
  ownerRequester: { label: 'Demandeur et propriétaire', shortLabel: 'Demandes' },
  booking: { label: 'Réservation, paiement et location', shortLabel: 'Réservation' },
  admin: { label: 'Admin / back-office', shortLabel: 'Admin' },
  testing: { label: 'Programme de tests utilisateurs', shortLabel: 'Essais' },
  partial: { label: 'Présent mais partiel ou surtout UI', shortLabel: 'Partiel' },
  advancedTesting: { label: 'Binômes testeurs techniques', shortLabel: 'Binômes' }
});

const DERIVED_BLOCKING_REASON_BY_ID = Object.freeze({
  testing_authorized_entry: 'Ce contrÃ´le nÃ©cessite un compte testeur actif. Utilisez les binÃ´mes testeurs backend ci-dessous pour la validation automatisÃ©e.',
  testing_four_families: 'Ce contrÃ´le nÃ©cessite un compte testeur actif. Utilisez les binÃ´mes testeurs backend ci-dessous pour la validation automatisÃ©e.',
  testing_reference_or_mirror_choice: 'Ce contrÃ´le nÃ©cessite un compte testeur actif. Utilisez les binÃ´mes testeurs backend ci-dessous pour la validation automatisÃ©e.',
  testing_waiting_mirror: 'Cet Ã©tat dÃ©pend dâ€™une session testeur prÃ©parÃ©e. Il est couvert par les vÃ©rifications backend des binÃ´mes et la suite Playwright dÃ©diÃ©e.',
  testing_pause_resume: 'Cet Ã©tat dÃ©pend dâ€™une session testeur mise en pause. Il est couvert par les vÃ©rifications backend des binÃ´mes et la suite Playwright dÃ©diÃ©e.',
  testing_embedded_mode: 'Ce contrÃ´le nÃ©cessite une session dâ€™essai active dans une page produit. Il est couvert par les vÃ©rifications backend des binÃ´mes et la suite Playwright dÃ©diÃ©e.',
  testing_report_problem: 'Ce contrÃ´le nÃ©cessite une session dâ€™essai active. Il est couvert par la suite Playwright dÃ©diÃ©e et par les binÃ´mes backend.'
});

const SESSION_CONTEXT_BLOCKING_REASON_BY_ID = Object.freeze({
  account_login_email_password: 'Ce controle doit etre lance hors session connectee. Il n est pas verifiable depuis un compte admin deja authentifie.',
  account_register: 'Ce controle doit etre lance hors session connectee. Il n est pas verifiable depuis un compte admin deja authentifie.',
  account_oauth_google_facebook: 'Ce controle doit etre lance hors session connectee. Il n est pas verifiable depuis un compte admin deja authentifie.',
  account_reset_password: 'Ce controle doit etre lance hors session connectee. Il n est pas verifiable depuis un compte admin deja authentifie.'
});

const VERIFICATION_LISTING_PATH = '/location/location-annonce-de-verification-admin-paris/verification-offer/';

const CATALOG_ITEM_OVERRIDES = Object.freeze({
  public_listing_detail: {
    routePath: VERIFICATION_LISTING_PATH
  },
  public_listing_share: {
    knownLimitationNote: null,
    routePath: VERIFICATION_LISTING_PATH,
    actions: [
      {
        type: 'waitForText',
        text: 'Partager cette annonce',
        label: 'Verifier la zone de partage'
      },
      {
        type: 'clickText',
        text: 'Copier le lien',
        label: 'Copier le lien'
      },
      {
        type: 'waitForText',
        text: 'Lien de vérification copié.',
        label: 'Verifier la copie'
      },
      {
        type: 'clickText',
        text: 'Visuel Instagram',
        label: 'Préparer le visuel Instagram'
      },
      {
        type: 'waitForText',
        text: 'Visuel Instagram prêt pour la vérification.',
        label: 'Verifier le visuel Instagram'
      }
    ]
  },
  account_oauth_callback: {
    knownLimitationNote: null,
    expectedTexts: ['Connexion réussie !', 'Callback OAuth vérifié en mode admin.']
  },
  account_documents_manage: {
    expectedTexts: []
  },
  account_notifications_manage: {
    targets: [
      {
        label: 'Centre notifications',
        path: '/centre-notifications',
        routeId: 'notifications-center',
        expectedTexts: [],
        timeoutMs: 20000
      },
      {
        label: 'Paramètres compte',
        path: '/profil-documents-utilisateur/parametres',
        routeId: 'account-settings',
        expectedTexts: [],
        timeoutMs: 20000
      }
    ]
  },
  account_delete: {
    expectedTexts: []
  },
  owner_requester_submit_listing_moderation: {
    expectedTexts: ['Sauvegarder le brouillon']
  },
  booking_request_start: {
    expectedTexts: ['Choisissez vos dates'],
    timeoutMs: 20000
  },
  booking_payment_stripe: {
    knownLimitationNote: null,
    expectedTexts: ['Mode de vérification admin', 'Autorisé en garantie'],
    actions: [
      {
        type: 'clickText',
        text: "J'accepte les conditions gÃ©nÃ©rales d'utilisation",
        label: 'Accepter les CGU'
      },
      {
        type: 'clickText',
        text: 'Payer la location en CB (test)',
        label: 'Confirmer le paiement'
      },
      {
        type: 'waitForText',
        text: 'Paiement Stripe de vérification confirmé. Empreinte CB enregistrée.',
        label: 'Verifier la confirmation de paiement'
      }
    ]
  },
  booking_contract_generation: {
    knownLimitationNote: null,
    expectedTexts: ['Générer le contrat'],
    actions: [
      {
        type: 'clickText',
        text: 'Générer le contrat',
        label: 'Lancer la génération du contrat'
      },
      {
        type: 'waitForText',
        text: 'Contrat de vérification généré.',
        label: 'Verifier la génération'
      },
      {
        type: 'clickText',
        text: 'Télécharger',
        label: 'Télécharger le contrat'
      },
      {
        type: 'waitForText',
        text: 'PDF de vérification téléchargé.',
        label: 'Verifier le téléchargement'
      },
      {
        type: 'clickSelector',
        selector: '#verification-contract-accept',
        label: 'Cocher l acceptation'
      },
      {
        type: 'clickText',
        text: 'Accepter et procéder au paiement',
        label: 'Accepter le contrat'
      },
      {
        type: 'waitForText',
        text: 'Contrat de vérification accepté.',
        label: 'Verifier l acceptation'
      }
    ]
  },
  booking_dispute_and_deposit: {
    knownLimitationNote: null,
    expectedTexts: ['Ouvrir un litige de vérification'],
    actions: [
      {
        type: 'clickText',
        text: 'Ouvrir un litige de vérification',
        label: 'Déclencher le litige'
      },
      {
        type: 'waitForText',
        text: 'Litige de vérification ouvert. Caution maintenue en attente de décision.',
        label: 'Verifier le gel de caution'
      }
    ]
  },
  owner_requester_proposals_to_payment: {
    knownLimitationNote: null,
    expectedTexts: ['Voir les propositions'],
    actions: [
      {
        type: 'clickText',
        text: 'Voir les propositions',
        label: 'Ouvrir les propositions'
      },
      {
        type: 'waitForText',
        text: 'Propositions reçues',
        label: 'Verifier la liste des propositions'
      },
      {
        type: 'clickText',
        text: 'Accepter',
        label: 'Accepter la proposition'
      },
      {
        type: 'waitForRoute',
        routeId: 'payment-processing',
        pathIncludes: '/traitement-paiement',
        label: 'Verifier la navigation vers le paiement'
      }
    ]
  },
  owner_requester_listing_approved_promotion: {
    knownLimitationNote: null,
    expectedTexts: ['Partager sur Instagram'],
    actions: [
      {
        type: 'clickText',
        text: 'Ouvrir Instagram',
        label: 'Lancer la promotion'
      },
      {
        type: 'waitForText',
        text: 'Promotion Instagram simulée.',
        label: 'Verifier la promotion'
      }
    ]
  },
  booking_identity_after_payment: {
    knownLimitationNote: null,
    expectedTexts: ['Déposer une CNI de vérification'],
    actions: [
      {
        type: 'clickText',
        text: 'Déposer une CNI de vérification',
        label: 'Déposer la CNI'
      },
      {
        type: 'waitForText',
        text: 'Pièce d identité de vérification déposée et approuvée.',
        label: 'Verifier la validation de la CNI'
      }
    ]
  },
  booking_manage_reservations: {
    knownLimitationNote: null,
    expectedTexts: ['Mode de vérification admin', 'Voir le contrat'],
    actions: [
      {
        type: 'clickText',
        text: 'Voir le contrat',
        label: 'Ouvrir le contrat'
      },
      {
        type: 'waitForText',
        text: 'Contrat de location',
        label: 'Verifier le contrat'
      }
    ]
  },
  booking_pickup_day: {
    knownLimitationNote: null,
    expectedTexts: ['Démarrage location (jour J)', 'Ouvrir état des lieux'],
    actions: [
      {
        type: 'clickText',
        text: 'Ouvrir état des lieux',
        label: 'Ouvrir l état des lieux'
      },
      {
        type: 'waitForRoute',
        routeId: 'photos-inspection',
        pathIncludes: '/photos-d-tat-des-lieux/',
        label: 'Verifier l ouverture de l état des lieux'
      }
    ]
  },
  testing_emergency_request: {
    actions: [
      {
        type: 'clickText',
        text: 'Urgences',
        label: 'Ouvrir les urgences'
      },
      {
        type: 'waitForText',
        text: 'Urgences',
        label: 'Verifier l onglet urgences'
      }
    ]
  },
  testing_final_debrief: {
    expectedTexts: [],
    actions: []
  },
  admin_verify_identity_documents: {
    routePath: '/administration-verification-documents'
  },
  testing_administer_program: {
    actions: [
      {
        type: 'clickText',
        text: 'Questionnaires',
        label: 'Ouvrir les questionnaires'
      },
      {
        type: 'waitForText',
        text: 'Questionnaires',
        label: 'Verifier les questionnaires'
      },
      {
        type: 'clickText',
        text: 'Signalements',
        label: 'Ouvrir les signalements'
      },
      {
        type: 'waitForText',
        text: 'Signalements',
        label: 'Verifier les signalements'
      },
      {
        type: 'clickText',
        text: 'Comptes rendus',
        label: 'Ouvrir les comptes rendus'
      },
      {
        type: 'waitForText',
        text: 'Comptes rendus de séance',
        label: 'Verifier les comptes rendus'
      }
    ],
    expectedTexts: ['Seances']
  },
  partial_public_demand_propose: {
    knownLimitationNote: null,
    expectedTexts: ['Proposer'],
    actions: [
      {
        type: 'clickText',
        text: 'Proposer',
        label: 'Ouvrir la proposition'
      },
      {
        type: 'waitForText',
        text: 'Choisissez votre annonce',
        label: 'Verifier le modal de proposition'
      },
      {
        type: 'waitForText',
        text: 'Annonce de verification admin',
        label: 'Attendre l annonce de verification'
      },
      {
        type: 'clickSelector',
        selector: '[data-testid="verification-public-proposal-submit"]',
        label: 'Envoyer la proposition'
      },
      {
        type: 'waitForText',
        text: 'Proposition de vérification envoyée.',
        label: 'Verifier l envoi'
      }
    ]
  },
  partial_favorites: {
    knownLimitationNote: null,
    routePath: VERIFICATION_LISTING_PATH,
    expectedTexts: ['Initialiser le favori de vérification'],
    actions: [
      {
        type: 'clickText',
        text: 'Initialiser le favori de vérification',
        label: 'Mettre en favori'
      },
      {
        type: 'waitForText',
        text: 'Annonce enregistrée en favori pour la vérification.',
        label: 'Verifier l enregistrement du favori'
      },
      {
        type: 'reload',
        label: 'Recharger la fiche'
      },
      {
        type: 'waitForSelector',
        selector: 'button[aria-label="Retirer des favoris"]',
        label: 'Verifier la persistance du favori'
      }
    ]
  },
  partial_reporting_front_only: {
    knownLimitationNote: null,
    targets: [
      {
        label: 'Signalement depuis le compte',
        path: '/profil-documents-utilisateur/signaler',
        routeId: 'account-report',
        expectedTexts: ['Signaler un probleme'],
        actions: [
          {
            type: 'clickSelector',
            selector: '[data-testid="account-report-verification-submit"]',
            label: 'Envoyer le signalement compte'
          },
          {
            type: 'waitForText',
            text: 'Signalement de verification envoye sous la reference #',
            label: 'Verifier le signalement compte'
          }
        ]
      },
      {
        label: 'Signalement annonce',
        path: VERIFICATION_LISTING_PATH,
        routeId: 'equipment-detail',
        actions: [
          {
            type: 'clickSelector',
            selector: 'button[aria-label="Signaler"]',
            label: 'Ouvrir le signalement annonce'
          },
          {
            type: 'waitForText',
            text: 'Signaler un probleme',
            label: 'Verifier le modal de signalement'
          },
          {
            type: 'clickSelector',
            selector: '[data-testid="listing-report-verification-submit"]',
            label: 'Envoyer le signalement annonce'
          },
          {
            type: 'waitForText',
            text: 'Signalement de verification envoye sous la reference #',
            label: 'Verifier le signalement annonce'
          }
        ]
      }
    ]
  },
  partial_advanced_security: {
    knownLimitationNote: null,
    expectedTexts: ['Authentification à deux facteurs', 'Sessions actives'],
    actions: [
      {
        type: 'clickText',
        text: 'Activer',
        label: 'Activer la double validation'
      },
      {
        type: 'waitForText',
        text: 'Double validation activée pour ce compte.',
        label: 'Verifier la double validation'
      },
      {
        type: 'clickText',
        text: 'Voir',
        label: 'Afficher les sessions actives'
      },
      {
        type: 'waitForText',
        text: 'Session courante',
        label: 'Verifier les sessions'
      }
    ]
  },
  partial_admin_reservations_demo: {
    knownLimitationNote: null,
    expectedTexts: ['Source des données:', 'Gestion des réservations']
  }
});

export const VERIFICATION_CATEGORY_ORDER = [
  'public',
  'account',
  'ownerRequester',
  'booking',
  'admin',
  'testing',
  'partial',
  'advancedTesting'
];

const routeItem = (
  id,
  category,
  title,
  routeId,
  routePath,
  options = {}
) => ({
  id,
  category,
  categoryLabel: CATEGORY_META?.[category]?.label || category,
  categoryShortLabel: CATEGORY_META?.[category]?.shortLabel || category,
  title,
  automationMode: options?.automationMode || 'browser_smoke',
  routeId,
  routePath,
  targets: options?.targets || null,
  expectedTexts: options?.expectedTexts || [],
  expectedSelectors: options?.expectedSelectors || [],
  actions: options?.actions || [],
  scopeNote: options?.scopeNote || "Vérification navigateur du rendu de page et des affordances configurées.",
  knownLimitationNote: options?.knownLimitationNote || null,
  externalDependencyNote: options?.externalDependencyNote || null,
  blockingReason: options?.blockingReason || null
});

const warningRouteItem = (id, category, title, routeId, routePath, warningNote, options = {}) =>
  routeItem(id, category, title, routeId, routePath, {
    ...options,
    knownLimitationNote: warningNote
  });

const advancedBackendItem = (id, title, options = {}) => ({
  id,
  category: 'advancedTesting',
  categoryLabel: CATEGORY_META.advancedTesting.label,
  categoryShortLabel: CATEGORY_META.advancedTesting.shortLabel,
  title,
  automationMode: options?.automationMode || 'tester_pairs_batch',
  scopeNote: options?.scopeNote || 'Vérification backend du protocole référence / miroir.',
  includePauseResume: options?.includePauseResume !== false,
  verificationTargets: options?.verificationTargets || [],
  expectedPairCount: Number(options?.expectedPairCount || 0) || 0,
  referenceScenarioId: options?.referenceScenarioId || null,
  pair: options?.pair || null,
  excludeFromRunAll: options?.excludeFromRunAll === true
});

const buildStaticCatalog = (context = {}) => {
  const samplePaths = context?.samplePaths || {};
  const testerPairs = Array.isArray(context?.testerPairs) ? context.testerPairs : [];

  const listingDetailPath = samplePaths?.listingDetail || '';
  const bookingRequestPath = samplePaths?.bookingRequest || '';
  const inspectionPath = samplePaths?.inspection || '';
  const contractPreviewPath = samplePaths?.contractPreview || '/apercu-generation-contrat';

  return [
    routeItem(
      'public_marketplace_search',
      'public',
      'Arriver sur la marketplace, chercher des offres, des demandes ou un flux mixte, filtrer par texte/catégorie/ville et exploiter la géolocalisation.',
      'home-search',
      '/accueil-recherche',
      {
        scopeNote: 'Vérifie le point d’entrée marketplace et son rendu principal.'
      }
    ),
    routeItem(
      'public_listing_detail',
      'public',
      'Ouvrir une fiche annonce, voir photos, description, règles, carte, disponibilité, jours/horaires de retrait-retour, profil propriétaire, avis et annonces similaires.',
      'equipment-detail',
      listingDetailPath,
      {
        blockingReason: listingDetailPath ? null : "Aucune annonce publiée n'est disponible pour résoudre une fiche annonce.",
        scopeNote: 'Vérifie le chargement d’une fiche annonce réelle.'
      }
    ),
    warningRouteItem(
      'public_listing_share',
      'public',
      'Partager une annonce depuis sa fiche: copier le lien, partager sur réseaux sociaux, récupérer un visuel Instagram.',
      'equipment-detail',
      listingDetailPath,
      "Le modal de partage et les points d'entrée réseaux sociaux sont vérifiés, mais les redirections externes et publications réseau ne sont pas simulées automatiquement.",
      {
        blockingReason: listingDetailPath ? null : "Aucune annonce publiée n'est disponible pour vérifier le partage d’annonce.",
        actions: [
          {
            type: 'clickSelector',
            selector: 'button[aria-label="Partager"]',
            label: 'Ouvrir le partage'
          },
          {
            type: 'waitForText',
            text: 'Partager cette annonce',
            label: 'Attendre le modal de partage'
          },
          {
            type: 'waitForText',
            text: 'Visuel Instagram',
            label: 'Vérifier le visuel Instagram'
          }
        ]
      }
    ),
    routeItem(
      'public_demands_marketplace',
      'public',
      'Parcourir les demandes publiques, filtrer/trier, puis basculer vers la création d’une demande.',
      'public-demands-marketplace',
      '/demandes-publiques'
    ),
    routeItem(
      'public_geolocation_search',
      'public',
      'Utiliser la page dédiée de recherche géolocalisée: “autour de moi”, rayon, vue grille/carte, ou recherche manuelle par ville/code postal.',
      'geolocation-search',
      '/amelioration-recherche-geolocalisee'
    ),
    routeItem(
      'public_content_pages',
      'public',
      'Consulter les contenus publics: FAQ avec recherche, page assurance avec calculateur/comparatif/processus, pages légales, politique cookies.',
      null,
      null,
      {
        targets: [
          {
            label: 'FAQ publique',
            path: '/foire-questions',
            routeId: 'faq'
          },
          {
            label: 'Couverture assurance',
            path: '/couverture-assurance',
            routeId: 'insurance-coverage'
          },
          {
            label: 'Mentions légales',
            path: '/legal/mentions-legales',
            routeId: 'legal-mentions'
          },
          {
            label: 'Politique cookies',
            path: '/legal/politique-temoins-connexion',
            routeId: 'legal-cookies'
          }
        ],
        scopeNote: 'Vérifie l’accessibilité des contenus publics structurants.'
      }
    ),
    routeItem(
      'public_chatbot',
      'public',
      'Utiliser le chatbot public du site.',
      'home-search',
      '/accueil-recherche',
      {
        actions: [
          {
            type: 'clickSelector',
            selector: 'button[aria-label="Afficher le chatbot"]',
            label: 'Ouvrir le chatbot'
          },
          {
            type: 'waitForText',
            text: 'Assistant Le Matos',
            label: 'Attendre le panneau chatbot'
          }
        ]
      }
    ),
    routeItem(
      'public_feedback_footer',
      'public',
      'Donner un retour/feedback depuis le footer.',
      'home-search',
      '/accueil-recherche',
      {
        actions: [
          {
            type: 'clickSelector',
            selector: 'button[aria-label="Envoyer un feedback"]',
            label: 'Ouvrir le feedback'
          },
          {
            type: 'waitForText',
            text: 'Envoyer un feedback',
            label: 'Attendre la modal feedback'
          }
        ]
      }
    ),

    routeItem(
      'account_login_email_password',
      'account',
      'Se connecter par email/mot de passe.',
      'authentication',
      '/authentification',
      {
        expectedTexts: ['Se connecter']
      }
    ),
    routeItem(
      'account_register',
      'account',
      'S’inscrire avec identité, adresse, ville/code postal, mot de passe, acceptation CGU/RGPD.',
      'authentication',
      '/authentification',
      {
        actions: [
          {
            type: 'clickText',
            text: 'Inscription',
            label: 'Basculer en inscription'
          },
          {
            type: 'waitForText',
            text: 'Prénom',
            label: 'Attendre le formulaire inscription'
          }
        ]
      }
    ),
    warningRouteItem(
      'account_oauth_google_facebook',
      'account',
      'Se connecter via Google ou Facebook.',
      'authentication',
      '/authentification',
      "Les boutons OAuth sont vérifiés côté UI, mais le consentement fournisseur externe n'est pas simulé automatiquement.",
      {
        expectedTexts: ['Se connecter avec Google', 'Se connecter avec Facebook']
      }
    ),
    warningRouteItem(
      'account_oauth_callback',
      'account',
      'Passer par le callback d’authentification sociale.',
      'auth-callback',
      '/auth/retour',
      "Le point de retour OAuth est vérifié côté route, sans exécuter un aller-retour complet chez le fournisseur externe."
    ),
    routeItem(
      'account_reset_password',
      'account',
      'Demander un lien de récupération puis réinitialiser son mot de passe.',
      'authentication',
      '/authentification',
      {
        actions: [
          {
            type: 'clickText',
            text: 'Mot de passe oublié',
            label: 'Ouvrir la récupération'
          },
          {
            type: 'waitForText',
            text: 'Réinitialiser le mot de passe',
            label: 'Attendre la modal'
          }
        ]
      }
    ),
    routeItem(
      'account_profile_manage',
      'account',
      'Gérer son profil: modifier infos perso, avatar, téléphone, adresse, date de naissance.',
      'account-profile',
      '/profil-documents-utilisateur'
    ),
    routeItem(
      'account_delete',
      'account',
      'Supprimer son compte, avec blocage si des réservations ne sont pas terminées.',
      'account-profile',
      '/profil-documents-utilisateur',
      {
        expectedTexts: ['Supprimer mon compte'],
        scopeNote: 'Vérifie la présence du workflow de suppression sans confirmer l’action destructive.'
      }
    ),
    routeItem(
      'account_activity_history',
      'account',
      'Consulter l’historique d’activité du compte.',
      'account-activity',
      '/profil-documents-utilisateur/historique'
    ),
    routeItem(
      'account_documents_manage',
      'account',
      'Gérer ses documents: identité, justificatif de domicile, assurance, RIB.',
      'account-documents',
      '/profil-documents-utilisateur/documents',
      {
        expectedTexts: ['RIB']
      }
    ),
    routeItem(
      'account_payouts_manage',
      'account',
      'Gérer ses coordonnées de versement: onboarding payout, reprise d’activation, remplacement du compte bancaire.',
      'account-payouts',
      '/profil-documents-utilisateur/coordonnees-versement',
      {
        expectedTexts: ['Coordonnées de versement']
      }
    ),
    routeItem(
      'account_notifications_manage',
      'account',
      'Gérer ses notifications: aperçu dans le header, centre complet, filtres lues/non lues, recherche, suppression, préférences email/push/sms.',
      null,
      null,
      {
        targets: [
          {
            label: 'Centre notifications',
            path: '/centre-notifications',
            routeId: 'notifications-center',
            expectedTexts: ['Préférences de notification']
          },
          {
            label: 'Paramètres compte',
            path: '/profil-documents-utilisateur/parametres',
            routeId: 'account-settings',
            expectedTexts: ['Préférences de notification']
          }
        ],
        scopeNote: 'Vérifie le centre de notifications et les préférences de compte.'
      }
    ),
    routeItem(
      'account_logout',
      'account',
      'Se déconnecter.',
      'account-logout',
      '/profil-documents-utilisateur/deconnexion'
    ),

    routeItem(
      'owner_requester_create_demande',
      'ownerRequester',
      'Créer une demande avec brouillon local, puis publication après connexion.',
      'create-demand-request',
      '/creer-demande',
      {
        expectedTexts: ['Créer une demande de location']
      }
    ),
    routeItem(
      'owner_requester_ai_demande',
      'ownerRequester',
      'Utiliser l’aide IA pour générer le titre et la description d’une demande.',
      'create-demand-request',
      '/creer-demande',
      {
        expectedTexts: ["Générer avec l'IA"]
      }
    ),
    routeItem(
      'owner_requester_manage_demands',
      'ownerRequester',
      'Gérer ses demandes: lister, filtrer, fermer, supprimer.',
      'user-demands',
      '/mes-annonces#demandes'
    ),
    warningRouteItem(
      'owner_requester_proposals_to_payment',
      'ownerRequester',
      'Recevoir des propositions sur une demande, les accepter ou les refuser, puis partir vers le paiement.',
      'user-demands',
      '/mes-annonces#demandes',
      "Le tableau de demandes est vérifié côté UI. L’enchaînement complet dépend de propositions existantes dans les données."
    ),
    routeItem(
      'owner_requester_create_listing',
      'ownerRequester',
      'Créer une annonce en 6 étapes: informations, photos, tarification, localisation, disponibilités, règles.',
      'create-listing',
      '/creer-annonce',
      {
        expectedTexts: ['Sauvegarder le brouillon']
      }
    ),
    routeItem(
      'owner_requester_manage_listing_lifecycle',
      'ownerRequester',
      'Sauvegarder une annonce en brouillon, la modifier, la supprimer, la désactiver temporairement ou la réactiver.',
      'user-listings',
      '/mes-annonces'
    ),
    routeItem(
      'owner_requester_submit_listing_moderation',
      'ownerRequester',
      'Soumettre une annonce à modération puis la publier.',
      'create-listing',
      '/creer-annonce',
      {
        expectedTexts: ['Soumettre à modération']
      }
    ),
    warningRouteItem(
      'owner_requester_listing_approved_promotion',
      'ownerRequester',
      'Recevoir une notification d’annonce approuvée puis une popup de promotion pour la partager sur les réseaux.',
      'user-listings',
      '/mes-annonces',
      "La présence des écrans de gestion d’annonce est vérifiée, mais la notification approuvée et la popup promotionnelle dépendent d’un événement métier réel."
    ),

    routeItem(
      'booking_request_start',
      'booking',
      'Démarrer une demande de réservation depuis une annonce, choisir les dates, passer les contrôles de disponibilité et accepter les CGU.',
      'booking-request',
      bookingRequestPath,
      {
        blockingReason: bookingRequestPath ? null : "Aucune annonce publiée n'est disponible pour résoudre une demande de réservation.",
        expectedTexts: ['Passer au paiement']
      }
    ),
    warningRouteItem(
      'booking_payment_stripe',
      'booking',
      'Payer via Stripe, avec affichage du montant de location et de l’empreinte CB de caution.',
      'payment-processing',
      '/traitement-paiement',
      "La page de paiement et le contexte Stripe sont vérifiés côté UI, sans exécuter un paiement test complet ni une redirection Checkout.",
      {
        expectedTexts: ['paiement']
      }
    ),
    warningRouteItem(
      'booking_identity_after_payment',
      'booking',
      'Passer par la vérification d’identité post-paiement en déposant une CNI.',
      'identity-verification-rental',
      '/verification-identite-location',
      "La page de vérification d’identité est vérifiée côté UI, sans simuler un dépôt de document complet post-paiement."
    ),
    routeItem(
      'booking_messages',
      'booking',
      'Échanger via la messagerie liée aux réservations.',
      'messages',
      '/messages'
    ),
    warningRouteItem(
      'booking_manage_reservations',
      'booking',
      'Gérer ses réservations: filtres par statut, contrat, chat, adresse de remise, timeline, rebooking, ajustement ou annulation totale/partielle.',
      'reservation-management',
      '/mes-reservations',
      "Le tableau de bord réservations est vérifié côté UI. Les sous-flux dépendants des réservations existantes peuvent varier selon les données."
    ),
    warningRouteItem(
      'booking_pickup_day',
      'booking',
      'Exécuter le jour J: checklist de remise, validation de la remise, démarrage de la location.',
      'reservation-management',
      '/mes-reservations',
      "Les écrans de gestion sont vérifiés, sans confirmer de checklist ou étape opérationnelle sur une réservation réelle."
    ),
    routeItem(
      'booking_photos_inspection',
      'booking',
      'Réaliser l’état des lieux photo officiel: photos avant/après, présence confirmée des 2 parties, comparaison.',
      'photos-inspection',
      inspectionPath,
      {
        blockingReason: inspectionPath ? null : "Aucune réservation n'est disponible pour ouvrir l'état des lieux photo.",
        expectedTexts: ['état des lieux']
      }
    ),
    warningRouteItem(
      'booking_dispute_and_deposit',
      'booking',
      'Ouvrir un litige d’état des lieux avec photos ciblées et description, puis suivre le gel/libération/capture de la caution.',
      'photos-inspection',
      inspectionPath,
      "L’écran officiel d’inspection/litige est vérifié, sans ouvrir automatiquement un litige réel ni décider la caution.",
      {
        blockingReason: inspectionPath ? null : "Aucune réservation n'est disponible pour vérifier le litige d'état des lieux.",
        expectedTexts: ['Ouvrir un litige']
      }
    ),
    warningRouteItem(
      'booking_contract_generation',
      'booking',
      'Générer, visualiser, télécharger et accepter un contrat via la page d’aperçu de génération de contrat.',
      'contract-generation-preview',
      contractPreviewPath,
      "La page contrat est vérifiée côté UI. La génération ou l’acceptation effective dépend d’une réservation de contexte.",
      {
        expectedTexts: ['Générer le contrat']
      }
    ),

    routeItem(
      'admin_dashboard_operations',
      'admin',
      'Entrer dans le portail admin puis piloter le tableau de bord business/opérations.',
      'admin-dashboard',
      '/administration-tableau-bord'
    ),
    routeItem(
      'admin_moderate_listings',
      'admin',
      'Modérer les annonces.',
      'admin-moderation',
      '/administration-moderation'
    ),
    routeItem(
      'admin_moderate_demands',
      'admin',
      'Modérer les demandes.',
      'admin-moderation',
      '/administration-moderation'
    ),
    routeItem(
      'admin_manage_users',
      'admin',
      'Gérer les utilisateurs: recherche, détail, activation/suspension, export, actions de masse.',
      'admin-user-management',
      '/administration-gestion-utilisateurs'
    ),
    routeItem(
      'admin_verify_identity_documents',
      'admin',
      'Vérifier les documents d’identité: prévisualisation, approbation, rejet motivé.',
      'admin-document-verification',
      '/administration-vérification-documents'
    ),
    routeItem(
      'admin_supervise_reservations',
      'admin',
      'Superviser les réservations et forcer des statuts.',
      'admin-reservation-management',
      '/administration-gestion-reservations'
    ),
    routeItem(
      'admin_arbitrate_inspection_disputes',
      'admin',
      'Arbitrer les litiges d’état des lieux.',
      'admin-inspection-disputes',
      '/administration-litiges-etat-des-lieux'
    ),
    routeItem(
      'admin_manage_reports',
      'admin',
      'Gérer les signalements.',
      'admin-signalements',
      '/administration-signalements'
    ),
    routeItem(
      'admin_matching',
      'admin',
      'Faire l’appariement demandes/offres: matching automatique global, inspection d’un matching, proposition manuelle.',
      'admin-matching',
      '/administration-appariement'
    ),
    routeItem(
      'admin_email_tracking',
      'admin',
      'Suivre les emails, les modèles, la file d’envoi, l’historique, les tests d’envoi et les relances d’échec.',
      null,
      null,
      {
        targets: [
          {
            label: 'Suivi courriels',
            path: '/administration-suivi-courriels',
            routeId: 'admin-email-tracking'
          },
          {
            label: 'Modèles courriels',
            path: '/administration-modeles-courriels',
            routeId: 'admin-email-templates'
          }
        ]
      }
    ),
    routeItem(
      'admin_notifications',
      'admin',
      'Suivre les notifications côté admin.',
      'admin-notifications',
      '/administration-notifications'
    ),
    routeItem(
      'admin_task_tracking',
      'admin',
      'Suivre les tâches automatiques et le journal des jobs.',
      'admin-task-tracking',
      '/administration-suivi-taches'
    ),
    routeItem(
      'admin_automation_management',
      'admin',
      'Déclencher et superviser les automatisations métier: contrôle documents, annulations, clôtures, libérations de caution, rappels, strikes, nettoyage des holds, digest.',
      'admin-automation-management',
      '/administration-gestion-automatisations'
    ),
    routeItem(
      'admin_manage_content',
      'admin',
      'Gérer les catégories, la FAQ, le footer, les pages légales, le contrat de location.',
      null,
      null,
      {
        targets: [
          {
            label: 'Catégories',
            path: '/administration-categories',
            routeId: 'admin-categories'
          },
          {
            label: 'FAQ admin',
            path: '/administration-foire-questions',
            routeId: 'admin-faq'
          },
          {
            label: 'Footer admin',
            path: '/administration-editeur-pied-page',
            routeId: 'admin-footer-editor'
          },
          {
            label: 'Pages légales admin',
            path: '/administration-pages-legales',
            routeId: 'admin-legal-pages'
          },
          {
            label: 'Contrat location admin',
            path: '/administration-contrat-location',
            routeId: 'admin-rental-contract'
          }
        ]
      }
    ),
    routeItem(
      'admin_feedbacks',
      'admin',
      'Gérer les retours/feedbacks envoyés depuis le site.',
      'admin-feedbacks',
      '/administration-retours'
    ),

    routeItem(
      'testing_authorized_entry',
      'testing',
      'Entrer comme testeur autorisé et déclarer son contexte poste/écran/navigateur.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification'
    ),
    routeItem(
      'testing_four_families',
      'testing',
      'Avancer sur les 4 familles obligatoires de tests.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['L\'application suit vos', '4 passages obligatoires']
      }
    ),
    routeItem(
      'testing_reference_or_mirror_choice',
      'testing',
      'Choisir un scénario de référence ou recevoir automatiquement le scénario miroir.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['référence / miroir']
      }
    ),
    routeItem(
      'testing_waiting_mirror',
      'testing',
      'Être mis en attente si le miroir n’est pas disponible, puis relancé par email quand c’est possible.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['En attente', 'miroir']
      }
    ),
    routeItem(
      'testing_pause_resume',
      'testing',
      'Reprendre une session, subir une pause admin, puis reprendre après autorisation.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['Parcours mis en pause par l\'observateur']
      }
    ),
    routeItem(
      'testing_embedded_mode',
      'testing',
      'Suivre un mode essai embarqué dans les pages: consignes, attentes initiales, tracking temps/page, questionnaires intermédiaires.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['questionnaire', 'consignes']
      }
    ),
    routeItem(
      'testing_report_problem',
      'testing',
      'Envoyer un signalement pendant l’essai.',
      'tester-authentication-context-setup',
      '/participant-configuration-contexte-authentification',
      {
        expectedTexts: ['Signaler']
      }
    ),
    routeItem(
      'testing_emergency_request',
      'testing',
      'Déclencher une demande d’urgence et dialoguer avec un observateur admin en temps réel.',
      'admin-test-results',
      '/administration-resultats-essais',
      {
        expectedTexts: ['Urgences']
      }
    ),
    routeItem(
      'testing_final_debrief',
      'testing',
      'Remplir le débrief final.',
      'admin-test-results',
      '/administration-resultats-essais',
      {
        expectedTexts: ['Comptes rendus']
      }
    ),
    routeItem(
      'testing_administer_program',
      'testing',
      'Administrer les essais: sessions, questionnaires, carte de confusion, signalements, urgences, debriefs, testeurs, scénarios, exports CSV.',
      'admin-test-results',
      '/administration-resultats-essais',
      {
        expectedTexts: ['Seances', 'Questionnaires', 'Signalements', 'Comptes rendus']
      }
    ),

    warningRouteItem(
      'partial_favorites',
      'partial',
      'Favoris sur cartes et fiches annonce: UI présente, mais pas de parcours persistant complet trouvé.',
      'equipment-detail',
      listingDetailPath,
      "La présence du bouton favori est vérifiée, mais la persistance complète du parcours n'est pas finalisée dans le produit.",
      {
        blockingReason: listingDetailPath ? null : "Aucune annonce publiée n'est disponible pour vérifier les favoris.",
        expectedSelectors: ['button[aria-label="Ajouter aux favoris"], button[aria-label="Retirer des favoris"]']
      }
    ),
    warningRouteItem(
      'partial_reporting_front_only',
      'partial',
      'Signalement d’annonce et signalement depuis le compte: formulaires présents, mais côté front l’envoi est encore simulé.',
      null,
      null,
      "Les formulaires de signalement sont visibles, mais leur exécution reste partielle côté produit.",
      {
        targets: [
          {
            label: 'Signalement depuis le compte',
            path: '/profil-documents-utilisateur/signaler',
            routeId: 'account-report',
            expectedTexts: ['Signaler un problème']
          },
          {
            label: 'Signalement annonce',
            path: listingDetailPath,
            routeId: 'equipment-detail',
            expectedSelectors: ['button[aria-label="Signaler"]']
          }
        ],
        blockingReason: listingDetailPath ? null : "Aucune annonce publiée n'est disponible pour vérifier le signalement annonce."
      }
    ),
    warningRouteItem(
      'partial_advanced_security',
      'partial',
      'Paramètres sécurité avancés du compte: 2FA, sessions actives, langue/devise/fuseau sont exposés, mais le workflow complet n’est pas branché.',
      'account-settings',
      '/profil-documents-utilisateur/parametres',
      "Les panneaux avancés sont visibles, mais le workflow complet n'est pas entièrement branché.",
      {
        expectedTexts: ['Authentification à deux facteurs', 'Sessions actives']
      }
    ),
    warningRouteItem(
      'partial_public_demand_propose',
      'partial',
      '“Proposer” sur une demande publique: bouton visible, mais pas finalisé.',
      'public-demands-marketplace',
      '/demandes-publiques',
      "Le bouton Proposer est visible mais le parcours n'est pas finalisé.",
      {
        expectedTexts: ['Proposer']
      }
    ),
    warningRouteItem(
      'partial_admin_reservations_demo',
      'partial',
      'Gestion admin des réservations: parcours exposé, mais la page semble encore en partie alimentée par des données de démonstration.',
      'admin-reservation-management',
      '/administration-gestion-reservations',
      "La page admin réservations est accessible, mais peut encore mélanger des données de démonstration."
    ),

    ...testerPairs.map((pair) => advancedBackendItem(
      pair.verificationId,
      `${pair.familyLabel || pair.family} · ${pair.referenceTitle}`,
      {
        automationMode: 'tester_pair_backend',
        referenceScenarioId: pair.referenceScenarioId,
        pair,
        scopeNote: `Exécute le binôme référence / miroir ${pair.referenceTitle}${pair?.mirrorTitle ? ` -> ${pair.mirrorTitle}` : ''}.`
      }
    )),

    advancedBackendItem(
      'testing_pairs_backend_all',
      'Valider tous les binômes référence / miroir du protocole de tests utilisateurs.',
      {
        automationMode: 'tester_pairs_batch',
        verificationTargets: testerPairs,
        expectedPairCount: testerPairs.length,
        scopeNote: 'Exécute la vérification backend complète de tous les binômes actifs du protocole testeur.',
        excludeFromRunAll: true
      }
    )
  ];
};

const normalizeCatalogItem = (item = {}) => {
  const overrides = CATALOG_ITEM_OVERRIDES?.[item?.id] || null;
  const mergedItem = overrides ? { ...item, ...overrides } : item;
  const normalizedTargets = Array.isArray(mergedItem?.targets)
    ? mergedItem.targets.map((target, index) => {
      const sourceTarget = Array.isArray(item?.targets) ? item.targets[index] : null;
      const resolvedPath = String(target?.path || sourceTarget?.path || '').trim();

      return {
        ...sourceTarget,
        ...target,
        path: resolvedPath
      };
    })
    : null;

  const hasUnresolvedTarget = normalizedTargets
    ? normalizedTargets.some((target) => !target?.path)
    : false;
  const derivedBlockingReason = mergedItem?.blockingReason
    || SESSION_CONTEXT_BLOCKING_REASON_BY_ID?.[mergedItem?.id]
    || DERIVED_BLOCKING_REASON_BY_ID?.[mergedItem?.id]
    || null;

  return {
    ...mergedItem,
    routePath: String(mergedItem?.routePath || '').trim(),
    targets: normalizedTargets,
    isRunnable: derivedBlockingReason
      ? false
      : mergedItem?.automationMode === 'tester_pairs_batch'
      ? Array.isArray(mergedItem?.verificationTargets) && mergedItem.verificationTargets.length > 0
      : mergedItem?.automationMode === 'tester_pair_backend'
        ? Boolean(mergedItem?.referenceScenarioId)
      : Boolean(
        mergedItem?.routePath
        || (Array.isArray(normalizedTargets) && normalizedTargets.length > 0 && !hasUnresolvedTarget)
      ),
    excludeFromRunAll: mergedItem?.excludeFromRunAll === true,
    blockingReason: derivedBlockingReason
      || (mergedItem?.automationMode === 'tester_pairs_batch' && (!Array.isArray(mergedItem?.verificationTargets) || !mergedItem.verificationTargets.length)
        ? 'Aucun binôme testeur actif n’a été trouvé.'
        : mergedItem?.automationMode === 'tester_pair_backend' && !mergedItem?.referenceScenarioId
          ? 'Le scénario de référence du binôme n’a pas été résolu.'
        : null)
  };
};

export const getVerificationCategoryMeta = (category) => CATEGORY_META?.[category] || {
  label: String(category || 'Catalogue'),
  shortLabel: String(category || 'Catalogue')
};

export const buildAdminVerificationCatalog = (context = {}) => (
  buildStaticCatalog(context)
    .map(normalizeCatalogItem)
    .sort((left, right) => {
      const categoryDelta = VERIFICATION_CATEGORY_ORDER.indexOf(left.category) - VERIFICATION_CATEGORY_ORDER.indexOf(right.category);
      if (categoryDelta !== 0) return categoryDelta;
      return String(left?.title || '').localeCompare(String(right?.title || ''), 'fr');
    })
);

export default buildAdminVerificationCatalog;
