const nettoyerSegment = (value) => {
  if (!value) return '';

  return String(value)
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-+|-+$/g, '')
    ?.replace(/-{2,}/g, '-');
};

const DEFAULT_SITE_ORIGIN = 'https://www.lematosduvoisin.fr';

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const resolveCanonicalSiteOrigin = (origin = '') => {
  const explicitOrigin = normalizeOrigin(
    import.meta.env?.VITE_SITE_URL
      || import.meta.env?.VITE_APP_URL
      || DEFAULT_SITE_ORIGIN
  );
  const requestedOrigin = normalizeOrigin(origin);

  if (!requestedOrigin) {
    return explicitOrigin;
  }

  try {
    const requestedUrl = new URL(requestedOrigin);
    const explicitUrl = new URL(explicitOrigin);
    const requestedHost = requestedUrl.host.toLowerCase();
    const explicitHost = explicitUrl.host.toLowerCase();
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestedHost);

    if (isLocalHost || requestedHost === 'lematosduvoisin.fr' || requestedHost === explicitHost) {
      return explicitOrigin;
    }
  } catch (error) {
    return requestedOrigin || explicitOrigin;
  }

  return requestedOrigin;
};

export const construireSlugAnnonce = (annonce = {}) => {
  const objet = nettoyerSegment(annonce?.titre || annonce?.title || 'objet');
  const ville = nettoyerSegment(annonce?.ville || annonce?.city || 'ville');
  return `location-${objet}-${ville}`;
};

export const construireUrlAnnonce = (annonce = {}) => {
  if (!annonce?.id) return '/accueil-recherche';
  return `/location/${construireSlugAnnonce(annonce)}/${annonce?.id}/`;
};

export const construireUrlAnnonceAbsolue = (annonce = {}, origin = '') => {
  const path = construireUrlAnnonce(annonce);
  const baseOrigin = resolveCanonicalSiteOrigin(origin);
  if (!baseOrigin) return path;
  return `${baseOrigin}${path}`;
};

export default construireUrlAnnonce;
