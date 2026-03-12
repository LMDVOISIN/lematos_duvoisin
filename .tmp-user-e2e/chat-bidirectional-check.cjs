const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = (process.env.SIM_BASE_URL || 'https://www.lematosduvoisin.fr').replace(/\/$/, '');
const USER_A_EMAIL = process.env.SIM_OWNER_EMAIL || 'rabii@loeni.com';
const USER_B_EMAIL = process.env.SIM_RENTER_EMAIL || 'rabii@tellr.fr';
const TARGET_TITLE = process.env.SIM_CHAT_TARGET_TITLE || 'DJEMB';
const OUTPUT_DIR = path.resolve(process.cwd(), '.tmp-user-e2e');
const REPORT_FILE = path.join(OUTPUT_DIR, 'chat-bidirectional-report.json');

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const loginWithMagicLink = async (context, email) => {
  const page = await context.newPage();
  const actionLink = await generateMagicLink(email);

  await page.goto(actionLink, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.goto(`${BASE_URL}/accueil-recherche`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await dismissCookieBanner(page);
  await neutralizeBlockingWidgets(page);

  const loginButton = page.locator('button:has-text("Se connecter"), a:has-text("Se connecter")').first();
  const stillLoggedOut = await loginButton.isVisible().catch(() => false);
  if (stillLoggedOut) {
    throw new Error(`Login failed for ${email} (button "Se connecter" still visible)`);
  }

  return page;
};

const openChatPopupFromReservations = async (page, tag) => {
  const reservationUrl = `${BASE_URL}/mes-reservations`;
  await page.goto(reservationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await dismissCookieBanner(page);
  await neutralizeBlockingWidgets(page);

  const targetRegex = new RegExp(TARGET_TITLE, 'i');
  const cardWithTargetButton = page
    .locator('section, article, div')
    .filter({ hasText: targetRegex })
    .filter({ has: page.getByRole('button', { name: /contacter/i }) })
    .first();

  let clicked = false;
  if ((await cardWithTargetButton.count()) > 0) {
    const buttonInCard = cardWithTargetButton.getByRole('button', { name: /contacter/i }).first();
    if (await buttonInCard.isVisible().catch(() => false)) {
      await buttonInCard.click({ timeout: 15000 });
      clicked = true;
    }
  }

  if (!clicked) {
    const fallbackButton = page.getByRole('button', { name: /contacter/i }).first();
    if (!(await fallbackButton.isVisible().catch(() => false))) {
      throw new Error(`[${tag}] aucun bouton "Contacter" visible`);
    }
    await fallbackButton.click({ timeout: 15000 });
  }

  const modalTitle = page.locator('h2').filter({ hasText: /discussion avec/i }).first();
  await modalTitle.waitFor({ state: 'visible', timeout: 20000 });
  return modalTitle.textContent();
};

const sendMessageInPopup = async (page, messageText, tag) => {
  const modal = page
    .locator('div.fixed.inset-0')
    .filter({ has: page.locator('h2').filter({ hasText: /discussion avec/i }) })
    .first();
  const input = modal.getByPlaceholder(/ecrivez votre message/i).first();
  const sendButton = modal.locator('form button[type="submit"]').first();

  if (!(await input.isVisible().catch(() => false))) {
    throw new Error(`[${tag}] champ de saisie introuvable`);
  }

  await input.fill(messageText, { timeout: 10000 });
  await sendButton.click({ timeout: 10000 });

  const ownBubble = page.locator(`text=${messageText}`).first();
  await ownBubble.waitFor({ state: 'visible', timeout: 15000 });
};

const waitForMessageInPopup = async (page, messageText, tag) => {
  const modal = page
    .locator('div.fixed.inset-0')
    .filter({ has: page.locator('h2').filter({ hasText: /discussion avec/i }) })
    .first();
  const bubble = modal.locator(`text=${messageText}`).first();
  await bubble.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {
    throw new Error(`[${tag}] message non recu: "${messageText}"`);
  });
};

const closePopupIfOpen = async (page) => {
  const closeButton = page.locator('button[aria-label*="Fermer"]').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ timeout: 5000 }).catch(() => {});
    await wait(400);
  }
};

const runAttempt = async (pageA, pageB, attemptNo) => {
  await closePopupIfOpen(pageA);
  await closePopupIfOpen(pageB);

  const titleA = await openChatPopupFromReservations(pageA, `A#${attemptNo}`);
  const titleB = await openChatPopupFromReservations(pageB, `B#${attemptNo}`);

  const stamp = `${Date.now()}-${attemptNo}`;
  const msgAtoB = `[CHAT-E2E ${stamp}] A->B`;
  const msgBtoA = `[CHAT-E2E ${stamp}] B->A`;

  await sendMessageInPopup(pageA, msgAtoB, `A#${attemptNo}`);
  await waitForMessageInPopup(pageB, msgAtoB, `B#${attemptNo}`);

  await sendMessageInPopup(pageB, msgBtoA, `B#${attemptNo}`);
  await waitForMessageInPopup(pageA, msgBtoA, `A#${attemptNo}`);

  return {
    attempt: attemptNo,
    titleA: String(titleA || '').trim(),
    titleB: String(titleB || '').trim(),
    msgAtoB,
    msgBtoA
  };
};

