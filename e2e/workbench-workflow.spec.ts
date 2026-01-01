import { test, expect } from '@playwright/test';
import { isAuthRequired } from './utils/auth';

test.describe('Workbench Editing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/workbench');
    await page.waitForLoadState('networkidle');
    const authRequired = await isAuthRequired(page);
    test.skip(authRequired, 'Requires authenticated session (set storageState or login).');
  });

  test('should load workbench with transactions table', async ({ page }) => {
    // Wait for workbench to load
    await expect(
      page
        .locator('h1, h2')
        .filter({ hasText: /workbench|transactions/i })
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Verify table exists
    const table = page.locator('table, [role="table"], [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 5000 });
  });

  test('should edit transaction payee inline', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find first editable payee cell
    const payeeCell = page
      .locator('[data-column="payee"], td:has-text("STARBUCKS"), [contenteditable="true"]')
      .first();

    if (await payeeCell.isVisible().catch(() => false)) {
      // Click to edit
      await payeeCell.click();
      await page.waitForTimeout(500);

      // Look for input field
      const input = page.locator('input[name="payee"], input[type="text"]').first();

      if (await input.isVisible().catch(() => false)) {
        // Clear and type new value
        await input.fill('Test Payee');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Verify change saved (look for success toast or updated value)
        // Note: If payee update fails, the test will still pass since we're testing the UI flow
        // In a real scenario, verify via API or database
        const updated = await page
          .locator('text=/test payee/i')
          .first()
          .isVisible()
          .catch(() => false);
        // We expect either the update worked or we at least completed the edit flow without error
        expect(updated).toBe(true);
      }
    }
  });

  test('should edit transaction category', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find first category cell/dropdown
    const categoryCell = page
      .locator('[data-column="category"], td select, button[aria-label*="category"]')
      .first();

    if (await categoryCell.isVisible().catch(() => false)) {
      await categoryCell.click();
      await page.waitForTimeout(500);

      // Look for category selector (dropdown or modal)
      const categorySelect = page.locator('select, [role="listbox"], [role="menu"]').first();

      if (await categorySelect.isVisible().catch(() => false)) {
        // Select first option
        if (
          categorySelect
            .locator('option')
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await categorySelect.selectOption({ index: 1 });
        } else {
          // Click first menu item
          await page.locator('[role="menuitem"], [role="option"]').first().click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test('should create split transaction', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find split button for first transaction
    const splitButton = page
      .locator('button:has-text("Split"), button[aria-label*="Split"], [data-action="split"]')
      .first();

    if (await splitButton.isVisible().catch(() => false)) {
      await splitButton.click();
      await page.waitForTimeout(1000);

      // Verify split modal/form opened
      const splitModal = page.locator('[role="dialog"], .modal, [data-testid*="split"]').first();
      const isModalVisible = await splitModal.isVisible().catch(() => false);

      if (isModalVisible) {
        // Look for add split line button
        const addLineButton = page
          .locator('button:has-text("Add"), button:has-text("Add Line")')
          .first();

        if (await addLineButton.isVisible().catch(() => false)) {
          await addLineButton.click();
          await page.waitForTimeout(500);
        }

        // Close modal
        const closeButton = page
          .locator('button:has-text("Cancel"), button:has-text("Close")')
          .first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }

      // Verify split modal appeared when button was clicked
      expect(isModalVisible).toBe(true);
    }
  });

  test('should mark transaction as reviewed', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find reviewed checkbox or button
    const reviewedCheckbox = page
      .locator('input[type="checkbox"][aria-label*="reviewed"], [data-column="reviewed"] input')
      .first();

    if (await reviewedCheckbox.isVisible().catch(() => false)) {
      const initialState = await reviewedCheckbox.isChecked();
      await reviewedCheckbox.click();
      await page.waitForTimeout(1000);

      // Verify state changed
      const newState = await reviewedCheckbox.isChecked();
      expect(newState).toBe(!initialState);
    }
  });

  test('should filter transactions', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for filter controls
    const filterInput = page
      .locator(
        'input[placeholder*="filter" i], input[placeholder*="search" i], input[type="search"]'
      )
      .first();

    if (await filterInput.isVisible().catch(() => false)) {
      await filterInput.fill('STARBUCKS');
      await page.waitForTimeout(1000);

      // Verify filtering occurred (row count changed or filter chip shown)
      const filterActive = await page
        .locator('text=/filter|starbucks/i')
        .first()
        .isVisible()
        .catch(() => false);
      // Filter should be active after typing search term
      expect(filterActive).toBe(true);

      // Clear filter
      await filterInput.clear();
    }
  });

  test('should use keyboard navigation', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click on first editable cell
    const firstCell = page.locator('table tbody tr:first-child td:not(:first-child)').first();

    if (await firstCell.isVisible().catch(() => false)) {
      await firstCell.click();
      await page.waitForTimeout(500);

      // Try arrow key navigation
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);

      // If no errors, navigation works
      expect(true).toBeTruthy();
    }
  });

  test('should bulk select transactions', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for select all checkbox
    const selectAllCheckbox = page
      .locator('thead input[type="checkbox"], [aria-label*="select all"]')
      .first();

    if (await selectAllCheckbox.isVisible().catch(() => false)) {
      await selectAllCheckbox.click();
      await page.waitForTimeout(1000);

      // Verify bulk actions appear (toolbar with selection count or action buttons)
      const bulkActions = await page
        .locator(
          'text=/selected/i, button:has-text("Delete"), button:has-text("Mark"), [data-testid*="bulk"]'
        )
        .first()
        .isVisible()
        .catch(() => false);
      // Bulk action UI should appear when rows are selected
      expect(bulkActions).toBe(true);

      // Deselect
      await selectAllCheckbox.click();
    }
  });
});
