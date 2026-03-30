import {
  DEFAULT_TESTING_PARTICIPANT_IMPORTANT,
  TESTING_SCENARIO_PARTICIPANT_COPY
} from './testingScenarioParticipantCopy';

const SCENARIO_BRIEFS = {
  'd6235dc4-5e96-49c1-8b4a-0f04a83a41c3': {
    objective:
      "Vérifier qu'un locataire trouve un objet, comprend l'annonce et envoie une demande de réservation sans aide.",
    instructions: [
      "Point de départ : depuis l'accueil recherche, chercher un objet disponible puis ouvrir son annonce.",
      "Parcours observé : filtres, lecture de l'annonce, choix des dates, puis passage au formulaire.",
      "Point d'attention : clarté du prix, des disponibilités et du paiement."
    ],
    expectedOutcome:
      "Le parcours doit rester continu et rassurant entre la recherche, l'annonce et la demande."
  },
  '5ae4e63b-6655-4d55-a2ef-966e3786c252': {
    objective:
      "Vérifier qu'un propriétaire peut publier une annonce simple sans se perdre dans le formulaire.",
    instructions: [
      "Point de départ : depuis `Créer une annonce`, lancer une annonce simple pour un équipement courant.",
      "Parcours observé : saisie des informations essentielles jusqu'à la publication.",
      "Point d'attention : clarté des champs, ordre des étapes et aides disponibles."
    ],
    expectedOutcome:
      "La création doit pouvoir se faire sans retour arrière inutile ni doute sur les informations attendues."
  },
  '461abaf3-b7fd-48f9-883b-0622b5dbae48': {
    objective:
      "Vérifier le parcours complet d'un nouveau compte qui s'inscrit puis réserve un objet.",
    instructions: [
      "Point de départ : en état non connecté, ouvrir une annonce puis tenter une réservation pour déclencher l'inscription.",
      "Parcours observé : connexion, recherche, annonce, documents et reprise du flux.",
      "Point d'attention : conservation du contexte avant et après la création de compte."
    ],
    expectedOutcome:
      "Le passage entre inscription et réservation doit rester fluide et compréhensible pour un nouveau venu."
  },
  '999eee41-5324-437d-9ce3-7022b27f03fb': {
    objective:
      "Vérifier qu'un propriétaire peut partir d'une annonce simple puis aller jusqu'à une publication complète avec photos et tarification.",
    instructions: [
      "Point de départ : depuis `Créer une annonce`, lancer une annonce complète avec photos et tarification.",
      "Parcours observé : saisie des informations essentielles, puis étapes photo, tarification et publication.",
      "Point d'attention : clarté des champs, ordre des étapes, robustesse des transitions et compréhension de ce qui est obligatoire ou optionnel."
    ],
    expectedOutcome:
      "Le propriétaire doit pouvoir publier sans retour arrière inutile, en comprenant d'abord les informations attendues puis quand son annonce est réellement prête."
  },
  'baeab87e-dc97-42b7-9c7e-842eac638429': {
    objective:
      "Vérifier que deux utilisateurs peuvent entrer en contact et suivre les échanges utiles avant réservation.",
    instructions: [
      "Point de départ : ouvrir une annonce existante puis lancer un message au propriétaire.",
      "Parcours observé : envoi d'une question, réception de la réponse et lecture de la notification associée.",
      "Point d'attention : visibilité de la messagerie et suivi des échanges."
    ],
    expectedOutcome:
      "Le canal de message doit être facile à ouvrir, à relire et à rattacher à l'annonce concernée."
  },
  'af358c11-4426-4829-bbd5-4303af621baa': {
    objective:
      "Vérifier qu'un administrateur retrouve vite les outils de modération, de suivi et de gestion.",
    instructions: [
      "Point de départ : depuis le tableau de bord admin, ouvrir successivement les sections annonces, utilisateurs et réservations.",
      "Contexte testé : besoin d'agir vite sur un signalement ou un blocage.",
      "Point d'attention : disponibilité des informations nécessaires à la décision."
    ],
    expectedOutcome:
      "Les écrans admin doivent soutenir une décision rapide sans obliger à chercher l'information critique."
  },
  '85978be1-15db-590b-aaba-01d40423964a': {
    objective:
      "Vérifier qu'un locataire trouve un objet, comprend l'annonce, lance la réservation puis traverse la location nominale sans aide.",
    instructions: [
      "Point de départ : depuis l'accueil recherche, choisir un objet disponible puis ouvrir son annonce.",
      "Parcours observé : recherche, lecture de l'annonce, réservation, remise, usage, photos et restitution finale.",
      "Point d'attention : clarté du prix, des disponibilités, du paiement, compréhension des étapes et confiance globale."
    ],
    expectedOutcome:
      "Le locataire doit traverser un parcours continu et rassurant, depuis la découverte de l'annonce jusqu'à la fin de la location sans incident."
  },
  '53572f5e-c6d0-5641-9e64-f3290812b301': {
    objective:
      "Evaluation d'une annulation de réservation côté locataire.",
    instructions: [
      "Point de départ : depuis `Mes réservations`, ouvrir une réservation déjà engagée côté locataire.",
      "Parcours observé : accès à l'action d'annulation et lecture des conséquences avant validation.",
      "Point d'attention : clarté de la suite pour le locataire et pour le propriétaire."
    ],
    expectedOutcome:
      "L'annulation doit être trouvable, explicite et sans ambiguïté sur ses effets."
  },
  'c4c99f8b-b490-5252-9d90-76e35f6d6aec': {
    objective:
      "Evaluation d'une panne survenue pendant l'utilisation de l'objet.",
    instructions: [
      "Point de départ : depuis une réservation en cours, ouvrir le dossier de location au moment où la panne survient.",
      "Parcours observé : signalement, documentation de l'incident et compréhension de la suite.",
      "Point d'attention : capacité du flux à faire agir vite sans perdre le contexte de réservation."
    ],
    expectedOutcome:
      "Le signalement de panne doit être actionnable rapidement avec une suite claire."
  },
  '53b3fdb1-67e5-4d2b-9b86-86ca8a4ba03e': {
    objective:
      "Evaluation de la réception d'un signalement de panne côté propriétaire pendant la location.",
    instructions: [
      "Point de départ : depuis une location en cours, ouvrir le dossier au moment où le locataire signale la panne.",
      "Parcours observé : lecture du signalement, consultation des preuves et compréhension de la suite côté propriétaire.",
      "Point d'attention : clarté des responsabilités, du niveau d'urgence et de la marche à suivre."
    ],
    expectedOutcome:
      "Le propriétaire doit comprendre rapidement ce qui s'est passé, ce qui est attendu de lui et la suite du dossier."
  },
  '0ea1478a-32f4-55ce-a02f-6d2a19e30955': {
    objective:
      "Evaluation d'un retard locataire au rendez-vous de remise.",
    instructions: [
      "Point de départ : depuis le dossier de réservation, se placer sur le rendez-vous de prise déjà planifié.",
      "Parcours observé : information de l'autre partie, gestion du retard et lecture des conséquences.",
      "Point d'attention : perception de l'urgence sans confusion inutile."
    ],
    expectedOutcome:
      "Le retard doit pouvoir être signalé clairement, avec une suite visible pour les deux parties."
  },
  '8134a5ac-3f1c-52cb-8e61-823a854af8c2': {
    objective:
      "Evaluation d'une absence locataire au rendez-vous de prise.",
    instructions: [
      "Point de départ : ouvrir le dossier de réservation au moment où la remise ne se fait pas du tout.",
      "Parcours observé : reconnaissance rapide du no-show par le propriétaire et par la plateforme.",
      "Point d'attention : distinction entre absence, retard et annulation."
    ],
    expectedOutcome:
      "Le no-show doit être reconnu comme un cas spécifique avec une suite sans ambiguïté."
  },
  '4f6a1f27-9c43-5653-a6c9-ffe28c5777bb': {
    objective:
      "Evaluation d'un refus de restitution côté locataire.",
    instructions: [
      "Point de départ : depuis une location arrivée à restitution, ouvrir l'écran où le retour devrait être confirmé.",
      "Parcours observé : remontée de la situation côté propriétaire puis côté plateforme.",
      "Point d'attention : capacité du flux à documenter et escalader sans perte de repère."
    ],
    expectedOutcome:
      "Le refus de restitution doit faire basculer vers une gestion d'incident claire et exploitable."
  },
  '21f682d4-801e-50db-afef-3635a9631445': {
    objective:
      "Evaluation d'une restitution en retard et de la gestion du dépassement.",
    instructions: [
      "Point de départ : depuis une réservation terminée en retard, ouvrir le dossier de restitution hors délai.",
      "Parcours observé : constat du retard, signalement et explication du dépassement.",
      "Point d'attention : compréhension des pénalités et de la suite du dossier."
    ],
    expectedOutcome:
      "Le dépassement doit être visible, justifiable et rattaché à des conséquences explicites."
  },
  '7193b2d9-4b39-5aab-b4bc-120b0f9f8bda': {
    objective:
      "Evaluation d'une déclaration de dommage pendant la location.",
    instructions: [
      "Point de départ : depuis une location en cours, ouvrir le dossier au moment où le dommage doit être déclaré.",
      "Parcours observé : déclaration du dommage, ajout des preuves et lecture de la suite.",
      "Point d'attention : pertinence de l'action proposée au bon moment."
    ],
    expectedOutcome:
      "La déclaration d'un dommage doit être rapide, documentée et sans zone grise."
  },
  'd0b19810-8307-52b3-9e74-d3554f5fed9e': {
    objective:
      "Évaluation d'une déclaration de perte ou de vol.",
    instructions: [
      "Point de départ : depuis une réservation en cours, ouvrir le dossier au moment où l'objet ne peut plus être restitué.",
      "Parcours observé : déclaration de perte ou de vol et identification des preuves attendues.",
      "Point d'attention : niveau de clarté sur l'urgence du cas."
    ],
    expectedOutcome:
      "La déclaration doit cadrer l'incident tout en orientant clairement vers la suite."
  },
  'a2ef55a6-5f1c-5181-a838-8c1c44f826bd': {
    objective:
      "Evaluation d'un signalement d'usage non conforme pendant la location.",
    instructions: [
      "Point de départ : depuis une location en cours, ouvrir le dossier au moment où l'usage n'est plus conforme.",
      "Parcours observé : signalement et bascule éventuelle vers un incident formel.",
      "Point d'attention : clarté des règles d'usage et de la réaction attendue."
    ],
    expectedOutcome:
      "Le signalement d'un mauvais usage doit être simple à comprendre et à rattacher au bon dossier."
  },
  'a0271135-9d3c-5a48-82c5-af0c61f605a7': {
    objective:
      "Evaluation d'une annulation de réservation côté propriétaire.",
    instructions: [
      "Point de départ : depuis `Mes réservations` côté propriétaire, ouvrir une réservation déjà planifiée.",
      "Parcours observé : accès à l'action d'annulation et lecture de son impact pour le locataire.",
      "Point d'attention : clarté des conséquences et du cadre de décision."
    ],
    expectedOutcome:
      "L'annulation côté propriétaire doit être nette, expliquée et traçable."
  },
  '0d79cf47-6fa2-58d8-95e9-3ce557b4c1ac': {
    objective:
      "Evaluation d'un refus d'objet au rendez-vous pour non-conformité.",
    instructions: [
      "Point de départ : ouvrir le dossier de réservation au rendez-vous de remise, avec l'annonce sous les yeux pour comparer l'objet réel.",
      "Parcours observé : refus de la remise, documentation du problème et lecture de la suite.",
      "Point d'attention : guidage de la collecte de preuves et de la décision de refus."
    ],
    expectedOutcome:
      "Le refus doit pouvoir être documenté sans ambiguïté et la suite doit rester claire pour les deux parties."
  },
  'c12cb9d2-c7d6-51f8-bbb8-8669b956becf': {
    objective:
      "Evaluation d'une restitution partielle avec élément manquant.",
    instructions: [
      "Point de départ : ouvrir le dossier de restitution quand un accessoire ou une pièce manque à la remise.",
      "Parcours observé : signalement de l'élément manquant et qualification de la gravité du cas.",
      "Point d'attention : distinction entre oubli, perte et dégradation."
    ],
    expectedOutcome:
      "La restitution partielle doit pouvoir être signalée avec un cadre clair pour les preuves et la suite."
  },
  '09194741-5876-5991-8192-4223836213dc': {
    objective:
      "Evaluation d'un retard propriétaire au rendez-vous de remise.",
    instructions: [
      "Point de départ : depuis le dossier de réservation, se placer sur le rendez-vous de remise avec retard côté propriétaire.",
      "Parcours observé : compréhension côté locataire de ce qu'il faut faire, attendre ou signaler.",
      "Point d'attention : distinction entre retard, absence et annulation."
    ],
    expectedOutcome:
      "Le retard du propriétaire doit être visible et exploitable sans perdre le contexte du rendez-vous."
  },
  '3a65fc08-f039-5bc7-9f50-02b48b1cee91': {
    objective:
      "Evaluation d'une absence propriétaire au rendez-vous de prise.",
    instructions: [
      "Point de départ : ouvrir le dossier de réservation au moment où le propriétaire ne se présente pas à la remise.",
      "Parcours observé : signalement de l'absence et compréhension de la suite côté locataire.",
      "Point d'attention : lisibilité du cas no-show par rapport aux autres incidents de remise."
    ],
    expectedOutcome:
      "L'absence du propriétaire doit être constatable vite, avec une suite claire pour le locataire."
  },
  '61d04afd-a659-5b0a-a08a-536f9c9288c8': {
    objective:
      "Evaluation d'une remise impossible pour cause de lieu, d'accès ou de contexte materiel.",
    instructions: [
      "Point de départ : ouvrir le dossier de réservation au moment où le lieu ou l'accès rend la remise impossible.",
      "Parcours observé : signalement de l'impossibilité de remise.",
      "Point d'attention : compréhension de la cause réelle du blocage."
    ],
    expectedOutcome:
      "Le motif d'impossibilité doit être clair et conduire vers une suite cohérente."
  },
  '37e6a06d-c5a7-5c47-abc3-066fb5649829': {
    objective:
      "Evaluation d'un refus de prolongation par le propriétaire.",
    instructions: [
      "Point de départ : depuis une location en cours, ouvrir la demande de prolongation à traiter côté propriétaire.",
      "Parcours observé : compréhension du refus, notification et lien avec la disponibilité.",
      "Point d'attention : clarté de la suite après le refus."
    ],
    expectedOutcome:
      "Le refus de prolongation doit être compréhensible et laisser une suite actionnable."
  },
  '58ec0c9d-785f-5265-9177-08d905d58627': {
    objective:
      "Evaluation d'un refus de restitution anticipée pour indisponibilité du propriétaire.",
    instructions: [
      "Point de départ : depuis une location en cours, ouvrir la demande de retour anticipé à traiter.",
      "Parcours observé : formulation du refus et alternative éventuellement proposée.",
      "Point d'attention : compréhension du décideur et du motif de décision."
    ],
    expectedOutcome:
      "Le refus de retour anticipé doit rester clair, justifié et sans trou dans la suite du dossier."
  },
  '67701085-bc2e-503b-919b-62dda242a7fe': {
    objective:
      "Evaluation d'un blocage photo après refus d'accès caméra.",
    instructions: [
      "Point de départ : arriver sur une étape photo obligatoire puis refuser l'accès à la caméra.",
      "Parcours observé : explication du blocage et possibilité de retour dans le flux.",
      "Point d'attention : niveau de compréhension pour un profil non expert."
    ],
    expectedOutcome:
      "Le refus de permission doit être détecté, expliqué et accompagnable sans jargon inutile."
  },
  '8bba0700-30fb-5199-835e-97e0a180b678': {
    objective:
      "Evaluation d'un échec d'upload photo au moment de la prise de l'objet.",
    instructions: [
      "Point de départ : arriver sur les photos de prise de l'objet puis provoquer un échec d'envoi.",
      "Parcours observé : formulation de l'erreur et possibilité de reprise.",
      "Point d'attention : compréhension de ce qui est enregistré, perdu ou à refaire."
    ],
    expectedOutcome:
      "L'échec d'upload doit être explicite et proposer une reprise fiable."
  },
  '17b6097b-c77f-53ba-bc14-43b2f506654c': {
    objective:
      "Evaluation d'un échec d'upload photo au moment de la restitution.",
    instructions: [
      "Point de départ : arriver sur les photos de restitution puis provoquer un échec d'envoi.",
      "Parcours observé : distinction entre erreur réseau, erreur de session et validation partielle.",
      "Point d'attention : risque de restitution bloquée sans explication suffisante."
    ],
    expectedOutcome:
      "La restitution ne doit pas devenir opaque quand l'upload échoue."
  },
  '08b87852-3e54-5b93-8a13-a46027b9b76b': {
    objective:
      "Evaluation d'un rejet de photos pour non-conformité.",
    instructions: [
      "Point de départ : partir d'une étape photo déjà soumise puis rouvrir le dossier après rejet.",
      "Parcours observé : compréhension du motif de rejet et de la marche à suivre.",
      "Point d'attention : niveau de guidage de la reprise photo."
    ],
    expectedOutcome:
      "Le rejet de qualité doit expliquer clairement ce qui ne va pas et comment corriger."
  },
  '8b655eb2-0868-574c-a1c1-f2376d7b83b9': {
    objective:
      "Evaluation d'une déconnexion ou d'une expiration de session pendant une étape photo.",
    instructions: [
      "Point de départ : ouvrir une étape photo en cours puis provoquer une rupture de session.",
      "Parcours observé : retour au bon endroit après reprise.",
      "Point d'attention : compréhension de ce qui a été perdu et de ce qui doit être refait."
    ],
    expectedOutcome:
      "La reprise après rupture de session doit être compréhensible et sans perte silencieuse."
  },
  'fbd425cf-9bc5-51ee-9937-7bee36e0e580': {
    objective:
      "Evaluation d'un litige sur l'état de l'objet au moment de la restitution.",
    instructions: [
      "Point de départ : ouvrir un dossier de restitution avec constats contradictoires ou photos opposées.",
      "Parcours observé : exposition des versions et versement des preuves par chaque partie.",
      "Point d'attention : intelligibilite de la logique du litige."
    ],
    expectedOutcome:
      "Le litige doit structurer les preuves et faire comprendre l'étape suivante sans zone grise."
  },
  '92ac0009-df9e-54d4-a67a-d386b117f281': {
    objective:
      "Evaluation d'un litige sur des frais additionnels après la location.",
    instructions: [
      "Point de départ : ouvrir un dossier où des frais additionnels sont déjà contestés après la location.",
      "Parcours observé : explication des frais, contestation et rattachement aux preuves.",
      "Point d'attention : compréhension de la demande et de son motif."
    ],
    expectedOutcome:
      "La contestation des frais doit être cadrée et compréhensible pour les deux parties."
  },
  '219217c5-87c4-5fed-b5cd-a66bdf13ffcc': {
    objective:
      "Evaluation d'un remboursement refusé ou partiel dans un cas limite.",
    instructions: [
      "Point de départ : ouvrir un dossier de remboursement déjà tranché de façon refusée ou partielle.",
      "Parcours observé : explication de la décision et lisibilité des motifs.",
      "Point d'attention : possibilité d'accepter, contester ou escalader la décision."
    ],
    expectedOutcome:
      "La décision de remboursement doit être motivée et lisible, même quand elle est défavorable."
  },
  '2ccc75b3-860a-5f15-a45b-1a4efa8637ba': {
    objective:
      "Evaluation d'un dossier qui doit obligatoirement passer par une escalade support.",
    instructions: [
      "Point de départ : ouvrir un dossier bloqué où la décision doit passer par le support humain.",
      "Parcours observé : visibilité, justification et traçabilité de la bascule vers l'escalade.",
      "Point d'attention : compréhension de l'attente d'une décision humaine."
    ],
    expectedOutcome:
      "L'escalade support doit être explicite, rassurante et sans faux espoirs sur une résolution automatique."
  }
};

