export const FOOTER_SLUG = 'footer-settings';
export const FOOTER_TITLE = 'Configuration du footer';

const DEFAULT_LEGAL_LINKS = [
  { label: 'Mentions l\u00e9gales', to: '/legal/mentions-legales' },
  { label: 'Politique Cookies', to: '/legal/politique-temoins-connexion' },
  { label: 'Politique de confidentialit\u00e9', to: '/legal/politique-confidentialite' },
  { label: "Conditions d'utilisation", to: '/legal/cgu' },
  { label: 'Conditions de vente', to: '/legal/cgv' },
  { label: 'Couverture assurance', to: '/couverture-assurance' },
  { label: 'FAQ', to: '/foire-questions' }
];

const DEFAULT_CATEGORIES = [
  'Jardinage',
  '\u00c9lectrom\u00e9nager',
  'Hi-Tech',
  'Maison & Mobilier',
  'Pu\u00e9riculture',
  '\u00c9v\u00e9nementiel & Loisirs',
  'Sports & Bien-\u00eatre',
  'Accessoires & V\u00eatements',
  'Accessoires pour Animaux',
  'V\u00e9hicules & Mobilit\u00e9',
  'Bricolage & BTP',
  'Logements'
];

export const DEFAULT_FOOTER_DATA = {
  companyName: 'Le Matos du Voisin',
  description: "Plateforme de location d'objets entre particuliers.",
  bottomTagline: 'Louez entre voisins, simplement et en confiance.',
  legalLinks: DEFAULT_LEGAL_LINKS,
  categories: DEFAULT_CATEGORIES
};

const normalizeText = (value, fallback = '') => {
  const nextValue = String(value || '')?.trim();
  return nextValue || fallback;
};

const normalizeLegalLinks = (value) => {
  if (!Array?.isArray(value)) return DEFAULT_LEGAL_LINKS;

  const links = value
    ?.map((link) => ({
      label: normalizeText(link?.label),
      to: normalizeText(link?.to)
    }))
    ?.filter((link) => link?.label && link?.to);

  return links?.length > 0 ? links : DEFAULT_LEGAL_LINKS;
};

const normalizeCategories = (value) => {
  if (!Array?.isArray(value)) return DEFAULT_CATEGORIES;

  const categories = value
    ?.map((item) => normalizeText(item))
    ?.filter(Boolean);

  return categories?.length > 0 ? categories : DEFAULT_CATEGORIES;
};

export const normalizeFooterData = (value) => {
  const nextValue = value || {};
  const merged = {
    ...DEFAULT_FOOTER_DATA,
    ...nextValue
  };

  return {
    ...merged,
    companyName: normalizeText(merged?.companyName, DEFAULT_FOOTER_DATA?.companyName),
    description: normalizeText(merged?.description, DEFAULT_FOOTER_DATA?.description),
    bottomTagline: normalizeText(merged?.bottomTagline, DEFAULT_FOOTER_DATA?.bottomTagline),
    legalLinks: normalizeLegalLinks(merged?.legalLinks),
    categories: normalizeCategories(merged?.categories)
  };
};

export const parseFooterData = (rawContent) => {
  if (!rawContent) return DEFAULT_FOOTER_DATA;

  try {
    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    return normalizeFooterData(parsed);
  } catch (error) {
    console.warn('Contenu footer invalide, fallback par défaut:', error);
    return DEFAULT_FOOTER_DATA;
  }
};
