const { supabaseFetch } = require('./_lib/supabase');
const { rateLimit } = require('./_lib/rate-limit');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const parseBody = (req) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (rateLimit(req, { key: 'restock-alert', max: 5, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const body = parseBody(req);
  const product_id = String(body.product_id || '').trim();
  const email      = String(body.email      || '').trim().toLowerCase();

  if (!product_id)           return json(res, 400, { error: 'product_id_required' });
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  try {
    const alertId = `rst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await supabaseFetch('/restock_alerts', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: alertId,
        product_id,
        email,
        notified: false,
        created_at: new Date().toISOString(),
      }),
    });

    return json(res, 200, { success: true });
  } catch (err) {
    // Gracefully handle unique constraint violations (23505)
    if (err.data?.code === '23505') {
      return json(res, 200, { success: true });
    }
    console.error('restock-alert POST:', err.message);
    return json(res, 500, { error: 'insert_failed' });
  }
};
