const { supabaseFetch } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  try {
    const rows = await supabaseFetch('/settings?select=value&section=eq.homepage&limit=1');
    const homepage = rows?.[0]?.value || null;
    res.statusCode = 200;
    res.end(JSON.stringify({ homepage }));
  } catch (error) {
    console.error('homepage:', error.status || error.message, error.data || '');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'settings_unavailable' }));
  }
};
