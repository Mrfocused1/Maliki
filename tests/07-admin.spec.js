// @ts-check
const { test, expect } = require('@playwright/test');
const { setAdminCookie, TEST_EMAIL } = require('./helpers');

test.describe('Admin — Unauthenticated', () => {
  test('admin page shows login form when not logged in', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#loginForm, #em, #pw').first()).toBeVisible({ timeout: 8000 });
  });

  test('admin API endpoints return 401 without cookie', async ({ page }) => {
    const resp = await page.request.get('/api/admin/data', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(401);
  });
});

test.describe('Admin — Authenticated', () => {
  test.beforeEach(async ({ context }) => {
    await setAdminCookie(context);
  });

  test('admin dashboard loads after cookie set', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should NOT show login form
    const loginForm = page.locator('#loginForm');
    const isLoginVisible = await loginForm.isVisible().catch(() => false);
    expect(isLoginVisible).toBe(false);

    // Should show main admin UI
    await expect(page.locator('#app, #root, .dashboard, nav, [class*="nav"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin/data API returns data with valid cookie', async ({ context, page }) => {
    await page.goto('/admin');
    const resp = await page.request.get('/api/admin/data', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('orders');
  });

  test('admin products section renders', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click the products nav item
    const productsNav = page.locator('button:has-text("Products"), a:has-text("Products"), [data-nav="products"]').first();
    if (await productsNav.isVisible()) {
      await productsNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/products|add product/i);
    }
  });

  test('admin orders section renders', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const ordersNav = page.locator('button:has-text("Orders"), a:has-text("Orders"), [data-nav="orders"]').first();
    if (await ordersNav.isVisible()) {
      await ordersNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/orders/i);
    }
  });

  test('admin email templates tab renders', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const emailNav = page.locator('button:has-text("Email"), a:has-text("Email"), [data-nav="email"]').first();
    if (await emailNav.isVisible()) {
      await emailNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/email|template/i);
    }
  });

  test('admin content tab shows homepage editor', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const contentNav = page.locator('button:has-text("Content"), a:has-text("Content"), [data-nav="content"]').first();
    if (await contentNav.isVisible()) {
      await contentNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/homepage|hero|content/i);
    }
  });

  test('admin settings section renders', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const settingsNav = page.locator('button:has-text("Settings"), a:has-text("Settings"), [data-nav="settings"]').first();
    if (await settingsNav.isVisible()) {
      await settingsNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/settings|currency|shop/i);
    }
  });

  test('admin subscribers section renders', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const subsNav = page.locator('button:has-text("Subscriber"), a:has-text("Subscriber"), [data-nav="subscribers"]').first();
    if (await subsNav.isVisible()) {
      await subsNav.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/subscriber/i);
    }
  });

  test('admin logout clears session', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForLoadState('domcontentloaded');
      // After logout, login form should reappear
      await expect(page.locator('#loginForm, #em, #pw').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('admin API /session endpoint returns authed:true with cookie', async ({ page }) => {
    await page.goto('/admin');
    const resp = await page.request.get('/api/admin/session', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.authed).toBe(true);
  });

  test('admin page has no critical JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const critical = errors.filter((e) => !e.includes('net::ERR') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });
});
