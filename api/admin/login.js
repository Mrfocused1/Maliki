const crypto = require('crypto');
const { setSessionCookie, sameOrigin } = require('../_lib/auth');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

const constantEq = (a, b) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    console.error('login: ADMIN_PASSWORD not set');
    return json(res, 500, { error: 'server_misconfigured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const password = String((body || {}).password || '');

  if (!password || !constantEq(password, expected)) {
    return json(res, 401, { error: 'invalid_credentials' });
  }

  setSessionCookie(req, res);
  return json(res, 200, { ok: true });
};
