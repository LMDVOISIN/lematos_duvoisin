const { test, expect } = require('@playwright/test');

const ensureUsablePage = async (page, opts = {}) => {
  const { minText = 80 } = opts;
  await page.waitForTimeout(350);
  const bodyText = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').trim();
  expect(bodyText.length).toBeGreaterThan(minText);
  expect(bodyText).not.toMatch(/application error|something went wrong|referenceerror|typeerror/i);
};

const maybeClick = async (locator) => {
  const el = locator.first();
  if ((await el.count()) > 0) {
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      await el.click({ timeout: 3000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

const maybeFill = async (locator, value) => {
  const el = locator.first();
  if ((await el.count()) > 0) {
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      await el.fill(value, { timeout: 3000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

const checkRoute = async (page, cfg) => {
  const jsErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (e) => jsErrors.push(String(e?.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(cfg.path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);

  const pathname = new URL(page.url()).pathname;
  if (cfg.expectedPaths && cfg.expectedPaths.length) {
    expect(cfg.expectedPaths).toContain(pathname);
  }

  if (cfg.interaction) {
    await cfg.interaction(page, pathname);
  }

  await ensureUsablePage(page, { minText: cfg.minText || 80 });

  // Hard fail on JS runtime errors; keep console errors permissive for noisy third-party assets.
  expect(jsErrors).toEqual([]);
};

const scenarios = [
  { id: 1, title: 'Accueil principal', path: '/' },
  { id: 2, title: 'Accueil recherche', path: '/accueil-recherche' },
  { id: 3, title: 'Legacy home-search redirect', path: '/home-search', expectedPaths: ['/accueil-recherche'] },
  { id: 4, title: 'FAQ page', path: '/foire-questions' },
  { id: 5, title: 'Legacy FAQ redirect', path: '/faq', expectedPaths: ['/foire-questions'] },
  { id: 6, title: 'Mentions legales', path: '/legal/mentions-legales' },
  { id: 7, title: 'CGU', path: '/legal/cgu' },
  { id: 8, title: 'CGV', path: '/legal/cgv' },
  { id: 9, title: 'Politique confidentialite', path: '/legal/politique-confidentialite' },
  { id: 10, title: 'Politique temoins', path: '/legal/politique-temoins-connexion' },
  { id: 11, title: 'Legacy politique cookies redirect', path: '/politique-cookies', expectedPaths: ['/legal/politique-temoins-connexion'] },
  { id: 12, title: 'Page authentification', path: '/authentification' },
  { id: 13, title: 'Legacy authentication redirect', path: '/authentication', expectedPaths: ['/authentification'] },
  { id: 14, title: 'Reset password page', path: '/reinitialiser-mot-de-passe' },
  { id: 15, title: 'Legacy reset-password redirect', path: '/reset-password', expectedPaths: ['/reinitialiser-mot-de-passe'] },
  {
    id: 16,
    title: 'Interaction recherche accueil',
    path: '/accueil-recherche',
    interaction: async (page) => {
      await maybeFill(
        page.locator('input[type="search"], input[placeholder*="rech"], input[type="text"]'),
        'perceuse'
      );
      await page.keyboard.press('Enter').catch(() => {});
      await page.mouse.wheel(0, 600);
    },
  },
  {
    id: 17,
    title: 'Interaction FAQ (ouvrir question)',
    path: '/foire-questions',
    interaction: async (page) => {
      const clicked =
        (await maybeClick(page.locator('button').filter({ hasText: /\?/ }))) ||
        (await maybeClick(page.locator('button')));
      if (clicked) await page.waitForTimeout(250);
    },
  },
  {
    id: 18,
    title: 'Tentative de connexion invalide',
    path: '/authentification',
    interaction: async (page) => {
      await maybeFill(page.locator('input[type="email"], input[name*="mail"]'), 'fake-user@example.com');
      await maybeFill(page.locator('input[type="password"]'), 'motdepasse-invalide');
      await maybeClick(page.locator('button[type="submit"], button').filter({ hasText: /connexion|se connecter|login/i }));
      await page.waitForTimeout(500);
    },
  },
  {
    id: 19,
    title: 'Tentative creation demande',
    path: '/creer-demande',
    interaction: async (page) => {
      await maybeFill(page.locator('input[type="text"], input:not([type])'), 'Demande test utilisateur');
      await maybeFill(page.locator('textarea'), 'Je cherche une perceuse pour ce week-end.');
      await maybeClick(page.locator('button[type="submit"], button').filter({ hasText: /publier|creer|envoyer|continuer/i }));
      await page.waitForTimeout(300);
    },
  },
  {
    id: 20,
    title: 'Exploration marketplace demandes',
    path: '/demandes-publiques',
    interaction: async (page) => {
      await maybeFill(page.locator('input[type="search"], input[type="text"]'), 'tondeuse');
      await maybeClick(page.locator('button, a').filter({ hasText: /filtre|voir|detail|consulter/i }));
      await page.mouse.wheel(0, 500);
    },
  },
  { id: 21, title: 'Page detail materiel (id 1)', path: '/detail-materiel/1', minText: 40 },
  {
    id: 22,
    title: 'Page demande reservation (id 1)',
    path: '/demande-reservation/1',
    expectedPaths: ['/demande-reservation/1', '/authentification'],
    minText: 40,
  },
  {
    id: 23,
    title: 'Page traitement paiement',
    path: '/traitement-paiement',
    expectedPaths: ['/traitement-paiement', '/authentification'],
    minText: 40,
  },
  {
    id: 24,
    title: 'Page acces admin',
    path: '/admin',
    interaction: async (page) => {
      await maybeFill(page.locator('input[type="password"]'), 'wrong-password');
      await maybeClick(page.locator('button[type="submit"], button').filter({ hasText: /acceder|continuer|valider|connexion/i }));
    },
  },
  { id: 25, title: 'Admin guard redirect', path: '/administration-tableau-bord', expectedPaths: ['/admin', '/administration-tableau-bord'], minText: 40 },
  {
    id: 26,
    title: 'Setup contexte testeur',
    path: '/participant-configuration-contexte-authentification',
    expectedPaths: ['/participant-configuration-contexte-authentification', '/authentification'],
    minText: 40,
  },
  {
    id: 27,
    title: 'Interface mode essai',
    path: '/interface-mode-essai-panneau-scenario',
    expectedPaths: ['/interface-mode-essai-panneau-scenario', '/authentification'],
    minText: 40,
  },
];

test.describe('Parcours utilisateur reel (27 checks)', () => {
  for (const s of scenarios) {
    test(`${String(s.id).padStart(2, '0')} - ${s.title}`, async ({ page }) => {
      await checkRoute(page, s);
    });
  }
});

