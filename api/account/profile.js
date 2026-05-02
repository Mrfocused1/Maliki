const { requireCustomer } = require('../_lib/account-auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const FIELDS = ['name', 'line1', 'line2', 'city', 'postal', 'country'];

module.exports = async (req, res) => {
  const user = await requireCustomer(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const rows = await supabaseFetch(`/customer_profiles?user_id=eq.${user.id}&limit=1`);
    const profile = rows[0] || {
      user_id: user.id,
      email: user.email,
      name: user.user_metadata?.name || '',
      line1: '', line2: '', city: '', postal: '', country: '',
    };
    return json(res, 200, profile);
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    for (const f of FIELDS) {
      if (typeof body[f] === 'string') patch[f] = body[f].trim().slice(0, 300);
    }

    const existing = await supabaseFetch(`/customer_profiles?user_id=eq.${user.id}&limit=1`);
    let result;
    if (existing[0]) {
      result = await supabaseFetch(`/customer_profiles?user_id=eq.${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } else {
      result = await supabaseFetch('/customer_profiles', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, email: user.email, ...patch }),
      });
    }
    return json(res, 200, result[0] || {});
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
