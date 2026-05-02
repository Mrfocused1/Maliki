// Simple in-memory IP rate limiter. Per Vercel function instance.
const buckets = new Map();
const MAX_BUCKETS = 5000;

const sweep = () => {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  if (buckets.size > MAX_BUCKETS) buckets.clear();
};

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function rateLimit(req, { key = 'default', max = 10, windowMs = 60000 } = {}) {
  sweep();
  const id = `${key}:${getIp(req)}`;
  const now = Date.now();
  const e = buckets.get(id) || { count: 0, reset: now + windowMs };
  if (now > e.reset) { e.count = 0; e.reset = now + windowMs; }
  e.count++;
  buckets.set(id, e);
  return e.count > max;
}

module.exports = { rateLimit, getIp };
