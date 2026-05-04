const { requireCustomer } = require('../_lib/account-auth');
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

const MAX_WISHLIST = 50;

module.exports = async (req, res) => {
  const user = await requireCustomer(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const rows = await supabaseFetch(
        `/customer_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=wishlist&limit=1`
      );
      const raw = rows[0]?.wishlist;
      const wishlist = Array.isArray(raw) ? raw : [];
      return json(res, 200, { wishlist });
    } catch (err) {
      console.error('wishlist GET:', err.message);
      return json(res, 500, { error: 'fetch_failed' });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const slug   = String(body.slug   || '').trim();
    const action = String(body.action || '').trim();

    if (!slug)                          return json(res, 400, { error: 'slug_required' });
    if (action !== 'add' && action !== 'remove') {
      return json(res, 400, { error: 'action_must_be_add_or_remove' });
    }

    try {
      const rows = await supabaseFetch(
        `/customer_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=wishlist&limit=1`
      );
      const rawList = rows[0]?.wishlist;
      let wishlist = Array.isArray(rawList) ? rawList : [];

      if (action === 'add') {
        if (!wishlist.includes(slug)) {
          wishlist = [...wishlist, slug].slice(-MAX_WISHLIST);
        }
      } else {
        wishlist = wishlist.filter((s) => s !== slug);
      }

      // Upsert the updated wishlist
      const existing = rows[0];
      if (existing) {
        await supabaseFetch(`/customer_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ wishlist, updated_at: new Date().toISOString() }),
        });
      } else {
        await supabaseFetch('/customer_profiles', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            wishlist,
            updated_at: new Date().toISOString(),
          }),
        });
      }

      return json(res, 200, { wishlist });
    } catch (err) {
      console.error('wishlist POST:', err.message);
      return json(res, 500, { error: 'update_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
