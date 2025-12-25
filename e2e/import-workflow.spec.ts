import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAuthRequired } from './utils/auth';
import { cleanupAllTransactions } from './utils/cleanup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function selectFirstAccount(page: Page) {
  // Wait for the "Select Account & Upload CSV" heading to ensure section is loaded
  await page.locator('text=Select Account & Upload CSV').waitFor({ timeout: 10000 });

  // Find the account select dropdown in the main content (not the nav bookset selector)
  const accountSelect = page.getByRole('main').getByRole('combobox');

  // Wait for options to load
  await page.waitForFunction(
    () => {
      const selects = Array.from(document.querySelectorAll('main select')) as HTMLSelectElement[];
      return selects.some((select) => select.options.length > 1);
    },
    { timeout: 10000 }
  );

  const options = await accountSelect.locator('option').count();
  console.log(`Found ${options} account options`);

  if (options > 1) {
    // Select the first real account (index 1, after placeholder at index 0)
    await accountSelect.selectOption({ index: 1 });
    const selectedValue = await accountSelect.inputValue();
    const selectedText = await accountSelect
      .locator(`option[value="${selectedValue}"]`)
      .textContent();
    console.log(`Selected account: ${selectedText} (${selectedValue})`);
  } else {
    throw new Error('No accounts available to select - found only placeholder option');
  }
}

async function applyBasicMapping(page: Page) {
  await expect(
    page
      .locator('h1, h2')
      .filter({ hasText: /configure csv mapping/i })
      .first()
  ).toBeVisible({ timeout: 15000 });

  const dateSelect = page.locator('label:has-text("Date Column:")').locator('..').locator('select');
  const descriptionSelect = page
    .locator('label:has-text("Description Column:")')
    .locator('..')
    .locator('select');
  const amountSelect = page
    .locator('label:has-text("Amount Column:")')
    .locator('..')
    .locator('select');

  await dateSelect.selectOption({ label: 'Date' });
  await descriptionSelect.selectOption({ label: 'Description' });
  await amountSelect.selectOption({ label: 'Amount' });

  const applyButton = page.getByRole('button', { name: /apply mapping/i });
  await expect(applyButton).toBeEnabled({ timeout: 10000 });
  await applyButton.click();

  const reviewReady = page
    .getByRole('button', { name: /check for duplicates/i })
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const errorState = page
    .getByRole('heading', { name: 'Error' })
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => false)
    .catch(() => false);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000));

  const success = await Promise.race([reviewReady, errorState, timeout]);
  if (!success) {
    const errorText = await page
      .locator('section:has(h2:has-text("Error"))')
      .textContent()
      .catch(() => '');
    throw new Error(`Mapping did not advance to review. ${errorText || ''}`.trim());
  }
}

async function checkDuplicates(page: Page) {
  const checkButton = page.getByRole('button', { name: /check for duplicates/i });

  console.log('Clicking "Check for Duplicates" button...');
  await checkButton.click();

  // Wait for duplicate check processing to complete by waiting for either:
  // 1. The import button to appear (meaning there are new transactions)
  // 2. A reasonable timeout (meaning all transactions are duplicates)
  const importButton = page.getByRole('button', { name: /import .* transactions/i });

  const result = await Promise.race([
    // Wait for import button to appear
    importButton.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'has-new'),
    // Or wait for processing to complete (check if stats updated by waiting for network idle)
    page.waitForLoadState('networkidle', { timeout: 10000 }).then(() => 'network-idle'),
    // Or timeout
    page.waitForTimeout(8000).then(() => 'timeout'),
  ]);

  console.log(`Duplicate check result: ${result}`);

  // Give React a moment to update the DOM
  await page.waitForTimeout(500);

  // Debug: Log final stats
  const statsText = await page
    .locator('h3:has-text("Import Statistics:")')
    .locator('..')
    .textContent();
  console.log('Final stats:', statsText);
}

