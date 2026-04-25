const sb = require('./_lib/supabase');
const { isAuthed, requireAdmin, sameOrigin } = require('./_lib/auth');
const { sanitiseSlug, parseProduct } = require('./_lib/products');

const PUBLIC_FIELDS =
  'id,slug,title,description,price_cents,currency,images,stock,published,category,created_at';
const ADMIN_FIELDS = '*';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  const authed = isAuthed(req);

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = url.searchParams.get('slug');
    const fields = authed ? ADMIN_FIELDS : PUBLIC_FIELDS;

    let path = `/products?select=${encodeURIComponent(fields)}&category=eq.ring&order=created_at.desc`;
    if (!authed) path += '&published=eq.true';
    if (slug) path += `&slug=eq.${encodeURIComponent(sanitiseSlug(slug))}`;

    const r = await sb.get(path);
    if (!r.ok) {
      console.error('products list failed', r.status, r.data);
      return json(res, 502, { error: 'fetch_failed' });
    }
    return json(res, 200, { products: r.data || [] });
  }

  if (req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!requireAdmin(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    let row;
    try { row = parseProduct(body, { creating: true }); }
    catch (e) { return json(res, 400, { error: e.message }); }

    const r = await sb.insert('products', row);
    if (!r.ok) {
      console.error('products insert failed', r.status, r.data);
      const status = r.status === 409 ? 409 : 502;
      return json(res, status, { error: status === 409 ? 'slug_taken' : 'insert_failed' });
    }
    return json(res, 201, { product: Array.isArray(r.data) ? r.data[0] : r.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method_not_allowed' });
};