const RESERVATION_SETUP_SCENARIO_IDS = new Set([
  '53572f5e-c6d0-5641-9e64-f3290812b301',
  'c4c99f8b-b490-5252-9d90-76e35f6d6aec',
  '53b3fdb1-67e5-4d2b-9b86-86ca8a4ba03e',
  '0ea1478a-32f4-55ce-a02f-6d2a19e30955',
  '8134a5ac-3f1c-52cb-8e61-823a854af8c2',
  '4f6a1f27-9c43-5653-a6c9-ffe28c5777bb',
  '21f682d4-801e-50db-afef-3635a9631445',
  '7193b2d9-4b39-5aab-b4bc-120b0f9f8bda',
  'd0b19810-8307-52b3-9e74-d3554f5fed9e',
  'a2ef55a6-5f1c-5181-a838-8c1c44f826bd',
  'a0271135-9d3c-5a48-82c5-af0c61f605a7',
  '0d79cf47-6fa2-58d8-95e9-3ce557b4c1ac',
  'c12cb9d2-c7d6-51f8-bbb8-8669b956becf',
  '09194741-5876-5991-8192-4223836213dc',
  '3a65fc08-f039-5bc7-9f50-02b48b1cee91',
  '61d04afd-a659-5b0a-a08a-536f9c9288c8',
  '37e6a06d-c5a7-5c47-abc3-066fb5649829',
  '58ec0c9d-785f-5265-9177-08d905d58627'
]);

