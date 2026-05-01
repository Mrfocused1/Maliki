const { requireAdmin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') return json(res, 405, { error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const id = String((req.body || {}).id || '');
  const status = String((req.body || {}).status || '');
  if (!id) return json(res, 400, { error: 'id_required' });
  if (!['pending', 'paid', 'fulfilled', 'refunded', 'cancelled'].includes(status)) {
    return json(res, 400, { error: 'invalid_status' });
  }

  try {
    const updated = await supabaseFetch(`/orders?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return json(res, 200, { order: updated[0] || { id, status } });
  } catch (error) {
    console.error('admin/orders:', error.status || error.message, error.data || '');
    return json(res, 500, { error: 'order_sync_failed' });
  }
};
