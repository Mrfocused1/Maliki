const crypto = require('crypto');

const toForm = (obj, prefix = '') => {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') {
      parts.push(toForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join('&');
};

const stripeFetch = async (path, options = {}) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('stripe_env_missing');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message || 'stripe_error'), { status: res.status, data });
  return data;
};

const createPaymentIntent = ({ amount, currency, metadata = {} }) =>
  stripeFetch('/payment_intents', {
    method: 'POST',
    body: toForm({
      amount,
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    }),
  });

const verifyWebhook = (rawBody, signature, secret) => {
  const parts = Object.fromEntries(signature.split(',').map(s => s.split('=')));
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parts.v1 || '', 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf))
    throw new Error('invalid_stripe_signature');
  const ageSecs = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (ageSecs > 300) {
    console.error(`webhook_expired: timestamp delta ${Math.round(ageSecs)}s`);
    throw new Error('webhook_expired');
  }
  return JSON.parse(rawBody);
};

module.exports = { createPaymentIntent, verifyWebhook };