const buildReservationSetupGuidance = ({
  viewerRole = '',
  mirrorListingsState = 'unknown',
  isPrimaryTester = false,
  hasExistingListings = null
} = {}) => {
  const normalizedViewerRole = String(viewerRole || '').trim();

  if (normalizedViewerRole === 'reference') {
    if (hasExistingListings === true) {
      return {
        status: 'ready',
        prerequisite: 'Vos annonces publiées seront proposées automatiquement pour ce test.',
        firstAction: 'Continuez avec une annonce déjà publiée, ou créez-en une nouvelle si besoin.'
      };
    }
    if (hasExistingListings === null) {
      return {
        status: 'ready',
        prerequisite: 'Si vous avez déjà une annonce publiée, elle sera reprise automatiquement pour ce test.',
        firstAction: 'Vérifiez vos annonces existantes ou créez-en une si besoin.'
      };
    }
    return {
      status: 'ready',
      prerequisite: 'Créez une annonce publiée pour préparer ce test.',
      firstAction: 'Commencez par créer une annonce de location.'
    };
  }

  if (normalizedViewerRole === 'mirror') {
    if (mirrorListingsState === 'available') {
      return {
        status: 'ready',
        prerequisite: 'Choisissez une annonce du test dans la liste proposée.',
        firstAction: 'Ouvrez cette annonce puis lancez la réservation correspondante.'
      };
    }

    if (mirrorListingsState === 'missing') {
      return {
        status: 'waiting_test_listing',
        prerequisite: "Ce test n'est pas encore prêt. L'annonce du test doit d'abord être créée.",
        firstAction: "Attendez que le propriétaire testeur dispose d'une annonce publiée, puis reprenez ce parcours."
      };
    }

    return {
      status: 'ready',
      prerequisite: "Choisissez l'annonce de test préparée pour ce parcours.",
      firstAction: 'Ouvrez cette annonce puis lancez la réservation correspondante.'
    };
  }

  return {
    status: 'ready',
    prerequisite: "Si vous mettez un objet en location, créez une annonce pour ce test. Si vous louez, choisissez ensuite une annonce du test.",
    firstAction: ''
  };
};

