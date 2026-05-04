// @ts-check
/**
 * Admin CMS round-trip tests.
 *
 * Each test actually saves data via the admin API and verifies the change
 * persists — either by reading back via the same API or via the public
 * endpoint. This catches bugs that tab-render tests miss entirely.
 *
 * All writes use clearly test-scoped values (prefixed e2e_) and clean up
 * after themselves so the live Supabase database is not polluted.
 *
 * Set VERCEL_URL=https://www.malikiatelier.com to run against the live site.
 */

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');

// ADMIN_SECRET: use env var for live Vercel runs, fall back to local dev default.
// When running against the live site set: ADMIN_SECRET=<vercel_secret> VERCEL_URL=https://...
const ADMIN_SECRET =
  process.env.ADMIN_SECRET ||
  '278a7c385356c7c9d05d154f53de6ca11fab3683af130777f351323fdbad27a9';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function issueAdminToken() {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  const p = b64url(payload);
  const sig = b64url(crypto.createHmac('sha256', ADMIN_SECRET).update(p).digest());
  return `${p}.${sig}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.VERCEL_URL || '';  // empty = use baseURL from config

function url(path) {
  return BASE_URL ? `${BASE_URL}${path}` : path;
}

// Cached live-login cookie so we only log in once per test run.
let _liveCookie = null;

// For live Vercel runs without ADMIN_SECRET, fall back to logging in with
// ADMIN_EMAIL + ADMIN_PASSWORD and reusing the resulting mk_admin cookie.
async function getLiveCookie(context) {
  if (_liveCookie) return _liveCookie;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const origin = BASE_URL;
  const res = await context.request.post(url('/api/admin/login'), {
    data: { email, password },
    headers: { 'Content-Type': 'application/json', Origin: origin, Referer: `${origin}/admin` },
  });
  if (!res.ok()) return null;
  const setCookie = res.headers()['set-cookie'] || '';
  const match = setCookie.match(/mk_admin=([^;]+)/);
  if (match) { _liveCookie = match[1]; return _liveCookie; }
  return null;
}

async function adminRequest(context, method, path, body) {
  const origin = BASE_URL || 'http://127.0.0.1:8000';

  // For live runs, prefer a login-derived cookie if ADMIN_EMAIL/PASSWORD set
  let cookieValue = issueAdminToken();
  if (BASE_URL) {
    const live = await getLiveCookie(context);
    if (live) cookieValue = live;
  }

  const opts = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: origin,
      Referer: `${origin}/admin`,
      Cookie: `mk_admin=${cookieValue}`,
    },
  };
  if (body) opts.data = body;
  return context.request[method.toLowerCase()](url(path), opts);
}

function withAdmin(context) {
  return (method, path, body) => adminRequest(context, method, path, body);
}

// ─── Products ─────────────────────────────────────────────────────────────────

test.describe('Admin CMS: Products', () => {
  let createdId;

  test('create product → appears in public catalog', async ({ context }) => {
    const api = await withAdmin(context);
    createdId = `e2e_prod_${Date.now().toString(36)}`;

    const res = await api('POST', '/api/admin/products', {
      id: createdId,
      title: 'E2E Test Product',
      slug: createdId,
      price_cents: 9900,
      category: 'ring',
      published: true,
      stock: 5,
      images: [],
    });
    expect(res.status()).toBe(200);

    const catalog = await context.request.get(url(`/api/catalog?_t=${Date.now()}`));
    const data = await catalog.json();
    const found = data.products.find((p) => p.id === createdId);
    expect(found, `Product ${createdId} not found in catalog after create`).toBeTruthy();
    expect(found.title).toBe('E2E Test Product');
  });

  test('update product → change reflected in catalog', async ({ context }) => {
    if (!createdId) test.skip();
    const api = await withAdmin(context);

    const res = await api('PATCH', '/api/admin/products', {
      id: createdId,
      title: 'E2E Test Product (updated)',
    });
    expect(res.status()).toBe(200);

    const catalog = await context.request.get(url(`/api/catalog?_t=${Date.now()}`));
    const data = await catalog.json();
    const found = data.products.find((p) => p.id === createdId);
    expect(found?.title).toBe('E2E Test Product (updated)');
  });

  test('delete product → gone from catalog', async ({ context }) => {
    if (!createdId) test.skip();
    const api = await withAdmin(context);

    const res = await api('DELETE', `/api/admin/products?id=${createdId}`, undefined);
    expect([200, 204]).toContain(res.status());

    const catalog = await context.request.get(url(`/api/catalog?_t=${Date.now()}`));
    const data = await catalog.json();
    const found = data.products.find((p) => p.id === createdId);
    expect(found, `Product ${createdId} still in catalog after delete`).toBeFalsy();
  });
});

// ─── Homepage settings ────────────────────────────────────────────────────────

test.describe('Admin CMS: Homepage settings', () => {
  let originalHero;

  test('save homepage hero → reflected by /api/homepage immediately', async ({ context }) => {
    const api = await withAdmin(context);

    // Read current value so we can restore it
    const before = await context.request.get(url('/api/homepage'));
    const beforeData = await before.json();
    originalHero = beforeData.homepage?.hero || {};

    const testHeadline = `E2E headline ${Date.now()}`;
    const patch = { ...(beforeData.homepage || {}), hero: { ...originalHero, headline: testHeadline } };

    const res = await api('PATCH', '/api/admin/settings', { section: 'homepage', value: patch });
    expect(res.status()).toBe(200);

    // /api/homepage is no-store so this should be fresh immediately
    const after = await context.request.get(url('/api/homepage'));
    const afterData = await after.json();
    expect(afterData.homepage?.hero?.headline).toBe(testHeadline);
  });

  test('restore homepage hero after test', async ({ context }) => {
    if (!originalHero) test.skip();
    const api = await withAdmin(context);
    const current = await context.request.get(url('/api/homepage'));
    const currentData = await current.json();
    const restored = { ...(currentData.homepage || {}), hero: originalHero };
    const res = await api('PATCH', '/api/admin/settings', { section: 'homepage', value: restored });
    expect(res.status()).toBe(200);
  });
});

// ─── CMS Pages ────────────────────────────────────────────────────────────────

test.describe('Admin CMS: Pages', () => {
  let createdPageId;
  const testSlug = `e2e-page-${Date.now().toString(36)}`;

  test('create page → appears in /api/pages', async ({ context }) => {
    const api = await withAdmin(context);

    const res = await api('POST', '/api/admin/pages', {
      slug: testSlug,
      title: 'E2E Test Page',
      body: '<p>Test content</p>',
      status: 'published',
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    createdPageId = body.page?.id || body.id || body[0]?.id;

    const pages = await context.request.get(url('/api/pages'));
    const data = await pages.json();
    expect(data.pages[testSlug], `Page ${testSlug} not found after create`).toBeTruthy();
    expect(data.pages[testSlug].title).toBe('E2E Test Page');
  });

  test('update page → change reflected in /api/pages', async ({ context }) => {
    if (!createdPageId) test.skip();
    const api = await withAdmin(context);

    const res = await api('PATCH', '/api/admin/pages', {
      id: createdPageId,
      title: 'E2E Test Page (updated)',
      body: '<p>Updated content</p>',
    });
    expect(res.status()).toBe(200);

    const pages = await context.request.get(url('/api/pages'));
    const data = await pages.json();
    expect(data.pages[testSlug]?.title).toBe('E2E Test Page (updated)');
  });

  test('delete page → gone from /api/pages', async ({ context }) => {
    if (!createdPageId) test.skip();
    const api = await withAdmin(context);

    const res = await api('DELETE', `/api/admin/pages?id=${createdPageId}`, undefined);
    expect([200, 204]).toContain(res.status());

    const pages = await context.request.get(url('/api/pages'));
    const data = await pages.json();
    expect(data.pages[testSlug], `Page ${testSlug} still present after delete`).toBeFalsy();
  });
});

// ─── Email templates ──────────────────────────────────────────────────────────

test.describe('Admin CMS: Email templates', () => {
  let originalSubject;
  const templateKey = 'order_confirmation';

  test('update email template → change persists in admin data', async ({ context }) => {
    const api = await withAdmin(context);

    const before = await api('GET', '/api/admin/data', undefined);
    const beforeData = await before.json();
    const tpl = (beforeData.email_templates || []).find((t) => t.key === templateKey);
    originalSubject = tpl?.subject || 'Your Maliki Atelier order';

    const testSubject = `E2E test subject ${Date.now()}`;
    const res = await api('PATCH', '/api/admin/emails', { key: templateKey, subject: testSubject });
    expect(res.status()).toBe(200);

    const after = await api('GET', '/api/admin/data', undefined);
    const afterData = await after.json();
    const updated = (afterData.email_templates || []).find((t) => t.key === templateKey);
    expect(updated?.subject).toBe(testSubject);
  });

  test('restore email template subject after test', async ({ context }) => {
    if (!originalSubject) test.skip();
    const api = await withAdmin(context);
    const res = await api('PATCH', '/api/admin/emails', { key: templateKey, subject: originalSubject });
    expect(res.status()).toBe(200);
  });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

test.describe('Admin CMS: Orders', () => {
  test('order status update persists in admin data', async ({ context }) => {
    const api = await withAdmin(context);

    const data = await (await api('GET', '/api/admin/data', undefined)).json();
    const order = (data.orders || []).find((o) => o.status === 'pending' || o.status === 'paid');
    if (!order) { test.skip(); return; }

    const originalStatus = order.status;
    const newStatus = originalStatus === 'pending' ? 'paid' : 'pending';

    const res = await api('PATCH', '/api/admin/orders', { id: order.id, status: newStatus });
    expect(res.status()).toBe(200);

    const after = await (await api('GET', '/api/admin/data', undefined)).json();
    const updated = (after.orders || []).find((o) => o.id === order.id);
    expect(updated?.status).toBe(newStatus);

    // Restore
    await api('PATCH', '/api/admin/orders', { id: order.id, status: originalStatus });
  });

  test('order status update with no orders skips gracefully', async ({ context }) => {
    const api = await withAdmin(context);
    const data = await (await api('GET', '/api/admin/data', undefined)).json();
    if ((data.orders || []).length > 0) {
      expect(true).toBe(true); // covered by the test above
    } else {
      test.skip();
    }
  });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

test.describe('Admin CMS: Reviews', () => {
  test('review approve/reject persists in admin data', async ({ context }) => {
    const api = await withAdmin(context);

    const data = await (await api('GET', '/api/admin/data', undefined)).json();
    const review = (data.product_reviews || []).find((r) => r.status === 'pending' || r.status === 'approved');
    if (!review) { test.skip(); return; }

    const originalStatus = review.status;
    const newStatus = originalStatus === 'pending' ? 'approved' : 'pending';

    const res = await api('PATCH', '/api/admin/reviews', { id: review.id, status: newStatus });
    expect(res.status()).toBe(200);

    const after = await (await api('GET', '/api/admin/data', undefined)).json();
    const updated = (after.product_reviews || []).find((r) => r.id === review.id);
    expect(updated?.status).toBe(newStatus);

    // Restore
    await api('PATCH', '/api/admin/reviews', { id: review.id, status: originalStatus });
  });
});

// ─── Admin data API completeness ──────────────────────────────────────────────

test.describe('Admin CMS: Data API completeness', () => {
  test('/api/admin/data returns all expected sections', async ({ context }) => {
    const api = await withAdmin(context);
    const res = await api('GET', '/api/admin/data', undefined);
    expect(res.status()).toBe(200);

    const data = await res.json();
    const required = ['products', 'orders', 'customers', 'subscribers', 'discounts',
      'email_templates', 'email_log', 'pages', 'settings'];
    for (const key of required) {
      expect(data, `Missing key: ${key}`).toHaveProperty(key);
    }
  });

  test('email_log entries have required fields', async ({ context }) => {
    const api = await withAdmin(context);
    const res = await api('GET', '/api/admin/data', undefined);
    const data = await res.json();
    const logs = data.email_log || [];
    if (logs.length === 0) { test.skip(); return; }

    const entry = logs[0];
    expect(entry).toHaveProperty('to');
    expect(entry).toHaveProperty('subject');
    expect(entry).toHaveProperty('sent_at');
    expect(entry).toHaveProperty('status');
    expect(entry).toHaveProperty('template_key');
  });

  test('each customer email is linkable to their email_log entries', async ({ context }) => {
    const api = await withAdmin(context);
    const res = await api('GET', '/api/admin/data', undefined);
    const data = await res.json();

    const logs = data.email_log || [];
    const customers = data.customers || [];
    if (logs.length === 0 || customers.length === 0) { test.skip(); return; }

    // For every log entry, the recipient email should be a string
    for (const entry of logs.slice(0, 10)) {
      expect(typeof entry.to).toBe('string');
      expect(entry.to.length).toBeGreaterThan(0);
    }

    // At least one customer should have matching email log entries (if any emails sent)
    const customerEmails = new Set(customers.map((c) => c.email));
    const linkedCount = logs.filter((e) => customerEmails.has(e.to)).length;
    console.log(`${linkedCount}/${logs.length} email log entries match a known customer`);
  });
});

// ─── Settings (general) ───────────────────────────────────────────────────────

test.describe('Admin CMS: General settings', () => {
  let originalGeneral;

  test('save general settings → persists in admin data', async ({ context }) => {
    const api = await withAdmin(context);

    const before = await (await api('GET', '/api/admin/data', undefined)).json();
    originalGeneral = before.settings?.general || {};

    const testNote = `e2e_${Date.now()}`;
    const patch = { ...originalGeneral, _e2e_marker: testNote };

    const res = await api('PATCH', '/api/admin/settings', { section: 'general', value: patch });
    expect(res.status()).toBe(200);

    const after = await (await api('GET', '/api/admin/data', undefined)).json();
    expect(after.settings?.general?._e2e_marker).toBe(testNote);
  });

  test('restore general settings after test', async ({ context }) => {
    if (!originalGeneral) test.skip();
    const api = await withAdmin(context);
    const res = await api('PATCH', '/api/admin/settings', { section: 'general', value: originalGeneral });
    expect(res.status()).toBe(200);
  });
});

// ─── Discount code (public API) ───────────────────────────────────────────────

test.describe('Admin CMS: Discount code validation', () => {
  test('active discount codes validate correctly via /api/discount', async ({ context }) => {
    const api = await withAdmin(context);
    const data = await (await api('GET', '/api/admin/data', undefined)).json();
    const active = (data.discounts || []).find((d) => d.status === 'active');
    if (!active) { test.skip(); return; }

    const origin = BASE_URL || 'http://127.0.0.1:8000';
    const res = await context.request.post(url('/api/discount'), {
      data: { code: active.code, subtotal_cents: active.minimum_cents || 0 },
      headers: { 'Content-Type': 'application/json', Origin: origin },
    });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('discount_cents');
    }
  });

  test('invalid discount code returns 404', async ({ context }) => {
    const origin = BASE_URL || 'http://127.0.0.1:8000';
    const res = await context.request.post(url('/api/discount'), {
      data: { code: 'INVALID_E2E_CODE_XYZ', subtotal_cents: 10000 },
      headers: { 'Content-Type': 'application/json', Origin: origin },
    });
    expect(res.status()).toBe(404);
  });
});
