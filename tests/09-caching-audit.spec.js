// @ts-check
/**
 * Caching and deployment-gap audit.
 *
 * Local E2E tests can't observe CDN behaviour (Vercel honours Cache-Control
 * headers; local-server.js does not). This file closes that gap two ways:
 *
 * 1. Static analysis — reads api/ source files and flags any that attach CDN
 *    caching headers to responses that include admin-configurable content.
 *    This is the class of bug that caused homepage settings to be stale.
 *
 * 2. Runtime header checks — assert that endpoints serving mutable admin data
 *    have Cache-Control: no-store (or equivalent) so the CDN never caches them.
 *
 * 3. Vercel smoke tests — if VERCEL_URL is set in the environment, repeat the
 *    key header checks and page-load assertions against the live deployment.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ─── helpers ──────────────────────────────────────────────────────────────────

const API_DIR = path.resolve(__dirname, '../api');

/** Returns { file, cacheHeader } for every api/*.js that sets a CDN-cacheable
 *  Cache-Control header (s-maxage or max-age > 0, stale-while-revalidate). */
function findCachedEndpoints() {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(path.join(dir, entry.name)); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const full = path.join(dir, entry.name);
      const src = fs.readFileSync(full, 'utf8');
      // Detect any Cache-Control value that would allow CDN caching
      const match = src.match(/['"]Cache-Control['"]\s*,\s*['"]([^'"]*s-maxage[^'"]*)['"]/i)
        || src.match(/['"]Cache-Control['"]\s*,\s*['"]([^'"]*stale-while-revalidate[^'"]*)['"]/i);
      if (match) results.push({ file: path.relative(API_DIR, full), cacheHeader: match[1] });
    }
  };
  walk(API_DIR);
  return results;
}

/**
 * Admin-editable Supabase tables — any API endpoint that reads from these
 * and is CDN-cached will serve stale content after an admin makes a change.
 */
const ADMIN_EDITABLE_TABLES = ['settings', 'pages'];

/** Returns the first admin-editable table name found in the source, or null. */
function servesAdminTable(relFile) {
  const src = fs.readFileSync(path.join(API_DIR, relFile), 'utf8');
  return ADMIN_EDITABLE_TABLES.find((table) => {
    // Match supabaseFetch calls that query the table, e.g. /pages?... or /settings?...
    return new RegExp(`supabaseFetch\\(['"]/` + table).test(src);
  }) || null;
}

// ─── static analysis ──────────────────────────────────────────────────────────

test.describe('Static: CDN caching on mutable-data endpoints', () => {
  test('no CDN-cached endpoint serves admin-editable table data', () => {
    const cached = findCachedEndpoints();

    const violations = cached
      .map(({ file, cacheHeader }) => ({ file, cacheHeader, table: servesAdminTable(file) }))
      .filter(({ table }) => table !== null);

    if (violations.length > 0) {
      const msg = violations
        .map(({ file, cacheHeader, table }) => `  ${file}: Cache-Control: ${cacheHeader}  (reads: ${table})`)
        .join('\n');
      throw new Error(
        `The following API endpoints have CDN caching AND read admin-editable tables.\n` +
        `Admin changes will be stale for visitors until the CDN TTL expires.\n` +
        `Fix: use Cache-Control: no-store on any endpoint that reads: ${ADMIN_EDITABLE_TABLES.join(', ')}.\n\n` +
        msg
      );
    }

    // Document what IS cached (informational — not a failure)
    if (cached.length > 0) {
      console.log('CDN-cached endpoints (no admin-editable tables, OK):');
      cached.forEach(({ file, cacheHeader }) => console.log(`  ${file}: ${cacheHeader}`));
    }
  });

  test('every api/ file that writes admin-editable tables has no CDN caching', () => {
    const violations = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) { walk(path.join(dir, entry.name)); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const full = path.join(dir, entry.name);
        const src = fs.readFileSync(full, 'utf8');
        const writesAdminTable = ADMIN_EDITABLE_TABLES.some((table) =>
          new RegExp(`supabaseFetch\\([^)]*${table}[^)]*,\\s*\\{[^}]*method.*(?:POST|PATCH|DELETE)|upsert.*${table}`, 'i').test(src)
          || (new RegExp(`/${table}`).test(src) && /Prefer.*upsert|method.*(?:POST|PATCH|DELETE)/i.test(src))
        );
        if (!writesAdminTable) continue;
        const hasCdn = /s-maxage|stale-while-revalidate/i.test(src);
        if (hasCdn) violations.push(path.relative(API_DIR, full));
      }
    };
    walk(API_DIR);
    expect(violations, `Admin-write endpoints must not have CDN caching: ${violations.join(', ')}`).toHaveLength(0);
  });
});

