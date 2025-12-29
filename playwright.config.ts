import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const storageState =
  process.env.PLAYWRIGHT_EMAIL && process.env.PLAYWRIGHT_PASSWORD
    ? 'e2e/.auth/state.json'
    : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  reporter: 'html',
  globalSetup:
    process.env.PLAYWRIGHT_EMAIL && process.env.PLAYWRIGHT_PASSWORD
      ? './e2e/auth.setup.ts'
      : undefined,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
