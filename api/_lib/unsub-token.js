const crypto = require('crypto');

const secret = () =>
  process.env.STRIPE_WEBHOOK_SECRET ||
  process.env.SUPABASE_SERVICE_KEY ||
  'maliki-unsub';

const generate = (email) =>
  crypto
    .createHmac('sha256', secret())
    .update(String(email).toLowerCase())
    .digest('hex')
    .slice(0, 32);

const verify = (email, token) =>
  typeof token === 'string' &&
  token.length === 32 &&
  crypto.timingSafeEqual(
    Buffer.from(generate(email), 'hex'),
    Buffer.from(token, 'hex')
  );

const url = (email) =>
  `https://www.malikiatelier.com/api/unsubscribe?email=${encodeURIComponent(
    String(email).toLowerCase()
  )}&token=${generate(String(email).toLowerCase())}`;

module.exports = { generate, verify, url };
