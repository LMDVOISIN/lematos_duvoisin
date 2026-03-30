export const ACCOUNT_SECTION_PATHS = {
  profile: '/profil-documents-utilisateur',
  activity: '/profil-documents-utilisateur/historique',
  documents: '/profil-documents-utilisateur/documents',
  settings: '/profil-documents-utilisateur/parametres',
  payouts: '/profil-documents-utilisateur/coordonnees-versement',
  logout: '/profil-documents-utilisateur/deconnexion',
  report: '/profil-documents-utilisateur/signaler'
};

export const ACCOUNT_MENU_ITEMS = [
  { id: 'profile', label: 'Profil', icon: 'User', path: ACCOUNT_SECTION_PATHS.profile },
  { id: 'activity', label: 'Historique', icon: 'Activity', path: ACCOUNT_SECTION_PATHS.activity },
  { id: 'documents', label: 'Documents', icon: 'FileText', path: ACCOUNT_SECTION_PATHS.documents },
  { id: 'settings', label: 'Paramètres', icon: 'Settings', path: ACCOUNT_SECTION_PATHS.settings },
  { id: 'payouts', label: 'Coordonnées de versement', icon: 'Wallet', path: ACCOUNT_SECTION_PATHS.payouts },
  { id: 'logout', label: 'Déconnexion', icon: 'LogOut', path: ACCOUNT_SECTION_PATHS.logout },
  { id: 'report', label: 'Signaler', icon: 'Flag', path: ACCOUNT_SECTION_PATHS.report }
];

export const ACCOUNT_PAGE_META = {
  profile: {
    title: 'Mon Profil',
    subtitle: 'Gérez vos informations personnelles et votre identité de compte.'
  },
  activity: {
    title: 'Historique',
    subtitle: 'Retrouvez vos activités et réservations passées.'
  },
  documents: {
    title: 'Documents',
    subtitle: 'Gérez vos justificatifs et vos pièces transmises.'
  },
  settings: {
    title: 'Paramètres',
    subtitle: 'Ajustez vos préférences, notifications et options de compte.'
  },
  payouts: {
    title: 'Coordonnées de versement',
    subtitle: 'Configurez le compte bancaire qui reçoit vos versements.'
  },
  logout: {
    title: 'Déconnexion',
    subtitle: 'Fermez votre session sur cet appareil en une action.'
  },
  report: {
    title: 'Signaler',
    subtitle: 'Décrivez un problème rencontré sur votre compte ou sur la plateforme.'
  }
};

export const resolveLegacyAccountTabPath = (tab) => {
  const normalizedTab = String(tab || '').trim().toLowerCase();

  switch (normalizedTab) {
    case 'profile':
      return ACCOUNT_SECTION_PATHS.profile;
    case 'activity':
    case 'historique':
      return ACCOUNT_SECTION_PATHS.activity;
    case 'documents':
      return ACCOUNT_SECTION_PATHS.documents;
    case 'settings':
    case 'parametres':
      return ACCOUNT_SECTION_PATHS.settings;
    case 'payouts':
    case 'coordonnees-versement':
      return ACCOUNT_SECTION_PATHS.payouts;
    case 'logout':
    case 'deconnexion':
      return ACCOUNT_SECTION_PATHS.logout;
    case 'report':
    case 'signaler':
      return ACCOUNT_SECTION_PATHS.report;
    default:
      return null;
  }
};
