const { supabaseFetch } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.statusCode = 204;
  res.end();

  if (req.method !== 'POST') return;

  const body = req.body || {};
  const path = String(body.path || '/').slice(0, 500);
  const referrer = String(body.referrer || '').slice(0, 500);

  supabaseFetch('/page_views', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ path, referrer }),
  }).catch((err) => console.error('track:', err.message));
};
