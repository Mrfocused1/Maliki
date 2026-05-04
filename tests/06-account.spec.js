// @ts-check
const { test, expect } = require('@playwright/test');
const { TEST_EMAIL } = require('./helpers');

test.describe('Account Page', () => {
  test('account page loads without error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    const critical = errors.filter((e) => !e.includes('net::ERR') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });

  test('login panel is visible when not authenticated', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#loginPanel, #loginForm, [id*="login"]').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#lEmail')).toBeVisible();
    await expect(page.locator('#lPass')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    await page.locator('#lEmail').fill(TEST_EMAIL);
    await page.locator('#lPass').fill('wrong-password-e2e');

    await page.locator('#loginBtn').click();

    // Wait for non-empty feedback text
    await page.waitForFunction(
      () => {
        const el = document.getElementById('loginFb');
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      { timeout: 10000 }
    );
    const fb = await page.locator('#loginFb').textContent();
    expect(fb?.trim().length).toBeGreaterThan(0);
  });

  test('register panel switches on tab click', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    // Look for a register/create account toggle
    const registerTab = page.locator('button:has-text("Register"), button:has-text("Create"), a:has-text("Register")').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await expect(page.locator('#registerPanel, [id*="register"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('forgot password button is present', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#forgotBtn')).toBeVisible();
  });

  test('register form validates email format', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');

    const registerTab = page.locator('button:has-text("Register"), button:has-text("Create")').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await page.locator('#rEmail').fill('notanemail');
      const valid = await page.locator('#rEmail').evaluate((el) => (el).validity.valid);
      expect(valid).toBe(false);
    }
  });
});
