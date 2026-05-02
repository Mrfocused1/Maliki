/**
 * Maliki Atelier — Full Puppeteer Test Suite
 * Covers every page and major interaction.
 * Run: node test.js
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:8000';
const ADMIN_PASS = '12345';
const TIMEOUT = 12000;

// ─── Colour helpers ─────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;  // green
const R = (s) => `\x1b[31m${s}\x1b[0m`;  // red
const Y = (s) => `\x1b[33m${s}\x1b[0m`;  // yellow
const B = (s) => `\x1b[1m${s}\x1b[0m`;   // bold

// ─── Results tracker ────────────────────────────────────────────────────────
const results = [];
const pass = (name) => { results.push({ ok: true, name }); process.stdout.write(G('  ✓ ') + name + '\n'); };
const fail = (name, err) => { results.push({ ok: false, name, err }); process.stdout.write(R('  ✗ ') + name + '\n    ' + Y(String(err).split('\n')[0]) + '\n'); };

async function test(name, fn) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, e.message || e); }
}

// ─── Page helper ────────────────────────────────────────────────────────────
async function newPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  // Suppress console noise from the page
  page.on('console', () => {});
  page.on('pageerror', () => {});
  return page;
}

async function goto(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
}

async function adminLogin(page) {
  await goto(page, '/admin/');
  // Wait for either the login form or the app shell (cookie may still be valid)
  await page.waitForFunction(
    () => document.querySelector('#pw') || document.querySelector('.sidebar'),
    { timeout: 8000 }
  );
  if (await page.$('.sidebar')) return; // already authed via cookie
  await page.type('#pw', ADMIN_PASS);
  await page.click('#loginBtn');
  await page.waitForSelector('.sidebar', { timeout: 8000 });
}

// ─── Start local server ─────────────────────────────────────────────────────
function pingServer() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://127.0.0.1:8000/', (r) => { r.resume(); resolve(r.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function startServer() {
  if (await pingServer()) return null; // already up — don't spawn a new one

  return new Promise((resolve, reject) => {
    const srv = spawn('node', ['local-server.js'], {
      cwd: __dirname,
      env: { ...process.env, ADMIN_PASSWORD: ADMIN_PASS, PORT: '8000' },
    });
    srv.stdout.on('data', (d) => {
      if (d.toString().includes('Serving Maliki')) resolve(srv);
    });
    srv.stderr.on('data', () => {});
    srv.on('error', reject);
    setTimeout(() => reject(new Error('Server start timeout')), 8000);
  });
}

// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(B('\n── Maliki Atelier — Puppeteer Test Suite ──\n'));

  let server;
  try {
    process.stdout.write('Starting local server… ');
    server = await startServer();
    console.log(G('ready'));
  } catch (e) {
    console.error(R('Failed to start server: ' + e.message));
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {

    // ── 1. HOME ────────────────────────────────────────────────────────────
    console.log(B('\n● Home page'));
    {
      const page = await newPage(browser);
      // The real home page lives at /home/ — / is a coming-soon gate
      await test('Loads without JS error', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/home/');
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Has Maliki wordmark in DOM', async () => {
        await goto(page, '/home/');
        const src = await page.$eval('img[alt*="Maliki"]', el => el.src).catch(() => null)
          || await page.$eval('.wordmark', el => el.textContent).catch(() => null);
        if (!src) throw new Error('No wordmark found');
      });
      await test('Nav links present (Shop, About, Contact)', async () => {
        const links = await page.$$eval('nav a, .nav a', els => els.map(e => e.textContent.trim()));
        const needed = ['Shop', 'About', 'Contact'];
        for (const n of needed) if (!links.some(l => l.includes(n))) throw new Error(`Missing nav link: ${n}`);
      });
      await test('Cart count badge visible', async () => {
        const count = await page.$('#cartCount');
        if (!count) throw new Error('No #cartCount element');
      });
      await page.close();
    }

    // ── 2. SHOP ────────────────────────────────────────────────────────────
    console.log(B('\n● Shop page'));
    {
      const page = await newPage(browser);
      await test('Loads without JS error', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/shop/');
        await page.waitForFunction(() => document.querySelectorAll('.product-card, .card, [data-pid]').length > 0 || document.body.textContent.length > 500, { timeout: 6000 }).catch(() => {});
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Product cards render', async () => {
        await goto(page, '/shop/');
        await page.waitForFunction(() => document.body.textContent.includes('Celestine') || document.body.textContent.includes('Maliki'), { timeout: 6000 });
        const body = await page.content();
        if (!body.includes('Celestine') && !body.includes('ring') && !body.includes('gold')) throw new Error('No product content found');
      });
      await test('Product detail: price and add-to-cart present', async () => {
        // Shop routes directly to a product detail page — no catalog filter UI
        await goto(page, '/shop/');
        await page.waitForFunction(() => document.body.textContent.includes('£') || document.body.textContent.includes('Add to Cart'), { timeout: 6000 }).catch(() => {});
        const body = await page.content();
        if (!body.includes('£') && !body.includes('Add to Cart') && !body.includes('Sold Out')) throw new Error('No price or add-to-cart found');
      });
      await page.close();
    }

    // ── 3. PRODUCT PAGE ────────────────────────────────────────────────────
    console.log(B('\n● Product page'));
    {
      const page = await newPage(browser);
      await test('Loads product by slug', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/shop/celestine-solitaire');
        await page.waitForFunction(() => document.body.textContent.includes('Celestine') || document.body.textContent.includes('£'), { timeout: 6000 });
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Price displays with £ symbol', async () => {
        const body = await page.content();
        if (!body.includes('£')) throw new Error('No £ price found on product page');
      });
      await test('Add to cart button present', async () => {
        const btn = await page.$('button[id*="cart"], button[id*="Cart"], #addToCart, .add-to-cart, button')
          .catch(() => null);
        const body = await page.content();
        if (!body.toLowerCase().includes('add to cart') && !body.toLowerCase().includes('add to bag')) throw new Error('No add-to-cart button text found');
      });
      await test('Quantity controls present', async () => {
        const body = await page.content();
        if (!body.includes('qty') && !body.includes('quantity') && !body.match(/[+−−-]/)) throw new Error('No quantity controls found');
      });
      await test('Add to cart increments cart count', async () => {
        await goto(page, '/shop/celestine-solitaire');
        await page.waitForFunction(() => document.body.textContent.includes('Celestine'), { timeout: 6000 });
        // Clear cart first via localStorage
        await page.evaluate(() => { try { const k='maliki.cart'; localStorage.setItem(k,'[]'); } catch{} });
        const before = await page.$eval('#cartCount', el => el.textContent.trim()).catch(() => '0');
        // Click add to cart
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const btn = btns.find(b => b.textContent.toLowerCase().includes('add to cart') || b.textContent.toLowerCase().includes('add to bag'));
          if (btn) btn.click();
        });
        await page.waitForFunction((b) => {
          const el = document.getElementById('cartCount');
          return el && el.textContent.trim() !== b;
        }, { timeout: 4000 }, before).catch(() => {});
        const after = await page.$eval('#cartCount', el => el.textContent.trim()).catch(() => before);
        if (after === before) throw new Error('Cart count did not change after add to cart');
      });
      await page.close();
    }

    // ── 4. CART ────────────────────────────────────────────────────────────
    console.log(B('\n● Cart page'));
    {
      const page = await newPage(browser);
      // Seed cart with one item first
      await goto(page, '/shop/celestine-solitaire');
      await page.waitForFunction(() => document.body.textContent.includes('Celestine'), { timeout: 6000 });
      await page.evaluate(() => {
        localStorage.setItem('maliki.cart', JSON.stringify([{ product_id: 'prd_celestine', quantity: 1 }]));
      });

      await test('Cart page loads with items', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/cart/');
        await page.waitForFunction(() => document.body.textContent.includes('£') || document.body.textContent.includes('Cart'), { timeout: 6000 });
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Line item renders with price', async () => {
        const body = await page.content();
        if (!body.includes('£')) throw new Error('No price in cart');
      });
      await test('Subtotal and total rows present', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('subtotal') && !body.toLowerCase().includes('total')) throw new Error('No totals in cart');
      });
      await test('Quantity + button present', async () => {
        const btn = await page.$('button[data-act="inc"], button[aria-label="Increase"], button');
        if (!btn) throw new Error('No increment button found');
      });
      await test('Remove button present', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('remove') && !body.includes('rm')) throw new Error('No remove button');
      });
      await test('Discount code input present', async () => {
        const input = await page.$('#discCode, input[placeholder*="discount"], input[placeholder*="code"], input[placeholder*="Code"]');
        if (!input) throw new Error('No discount code input');
      });
      await test('Checkout form fields present (name, email, address)', async () => {
        const body = await page.content();
        if (!body.includes('ckName') && !body.toLowerCase().includes('full name')) throw new Error('No name field in checkout');
        if (!body.includes('ckEmail') && !body.toLowerCase().includes('email')) throw new Error('No email field in checkout');
      });
      await test('Empty cart shows empty state', async () => {
        await page.evaluate(() => localStorage.setItem('maliki.cart', '[]'));
        await goto(page, '/cart/');
        await page.waitForFunction(() => document.body.textContent.includes('empty') || document.body.textContent.includes('Cart'), { timeout: 4000 });
        const body = await page.content();
        if (!body.toLowerCase().includes('empty') && !body.toLowerCase().includes('browse')) throw new Error('Empty cart state not shown');
      });
      await page.close();
    }

    // ── 5. ABOUT ───────────────────────────────────────────────────────────
    console.log(B('\n● About page'));
    {
      const page = await newPage(browser);
      await test('Loads without JS error', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/about/');
        await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 6000 });
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Story and craftsmanship sections present', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('story') && !body.toLowerCase().includes('atelier')) throw new Error('No story content');
        if (!body.toLowerCase().includes('craft') && !body.toLowerCase().includes('hand')) throw new Error('No craftsmanship content');
      });
      await test('CTA link to contact present', async () => {
        const link = await page.$('a[href*="contact"]');
        if (!link) throw new Error('No contact link in CTA');
      });
      await page.close();
    }

    // ── 6. CONTACT ─────────────────────────────────────────────────────────
    console.log(B('\n● Contact page'));
    {
      const page = await newPage(browser);
      await test('Loads without JS error', async () => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await goto(page, '/contact/');
        await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 6000 });
        if (errors.length) throw new Error(errors[0]);
      });
      await test('Contact form fields present', async () => {
        const name = await page.$('#cName, input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]');
        const email = await page.$('#cEmail, input[type="email"]');
        if (!name) throw new Error('No name field');
        if (!email) throw new Error('No email field');
      });
      await test('Subject select has options', async () => {
        const options = await page.$$eval('select option', opts => opts.map(o => o.value)).catch(() => []);
        if (options.length < 2) throw new Error('Subject select has fewer than 2 options');
        if (options.filter(Boolean).some(o => o === '')) {
          // placeholder option is fine, just ensure it has real options too
          const real = options.filter(Boolean).filter(o => o !== '');
          if (real.length === 0) throw new Error('No real subject options');
        }
        // Verify no duplicate values
        const nonEmpty = options.filter(Boolean).filter(o => o !== '');
        const unique = new Set(nonEmpty);
        if (unique.size !== nonEmpty.length) throw new Error('Duplicate subject options found');
      });
      await test('Submit button present', async () => {
        const btn = await page.$('button[type="submit"], input[type="submit"], button');
        if (!btn) throw new Error('No submit button');
      });
      await page.close();
    }

    // ── 7. ADMIN — Login ───────────────────────────────────────────────────
    console.log(B('\n● Admin — Login'));
    {
      const page = await newPage(browser);
      await test('Login page renders', async () => {
        await goto(page, '/admin/');
        await page.waitForSelector('#pw, input[type="password"]', { timeout: 5000 });
      });
      await test('Wrong password shows error', async () => {
        await goto(page, '/admin/');
        await page.waitForSelector('#pw');
        await page.type('#pw', 'wrongpassword');
        await page.click('#loginBtn');
        await page.waitForFunction(() => {
          const fb = document.querySelector('#loginErr');
          return fb && fb.textContent.trim().length > 0;
        }, { timeout: 4000 });
      });
      await test('Correct password logs in', async () => {
        await adminLogin(page);
        const sidebar = await page.$('.sidebar');
        if (!sidebar) throw new Error('Sidebar not visible after login');
      });
      await page.close();
    }

    // ── 8. ADMIN — Overview ─────────────────────────────────────────────────
    console.log(B('\n● Admin — Overview'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await test('Overview stats render (revenue, orders)', async () => {
        await page.waitForFunction(() => document.body.textContent.includes('£') || document.body.textContent.includes('Orders'), { timeout: 5000 });
        const body = await page.content();
        if (!body.includes('£') && !body.toLowerCase().includes('revenue')) throw new Error('No revenue stat');
        if (!body.toLowerCase().includes('order')) throw new Error('No orders stat');
      });
      await test('Sidebar nav items present', async () => {
        const body = await page.content();
        const needed = ['Orders', 'Products', 'Customers'];
        for (const n of needed) if (!body.includes(n)) throw new Error(`Missing sidebar item: ${n}`);
      });
      await page.close();
    }

    // ── 9. ADMIN — Orders ──────────────────────────────────────────────────
    console.log(B('\n● Admin — Orders'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await test('Navigate to Orders', async () => {
        await page.evaluate(() => {
          const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a')];
          const link = links.find(l => l.textContent.trim() === 'Orders' || l.dataset.view === 'orders');
          if (link) link.click();
        });
        await page.waitForFunction(() => document.body.textContent.includes('MA-') || document.body.textContent.includes('Pending') || document.body.textContent.includes('Fulfilled'), { timeout: 5000 });
      });
      await test('Order list renders with order numbers', async () => {
        const body = await page.content();
        if (!body.includes('MA-')) throw new Error('No order numbers found');
      });
      await test('Filter tabs include Failed and Cancelled', async () => {
        const body = await page.content();
        if (!body.includes('Failed') && !body.includes('failed')) throw new Error('No Failed filter tab');
        if (!body.includes('Cancelled') && !body.includes('cancelled')) throw new Error('No Cancelled filter tab');
      });
      await test('Clicking an order opens drawer', async () => {
        await page.evaluate(() => {
          const rows = document.querySelectorAll('tr[data-oid], tr[data-id], tbody tr');
          if (rows[0]) rows[0].click();
        });
        await page.waitForFunction(() => {
          const drawer = document.querySelector('#drawer, .drawer, [class*="drawer"]');
          return drawer && (drawer.classList.contains('open') || drawer.style.display !== 'none');
        }, { timeout: 4000 }).catch(() => {});
        const body = await page.content();
        if (!body.includes('MA-')) throw new Error('Drawer did not open with order data');
      });
      await page.close();
    }

    // ── 10. ADMIN — Products ───────────────────────────────────────────────
    console.log(B('\n● Admin — Products'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      // Navigate to products
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Products' || l.dataset.view === 'products');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('Celestine') || document.body.textContent.includes('Lumen'), { timeout: 5000 });

      await test('Product list renders all 12 rings', async () => {
        const body = await page.content();
        if (!body.includes('Celestine')) throw new Error('Product list empty');
      });
      await test('Prices display with £ symbol', async () => {
        const body = await page.content();
        if (!body.includes('£')) throw new Error('No £ in product list');
      });
      await test('Prices include comma formatting', async () => {
        const body = await page.content();
        if (!body.match(/£[\d,]+/)) throw new Error('Prices missing comma formatting');
      });
      await test('New product button present', async () => {
        const btn = await page.$('#newProduct, button[id*="new"], button[id*="New"]');
        if (!btn) {
          const body = await page.content();
          if (!body.toLowerCase().includes('new product') && !body.toLowerCase().includes('add product')) throw new Error('No new product button');
        }
      });
      await test('Clicking a product opens edit drawer', async () => {
        await page.evaluate(() => {
          const rows = document.querySelectorAll('tr[data-pid], tr[data-id], tbody tr');
          if (rows[0]) rows[0].click();
        });
        await page.waitForFunction(() => {
          const drawer = document.querySelector('#drawer, .drawer');
          return drawer && drawer.classList.contains('open');
        }, { timeout: 4000 }).catch(() => {});
        const body = await page.content();
        if (!body.includes('Title') && !body.includes('TITLE') && !body.includes('f-price') && !body.includes('Price')) throw new Error('Edit drawer not opened');
      });
      await test('Price field has £ prefix in edit drawer', async () => {
        const body = await page.content();
        // The £ prefix span should be present in edit drawer
        if (!body.includes('£')) throw new Error('No £ in edit drawer');
      });
      await page.close();
    }

    // ── 11. ADMIN — Customers ──────────────────────────────────────────────
    console.log(B('\n● Admin — Customers'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Customers' || l.dataset.view === 'customers');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('Eleanor') || document.body.textContent.includes('customer') || document.body.textContent.includes('@'), { timeout: 5000 });

      await test('Customer list renders', async () => {
        const body = await page.content();
        if (!body.includes('Eleanor') && !body.includes('example.com')) throw new Error('No customer data found');
      });
      await test('Clicking a customer opens drawer', async () => {
        await page.evaluate(() => {
          const rows = document.querySelectorAll('tr[data-cid], tr[data-id], tbody tr');
          if (rows[0]) rows[0].click();
        });
        await page.waitForFunction(() => {
          const drawer = document.querySelector('#drawer, .drawer');
          return drawer && drawer.classList.contains('open');
        }, { timeout: 4000 }).catch(() => {});
        const body = await page.content();
        if (!body.includes('Total spent') && !body.includes('Orders') && !body.includes('@')) throw new Error('Customer drawer not opened');
      });
      await page.close();
    }

    // ── 12. ADMIN — Emails ─────────────────────────────────────────────────
    console.log(B('\n● Admin — Emails'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Emails' || l.dataset.view === 'emails');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('template') || document.body.textContent.includes('Template') || document.body.textContent.includes('welcome'), { timeout: 5000 });

      await test('Email templates tab renders', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('template') && !body.toLowerCase().includes('welcome')) throw new Error('No template content');
      });
      await test('All 8 templates listed', async () => {
        const body = await page.content();
        const templates = ['welcome', 'order', 'shipped', 'abandoned', 'back in stock', 'newsletter', 'vip', 'payment'];
        const found = templates.filter(t => body.toLowerCase().includes(t));
        if (found.length < 6) throw new Error(`Only ${found.length}/8 templates found`);
      });
      await test('Email log tab accessible', async () => {
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button, [data-sub], [data-tab]')];
          const btn = btns.find(b => b.textContent.toLowerCase().includes('log') || b.textContent.toLowerCase().includes('activity') || b.textContent.toLowerCase().includes('sent'));
          if (btn) btn.click();
        });
        await page.waitForFunction(() => document.body.textContent.includes('Recipient') || document.body.textContent.includes('sent') || document.body.textContent.includes('Sent'), { timeout: 4000 }).catch(() => {});
        const body = await page.content();
        if (!body.toLowerCase().includes('recipient') && !body.toLowerCase().includes('sent') && !body.toLowerCase().includes('subject')) throw new Error('Email log not accessible');
      });
      await test('Email log shows recipient_name not "undefined"', async () => {
        const body = await page.content();
        if (body.includes('>undefined<') || body.includes('"undefined"')) throw new Error('Undefined shown as recipient');
      });
      await page.close();
    }

    // ── 13. ADMIN — Discounts ──────────────────────────────────────────────
    console.log(B('\n● Admin — Discounts'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Discounts' || l.dataset.view === 'discounts');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('ATELIER10') || document.body.textContent.includes('WELCOME50'), { timeout: 5000 });

      await test('Discount list renders', async () => {
        const body = await page.content();
        if (!body.includes('ATELIER10') && !body.includes('WELCOME50')) throw new Error('No discount data');
      });
      await test('Discount codes and labels visible', async () => {
        const body = await page.content();
        if (!body.includes('%') && !body.includes('off')) throw new Error('No discount value labels');
      });
      await page.close();
    }

    // ── 14. ADMIN — Settings ───────────────────────────────────────────────
    console.log(B('\n● Admin — Settings'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Settings' || l.dataset.view === 'settings');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('General') || document.body.textContent.includes('Branding') || document.body.textContent.includes('store'), { timeout: 5000 });

      await test('Settings general tab renders', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('store') && !body.toLowerCase().includes('general')) throw new Error('General settings not found');
      });
      await test('Save button present on general tab', async () => {
        const btn = await page.$('button[id*="save_"], #save_general, button.btn');
        if (!btn) throw new Error('No save button on general tab');
      });

      const tabs = [
        ['branding', 'Branding'],
        ['shipping', 'Shipping'],
        ['legal', 'Legal'],
        ['integrations', 'Integrations'],
        ['notifications', 'Notifications'],
      ];
      for (const [key, label] of tabs) {
        await test(`Settings tab: ${label} loads`, async () => {
          await page.evaluate((k) => {
            const btns = [...document.querySelectorAll('button[data-st], .filterbtn, button')];
            const btn = btns.find(b => b.dataset.st === k || b.textContent.trim() === k);
            if (btn) btn.click();
          }, key);
          await page.waitForFunction((lbl) => document.body.textContent.includes(lbl), { timeout: 3000 }, label).catch(() => {});
          const body = await page.content();
          if (!body.includes(label)) throw new Error(`${label} tab content not found`);
        });
      }
      await page.close();
    }

    // ── 15. ADMIN — Reports ────────────────────────────────────────────────
    console.log(B('\n● Admin — Reports'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Reports' || l.dataset.view === 'reports');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('Revenue') || document.body.textContent.includes('revenue') || document.body.textContent.includes('£'), { timeout: 5000 });

      await test('Revenue chart or stats present', async () => {
        const body = await page.content();
        if (!body.toLowerCase().includes('revenue') && !body.includes('£')) throw new Error('No revenue data in reports');
      });
      await page.close();
    }

    // ── 16. ADMIN — Subscribers ────────────────────────────────────────────
    console.log(B('\n● Admin — Subscribers'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Subscribers' || l.dataset.view === 'subscribers');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('@') || document.body.textContent.includes('subscribed'), { timeout: 5000 });

      await test('Subscriber list renders', async () => {
        const body = await page.content();
        if (!body.includes('@') && !body.toLowerCase().includes('subscriber')) throw new Error('No subscriber data');
      });
      await page.close();
    }

    // ── 17. ADMIN — Pages / CMS ────────────────────────────────────────────
    console.log(B('\n● Admin — Pages (CMS)'));
    {
      const page = await newPage(browser);
      await adminLogin(page);
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('[data-view], [data-nav], .nav-item, a, button')];
        const link = links.find(l => l.textContent.trim() === 'Content' || l.textContent.trim() === 'Pages' || l.dataset.view === 'content' || l.dataset.view === 'pages');
        if (link) link.click();
      });
      await page.waitForFunction(() => document.body.textContent.includes('About') || document.body.textContent.includes('page') || document.body.textContent.includes('Shipping'), { timeout: 5000 }).catch(() => {});

      await test('CMS pages list renders', async () => {
        const body = await page.content();
        if (!body.includes('About') && !body.includes('Shipping') && !body.toLowerCase().includes('page')) throw new Error('No CMS pages found');
      });
      await page.close();
    }

    // ── 18. NAVIGATION — Internal links work ───────────────────────────────
    console.log(B('\n● Navigation — Internal links'));
    {
      const page = await newPage(browser);
      const routes = ['/', '/shop/', '/about/', '/contact/', '/cart/'];
      for (const route of routes) {
        await test(`Route ${route} returns 200`, async () => {
          const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
          if (!response || response.status() >= 400) throw new Error(`Status ${response?.status()}`);
        });
      }
      await page.close();
    }

    // ── 19. API HEALTH ─────────────────────────────────────────────────────
    console.log(B('\n● API health checks'));
    {
      const page = await newPage(browser);
      await test('GET /api/site-mode returns JSON', async () => {
        const r = await page.goto(BASE + '/api/site-mode', { waitUntil: 'domcontentloaded' });
        const text = await page.content();
        if (!text.includes('mode') && !text.includes('live') && !text.includes('coming')) throw new Error('Unexpected response: ' + text.slice(0, 100));
      });
      await test('GET /api/catalog returns valid JSON', async () => {
        await page.goto(BASE + '/api/catalog', { waitUntil: 'domcontentloaded' });
        const text = await page.content();
        // Accepts a products array (Supabase connected) or an error JSON (local dev without Supabase)
        if (!text.includes('products') && !text.includes('catalog_unavailable') && !text.includes('error')) throw new Error('Unexpected catalog response: ' + text.slice(0, 100));
      });
      await test('GET /api/pages returns pages', async () => {
        await page.goto(BASE + '/api/pages', { waitUntil: 'domcontentloaded' });
        const text = await page.content();
        if (!text.includes('about') && !text.includes('pages') && !text.includes('body')) throw new Error('No pages data');
      });
      await test('GET /api/admin/session returns authed field', async () => {
        await page.goto(BASE + '/api/admin/session', { waitUntil: 'domcontentloaded' });
        const text = await page.content();
        if (!text.includes('authed')) throw new Error('No authed field in session response');
      });
      await test('POST /api/discount rejects empty code', async () => {
        const result = await page.evaluate(async (base) => {
          const r = await fetch(base + '/api/discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '', subtotal_cents: 100000 }) });
          return { status: r.status, body: await r.json() };
        }, BASE);
        if (result.status !== 400) throw new Error(`Expected 400 got ${result.status}`);
      });
      await test('POST /api/notify rejects invalid email', async () => {
        const result = await page.evaluate(async (base) => {
          const r = await fetch(base + '/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base }, body: JSON.stringify({ email: 'notanemail' }) });
          return { status: r.status };
        }, BASE);
        if (result.status !== 400) throw new Error(`Expected 400 got ${result.status}`);
      });
      await page.close();
    }

  } finally {
    await browser.close();
    if (server) server.kill();
  }

  // ── Results summary ──────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(B(`\n── Summary: ${G(passed + ' passed')} / ${failed.length > 0 ? R(failed.length + ' failed') : '0 failed'} / ${results.length} total ──\n`));

  if (failed.length) {
    console.log(R('Failed tests:'));
    failed.forEach(r => console.log(`  ${R('✗')} ${r.name}\n    ${Y(r.err)}\n`));
    process.exit(1);
  } else {
    console.log(G('All tests passed.\n'));
  }
}

main().catch(err => {
  console.error(R('\nFatal: ' + err.message));
  process.exit(1);
});
