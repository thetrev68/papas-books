import type { Page } from '@playwright/test';

export async function isAuthRequired(page: Page): Promise<boolean> {
  const loginSelectors = [
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'a:has-text("Sign In")',
    'a:has-text("Log In")',
    'input[type="email"]',
    'input[name="email"]',
  ];

  const loginVisible = await page
    .locator(loginSelectors.join(', '))
    .first()
    .isVisible()
    .catch(() => false);

  if (loginVisible) {
    return true;
  }

  const currentUrl = page.url();
  return /\/(login|auth)/i.test(currentUrl);
}

/**
 * Waits for the app to finish its initial loading state.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for "Loading..." to disappear
  await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 45000 });

  // Give it a tiny bit more time for any final redirects/renders
  await page.waitForTimeout(500);
}
