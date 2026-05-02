const { requireAdmin, sameOrigin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');
const { sendTemplatedEmail } = require('../_lib/mailer');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const maybeSendShipped = async (orderId) => {
  try {
    const [tplRows, orderRows] = await Promise.all([
      supabaseFetch('/email_templates?key=eq.shipped&limit=1'),
      supabaseFetch(`/orders?id=eq.${encodeURIComponent(orderId)}&select=customer_name,customer_email,number&limit=1`),
    ]);
    const tpl = tplRows?.[0];
    const order = orderRows?.[0];
    if (!tpl?.enabled || !order) return;
    await sendTemplatedEmail({
      template_key: 'shipped',
      subject: tpl.subject,
      body: tpl.body,
      vars: { name: order.customer_name, order_number: order.number },
      to: order.customer_email,
      to_name: order.customer_name,
      order_id: orderId,
    });
  } catch (err) {
    console.error('admin/orders: shipped email:', err.message);
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') return json(res, 405, { error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const id = String((req.body || {}).id || '');
  const status = String((req.body || {}).status || '');
  if (!id) return json(res, 400, { error: 'id_required' });
  if (!['pending', 'paid', 'fulfilled', 'refunded', 'cancelled', 'failed'].includes(status)) {
    return json(res, 400, { error: 'invalid_status' });
  }

  try {
    const updated = await supabaseFetch(`/orders?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (status === 'fulfilled') maybeSendShipped(id);
    return json(res, 200, { order: updated[0] || { id, status } });
  } catch (error) {
    console.error('admin/orders:', error.status || error.message);
    return json(res, 500, { error: 'order_sync_failed' });
  }
};
