// @ts-check
const crypto = require('crypto');
const http = require('http');

const BASE = 'http://127.0.0.1:8000';
const ADMIN_SECRET = '278a7c385356c7c9d05d154f53de6ca11fab3683af130777f351323fdbad27a9';

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

module.exports = async function globalTeardown() {
  const id = process.env._E2E_TEST_PRODUCT_ID;
  if (!id) return;

  const token = issueAdminToken();
  const url = new URL(`${BASE}/api/admin/products?id=${encodeURIComponent(id)}`);

  await new Promise((resolve) => {
    const req = http.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method: 'DELETE',
      headers: {
        'Cookie': `mk_admin=${token}`,
        'Origin': BASE,
        'Referer': `${BASE}/admin`,
      },
    }, (res) => {
      res.resume();
      res.on('end', () => {
        console.log(`[teardown] Deleted test product ${id}: HTTP ${res.statusCode}`);
        resolve(undefined);
      });
    });
    req.on('error', (e) => { console.warn('[teardown] Delete failed:', e.message); resolve(undefined); });
    req.end();
  });
};
