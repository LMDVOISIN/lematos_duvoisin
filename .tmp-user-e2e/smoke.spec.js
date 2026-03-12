const { test, expect } = require('playwright/test');

test('smoke root page', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/127\.0\.0\.1:4173/);
});
