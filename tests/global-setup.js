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

async function apiRequest(method, path, body) {
  const token = issueAdminToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `mk_admin=${token}`,
      'Origin': BASE,
      'Referer': `${BASE}/admin`,
    },
  };
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}${path}`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: opts.headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = async function globalSetup() {
  // Check if products already exist
  const catalog = await apiRequest('GET', '/api/catalog', null);
  if (catalog.body?.products?.length > 0) {
    console.log(`[setup] ${catalog.body.products.length} products already in catalog — skipping fixture creation`);
    return;
  }

  // Create a test product so product-flow tests have something to work with
  const product = {
    id: `e2e_${Date.now().toString(36)}`,
    title: 'E2E Test Ring',
    slug: 'e2e-test-ring',
    price_cents: 15000,
    description: 'An automated E2E test product — safe to ignore.',
    published: true,
    category: 'ring',
    stock: 10,
    images: [],
  };

  const result = await apiRequest('POST', '/api/admin/products', product);
  if (result.status === 200 || result.status === 201) {
    console.log(`[setup] Created test product: ${result.body?.id || 'unknown id'}`);
    // Store the ID for teardown
    process.env._E2E_TEST_PRODUCT_ID = result.body?.id;
  } else {
    console.warn(`[setup] Could not create test product: ${result.status}`, result.body);
  }
};
