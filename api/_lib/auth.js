const crypto = require('crypto');

const COOKIE_NAME = 'mk_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
};

// TEMPORARY: if ADMIN_SECRET env var isn't set, generate a random secret per
// cold start. Sessions invalidate on every restart (~minutes of idle), but it
// keeps things working until the env var is configured. Set ADMIN_SECRET in
// Vercel for stable sessions.
let _ephemeralSecret = null;
const secret = () => {
  const s = process.env.ADMIN_SECRET;
  if (s && s.length >= 16) return s;
  if (!_ephemeralSecret) _ephemeralSecret = crypto.randomBytes(32).toString('hex');
  return _ephemeralSecret;
};

const sign = (payloadStr) =>
  b64url(crypto.createHmac('sha256', secret()).update(payloadStr).digest());

const constantEq = (a, b) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

const issueToken = () => {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const p = b64url(payload);
  return `${p}.${sign(p)}`;
};

const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [p, s] = parts;
  if (!constantEq(s, sign(p))) return false;
  try {
    const { exp } = JSON.parse(fromB64url(p).toString('utf8'));
    return typeof exp === 'number' && Math.floor(Date.now() / 1000) < exp;
  } catch {
    return false;
  }
};

const parseCookies = (req) => {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(/;\s*/).forEach((kv) => {
    if (!kv) return;
    const i = kv.indexOf('=');
    if (i < 0) return;
    out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
  });
  return out;
};

const isHttps = (req) => {
  const proto = req.headers['x-forwarded-proto'];
  if (proto) return proto === 'https';
  const host = req.headers.host || '';
  return !host.startsWith('localhost') && !host.startsWith('127.');
};

const setSessionCookie = (req, res) => {
  const token = issueToken();
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isHttps(req)) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
};

const clearSessionCookie = (req, res) => {
  const flags = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (isHttps(req)) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
};

const isAuthed = (req) => {
  const token = parseCookies(req)[COOKIE_NAME];
  return verifyToken(token);
};

const requireAdmin = (req, res) => {
  if (!isAuthed(req)) {
    res.status(401).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: 'unauthorized' }));
    return false;
  }
  return true;
};

const sameOrigin = (req) => {
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const expected = [`https://${host}`, `http://${host}`];
  return (
    (origin && expected.includes(origin)) ||
    (referer && expected.some((p) => referer.startsWith(p + '/') || referer === p))
  );
};

module.exports = {
  COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  isAuthed,
  requireAdmin,
  sameOrigin,
};
