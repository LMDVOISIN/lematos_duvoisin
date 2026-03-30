const SCENARIO_PATH_ALIASES = {
  '/home-search': '/accueil-recherche',
  '/equipment-detail': '/detail-matériel',
  '/equipment-detail/:id': '/detail-matériel/:id',
  '/booking-request': '/demande-reservation',
  '/booking-request/:id': '/demande-reservation/:id',
  '/reservation-create': '/demande-reservation',
  '/create-listing': '/creer-annonce',
  '/create-listing-step2': '/creer-annonce',
  '/create-listing-step3': '/creer-annonce',
  '/signup': '/authentification',
  '/login': '/authentification',
  '/notifications': '/centre-notifications',
  '/user-profile-documents': '/profil-documents-utilisateur'
};

const INDIRECT_SCENARIO_PATHS = new Set([
  '/equipment-detail',
  '/equipment-detail/:id',
  '/booking-request',
  '/booking-request/:id',
  '/reservation-create'
]);

const trimTrailingSlash = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '/') return normalized || '/';
  return normalized.replace(/\/+$/, '') || '/';
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveScenarioPath = (value) => {
  const normalized = trimTrailingSlash(value);
  return SCENARIO_PATH_ALIASES[normalized] || normalized;
};

export const canOpenScenarioPathDirectly = (scenarioPath) => {
  const normalized = trimTrailingSlash(scenarioPath);
  const resolvedPath = resolveScenarioPath(normalized);

  if (!resolvedPath) return false;
  if (INDIRECT_SCENARIO_PATHS.has(normalized)) return false;
  if (resolvedPath.includes('/:')) return false;

  return true;
};

export const matchesScenarioPath = (pathname, scenarioPath) => {
  const actualPath = trimTrailingSlash(pathname);
  const expectedPath = resolveScenarioPath(scenarioPath);

  if (!actualPath || !expectedPath) return false;
  if (actualPath === expectedPath) return true;
  if (expectedPath !== '/' && actualPath.startsWith(`${expectedPath}/`)) return true;

  const pattern = expectedPath
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (segment.startsWith(':')) return '[^/]+';
      return escapeRegex(segment);
    })
    .join('/');

  return new RegExp(`^${pattern}$`, 'i').test(actualPath);
};

export const findScenarioPageByPath = (pathname, pages = []) => {
  return (pages || []).find((page) => matchesScenarioPath(pathname, page?.url)) || null;
};

export const getVisitedScenarioUrls = (responses = [], pages = []) => {
  const visited = new Set();

  (responses || []).forEach((response) => {
    const page = findScenarioPageByPath(response?.page_url, pages);
    if (page?.url) {
      visited.add(page.url);
    }
  });

  return Array.from(visited);
};

export const getScenarioStartNavigationPath = (scenario) => {
  const pages = Array.isArray(scenario?.pages) ? scenario.pages : [];
  const firstPage = [...pages]
    .sort((left, right) => (left?.order || 0) - (right?.order || 0))
    .find((page) => page?.url);

  if (!canOpenScenarioPathDirectly(firstPage?.url)) {
    return '/accueil-recherche';
  }

  return resolveScenarioPath(firstPage?.url || '/accueil-recherche');
};

export const getSessionResumeNavigationPath = (session, scenario) => {
  const checkpointPath = trimTrailingSlash(session?.checkpoint_path);

  if (checkpointPath && !checkpointPath.includes('/:')) {
    const resolvedCheckpointPath = resolveScenarioPath(checkpointPath);
    if (resolvedCheckpointPath?.startsWith('/')) {
      return resolvedCheckpointPath;
    }
  }

  return getScenarioStartNavigationPath(scenario);
};
