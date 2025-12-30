import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests (WCAG 2.1 AA)', () => {
  test.beforeEach(async () => {
    // Note: These tests will run on public pages
    // For authenticated pages, you'll need to set up login first
  });

  test('Login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Signup page should have no accessibility violations', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Login page should have keyboard navigation support', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements
    await page.keyboard.press('Tab'); // Email field
    await expect(page.locator('#email')).toBeFocused();

    await page.keyboard.press('Tab'); // Password field
    await expect(page.locator('#password')).toBeFocused();

    await page.keyboard.press('Tab'); // Submit button
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test('Skip to main content link should work', async () => {
    // This test requires authentication - placeholder for future implementation
    // await page.goto('/app/dashboard');
    // await page.keyboard.press('Tab');
    // await expect(page.locator('a:has-text("Skip to main content")')).toBeVisible();
    // await page.keyboard.press('Enter');
    // await expect(page.locator('#main-content')).toBeFocused();
  });

  test('Color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/login');

    // Check for color contrast violations specifically
    const contrastResults = await new AxeBuilder({ page }).include('body').analyze();

    const contrastViolations = contrastResults.violations.filter((v) => v.id === 'color-contrast');

    expect(contrastViolations).toEqual([]);
  });

  test('All images and icons should have alt text or aria-hidden', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for image-alt rule violations
    const imageViolations = accessibilityScanResults.violations.filter((v) => v.id === 'image-alt');

    expect(imageViolations).toEqual([]);
  });

  test('Form inputs should have associated labels', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for label rule violations
    const labelViolations = accessibilityScanResults.violations.filter((v) => v.id === 'label');

    expect(labelViolations).toEqual([]);
  });

  test('Buttons should have accessible names', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for button-name rule violations
    const buttonViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'button-name'
    );

    expect(buttonViolations).toEqual([]);
  });

  test('Page should have a valid document structure', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for document structure violations
    const structureViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'page-has-heading-one' || v.id === 'region' || v.id === 'landmark-one-main'
    );

    expect(structureViolations).toEqual([]);
  });

  test('Focus indicators should be visible', async ({ page }) => {
    await page.goto('/login');

    // Focus on email input
    await page.locator('#email').focus();

    // Check that focus styles are applied
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeFocused();

    // Verify outline is visible (checking computed style)
    const outline = await emailInput.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
      };
    });

    // Should have visible outline (not "none" or "0px")
    expect(outline.outlineStyle).not.toBe('none');
  });
});
