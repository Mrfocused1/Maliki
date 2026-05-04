const crypto = require('crypto');

const secret = () => {
  const s = process.env.UNSUB_TOKEN_SECRET;
  if (!s) throw new Error('unsub_token_secret_missing: set UNSUB_TOKEN_SECRET in env');
  return s;
};

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

const url = (email) => {
  const base = (process.env.SITE_URL || 'https://www.malikiatelier.com').replace(/\/$/, '');
  return `${base}/api/unsubscribe?email=${encodeURIComponent(
    String(email).toLowerCase()
  )}&token=${generate(String(email).toLowerCase())}`;
};

module.exports = { generate, verify, url };