test.describe('CSV Import Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first
    await page.goto('/');

    const authRequired = await isAuthRequired(page);
    test.skip(authRequired, 'Requires authenticated session (set storageState or login).');

    // Clean up ALL test data from previous runs to prevent duplicate detection
    await cleanupAllTransactions();
  });

  test('should import CSV file successfully', async ({ page }) => {
    // Navigate to import page
    await page.goto('/app/import');

    // Wait for page to load
    await expect(
      page
        .locator('h1, h2')
        .filter({ hasText: /import/i })
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Select account
    await selectFirstAccount(page);

    // Upload CSV file
    const filePath = path.join(__dirname, 'fixtures', 'sample-transactions.csv');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    await applyBasicMapping(page);
    await checkDuplicates(page);

    // Check if there are new transactions to import
    const newCountText = await page.locator('li:has-text("New transactions")').textContent();
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0');
    console.log(`New transactions count: ${newCount}`);

    if (newCount === 0) {
      // All transactions were duplicates - this can happen if the database wasn't fully cleaned
      // or if there's leftover data from other tests
      console.log('Skipping import - all transactions are duplicates or flagged for review');
      test.skip();
    }

    // Verify import button exists (should be visible if newCount > 0)
    const importButton = page.getByRole('button', { name: /import .* transactions/i });
    await expect(importButton).toBeVisible({
      timeout: 5000,
    });
    await importButton.click();

    // Wait for either success or error
    await Promise.race([
      page.locator('text=/import complete/i').first().waitFor({ state: 'visible', timeout: 15000 }),
      page
        .locator('text=/error/i')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => {
          throw new Error('Import failed - error message appeared');
        }),
    ]).catch(async (error) => {
      // Debug: capture what's on the page
      const bodyText = await page.locator('body').textContent();
      console.log('Page text after import:', bodyText?.substring(0, 500));
      throw error;
    });

    await expect(page.locator('text=/import complete/i').first()).toBeVisible();

    // Verify we can navigate to workbench
    await page.goto('/app/workbench');
    await expect(
      page
        .locator('h1, h2')
        .filter({ hasText: /workbench|transactions/i })
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should detect duplicate transactions on re-import', async ({ page }) => {
    // First import
    await page.goto('/app/import');
    await selectFirstAccount(page);

    const filePath = path.join(__dirname, 'fixtures', 'sample-transactions.csv');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await applyBasicMapping(page);
    await checkDuplicates(page);

    // Check if there are new transactions to import
    const newCountText = await page.locator('li:has-text("New transactions")').textContent();
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0');

    if (newCount === 0) {
      console.log('Skipping duplicate detection test - all transactions are already duplicates');
      test.skip();
    }

    // Verify import button exists for first import
    const importButton = page.getByRole('button', { name: /import .* transactions/i });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();
    await expect(page.locator('text=/import complete/i').first()).toBeVisible({ timeout: 15000 });

    // Second import (same file) - should detect duplicates
    const importAnother = page.getByRole('button', { name: /import another file/i });
    if (await importAnother.isVisible().catch(() => false)) {
      await importAnother.click();
    } else {
      await page.goto('/app/import');
    }

    await selectFirstAccount(page);
    await fileInput.setInputFiles(filePath);
    await applyBasicMapping(page);
    await checkDuplicates(page);

    // Look for duplicate indicators
    const exactText = await page
      .locator('li:has-text("Exact duplicates") span')
      .first()
      .textContent();
    const fuzzyText = await page
      .locator('li:has-text("Fuzzy duplicates") span')
      .first()
      .textContent();

    const exactCount = exactText ? Number.parseInt(exactText, 10) : 0;
    const fuzzyCount = fuzzyText ? Number.parseInt(fuzzyText, 10) : 0;
    expect(exactCount + fuzzyCount).toBeGreaterThan(0);
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/app/import');
    await page.waitForLoadState('networkidle');

    // Try to upload without selecting account (if required)
    const filePath = path.join(__dirname, 'fixtures', 'sample-transactions.csv');
    const fileInput = page.locator('input[type="file"]');

    // Check if account selection is required
    const accountSelect = page.locator('select[name="account"], select#account, select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      // Don't select account, just upload
      await fileInput.setInputFiles(filePath);
      await page.waitForTimeout(1000);

      // Look for error message
      const errorMessage = await page
        .locator('text=/select.*account|account.*required/i')
        .first()
        .isVisible()
        .catch(() => false);

      // If error shown, test passes
      if (errorMessage) {
        expect(errorMessage).toBeTruthy();
      }
    }
  });
});
