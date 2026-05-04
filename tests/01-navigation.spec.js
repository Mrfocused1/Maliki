// @ts-check
const { test, expect } = require('@playwright/test');
const { dismissCookieBanner } = require('./helpers');

test.describe('Navigation', () => {
  test('homepage loads with title and hero', async ({ page }) => {
    await page.goto('/home/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/Maliki/i);
    await expect(page.locator('#heroHeadline')).toBeVisible();
    await expect(page.locator('#heroCta')).toBeVisible();
  });

  test('header links navigate correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Shop link
    await page.click('a[href="/shop"]');
    await page.waitForURL('**/shop**');
    await expect(page).toHaveURL(/\/shop/);

    // Root redirects to /home/ — navigate there and verify
    await page.goto('/home/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/home\//i);
  });

  test('cart link navigates to cart', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.click('a.cart-btn');
    await page.waitForURL('**/cart**');
    await expect(page).toHaveURL(/\/cart/);
  });

  test('mobile menu opens and closes', async ({ page }) => {
    // Burger button is only visible at ≤768px — use mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(page);

    const burger = page.locator('#burgerBtn');
    await expect(burger).toBeVisible();
    await burger.click();
    await expect(page.locator('#mobileNav')).toHaveAttribute('aria-hidden', 'false');

    await page.locator('#mobileNavClose').click();
    await expect(page.locator('#mobileNav')).toHaveAttribute('aria-hidden', 'true');
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/Maliki/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#contactForm')).toBeVisible();
  });

  test('account page loads login form', async ({ page }) => {
    await page.goto('/account/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('body')).toContainText(/sign in|log in|your account/i);
  });

  test('404 page returns not found', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('cookie banner accept sets localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Clear cookie consent so banner appears
    await page.evaluate(() => localStorage.removeItem('maliki.cookies'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    const banner = page.locator('#cookie-banner');
    await banner.waitFor({ state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Accept")');
    const val = await page.evaluate(() => localStorage.getItem('maliki.cookies'));
    expect(val).toBe('accepted');
  });

  test('cookie banner decline sets localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.removeItem('maliki.cookies'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    const banner = page.locator('#cookie-banner');
    await banner.waitFor({ state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Decline")');
    const val = await page.evaluate(() => localStorage.getItem('maliki.cookies'));
    expect(val).toBe('declined');
  });
});
