const { sameOrigin } = require('./_lib/auth');
const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (rateLimit(req, { key: 'discount', max: 20, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const body = req.body || {};
  const code = String(body.code || '').trim().toUpperCase();
  const subtotal_cents = Math.max(0, Math.floor(Number(body.subtotal_cents) || 0));

  if (!code) return json(res, 400, { error: 'code_required' });

  try {
    const rows = await supabaseFetch(
      `/discounts?code=eq.${encodeURIComponent(code)}&select=*&limit=1`
    );
    const discount = rows?.[0];

    if (!discount) return json(res, 404, { error: 'invalid_code' });
    if (discount.status !== 'active') return json(res, 400, { error: 'code_inactive' });

    const now = new Date().toISOString();
    if (discount.starts_at && discount.starts_at > now)
      return json(res, 400, { error: 'code_not_started' });
    if (discount.ends_at && discount.ends_at < now)
      return json(res, 400, { error: 'code_expired' });
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit)
      return json(res, 400, { error: 'code_exhausted' });
    if (subtotal_cents < discount.minimum_cents)
      return json(res, 400, {
        error: 'minimum_not_met',
        minimum_cents: discount.minimum_cents,
      });

    let discount_cents;
    if (discount.type === 'percent') {
      discount_cents = Math.round(subtotal_cents * Number(discount.value) / 100);
    } else {
      discount_cents = Math.min(Number(discount.value), subtotal_cents);
    }

    const label =
      discount.type === 'percent'
        ? `${Number(discount.value)}% off`
        : `£${(Number(discount.value) / 100).toFixed(2).replace(/\.00$/, '')} off`;

    return json(res, 200, { valid: true, discount_cents, label, code: discount.code });
  } catch (err) {
    console.error('discount:', err.message);
    return json(res, 500, { error: 'server_error' });
  }
};
