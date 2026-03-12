const { test } = require('@playwright/test');

test('debug home load', async ({ page }) => {
  const failed = [];
  const consoleMsgs = [];
  const pageErrors = [];

  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText || 'failed'}`));
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const body = document.body;
    return {
      href: location.href,
      title: document.title,
      bodyText: (body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 250),
      bodyTextLen: (body?.innerText || '').replace(/\s+/g, ' ').trim().length,
      rootText: (root?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 250),
      rootTextLen: (root?.innerText || '').replace(/\s+/g, ' ').trim().length,
      scripts: Array.from(document.scripts).map((s) => s.src || '[inline]'),
    };
  });

  console.log('DEBUG_INFO', JSON.stringify(info, null, 2));
  console.log('DEBUG_PAGE_ERRORS', pageErrors.slice(0, 20));
  console.log('DEBUG_CONSOLE', consoleMsgs.slice(0, 30));
  console.log('DEBUG_FAILED_REQ', failed.slice(0, 30));
});

