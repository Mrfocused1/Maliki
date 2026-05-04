// @ts-check
const { test, expect } = require('@playwright/test');
const { setAdminCookie } = require('./helpers');

test.describe('Public API Endpoints', () => {
  test('GET /api/catalog returns products array', async ({ page }) => {
    const resp = await page.request.get('/api/catalog', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('products');
    expect(Array.isArray(data.products)).toBe(true);
  });

  test('GET /api/config responds with JSON', async ({ page }) => {
    const resp = await page.request.get('/api/config', {
      headers: { Accept: 'application/json' },
    });
    // Returns 200 with stripePublishableKey when Stripe is configured,
    // or 500 with error when STRIPE_PUBLISHABLE_KEY env is missing (local dev)
    expect([200, 500]).toContain(resp.status());
    const data = await resp.json();
    expect(typeof data).toBe('object');
  });

  test('GET /api/pages returns pages data', async ({ page }) => {
    const resp = await page.request.get('/api/pages', {
      headers: { Accept: 'application/json' },
    });
    expect([200, 500]).toContain(resp.status());
    if (resp.status() === 200) {
      const data = await resp.json();
      // Pages API returns { pages: { ... } } object
      expect(typeof data).toBe('object');
      if (data.pages) expect(typeof data.pages).toBe('object');
    }
  });

  test('POST /api/contact rejects cross-origin', async ({ page }) => {
    await page.goto('/');
    const resp = await page.request.post('/api/contact', {
      data: { name: 'Test', email: 'test@example.com', message: 'hi' },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example.com',
      },
    });
    expect(resp.status()).toBe(403);
  });

  test('POST /api/checkout rejects GET method', async ({ page }) => {
    const resp = await page.request.get('/api/checkout');
    expect(resp.status()).toBe(405);
  });

  test('GET /api/robots returns text', async ({ page }) => {
    const resp = await page.request.get('/api/robots');
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-type']).toMatch(/text/);
  });
});

test.describe('Admin API Endpoints', () => {
  test('GET /api/admin/session returns authed:false without cookie', async ({ page }) => {
    const resp = await page.request.get('/api/admin/session', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.authed).toBe(false);
  });

  test('GET /api/admin/analytics returns 401 without cookie', async ({ page }) => {
    const resp = await page.request.get('/api/admin/analytics', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(401);
  });

  test('PATCH /api/admin/orders rejects without cookie', async ({ page }) => {
    const resp = await page.request.patch('/api/admin/orders', {
      data: { id: 'test', status: 'shipped' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status()).toBe(401);
  });

  test('GET /api/admin/analytics returns data with cookie', async ({ context, page }) => {
    await setAdminCookie(context);
    await page.goto('/admin');

    const resp = await page.request.get('/api/admin/analytics', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.status()).toBe(200);
  });
});
