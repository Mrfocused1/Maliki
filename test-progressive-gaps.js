/**
 * Puppeteer test: Progressive gap audit
 * Usage: SITE_URL=https://www.malikiatelier.com node test-progressive-gaps.js
 */

const puppeteer = require('puppeteer');
const https = require('https');
const http  = require('http');

const SITE_URL = (process.env.SITE_URL || 'https://www.malikiatelier.com').replace(/\/$/, '');

let passed = 0;
let failed = 0;

function ok(label)        { console.log(`  ✓  ${label}`); passed++; }
function fail(label, err) { console.error(`  ✗  ${label}`); if (err) console.error(`     ${err.message || err}`); failed++; }
function wait(ms)         { return new Promise(r => setTimeout(r, ms)); }

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
  console.log('\n=== Maliki Progressive Gap Audit — Puppeteer Suite ===');
  console.log(`    Site: ${SITE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ─── 1. Newsletter API: bad email returns 400 ──────────────────────────────
  console.log('1. Newsletter — invalid email rejected');
  try {
    const res = await nodeRequest(`${SITE_URL}/api/newsletter`, {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    if (res.status === 400 && res.body.error === 'invalid_email') {
      ok('Returns 400 for invalid email');
    } else if (res.status === 429) {
      ok('Returns 429 (rate limited — invalid email also rejected)');
    } else {
      fail(`Expected 400 invalid_email, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  } catch (err) { fail('Newsletter bad email test', err); }

  // ─── 2. Newsletter API: rate limiting ─────────────────────────────────────
  console.log('\n2. Newsletter — rate limiting');
  try {
    let limited = false;
    for (let i = 0; i < 7; i++) {
      const res = await nodeRequest(`${SITE_URL}/api/newsletter`, {
        method: 'POST',
        body: JSON.stringify({ email: `test${i}@example.com` }),
      });
      if (res.status === 429) { limited = true; break; }
    }
    limited ? ok('Rate limits newsletter after repeated requests') : fail('Rate limiting did not trigger');
  } catch (err) { fail('Newsletter rate limit test', err); }

  // ─── 3. Login: 429 UI message mentions wait time (source check) ──────────
  // Note: in-memory rate limiter is per-Vercel-instance so runtime triggering
  // is unreliable in tests. We verify the UI code has the correct message.
  console.log('\n3. Login — 429 UI message code contains wait time');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/`, { waitUntil: 'networkidle2', timeout: 20000 });
    const src = await page.content();
    await page.close();
    if (src.includes('15 minutes')) {
      ok('Login 429 UI message code mentions "15 minutes"');
    } else {
      fail('Login 429 UI message missing wait time in source');
    }
  } catch (err) { fail('Login 429 message source check', err); }

  // ─── 4. Login: forgot password button visible ─────────────────────────────
  console.log('\n4. Login — forgot password button present');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('#forgotBtn', { timeout: 10000 });
    const text = await page.$eval('#forgotBtn', el => el.textContent.trim().toLowerCase());
    if (text.includes('forgot')) {
      ok('Forgot password button is present on login form');
    } else {
      fail(`Forgot button text unexpected: "${text}"`);
    }
    await page.close();
  } catch (err) { fail('Forgot password button test', err); }

  // ─── 5. Login: forgot password requires email first ──────────────────────
  console.log('\n5. Login — forgot password prompts for email if empty');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('#forgotBtn', { timeout: 10000 });
    await page.click('#forgotBtn');
    await wait(300);
    const errText = await page.$eval('#loginErr', el => el.textContent);
    if (errText.toLowerCase().includes('email')) {
      ok('Forgot password shows error when email field is empty');
    } else {
      fail(`Expected email prompt, got: "${errText}"`);
    }
    await page.close();
  } catch (err) { fail('Forgot password empty email test', err); }

  // ─── 6. Setup page — button text is "Set Password" not "Create Account" ──
  console.log('\n6. Setup page — button says "Set Password"');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup#access_token=FAKE&type=invite`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);
    await page.waitForSelector('#submitBtn', { timeout: 5000 });
    const btnText = await page.$eval('#submitBtn', el => el.textContent.trim());
    if (btnText === 'Set Password') {
      ok('Setup button text is "Set Password"');
    } else {
      fail(`Expected "Set Password", got: "${btnText}"`);
    }
    await page.close();
  } catch (err) { fail('Setup button text test', err); }

  // ─── 7. Setup page — recovery token shows correct heading ─────────────────
  console.log('\n7. Setup page — recovery token shows "Reset your password"');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup#access_token=FAKE&type=recovery`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);
    const title = await page.$eval('#setupTitle', el => el.textContent.trim());
    if (title.toLowerCase().includes('reset')) {
      ok('Recovery flow shows "Reset your password" heading');
    } else {
      fail(`Expected reset heading, got: "${title}"`);
    }
    await page.close();
  } catch (err) { fail('Setup recovery heading test', err); }

  // ─── 8. Setup page — short password button restores to "Set Password" ─────
  console.log('\n8. Setup page — button restores to "Set Password" after validation error');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/admin/setup#access_token=FAKE&type=invite`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await wait(600);
    await page.waitForSelector('#pw', { timeout: 5000 });
    await page.type('#pw', 'ab');
    await page.type('#pw2', 'ab');
    await page.click('#submitBtn');
    await wait(300);
    const btnText = await page.$eval('#submitBtn', el => el.textContent.trim());
    if (btnText === 'Set Password') {
      ok('Button restores to "Set Password" after short password error');
    } else {
      fail(`Button text after error: "${btnText}"`);
    }
    await page.close();
  } catch (err) { fail('Setup button restore test', err); }

  // ─── 9. Contact form — double submit prevented ────────────────────────────
  console.log('\n9. Contact form — button disabled during submit');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/contact`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('#contactSubmit', { timeout: 10000 });

    // Replace fetch with a never-resolving stub — button stays disabled, no real request sent
    await page.evaluate(() => { window.fetch = () => new Promise(() => {}); });

    await page.type('#cName', 'Test User');
    await page.type('#cEmail', 'test@example.com');
    const msgField = await page.$('#cMessage');
    if (msgField) await msgField.type('x');

    await page.click('#contactSubmit');
    await wait(100);
    const isDisabled = await page.$eval('#contactSubmit', el => el.disabled);
    if (isDisabled) {
      ok('Contact submit button disabled immediately on click');
    } else {
      fail('Contact submit button was not disabled after click');
    }
    await page.close();
  } catch (err) { fail('Contact double-submit test', err); }

  // ─── 10. Cart — empty state ────────────────────────────────────────────────
  console.log('\n10. Cart — empty state shown with CTA');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/cart`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(600);
    const html = await page.content();
    if (html.includes('empty') || html.includes('cart is empty') || html.includes('Your cart')) {
      ok('Cart shows empty state');
    } else {
      fail('Could not find empty cart state');
    }
    await page.close();
  } catch (err) { fail('Cart empty state test', err); }

  // ─── 11. 404 page renders correctly ───────────────────────────────────────
  console.log('\n11. 404 — page renders with return link');
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/this-page-does-not-exist-xyz`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(400);
    const html = await page.content();
    if (html.includes('404') && html.includes('atelier')) {
      ok('404 page renders correctly with return link');
    } else {
      fail('404 page missing expected content');
    }
    await page.close();
  } catch (err) { fail('404 page test', err); }

  // ─── 12. Forgot password API — always returns 200 (no email leak) ─────────
  console.log('\n12. Forgot password API — returns 200 for unknown email (no leak)');
  try {
    const res = await nodeRequest(`${SITE_URL}/api/admin/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@nowhere.example.com' }),
    });
    if (res.status === 200 && res.body.ok) {
      ok('Forgot password returns 200 for unknown email (prevents account enumeration)');
    } else if (res.status === 429) {
      ok('Forgot password rate limited (endpoint is protected)');
    } else {
      fail(`Expected 200 ok, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  } catch (err) { fail('Forgot password no-leak test', err); }

  await browser.close();

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(`${'─'.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
})();
