/**
 * Puppeteer test: Admin invite → setup → login flow
 * Usage: INVITE_SECRET=xxx SITE_URL=https://www.malikiatelier.com node test-admin-auth.js
 */

const puppeteer = require('puppeteer');
const https = require('https');
const http  = require('http');

const SITE_URL      = (process.env.SITE_URL || 'https://www.malikiatelier.com').replace(/\/$/, '');
const INVITE_SECRET = process.env.INVITE_SECRET || '';
const TEST_EMAIL    = 'derryalswaby@malikiatelier.com';

let passed = 0;
let failed = 0;

function ok(label)        { console.log(`  ✓  ${label}`); passed++; }
function fail(label, err) { console.error(`  ✗  ${label}`); if (err) console.error(`     ${err.message || err}`); failed++; }
function wait(ms)         { return new Promise(r => setTimeout(r, ms)); }

// Node-level HTTP request (bypasses browser CORS)
function nodeRequest(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const body = opts.body ? Buffer.from(opts.body) : null;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Origin: SITE_URL,
        Referer: SITE_URL + '/',
        ...(opts.headers || {}),
        ...(body ? { 'Content-Length': body.length } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  console.log('\n=== Maliki Admin Auth — Puppeteer Test Suite ===');
  console.log(`    Site: ${SITE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ─── Test 1: Invite endpoint sends email ──────────────────────────────────
  console.log('1. Invite endpoint');
  try {
    const res = await nodeRequest(`${SITE_URL}/api/admin/invite`, {
      method: 'POST',
      headers: { 'x-invite-secret': INVITE_SECRET },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });

    if (res.status === 200 && res.body.ok) {
      ok(`Invite sent to ${TEST_EMAIL}`);
    } else {
      fail(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  } catch (err) {
    fail('Invite endpoint threw', err);
  }

  // ─── Test 2: Login with wrong credentials ────────────────────────────────
  console.log('\n2. Login — wrong credentials');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('#em', { timeout: 10000 });

    await page.type('#em', 'wrong@example.com');
    await page.type('#pw', 'wrongpassword');
    await page.click('#loginBtn');

    await page.waitForFunction(
      () => (document.getElementById('loginErr')?.textContent || '').length > 0,
      { timeout: 8000 }
    );

    const errText = await page.$eval('#loginErr', el => el.textContent);
    const rejected = errText.toLowerCase().includes('incorrect')
      || errText.toLowerCase().includes('password')
      || errText.toLowerCase().includes('many');
    if (rejected) {
      ok('Rejected invalid credentials with correct message');
    } else {
      fail(`Unexpected error message: "${errText}"`);
    }
    await page.close();
  } catch (err) {
    fail('Login rejection test', err);
  }

  // ─── Test 3: Login form has email + password fields ───────────────────────
  console.log('\n3. Login form — field presence');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('#em', { timeout: 10000 });

    const hasEmail = await page.$('#em') !== null;
    const hasPw    = await page.$('#pw') !== null;
    const hasBtn   = await page.$('#loginBtn') !== null;

    if (hasEmail && hasPw && hasBtn) {
      ok('Login form has email field, password field, and submit button');
    } else {
      fail(`Missing fields — email:${hasEmail} pw:${hasPw} btn:${hasBtn}`);
    }
    await page.close();
  } catch (err) {
    fail('Login form fields test', err);
  }

  // ─── Test 4: Setup page — no token shows expired state ───────────────────
  console.log('\n4. Setup page — no token');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(600);

    const invalidVisible = await page.evaluate(() => {
      const el = document.getElementById('stateInvalid');
      if (!el) return 'MISSING';
      return el.style.display;
    });

    if (invalidVisible === 'block') {
      ok('Shows expired-link state when no token present');
    } else {
      fail(`stateInvalid display="${invalidVisible}" (expected "block")`);
    }
    await page.close();
  } catch (err) {
    fail('Setup page invalid state', err);
  }

  // ─── Test 5: Setup page — invite token shows setup form ──────────────────
  console.log('\n5. Setup page — fake invite token shows form');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup#access_token=FAKE_TOKEN_FOR_TEST&type=invite`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);

    const setupVisible = await page.evaluate(() => {
      const el = document.getElementById('stateSetup');
      if (!el) return 'MISSING';
      const style = window.getComputedStyle(el);
      return style.display;
    });

    if (setupVisible !== 'none' && setupVisible !== 'MISSING') {
      ok('Setup form shown when invite token present in hash');
    } else {
      fail(`stateSetup display="${setupVisible}" (expected visible)`);
    }
    await page.close();
  } catch (err) {
    fail('Setup page — token test', err);
  }

  // ─── Test 6: Password validation on setup page ───────────────────────────
  console.log('\n6. Setup page — password validation');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup#access_token=FAKE_TOKEN_FOR_TEST&type=invite`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);

    await page.waitForSelector('#pw', { timeout: 5000 });

    // Mismatch
    await page.type('#pw', 'GoodPass123!');
    await page.type('#pw2', 'DifferentPass!');
    await page.click('#submitBtn');
    await wait(400);

    const errText = await page.$eval('#errMsg', el => el.textContent);
    if (errText.toLowerCase().includes('match')) {
      ok('Password mismatch validation works');
    } else {
      fail(`Expected mismatch error, got: "${errText}"`);
    }

    await page.close();

    // Short password — new page to avoid hash-navigation reuse
    const page6b = await browser.newPage();
    await page6b.goto(`${SITE_URL}/admin/setup#access_token=FAKE2&type=invite`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);
    await page6b.waitForSelector('#pw', { timeout: 5000 });

    await page6b.type('#pw', 'sh');
    await page6b.type('#pw2', 'sh');
    await page6b.click('#submitBtn');
    await wait(400);

    const errText2 = await page6b.$eval('#errMsg', el => el.textContent);
    if (errText2.toLowerCase().includes('8') || errText2.toLowerCase().includes('least')) {
      ok('Short password validation works');
    } else {
      fail(`Expected length error, got: "${errText2}"`);
    }

    await page6b.close();
  } catch (err) {
    fail('Setup page validation', err);
  }

  // ─── Test 7: Rate limiting on login endpoint ─────────────────────────────
  console.log('\n7. Login rate limiting');
  try {
    let rateLimited = false;
    for (let i = 0; i < 8; i++) {
      const res = await nodeRequest(`${SITE_URL}/api/admin/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'ratelimit-test@test.com', password: 'wrong' }),
      });
      if (res.status === 429) { rateLimited = true; break; }
    }
    if (rateLimited) {
      ok('Login endpoint rate-limits after repeated failures');
    } else {
      fail('Rate limiting did not trigger after 8 attempts');
    }
  } catch (err) {
    fail('Rate limit test', err);
  }

  await browser.close();

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(`${'─'.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
})();
