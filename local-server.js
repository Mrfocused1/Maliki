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

process.env.ADMIN_PASSWORD ||= '12345';
process.env.ADMIN_SECRET ||= 'local-preview-secret-change-before-production';
process.env.SUPABASE_URL ||= 'https://yvjjtbejnicwckzmcadj.supabase.co';

const root = __dirname;
const port = Number(process.env.PORT || 8000);

const api = {
  '/api/admin/login': require('./api/admin/login'),
  '/api/admin/data': require('./api/admin/data'),
  '/api/admin/logout': require('./api/admin/logout'),
  '/api/admin/orders': require('./api/admin/orders'),
  '/api/admin/products': require('./api/admin/products'),
  '/api/admin/session': require('./api/admin/session'),
  '/api/admin/settings': require('./api/admin/settings'),
  '/api/catalog': require('./api/catalog'),
  '/api/config': require('./api/config'),
  '/api/pages': require('./api/pages'),
  '/api/site-mode': require('./api/site-mode'),
  '/api/stripe-webhook': require('./api/stripe-webhook'),
  '/api/checkout': require('./api/checkout'),
  '/api/contact': require('./api/contact'),
  '/api/discount': require('./api/discount'),
  '/api/notify': require('./api/notify'),
  '/api/track': require('./api/track'),
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

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      if ((req.headers['content-type'] || '').includes('application/json')) {
        try {
          return resolve(JSON.parse(raw));
        } catch {
          return resolve({});
        }
      }
      resolve(raw);
    });
    req.on('error', reject);
  });

const runApi = async (handler, req, res) => {
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

    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': req.url.startsWith('/admin') ? 'no-store' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
};

const resolveStaticPath = (pathname) => {
  let requestPath = decodeURIComponent(pathname);
  if (requestPath.startsWith('/shop/') && !requestPath.endsWith('.html')) {
    return path.join(root, 'shop', 'product.html');
  }
  if (requestPath.endsWith('/')) requestPath += 'index.html';

  const filePath = path.normalize(path.join(root, requestPath));
  if (!filePath.startsWith(root)) return null;
  return filePath;
};

http
  .createServer(async (req, res) => {
    try {
      const { pathname } = parse(req.url);
      const handler = api[pathname];
      if (handler) return await runApi(handler, req, res);

      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const filePath = resolveStaticPath(pathname);
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
    console.log(`Admin password: ${process.env.ADMIN_PASSWORD}`);
  });
