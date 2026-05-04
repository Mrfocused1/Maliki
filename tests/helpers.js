// @ts-check
const crypto = require('crypto');

const BASE = 'http://127.0.0.1:8000';
const ADMIN_SECRET = '278a7c385356c7c9d05d154f53de6ca11fab3683af130777f351323fdbad27a9';
const TEST_EMAIL = 'e2e@maliki-test.invalid';

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

async function setAdminCookie(context) {
  const vercelUrl = process.env.VERCEL_URL;
  const domain = vercelUrl
    ? new URL(vercelUrl).hostname
    : '127.0.0.1';
  await context.addCookies([{
    name: 'mk_admin',
    value: issueAdminToken(),
    domain,
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  }]);
}

async function dismissCookieBanner(page) {
  const banner = page.locator('#cookie-banner');
  try {
    await banner.waitFor({ state: 'visible', timeout: 2000 });
    await page.evaluate(() => localStorage.setItem('maliki.cookies', 'accepted'));
    await page.reload({ waitUntil: 'domcontentloaded' });
  } catch {
    // already dismissed
  }
}

async function getCatalogProducts(page) {
  const resp = await page.request.get(`${BASE}/api/catalog`);
  if (!resp.ok()) return [];
  const data = await resp.json();
  return data.products || [];
}

module.exports = { BASE, TEST_EMAIL, setAdminCookie, dismissCookieBanner, getCatalogProducts };
