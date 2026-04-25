const sb = require('../_lib/supabase');
const { isAuthed, requireAdmin, sameOrigin } = require('../_lib/auth');
const { parseProduct } = require('../_lib/products');

const PUBLIC_FIELDS =
  'id,slug,title,description,price_cents,currency,images,stock,published,category,created_at';
const ADMIN_FIELDS = '*';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const idFilter = (id) => `id=eq.${encodeURIComponent(id)}`;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '');
  if (!UUID_RX.test(id)) return json(res, 400, { error: 'invalid_id' });

  const authed = isAuthed(req);

  if (req.method === 'GET') {
    const fields = authed ? ADMIN_FIELDS : PUBLIC_FIELDS;
    let path = `/products?select=${encodeURIComponent(fields)}&${idFilter(id)}&category=eq.ring`;
    if (!authed) path += '&published=eq.true';
    const r = await sb.get(path);
    if (!r.ok) return json(res, 502, { error: 'fetch_failed' });
    const row = Array.isArray(r.data) ? r.data[0] : null;
    if (!row) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { product: row });
  }

  if (req.method === 'PATCH') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!requireAdmin(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    let patch;
    try { patch = parseProduct(body); }
    catch (e) { return json(res, 400, { error: e.message }); }
    patch.updated_at = new Date().toISOString();

    const r = await sb.update('products', idFilter(id), patch);
    if (!r.ok) {
      console.error('product patch failed', r.status, r.data);
      const status = r.status === 409 ? 409 : 502;
      return json(res, status, { error: status === 409 ? 'slug_taken' : 'update_failed' });
    }
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!row) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { product: row });
  }

  if (req.method === 'DELETE') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!requireAdmin(req, res)) return;

    const r = await sb.remove('products', idFilter(id));
    if (!r.ok) {
      console.error('product delete failed', r.status, r.data);
      return json(res, 502, { error: 'delete_failed' });
    }
    return json(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return json(res, 405, { error: 'method_not_allowed' });
};
