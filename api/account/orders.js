const { requireCustomer } = require('../_lib/account-auth');
const { supabaseFetch, normalizeOrder } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  const user = await requireCustomer(req, res);
  if (!user) return;

  const orders = await supabaseFetch(
    `/orders?customer_email=eq.${encodeURIComponent(user.email)}&order=placed_at.desc&limit=50&select=*,order_items(*)`
  );
  return json(res, 200, { orders: (orders || []).map(normalizeOrder) });
};