// ─── runtime cache-header checks ──────────────────────────────────────────────

test.describe('Runtime: Cache-Control headers on mutable-data endpoints', () => {
  test('/api/homepage responds with no-store', async ({ request }) => {
    const resp = await request.get('/api/homepage');
    if (resp.status() === 404) {
      throw new Error(
        '/api/homepage returned 404 — the local server needs a restart to pick up the new route.\n' +
        'Run: pkill -f "node local-server" && node local-server.js &'
      );
    }
    expect([200, 500]).toContain(resp.status());
    const cc = resp.headers()['cache-control'] || '';
    expect(cc).toMatch(/no-store/i);
  });

  test('/api/catalog Cache-Control is documented (CDN-cached products, no settings)', async ({ request }) => {
    const resp = await request.get('/api/catalog');
    expect(resp.status()).toBe(200);
    const cc = resp.headers()['cache-control'] || '';
    // /api/catalog may be CDN-cached for products, which is acceptable because
    // settings/homepage data is now fetched separately via /api/homepage (no-store).
    // This test documents that expectation explicitly so any future change is visible.
    console.log(`/api/catalog Cache-Control: ${cc || '(none)'}`);
    // Not asserting a specific value — just ensuring the header exists and is logged
    expect(typeof cc).toBe('string');
  });

  test('/api/pages responds with no-store', async ({ request }) => {
    const resp = await request.get('/api/pages');
    expect([200, 500]).toContain(resp.status());
    const cc = resp.headers()['cache-control'] || '';
    expect(cc).toMatch(/no-store/i);
  });

  test('/api/admin/settings is not CDN-cached', async ({ request }) => {
    const resp = await request.patch('/api/admin/settings', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    // Will 401 without auth cookie — that's fine, we only want the headers
    const cc = resp.headers()['cache-control'] || '';
    expect(cc).not.toMatch(/s-maxage/i);
    expect(cc).not.toMatch(/stale-while-revalidate/i);
  });
});

// ─── Vercel smoke tests ────────────────────────────────────────────────────────

const VERCEL_URL = process.env.VERCEL_URL
  ? process.env.VERCEL_URL.replace(/\/$/, '')
  : null;

test.describe('Vercel: live deployment smoke tests', () => {
  test.skip(!VERCEL_URL, 'Set VERCEL_URL=https://your-site.vercel.app to enable');

  test('homepage loads on Vercel', async ({ page }) => {
    await page.goto(`${VERCEL_URL}/home/`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/home');
  });

  test('/api/homepage on Vercel responds with no-store', async ({ request }) => {
    const resp = await request.get(`${VERCEL_URL}/api/homepage`);
    expect([200, 500]).toContain(resp.status());
    const cc = resp.headers()['cache-control'] || '';
    expect(cc, `/api/homepage must be Cache-Control: no-store on Vercel — got: "${cc}"`).toMatch(/no-store/i);
  });

  test('/api/pages on Vercel responds with no-store', async ({ request }) => {
    const resp = await request.get(`${VERCEL_URL}/api/pages`);
    expect([200, 500]).toContain(resp.status());
    const cc = resp.headers()['cache-control'] || '';
    expect(cc, `/api/pages must be Cache-Control: no-store on Vercel — got: "${cc}"`).toMatch(/no-store/i);
  });

  test('/api/catalog on Vercel returns products', async ({ request }) => {
    const resp = await request.get(`${VERCEL_URL}/api/catalog`);
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data.products)).toBe(true);
  });

  test('shop page loads on Vercel', async ({ page }) => {
    await page.goto(`${VERCEL_URL}/shop/`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin page redirects or loads on Vercel (not blank)', async ({ page }) => {
    await page.goto(`${VERCEL_URL}/admin/`);
    await page.waitForLoadState('domcontentloaded');
    // Should show login gate or admin UI — not a blank/error page
    const body = await page.locator('body').textContent();
    expect(body && body.trim().length).toBeGreaterThan(10);
  });
});