const SCENARIO_ENTRY_GUIDANCE = {
  'd6235dc4-5e96-49c1-8b4a-0f04a83a41c3': {
    prerequisite: "Choisissez dans la liste un objet à louer.",
    firstAction: "Ouvrez son annonce puis avancez vers la demande de réservation."
  },
  '5ae4e63b-6655-4d55-a2ef-966e3786c252': {
    prerequisite: "Créez une annonce de location.",
    firstAction: "Commencez depuis `Créer une annonce`."
  },
  '461abaf3-b7fd-48f9-883b-0622b5dbae48': {
    prerequisite: "Choisissez dans la liste un objet à louer.",
    firstAction: "Ouvrez son annonce puis lancez la réservation sans être connecté."
  },
  '999eee41-5324-437d-9ce3-7022b27f03fb': {
    prerequisite: "Créez une annonce de location.",
    firstAction: "Commencez depuis `Créer une annonce` et allez jusqu'aux photos."
  },
  'baeab87e-dc97-42b7-9c7e-842eac638429': {
    prerequisite: "Choisissez dans la liste une annonce à consulter.",
    firstAction: "Ouvrez l'annonce puis lancez un message au propriétaire."
  },
  'af358c11-4426-4829-bbd5-4303af621baa': {
    prerequisite: "Ouvrez l'administration.",
    firstAction: "Commencez sur le tableau de bord admin."
  },
  '85978be1-15db-590b-aaba-01d40423964a': {
    prerequisite: "Choisissez dans la liste un objet à louer.",
    firstAction: "Ouvrez l'annonce puis lancez une location nominale."
  },
  '53572f5e-c6d0-5641-9e64-f3290812b301': {
    prerequisite: '',
    firstAction: "Commencez dans `Mes réservations` sur le dossier concerné."
  },
  'c4c99f8b-b490-5252-9d90-76e35f6d6aec': {
    prerequisite: '',
    firstAction: "Commencez dans le dossier de location au moment de la panne."
  },
  '53b3fdb1-67e5-4d2b-9b86-86ca8a4ba03e': {
    prerequisite: '',
    firstAction: "Commencez dans le dossier de location au moment où la panne vous est signalée."
  },
  '0ea1478a-32f4-55ce-a02f-6d2a19e30955': {
    prerequisite: '',
    firstAction: "Commencez sur le rendez-vous de prise déjà planifié."
  },
  '8134a5ac-3f1c-52cb-8e61-823a854af8c2': {
    prerequisite: '',
    firstAction: "Commencez au moment où la remise n'a pas lieu."
  },
  '4f6a1f27-9c43-5653-a6c9-ffe28c5777bb': {
    prerequisite: '',
    firstAction: "Commencez au moment où la restitution devrait être confirmée."
  },
  '21f682d4-801e-50db-afef-3635a9631445': {
    prerequisite: '',
    firstAction: "Commencez sur le dossier de restitution hors délai."
  },
  '7193b2d9-4b39-5aab-b4bc-120b0f9f8bda': {
    prerequisite: '',
    firstAction: "Commencez dans le dossier de location au moment du dommage."
  },
  'd0b19810-8307-52b3-9e74-d3554f5fed9e': {
    prerequisite: '',
    firstAction: "Commencez dans le dossier de location au moment de la perte ou du vol."
  },
  'a2ef55a6-5f1c-5181-a838-8c1c44f826bd': {
    prerequisite: '',
    firstAction: "Commencez dans le dossier de location au moment de l'usage non conforme."
  },
  'a0271135-9d3c-5a48-82c5-af0c61f605a7': {
    prerequisite: '',
    firstAction: "Commencez dans `Mes réservations` côté propriétaire."
  },
  '0d79cf47-6fa2-58d8-95e9-3ce557b4c1ac': {
    prerequisite: '',
    firstAction: "Au rendez-vous de remise, comparez l'objet réel à l'annonce."
  },
  'c12cb9d2-c7d6-51f8-bbb8-8669b956becf': {
    prerequisite: '',
    firstAction: "Commencez au moment de la restitution avec un élément manquant."
  },
  '09194741-5876-5991-8192-4223836213dc': {
    prerequisite: '',
    firstAction: "Commencez sur le rendez-vous de remise avec retard côté propriétaire."
  },
  '3a65fc08-f039-5bc7-9f50-02b48b1cee91': {
    prerequisite: '',
    firstAction: "Commencez au moment où le propriétaire ne se présente pas."
  },
  '61d04afd-a659-5b0a-a08a-536f9c9288c8': {
    prerequisite: '',
    firstAction: "Commencez au moment où le lieu ou l'accès bloque la remise."
  },
  '37e6a06d-c5a7-5c47-abc3-066fb5649829': {
    prerequisite: '',
    firstAction: "Commencez sur une demande de prolongation à traiter."
  },
  '58ec0c9d-785f-5265-9177-08d905d58627': {
    prerequisite: '',
    firstAction: "Commencez sur une demande de retour anticipé à traiter."
  },
  '67701085-bc2e-503b-919b-62dda242a7fe': {
    prerequisite: "Ouvrez une étape photo obligatoire.",
    firstAction: "Refusez l'accès à la caméra."
  },
  '8bba0700-30fb-5199-835e-97e0a180b678': {
    prerequisite: "Ouvrez une étape photo obligatoire.",
    firstAction: "Commencez les photos de prise puis provoquez un échec d'envoi."
  },
  '17b6097b-c77f-53ba-bc14-43b2f506654c': {
    prerequisite: "Ouvrez une étape photo obligatoire.",
    firstAction: "Commencez les photos de restitution puis provoquez un échec d'envoi."
  },
  '08b87852-3e54-5b93-8a13-a46027b9b76b': {
    prerequisite: "Ouvrez une étape photo rejetée.",
    firstAction: "Relisez le rejet puis préparez une reprise."
  },
  '8b655eb2-0868-574c-a1c1-f2376d7b83b9': {
    prerequisite: "Ouvrez une étape photo obligatoire.",
    firstAction: "Commencez la capture photo puis provoquez une rupture de session."
  },
  'fbd425cf-9bc5-51ee-9937-7bee36e0e580': {
    prerequisite: "Ouvrez un dossier de litige existant.",
    firstAction: "Commencez par lire les constats opposés des deux parties."
  },
  '92ac0009-df9e-54d4-a67a-d386b117f281': {
    prerequisite: "Ouvrez un dossier de litige existant.",
    firstAction: "Commencez par lire les frais contestés."
  },
  '219217c5-87c4-5fed-b5cd-a66bdf13ffcc': {
    prerequisite: "Ouvrez un dossier de remboursement existant.",
    firstAction: "Commencez par lire la décision de remboursement."
  },
  '2ccc75b3-860a-5f15-a45b-1a4efa8637ba': {
    prerequisite: "Ouvrez un dossier bloqué ou escalade.",
    firstAction: "Commencez sur la bascule vers le support humain."
  }
};

