const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = 'https://www.lematosduvoisin.fr';
const USER_A_EMAIL = 'rabii@loeni.com';
const USER_B_EMAIL = 'rabii@tellr.fr';
const TARGET_TITLE = 'DJEMB';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateLink(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${BASE_URL}/accueil-recherche` }
  });
  if (error) throw error;
  return data?.properties?.action_link;
}

async function login(context, email) {
  const page = await context.newPage();
  const link = await generateLink(email);
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await wait(2000);
  await page.goto(`${BASE_URL}/accueil-recherche`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1000);
  return page;
}

async function openPopup(page) {
  await page.goto(`${BASE_URL}/mes-reservations`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1800);
  const cardButton = page
    .locator('section, article, div')
    .filter({ hasText: new RegExp(TARGET_TITLE, 'i') })
    .filter({ has: page.getByRole('button', { name: /contacter/i }) })
    .first()
    .getByRole('button', { name: /contacter/i })
    .first();
  if (await cardButton.isVisible().catch(() => false)) {
    await cardButton.click({ timeout: 15000 });
  } else {
    await page.getByRole('button', { name: /contacter/i }).first().click({ timeout: 15000 });
  }
  await page.locator('h2').filter({ hasText: /discussion avec/i }).first().waitFor({ state: 'visible', timeout: 20000 });
}

async function sendInPopup(page, text) {
  const modal = page.locator('div.fixed.inset-0').filter({ has: page.locator('h2').filter({ hasText: /discussion avec/i }) }).first();
  const input = modal.getByPlaceholder(/ecrivez votre message/i).first();
  const send = modal.locator('form button[type="submit"]').first();
  await input.fill(text, { timeout: 10000 });
  await send.click({ timeout: 10000 });
  await modal.locator(`text=${text}`).first().waitFor({ state: 'visible', timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctxA = await browser.newContext({ viewport: { width: 1536, height: 960 } });
    const ctxB = await browser.newContext({ viewport: { width: 1536, height: 960 } });

    const pageA = await login(ctxA, USER_A_EMAIL);
    const pageB = await login(ctxB, USER_B_EMAIL);

    const stamp = Date.now();
    const msgAtoB = `[CHAT-POSTFIX ${stamp}] A->B`;
    const msgBtoA = `[CHAT-POSTFIX ${stamp}] B->A`;

    await openPopup(pageA);
    await sendInPopup(pageA, msgAtoB);

    await openPopup(pageB);

    const modalB = pageB.locator('div.fixed.inset-0').filter({ has: pageB.locator('h2').filter({ hasText: /discussion avec/i }) }).first();
    await modalB.locator(`text=${msgAtoB}`).first().waitFor({ state: 'visible', timeout: 25000 });

    await sendInPopup(pageB, msgBtoA);

    await openPopup(pageA);
    const modalA = pageA.locator('div.fixed.inset-0').filter({ has: pageA.locator('h2').filter({ hasText: /discussion avec/i }) }).first();
    await modalA.locator(`text=${msgBtoA}`).first().waitFor({ state: 'visible', timeout: 25000 });

    await pageA.screenshot({ path: '.tmp-user-e2e/postfix-userA.png', fullPage: true });
    await pageB.screenshot({ path: '.tmp-user-e2e/postfix-userB.png', fullPage: true });

    console.log('[postfix-check] OK', { msgAtoB, msgBtoA });
  } finally {
    await browser.close();
  }
})();
