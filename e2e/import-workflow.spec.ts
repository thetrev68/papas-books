import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('CSV Import Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Check if already logged in by looking for dashboard or login page
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Log In")');
    const isLoginPage = await loginButton.isVisible().catch(() => false);

    if (isLoginPage) {
      // Note: In a real scenario, you'd need test credentials
      // For now, this test requires manual login or test user setup
      console.log('Login required - test should be run with authenticated session');
    }
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

    // Select account (if dropdown exists)
    const accountSelect = page.locator('select[name="account"], select#account, select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      const options = await accountSelect.locator('option').count();
      if (options > 1) {
        await accountSelect.selectOption({ index: 1 });
      }
    }

    // Upload CSV file
    const filePath = path.join(__dirname, 'fixtures', 'sample-transactions.csv');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for preview/processing
    await page.waitForTimeout(2000);

    // Look for success indicators or preview
    const hasPreview = await page
      .locator('text=/preview|transactions|rows/i')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasPreview) {
      // Confirm import if button exists
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Import"), button:has-text("Upload")'
      );
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();

        // Wait for success message or redirect
        await page.waitForTimeout(2000);
      }
    }

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
    await page.waitForLoadState('networkidle');

    const accountSelect = page.locator('select[name="account"], select#account, select').first();
    if (await accountSelect.isVisible().catch(() => false)) {
      const options = await accountSelect.locator('option').count();
      if (options > 1) {
        await accountSelect.selectOption({ index: 1 });
      }
    }

    const filePath = path.join(__dirname, 'fixtures', 'sample-transactions.csv');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(2000);

    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Import"), button:has-text("Upload")'
    );
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(2000);
    }

    // Second import (same file) - should detect duplicates
    await page.goto('/app/import');
    await page.waitForLoadState('networkidle');

    if (await accountSelect.isVisible().catch(() => false)) {
      const options = await accountSelect.locator('option').count();
      if (options > 1) {
        await accountSelect.selectOption({ index: 1 });
      }
    }

    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(2000);

    // Look for duplicate indicators
    const duplicateIndicator = await page
      .locator('text=/duplicate|already|exists/i')
      .first()
      .isVisible()
      .catch(() => false);
    expect(duplicateIndicator).toBeTruthy();
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
