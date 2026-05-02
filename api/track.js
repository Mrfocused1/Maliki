const { supabaseFetch } = require('./_lib/supabase');

const trim = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async (req, res) => {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  res.end();

  if (req.method !== 'POST') return;

  const body = req.body || {};
  const country = req.headers['x-vercel-ip-country'] || '';
  const ua = req.headers['user-agent'] || '';

  const row = {
    path:        trim(body.path, 500) || '/',
    referrer:    trim(body.referrer, 500),
    session_id:  trim(body.session_id, 64),
    visitor_id:  trim(body.visitor_id, 64),
    user_agent:  trim(ua, 500),
    country:     trim(country, 8),
    screen:      trim(body.screen, 32),
    utm_source:  trim(body.utm_source, 80),
    utm_medium:  trim(body.utm_medium, 80),
    utm_campaign:trim(body.utm_campaign, 120),
  };

  supabaseFetch('/page_views', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  }).catch((err) => console.error('track:', err.message));
};
