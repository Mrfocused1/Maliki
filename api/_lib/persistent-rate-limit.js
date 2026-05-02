const { supabaseFetch } = require('./supabase');
const { getIp } = require('./rate-limit');

// Supabase-backed rate limiter — works across all Vercel lambda instances.
// Used only for high-value endpoints (admin login, forgot password) where
// per-instance in-memory limits can be bypassed by hitting different cold starts.
async function persistentRateLimit(req, { key, max, windowMs }) {
  const ip = getIp(req);
  const fullKey = `${key}:${ip}`;
  const windowSecs = Math.ceil(windowMs / 1000);
  try {
    const count = await supabaseFetch('/rpc/check_rate_limit', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ p_key: fullKey, p_window_secs: windowSecs }),
    });
    return count > max;
  } catch (err) {
    // Fail open — don't block all logins if Supabase is temporarily down
    console.error('persistent-rate-limit:', err.message);
    return false;
  }
}

module.exports = { persistentRateLimit };
