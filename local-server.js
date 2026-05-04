const fs = require('fs');
const http = require('http');
const path = require('path');
const { parse } = require('url');

const loadEnvFile = (name) => {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');

process.env.ADMIN_SECRET ||= 'local-dev-only-not-for-production-use-set-env';

// Auto-auth helpers (local dev only — never shipped to production)
const { COOKIE_NAME, setSessionCookie, isAuthed } = require('./api/_lib/auth');
const injectAdminAuth = (req) => {
  if (!isAuthed(req)) {
    const raw = req.headers.cookie || '';
    const { issueToken } = (() => {
      const crypto = require('crypto');
      const b64url = (buf) =>
        Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const sign = (p) =>
        b64url(crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(p).digest());
      const issueToken = () => {
        const p = b64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 43200 }));
        return `${p}.${sign(p)}`;
      };
      return { issueToken };
    })();
    const token = issueToken();
    const extra = `${COOKIE_NAME}=${token}`;
    req.headers.cookie = raw ? `${raw}; ${extra}` : extra;
  }
};
process.env.SUPABASE_URL ||= 'https://yvjjtbejnicwckzmcadj.supabase.co';

const root = __dirname;
const port = Number(process.env.PORT || 8000);

const api = {
  '/api/admin/analytics': require('./api/admin/analytics'),
  '/api/admin/campaign': require('./api/admin/campaign'),
  '/api/admin/data': require('./api/admin/data'),
  '/api/admin/emails': require('./api/admin/emails'),
  '/api/admin/forgot-password': require('./api/admin/forgot-password'),
  '/api/admin/invite': require('./api/admin/invite'),
  '/api/admin/login': require('./api/admin/login'),
  '/api/admin/logout': require('./api/admin/logout'),
  '/api/admin/orders': require('./api/admin/orders'),
  '/api/admin/pages': require('./api/admin/pages'),
  '/api/admin/products': require('./api/admin/products'),
  '/api/admin/restock': require('./api/admin/restock'),
  '/api/admin/reviews': require('./api/admin/reviews'),
  '/api/admin/session': require('./api/admin/session'),
  '/api/admin/settings': require('./api/admin/settings'),
  '/api/account/orders': require('./api/account/orders'),
  '/api/account/profile': require('./api/account/profile'),
  '/api/account/referral': require('./api/account/referral'),
  '/api/account/wishlist': require('./api/account/wishlist'),
  '/api/catalog': require('./api/catalog'),
  '/api/homepage': require('./api/homepage'),
  '/api/checkout': require('./api/checkout'),
  '/api/config': require('./api/config'),
  '/api/contact': require('./api/contact'),
  '/api/discount': require('./api/discount'),
  '/api/newsletter': require('./api/newsletter'),
  '/api/notify': require('./api/notify'),
  '/api/pages': require('./api/pages'),
  '/api/restock-alert': require('./api/restock-alert'),
  '/api/reviews': require('./api/reviews'),
  '/api/robots': require('./api/robots'),
  '/api/site-mode': require('./api/site-mode'),
  '/api/sitemap': require('./api/sitemap'),
  '/api/stripe-webhook': require('./api/stripe-webhook'),
  '/api/track': require('./api/track'),
  '/api/unsubscribe': require('./api/unsubscribe'),
};

const types = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

const runApi = async (handler, req, res) => {
  // Auto-authenticate all admin API calls locally
  if (req.url && req.url.startsWith('/api/admin')) injectAdminAuth(req);
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const rawBody = Buffer.concat(chunks).toString('utf8');
  req.rawBody = rawBody;
  if (rawBody) {
    if ((req.headers['content-type'] || '').includes('application/json')) {
      try { req.body = JSON.parse(rawBody); } catch { req.body = {}; }
    } else {
      req.body = rawBody;
    }
  } else {
    req.body = {};
  }
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (body) => { if (!res.writableEnded) res.end(body); };
  await handler(req, res);
};

const sendFile = (req, res, filePath) => {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }

    const headers = {
      'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': req.url.startsWith('/admin') ? 'no-store' : 'no-cache',
    };
    // Set admin session cookie when serving admin pages locally
    if (req.url && req.url.startsWith('/admin') && path.extname(filePath) === '.html') {
      injectAdminAuth(req);
      const tok = (req.headers.cookie || '').match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
      if (tok) headers['Set-Cookie'] = `${COOKIE_NAME}=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
};

const resolveStaticPath = (pathname, req) => {
  let requestPath = decodeURIComponent(pathname);

  // Mirror vercel.json rewrites
  if (requestPath === '/admin/setup') {
    return path.join(root, 'admin', 'setup.html');
  }
  if (requestPath === '/shipping') {
    req.query = { ...req.query, slug: 'shipping-and-returns' };
    return path.join(root, 'page', 'index.html');
  }
  if (requestPath === '/care') {
    req.query = { ...req.query, slug: 'care' };
    return path.join(root, 'page', 'index.html');
  }
  const pageSlugMatch = requestPath.match(/^\/page\/([^/]+)$/);
  if (pageSlugMatch) {
    req.query = { ...req.query, slug: pageSlugMatch[1] };
    return path.join(root, 'page', 'index.html');
  }

  if (requestPath.startsWith('/shop/') && !requestPath.endsWith('.html')) {
    return path.join(root, 'shop', 'product.html');
  }
  if (requestPath.endsWith('/')) requestPath += 'index.html';

  const filePath = path.normalize(path.join(root, requestPath));
  if (!filePath.startsWith(root)) return null;

  // Serve directory index when path has no extension and directory exists
  if (!path.extname(filePath)) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return filePath;
};

http
  .createServer(async (req, res) => {
    try {
      const { pathname, query } = parse(req.url, true);
      req.query = query;
      const handler = api[pathname];
      if (handler) return await runApi(handler, req, res);

      // Dynamic product slug route: /api/products/:slug
      const productSlugMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
      if (productSlugMatch) {
        req.query = { ...req.query, slug: productSlugMatch[1] };
        return await runApi(require('./api/products/[slug]'), req, res);
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const filePath = resolveStaticPath(pathname, req);
      if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Forbidden');
      }
      return sendFile(req, res, filePath);
    } catch (error) {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'local_server_error' }));
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Serving Maliki at http://127.0.0.1:${port}`);
    console.log('Admin login: use Supabase credentials configured in your environment.');
  });
