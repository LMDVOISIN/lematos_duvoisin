const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = (process.env.SIM_BASE_URL || 'https://www.lematosduvoisin.fr').replace(/\/$/, '');
const LOCATAIRE_EMAIL = process.env.SIM_RENTER_EMAIL || 'rabii@tellr.fr';
const PROPRIETAIRE_EMAIL = process.env.SIM_OWNER_EMAIL || 'rabii@loeni.com';
const ANNONCE_ID = Number(process.env.SIM_ANNONCE_ID || 346);
const START_DATE = process.env.SIM_START_DATE || '2026-02-27T23:00:00.000Z';
const END_DATE = process.env.SIM_END_DATE || '2026-03-09T23:00:00.000Z';

const OUTPUT_DIR = path.resolve(process.cwd(), '.tmp-user-e2e');
const REPORT_FILE = path.join(OUTPUT_DIR, 'simulation-payment-owner-report.json');
const RENTER_SCREENSHOT = path.join(OUTPUT_DIR, 'simulation-renter-payment.png');
const OWNER_SCREENSHOT = path.join(OUTPUT_DIR, 'simulation-owner-tarification.png');

const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envName of requiredEnvVars) {
  if (!process.env[envName]) {
    throw new Error(`Variable manquante: ${envName}`);
  }
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const amountFromText = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
};

const extractAmount = (text, regex) => {
  const match = text.match(regex);
  if (!match?.[1]) return null;
  return amountFromText(match[1]);
};