const splitLines = (value = '') =>
  String(value || '')
    .split(/\r\n|\s+\|\s+/)
    .map((line) => String(line || '').trim())
    .filter(Boolean);

const cleanInstructionPrefix = (instruction = '', pattern) =>
  String(instruction || '').replace(pattern, '').trim();

const pickStructuredInstruction = (instructions = [], pattern) => {
  const match = instructions.find((instruction) => pattern.test(String(instruction || '').trim()));
  return match ? cleanInstructionPrefix(match, pattern) : '';
};

const excludeStructuredInstructions = (instructions = [], patterns = []) =>
  instructions.filter((instruction) => !patterns.some((pattern) => pattern.test(String(instruction || '').trim())));

const START_POINT_PATTERN = /^Point de départ\s*:/i;
const OBSERVED_PATH_PATTERN = /^(Parcours observé|Contexte testé)\s*:/i;
const ATTENTION_POINT_PATTERN = /^Point d'attention\s*:/i;

export const getTestingScenarioProtocolMeta = (scenario = {}) => {
  const scenarioRecord = scenario || {};
  const pages = Array.isArray(scenarioRecord?.pages) ? scenarioRecord.pages : [];
  const protocolPage = pages.find((page) => (
    page?.source_id
    || page?.source_code
    || typeof page?.requires_photo_upload === 'boolean'
    || typeof page?.requires_device_switch === 'boolean'
    || typeof page?.is_happy === 'boolean'
  )) || {};

  return {
    sourceId: protocolPage?.source_id || null,
    sourceCode: protocolPage?.source_code || null,
    requiresPhotoUpload: Boolean(protocolPage?.requires_photo_upload),
    requiresDeviceSwitch: Boolean(protocolPage?.requires_device_switch),
    isHappyPath: typeof protocolPage?.is_happy === 'boolean' ? protocolPage.is_happy : null,
    stepCount: pages.filter((page) => page?.url).length || pages.length || 0
  };
};

