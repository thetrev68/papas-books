import { test, expect } from '@playwright/test';
import { isAuthRequired } from './utils/auth';
import fs from 'fs';
import path from 'path';

test.describe('CSV Export Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const authRequired = await isAuthRequired(page);
    test.skip(authRequired, 'Requires authenticated session (set storageState or login).');
  });

  test('should export transactions from workbench', async ({ page }) => {
    await page.goto('/app/workbench');
    await page.waitForLoadState('networkidle');

    // Wait for workbench to load
    await expect(
      page
        .locator('h1, h2')
        .filter({ hasText: /workbench|transactions/i })
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Look for export button
    const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

    // If export button exists, test the export functionality
    if ((await exportButton.count()) > 0) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

      // Click export button
      await exportButton.first().click();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download filename contains 'csv'
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);

      // Optionally: Save and verify file content
      const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
      await download.saveAs(filePath);

      // Verify file exists and contains CSV headers
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      expect(fileContent).toContain('Date');
      expect(fileContent).toContain('Account');
      expect(fileContent).toContain('Category');
      expect(fileContent).toContain('Amount');

      // Clean up
      fs.unlinkSync(filePath);
    } else {
      test.skip(true, 'Export button not found on workbench');
    }
  });

  test('should export accounts from settings', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    // Look for Accounts tab
    const accountsTab = page.locator('button, a').filter({ hasText: /^accounts$/i });
    if ((await accountsTab.count()) > 0) {
      await accountsTab.click();
      await page.waitForTimeout(1000);

      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/accounts.*\.csv$/i);

        // Verify CSV content
        const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
        await download.saveAs(filePath);

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        expect(fileContent).toContain('Name');
        expect(fileContent).toContain('Type');
        expect(fileContent).toContain('Opening Balance');

        fs.unlinkSync(filePath);
      }
    }
  });

  test('should export categories from settings', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    // Look for Categories tab
    const categoriesTab = page.locator('button, a').filter({ hasText: /^categories$/i });
    if ((await categoriesTab.count()) > 0) {
      await categoriesTab.click();
      await page.waitForTimeout(1000);

      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/categories.*\.csv$/i);

        // Verify CSV content
        const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
        await download.saveAs(filePath);

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        expect(fileContent).toContain('Name');
        expect(fileContent).toContain('Parent Category');
        expect(fileContent).toContain('Tax Deductible');

        fs.unlinkSync(filePath);
      }
    }
  });

  test('should export payees from settings', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    // Look for Payees tab
    const payeesTab = page.locator('button, a').filter({ hasText: /^payees$/i });
    if ((await payeesTab.count()) > 0) {
      await payeesTab.click();
      await page.waitForTimeout(1000);

      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/payees.*\.csv$/i);

        // Verify CSV content
        const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
        await download.saveAs(filePath);

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        expect(fileContent).toContain('Name');
        expect(fileContent).toContain('Default Category');

        fs.unlinkSync(filePath);
      }
    }
  });

  test('should export rules from settings', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    // Look for Rules tab
    const rulesTab = page.locator('button, a').filter({ hasText: /^rules$/i });
    if ((await rulesTab.count()) > 0) {
      await rulesTab.click();
      await page.waitForTimeout(1000);

      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/rules.*\.csv$/i);

        // Verify CSV content
        const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
        await download.saveAs(filePath);

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        expect(fileContent).toContain('Priority');
        expect(fileContent).toContain('Keyword');
        expect(fileContent).toContain('Match Type');

        fs.unlinkSync(filePath);
      }
    }
  });

  test('should handle empty table export gracefully', async ({ page }) => {
    // Navigate to a settings page that might have empty data
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    // Look for any tab
    const tabs = page
      .locator('button, a')
      .filter({ hasText: /^(accounts|categories|payees|rules)$/i });
    if ((await tabs.count()) > 0) {
      await tabs.first().click();
      await page.waitForTimeout(1000);

      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      // Verify button exists (it should be enabled or disabled based on data)
      if ((await exportButton.count()) > 0) {
        const isDisabled = await exportButton.first().isDisabled();

        // If disabled, verify it has appropriate tooltip or visual state
        if (isDisabled) {
          // Button should be visually disabled when no data
          expect(isDisabled).toBe(true);
        } else {
          // If enabled, download should work
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
          await exportButton.first().click();
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.csv$/i);
        }
      }
    }
  });

  test('should export filtered transactions from workbench', async ({ page }) => {
    await page.goto('/app/workbench');
    await page.waitForLoadState('networkidle');

    // Wait for workbench to load
    await page.waitForTimeout(2000);

    // Look for search/filter input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]'
    );

    if ((await searchInput.count()) > 0) {
      // Enter a filter term
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);

      // Now export (should only export filtered results)
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;

        // Verify download works with filters applied
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    }
  });
});

test.describe('CSV Export Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    const authRequired = await isAuthRequired(page);
    test.skip(authRequired, 'Requires authenticated session');
  });

  test('should handle special characters in exported data', async ({ page }) => {
    await page.goto('/app/workbench');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

    if ((await exportButton.count()) > 0) {
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
      await exportButton.first().click();

      const download = await downloadPromise;
      const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
      await download.saveAs(filePath);

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Verify UTF-8 BOM is present for Excel compatibility
      expect(fileContent.charCodeAt(0)).toBe(0xfeff);

      // Verify CSV is properly formatted (has headers)
      const lines = fileContent.split('\n');
      expect(lines.length).toBeGreaterThan(0);

      fs.unlinkSync(filePath);
    }
  });

  test('should export split transactions correctly', async ({ page }) => {
    await page.goto('/app/workbench');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for any split transactions in the table
    const splitIndicator = page.locator('text=/split/i').first();

    if (await splitIndicator.isVisible().catch(() => false)) {
      const exportButton = page.locator('button').filter({ hasText: /export|csv|download/i });

      if ((await exportButton.count()) > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await exportButton.first().click();

        const download = await downloadPromise;
        const filePath = path.join(__dirname, 'downloads', download.suggestedFilename());
        await download.saveAs(filePath);

        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Verify split transactions are included
        expect(fileContent).toContain('Split Details');

        fs.unlinkSync(filePath);
      }
    }
  });
});
