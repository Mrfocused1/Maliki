const { supabaseFetch } = require('./_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const rows = await supabaseFetch('/settings?section=eq.general&select=value&limit=1');
    const mode = rows?.[0]?.value?.site_mode || 'coming_soon';
    return json(res, 200, { mode });
  } catch (error) {
    console.error('site-mode:', error.status || error.message);
    return json(res, 200, { mode: 'coming_soon' });
  }
};