const generateMagicLink = async (email) => {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${BASE_URL}/accueil-recherche`
    }
  });

  if (error) {
    throw new Error(`generateLink failed for ${email}: ${error.message}`);
  }

  const link = data?.properties?.action_link || data?.action_link || null;
  if (!link) {
    throw new Error(`No action_link returned for ${email}`);
  }
  return link;
};

const dismissCookieBanner = async (page) => {
  const candidates = [
    'button:has-text("Tout refuser")',
    'button:has-text("Tout accepter")',
    'button:has-text("Personnaliser")'
  ];

  for (const selector of candidates) {
    const btn = page.locator(selector).first();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    return;
  }
};

const neutralizeBlockingWidgets = async (page) => {
  await page.evaluate(() => {
    const selectors = ['#agentova-widget-host', 'iframe[src*="agentova"]', 'iframe[title*="chat"]'];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      });
    }
  }).catch(() => {});
};

const loginWithMagicLink = async (context, email) => {
  const page = await context.newPage();
  const actionLink = await generateMagicLink(email);

  await page.goto(actionLink, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  await page.goto(`${BASE_URL}/accueil-recherche`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  await dismissCookieBanner(page);
  await neutralizeBlockingWidgets(page);

  const loginButton = page.locator('button:has-text("Se connecter"), a:has-text("Se connecter")').first();
  const stillLoggedOut = await loginButton.isVisible().catch(() => false);
  if (stillLoggedOut) {
    throw new Error(`Login failed for ${email} (button "Se connecter" still visible)`);
  }

  return page;
};

const getOwnerAnnonceId = async (ownerEmail) => {
  const { data: ownerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id,email,pseudo')
    .ilike('email', ownerEmail)
    .maybeSingle();

  if (profileError || !ownerProfile?.id) {
    throw new Error(`Owner profile introuvable pour ${ownerEmail}: ${profileError?.message || 'not found'}`);
  }

  const { data: annonces, error: annonceError } = await supabaseAdmin
    .from('annonces')
    .select('id,titre,owner_id,photos')
    .eq('owner_id', ownerProfile.id)
    .order('id', { ascending: false })
    .limit(10);

  if (annonceError) {
    throw new Error(`Impossible de lire les annonces owner: ${annonceError.message}`);
  }

  const withPhotos = (annonces || []).find((a) => Array.isArray(a?.photos) && a.photos.length > 0);
  const selected = withPhotos || (annonces || [])[0] || null;
  if (!selected?.id) {
    throw new Error(`Aucune annonce trouvée pour ${ownerEmail}`);
  }

  return Number(selected.id);
};

const run = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      annonceId: ANNONCE_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      locataire: LOCATAIRE_EMAIL,
      proprietaire: PROPRIETAIRE_EMAIL
    },
    renterFlow: {},
    ownerFlow: {},
    success: false
  };

  const browser = await chromium.launch({ headless: true });
  try {
    // RENTER FLOW
    const renterContext = await browser.newContext();
    const renterPage = await loginWithMagicLink(renterContext, LOCATAIRE_EMAIL);

    const paymentUrl = `${BASE_URL}/traitement-paiement?annonceId=${encodeURIComponent(String(ANNONCE_ID))}&startDate=${encodeURIComponent(START_DATE)}&endDate=${encodeURIComponent(END_DATE)}`;
    await renterPage.goto(paymentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await renterPage.waitForTimeout(2500);

    await renterPage.screenshot({ path: RENTER_SCREENSHOT, fullPage: true });
    const renterBodyText = ((await renterPage.textContent('body')) || '').replace(/\s+/g, ' ').trim();

    const displayedRental = extractAmount(renterBodyText, /Prix de location\s*\(\d+\s*jours?\)\s*([0-9]+(?:[.,][0-9]{2})?)\s*EUR/i);
    const totalToPay = extractAmount(renterBodyText, /Total a payer\s*([0-9]+(?:[.,][0-9]{2})?)\s*EUR/i);
    const cautionAmount = extractAmount(renterBodyText, /Caution\s*\(prelevee puis remboursee\)\s*([0-9]+(?:[.,][0-9]{2})?)/i);
    const locationInCautionCard = extractAmount(renterBodyText, /Montant location:\s*([0-9]+(?:[.,][0-9]{2})?)\s*EUR/i);
    const chargedToday = extractAmount(renterBodyText, /Total debite aujourd hui\s*\(location \+ caution\):\s*([0-9]+(?:[.,][0-9]{2})?)\s*EUR/i);
    const payButtonAmount = extractAmount(renterBodyText, /Payer sur Stripe \(test\)\s*([0-9]+(?:[.,][0-9]{2})?)\s*EUR/i);

    const renterChecks = {
      hasPaymentSection: /Paiement securise/i.test(renterBodyText),
      displayedRental,
      totalToPay,
      cautionAmount,
      locationInCautionCard,
      chargedToday,
      payButtonAmount,
      totalMatchesRental: totalToPay !== null && displayedRental !== null && totalToPay === displayedRental,
      cautionCardMatchesRental: locationInCautionCard !== null && displayedRental !== null && locationInCautionCard === displayedRental,
      chargedMatchesFormula:
        chargedToday !== null && displayedRental !== null && cautionAmount !== null
          ? chargedToday === Number((displayedRental + cautionAmount).toFixed(2))
          : false,
      buttonMatchesCharged:
        payButtonAmount !== null && chargedToday !== null
          ? payButtonAmount === chargedToday
          : false
    };
    report.renterFlow = renterChecks;
    await renterContext.close();

    // OWNER FLOW
    const ownerAnnonceId = await getOwnerAnnonceId(PROPRIETAIRE_EMAIL);
    const ownerContext = await browser.newContext();
    const ownerPage = await loginWithMagicLink(ownerContext, PROPRIETAIRE_EMAIL);

    await ownerPage.goto(`${BASE_URL}/creer-annonce?edit=${encodeURIComponent(String(ownerAnnonceId))}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await ownerPage.waitForTimeout(1800);
    await dismissCookieBanner(ownerPage);
    await neutralizeBlockingWidgets(ownerPage);

    // Try to reach step 3 (Tarification) from an existing listing.
    const nextButton = ownerPage.locator('button:has-text("Suivant")').last();
    for (let i = 0; i < 2; i += 1) {
      await ownerPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await ownerPage.waitForTimeout(300);
      if ((await nextButton.count()) > 0 && await nextButton.isVisible().catch(() => false)) {
        await nextButton.click({ timeout: 8000, force: true }).catch(() => {});
        await ownerPage.waitForTimeout(1200);
      }
    }

    await ownerPage.screenshot({ path: OWNER_SCREENSHOT, fullPage: true });
    const ownerBodyText = ((await ownerPage.textContent('body')) || '').replace(/\s+/g, ' ').trim();

    report.ownerFlow = {
      ownerAnnonceId,
      hasTarificationTitle: /Tarification/i.test(ownerBodyText),
      hasOwnerPaymentFeeInfo: /Frais de paiement location/i.test(ownerBodyText),
      hasDeductionWording: /deduits du reversement proprietaire/i.test(ownerBodyText),
      hasOwnerEarningsEstimate: /Vous recevez \(estimation\)/i.test(ownerBodyText),
      hasDetailedDeductions: /deductions appliquees au reversement proprietaire/i.test(ownerBodyText)
    };
    await ownerContext.close();

    report.success = Boolean(
      report.renterFlow?.hasPaymentSection
      && report.renterFlow?.totalMatchesRental
      && report.renterFlow?.cautionCardMatchesRental
      && report.renterFlow?.chargedMatchesFormula
      && report.renterFlow?.buttonMatchesCharged
      && report.ownerFlow?.hasOwnerPaymentFeeInfo
      && report.ownerFlow?.hasDeductionWording
      && report.ownerFlow?.hasOwnerEarningsEstimate
    );
  } finally {
    await browser.close();
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.success) {
    process.exitCode = 2;
  }
};

run().catch((error) => {
  process.stderr.write(`[simulation-error] ${error?.stack || error?.message || error}\n`);
  process.exit(1);
});
