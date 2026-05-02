const { setSessionCookie, sameOrigin } = require('../_lib/auth');
const { rateLimit } = require('../_lib/rate-limit');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  if (rateLimit(req, { key: 'admin_login', max: 5, windowMs: 15 * 60 * 1000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('login: SUPABASE_URL or SUPABASE_ANON_KEY not set');
    return json(res, 500, { error: 'server_misconfigured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = String((body || {}).email || '').trim().toLowerCase();
  const password = String((body || {}).password || '');

  if (!email || !password) {
    return json(res, 401, { error: 'invalid_credentials' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!r.ok) return json(res, 401, { error: 'invalid_credentials' });

    const data = await r.json();

    if (data.user?.user_metadata?.role !== 'admin') {
      return json(res, 403, { error: 'not_admin' });
    }

    setSessionCookie(req, res);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('login:', err.message);
    return json(res, 500, { error: 'login_failed' });
  }
};
