const { normalizeProduct, supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const { slug } = req.query;
  if (!slug) return json(res, 400, { error: 'slug_required' });

  try {
    const products = await supabaseFetch(
      `/products?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=*,product_images(url,alt,position)&limit=1`
    );

    if (!products || products.length === 0) return json(res, 404, { error: 'not_found' });

    return json(res, 200, normalizeProduct(products[0]));
  } catch (error) {
    console.error('products/[slug]:', error.status || error.message, error.data || '');
    return json(res, 500, { error: 'unavailable' });
  }
};
