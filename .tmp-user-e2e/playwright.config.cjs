/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: __dirname,
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1366, height: 768 },
    actionTimeout: 10000,
    navigationTimeout: 20000,
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'npm run serve -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120000,
  },
};

