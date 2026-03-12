export const LEGAL_PAGE_DEFINITIONS = [
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    aliases: []
  },
  {
    slug: 'cgu',
    title: "Conditions Générales d'Utilisation (CGU)",
    aliases: []
  },
  {
    slug: 'cgv',
    title: 'Conditions Générales de Vente (CGV)',
    aliases: []
  },
  {
    slug: 'politique-temoins-connexion',
    title: 'Politique cookies',
    aliases: ['politique-cookies', 'cookies']
  },
  {
    slug: 'politique-confidentialite',
    title: 'Politique de confidentialité',
    aliases: ['confidentialite']
  }
];

export const getLegalPageDefinition = (slug) =>
  LEGAL_PAGE_DEFINITIONS?.find((definition) => definition?.slug === slug) || null;

export const getCandidateSlugs = (slug, extraSlugs = []) => {
  const definition = getLegalPageDefinition(slug);
  const candidates = [
    slug,
    ...(definition?.aliases || []),
    ...(Array?.isArray(extraSlugs) ? extraSlugs : [])
  ]?.filter(Boolean);

  return [...new Set(candidates)];
};

export const resolveLegalPageFromRows = (rows, slug) => {
  const candidates = getCandidateSlugs(slug);

  return candidates
    ?.map((candidate) => rows?.find((row) => row?.slug === candidate))
    ?.find(Boolean) || null;
};

