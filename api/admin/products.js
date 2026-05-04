const { requireAdmin, sameOrigin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const productColumns = [
  'id', 'slug', 'title', 'subtitle', 'description', 'price_cents',
  'currency', 'category', 'metal', 'stone', 'hand_size', 'stock',
  'published', 'featured',
];

const productPayload = (data) => {
  const out = {};
  for (const key of productColumns) {
    if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
  }
  out.currency = String(out.currency || 'GBP').toUpperCase().slice(0, 3);
  out.price_cents = Math.max(0, Math.round(Number(out.price_cents) || 0));
  out.stock = out.stock === '' || out.stock == null ? null : Math.max(0, Math.floor(Number(out.stock) || 0));
  out.published = out.published !== false;
  out.featured = !!out.featured;
  return out;
};

const syncImages = async (productId, images = [], title = '') => {
  // Skip base64 data URIs — they're too large for Supabase and come from local uploads.
  const urls = (images || []).filter((u) => u && !u.startsWith('data:'));

  await supabaseFetch(`/product_images?product_id=eq.${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });

  if (!urls.length) return [];

  const rows = urls.slice(0, 8).map((url, position) => ({
    product_id: productId,
    url,
    alt: title,
    position,
  }));

  return await supabaseFetch('/product_images', {
    method: 'POST',
    body: JSON.stringify(rows),
  });
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  try {
    if (req.method === 'POST') {
      const data = req.body || {};
      const product = productPayload(data);
      const created = await supabaseFetch('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      await syncImages(product.id, data.images, product.title);
      return json(res, 200, { product: created[0] || product });
    }

    if (req.method === 'PATCH') {
      const id = String((req.body || {}).id || '');
      if (!id) return json(res, 400, { error: 'id_required' });
      const product = productPayload(req.body || {});
      delete product.id;
      const updated = await supabaseFetch(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(product),
      });
      await syncImages(id, req.body.images, product.title);
      return json(res, 200, { product: updated[0] || { id, ...product } });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || (req.body || {}).id || '');
      if (!id) return json(res, 400, { error: 'id_required' });
      await supabaseFetch(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error('admin/products:', error.status || error.message);
    return json(res, 500, { error: 'product_sync_failed' });
  }
};
