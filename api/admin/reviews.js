const { requireAdmin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const parseBody = (req) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    try {
      const reviews = await supabaseFetch('/product_reviews?order=created_at.desc');
      return json(res, 200, { reviews });
    } catch (err) {
      console.error('admin/reviews GET:', err.message);
      return json(res, 500, { error: 'fetch_failed' });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const id      = String(body.id      || '').trim();
    const approved = body.approved;

    if (!id)                    return json(res, 400, { error: 'id_required' });
    if (typeof approved !== 'boolean') return json(res, 400, { error: 'approved_must_be_boolean' });

    try {
      await supabaseFetch(`/product_reviews?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ approved, updated_at: new Date().toISOString() }),
      });
      return json(res, 200, { success: true });
    } catch (err) {
      console.error('admin/reviews PATCH:', err.message);
      return json(res, 500, { error: 'update_failed' });
    }
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const id = String(body.id || '').trim();

    if (!id) return json(res, 400, { error: 'id_required' });

    try {
      await supabaseFetch(`/product_reviews?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return json(res, 200, { success: true });
    } catch (err) {
      console.error('admin/reviews DELETE:', err.message);
      return json(res, 500, { error: 'delete_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