export const getTestingScenarioProtocolTags = (scenario = {}) => {
  const meta = getTestingScenarioProtocolMeta(scenario || {});
  const tags = [];

  if (meta.requiresDeviceSwitch) {
    tags.push('Changement de device');
  }

  if (meta.requiresPhotoUpload) {
    tags.push('Preuve photo requise');
  }

  if (meta.isHappyPath === true) {
    tags.push('Parcours nominal');
  }

  if (meta.isHappyPath === false) {
    tags.push('Parcours incident');
  }

  return tags;
};

export const getTestingScenarioBrief = (scenario = {}, options = {}) => {
  const scenarioRecord = scenario || {};
  const scenarioId = String(scenarioRecord.id || '').trim();
  const customBrief = SCENARIO_BRIEFS[scenarioId] || {};
  const participantCopy = TESTING_SCENARIO_PARTICIPANT_COPY[scenarioId] || {};
  const entryGuidance = SCENARIO_ENTRY_GUIDANCE[scenarioId] || {};
  const viewerRole = String(options.viewerRole || '').trim();
  const testerOrderIndex = Number(options.testerOrderIndex);
  const isPrimaryTester = Number.isFinite(testerOrderIndex) ? testerOrderIndex % 2 === 1 : false;
  const hasExistingListings =
    typeof options?.hasExistingListings === 'boolean' ? options.hasExistingListings : null;
  const hasMirrorGuidance = Object.prototype.hasOwnProperty.call(options || {}, 'mirrorGuidance');
  const hasMirrorListings = Array.isArray(options?.mirrorGuidance?.listings)
    && options.mirrorGuidance.listings.length > 0;
  const mirrorListingsState = hasMirrorListings
    ? 'available'
    : hasMirrorGuidance
      ? 'missing'
      : 'unknown';
  const fallbackInstructions = splitLines(scenarioRecord.instructions);
  const instructions =
    Array.isArray(customBrief.instructions) && customBrief.instructions.length > 0
      ? customBrief.instructions
      : fallbackInstructions;

  const startPoint = pickStructuredInstruction(instructions, START_POINT_PATTERN);
  const observedPath = pickStructuredInstruction(instructions, OBSERVED_PATH_PATTERN);
  const attentionPoint = pickStructuredInstruction(instructions, ATTENTION_POINT_PATTERN);
  const supportingInstructions = excludeStructuredInstructions(instructions, [
    START_POINT_PATTERN,
    OBSERVED_PATH_PATTERN,
    ATTENTION_POINT_PATTERN
  ]);
  const roleAwareGuidance = RESERVATION_SETUP_SCENARIO_IDS.has(scenarioId)
    ? buildReservationSetupGuidance({ viewerRole, mirrorListingsState, isPrimaryTester, hasExistingListings })
    : null;
  const roleAwarePrerequisite = String(roleAwareGuidance?.prerequisite || '').trim();
  const roleAwareFirstAction = String(roleAwareGuidance?.firstAction || '').trim();
  const entryStatus = String(roleAwareGuidance?.status || 'ready').trim() || 'ready';

  return {
    title: scenarioRecord.title || 'Parcours sans titre',
    participantTitle:
      String(participantCopy.title || '').trim()
      || String(scenarioRecord.title || '').trim()
      || 'Parcours sans titre',
    participantSituation:
      String(participantCopy.situation || '').trim()
      || String(customBrief.objective || '').trim()
      || 'Vous découvrez la plateforme et vous avancez dans une situation concrète.',
    participantGoal:
      String(participantCopy.goal || '').trim()
      || String(customBrief.expectedOutcome || '').trim()
      || 'Avancez comme vous le feriez naturellement sur le site.',
    participantImportant:
      String(participantCopy.important || '').trim()
      || DEFAULT_TESTING_PARTICIPANT_IMPORTANT,
    prerequisite:
      roleAwarePrerequisite
      || String(entryGuidance.prerequisite || '').trim()
      || "Ouvrez le dossier ou l'écran concerné par ce test.",
    firstAction:
      String(entryGuidance.firstAction || '').trim()
      || roleAwareFirstAction
      || startPoint
      || 'Commencez sur le premier écran repère du parcours.',
    objective:
      customBrief.objective
      || String(scenarioRecord.objective || scenarioRecord.expected_result || '').trim()
      || 'Brief indisponible pour ce parcours.',
    instructions,
    startPoint,
    observedPath,
    attentionPoint,
    supportingInstructions,
    expectedOutcome:
      customBrief.expectedOutcome || String(scenarioRecord.expected_result || '').trim(),
    entryStatus,
    isStartBlocked: entryStatus !== 'ready',
    protocolTags: getTestingScenarioProtocolTags(scenarioRecord),
    protocolMeta: getTestingScenarioProtocolMeta(scenarioRecord)
  };
};

export const testingScenarioNeedsReservationSetup = (scenario = {}) =>
  RESERVATION_SETUP_SCENARIO_IDS.has(String((scenario || {}).id || '').trim());
