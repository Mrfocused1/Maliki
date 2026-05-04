const { normalizeProduct, supabaseFetch } = require('./_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const [products, settingsRows] = await Promise.all([
      supabaseFetch('/products?select=*,product_images(url,alt,position)&published=eq.true&order=created_at.asc'),
      supabaseFetch('/settings?select=section,value&section=eq.homepage&limit=1').catch(() => []),
    ]);

    const homepage = settingsRows?.[0]?.value || null;
    return json(res, 200, { products: products.map(normalizeProduct), homepage });
  } catch (error) {
    console.error('catalog:', error.status || error.message, error.data || '');
    return json(res, 500, { error: 'catalog_unavailable' });
  }
};
