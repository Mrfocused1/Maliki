const { supabaseFetch } = require('./_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const rows = await supabaseFetch('/pages?select=slug,title,body&status=eq.published');
    const pages = Object.fromEntries((rows || []).map(p => [p.slug, { title: p.title, body: p.body }]));
    return json(res, 200, { pages });
  } catch (error) {
    console.error('pages:', error.status || error.message);
    return json(res, 500, { error: 'pages_unavailable' });
  }
};