const run = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    userA: USER_A_EMAIL,
    userB: USER_B_EMAIL,
    targetTitle: TARGET_TITLE,
    success: false,
    attempts: [],
    debug: {
      userA: {
        rpcCalls: 0,
        rpcPayloads: [],
        rpcResponses: [],
        messageConversationIds: [],
        messageInsertConversationIds: [],
        messageUrls: [],
        conversationUrls: [],
        consoleErrors: [],
        pageErrors: [],
        conversationResponses: []
      },
      userB: {
        rpcCalls: 0,
        rpcPayloads: [],
        rpcResponses: [],
        messageConversationIds: [],
        messageInsertConversationIds: [],
        messageUrls: [],
        conversationUrls: [],
        consoleErrors: [],
        pageErrors: [],
        conversationResponses: []
      }
    }
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const contextA = await browser.newContext({ viewport: { width: 1536, height: 960 } });
    const contextB = await browser.newContext({ viewport: { width: 1536, height: 960 } });
    const pageA = await loginWithMagicLink(contextA, USER_A_EMAIL);
    const pageB = await loginWithMagicLink(contextB, USER_B_EMAIL);

    const wireDebugCapture = (page, target) => {
      page.on('console', (msg) => {
        if ((msg.type() !== 'error' && msg.type() !== 'warning') || target.consoleErrors.length >= 80) return;
        target.consoleErrors.push({
          type: msg.type(),
          text: msg.text()
        });
      });

      page.on('pageerror', (error) => {
        if (target.pageErrors.length >= 80) return;
        target.pageErrors.push(String(error?.message || error));
      });

      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/rest/v1/rpc/chat_get_or_create_conversation')) {
          target.rpcCalls += 1;
          if (target.rpcPayloads.length < 20) {
            try {
              target.rpcPayloads.push(JSON.parse(request.postData() || '{}'));
            } catch (_error) {
              target.rpcPayloads.push({ raw: request.postData() || null });
            }
          }
        }
        if (url.includes('/rest/v1/conversations')) {
          if (target.conversationUrls.length < 30) {
            target.conversationUrls.push(url);
          }
        }
        if (url.includes('/rest/v1/messages')) {
          if (target.messageUrls.length < 30) {
            target.messageUrls.push(url);
          }
          const match = url.match(/conversation_id=eq\.([0-9]+)/i);
          if (match?.[1]) {
            target.messageConversationIds.push(Number(match[1]));
          }
          if (request.method() === 'POST') {
            try {
              const payload = JSON.parse(request.postData() || '{}');
              if (payload?.conversation_id) {
                target.messageInsertConversationIds.push(Number(payload.conversation_id));
              }
            } catch (_error) {}
          }
        }
      });

      page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/rest/v1/rpc/chat_get_or_create_conversation')) return;
        if (target.rpcResponses.length >= 20) return;
        let body = null;
        try {
          body = await response.json();
        } catch (_error) {
          body = null;
        }
        target.rpcResponses.push({
          status: response.status(),
          body
        });
      });

      page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/rest/v1/conversations?') || target.conversationResponses.length >= 40) return;

        let body = null;
        try {
          body = await response.json();
        } catch (_error) {
          body = null;
        }
        target.conversationResponses.push({
          status: response.status(),
          url,
          body
        });
      });
    };

    wireDebugCapture(pageA, report.debug.userA);
    wireDebugCapture(pageB, report.debug.userB);

    let successResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await runAttempt(pageA, pageB, attempt);
        report.attempts.push({ ...result, ok: true });
        successResult = result;
        break;
      } catch (error) {
        report.attempts.push({
          attempt,
          ok: false,
          error: String(error?.message || error)
        });
        lastError = error;
      }
    }

    await pageA.screenshot({ path: path.join(OUTPUT_DIR, 'chat-e2e-userA-final.png'), fullPage: true });
    await pageB.screenshot({ path: path.join(OUTPUT_DIR, 'chat-e2e-userB-final.png'), fullPage: true });

    report.success = Boolean(successResult);
    if (!successResult && lastError) {
      throw lastError;
    }
  } finally {
    await browser.close();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  }
};

run()
  .then(() => {
    process.stdout.write(`[chat-e2e] OK - report: ${REPORT_FILE}\n`);
  })
  .catch((error) => {
    process.stderr.write(`[chat-e2e] FAIL - ${error?.stack || error?.message || error}\n`);
    process.exit(1);
  });
