import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points at a Vercel preview in CI; locally we build and start the app.
const externalUrl = process.env.E2E_BASE_URL;
const localUrl = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: externalUrl ?? localUrl,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: externalUrl
    ? undefined
    : {
        command: 'pnpm build && pnpm start -p 3000',
        url: `${localUrl}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
