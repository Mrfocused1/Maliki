const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (rateLimit(req, { key: 'newsletter', max: 5, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  try {
    await supabaseFetch('/subscribers', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        email,
        subscribed_at: new Date().toISOString(),
        source: 'popup',
        status: 'active',
      }),
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('newsletter:', err.message);
    return json(res, 500, { error: 'subscribe_failed' });
  }
};
