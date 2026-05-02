const { requireCustomer } = require('../_lib/account-auth');
const { supabaseFetch } = require('../_lib/supabase');

const SITE_URL = 'https://www.malikiatelier.com';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const generateCode = (email) => {
  const prefix = (email.split('@')[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MAL-${prefix}${suffix}`;
};

module.exports = async (req, res) => {
  const user = await requireCustomer(req, res);
  if (!user) return;

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const rows = await supabaseFetch(
      `/customer_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=referral_code&limit=1`
    );
    const profile = rows[0];

    // Return existing code if present
    if (profile?.referral_code) {
      const code = profile.referral_code;
      return json(res, 200, {
        code,
        link: `${SITE_URL}/shop?ref=${encodeURIComponent(code)}`,
      });
    }

    // Generate a new code
    const code = generateCode(user.email || '');

    if (profile) {
      await supabaseFetch(`/customer_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ referral_code: code, updated_at: new Date().toISOString() }),
      });
    } else {
      await supabaseFetch('/customer_profiles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          referral_code: code,
          updated_at: new Date().toISOString(),
        }),
      });
    }

    return json(res, 200, {
      code,
      link: `${SITE_URL}/shop?ref=${encodeURIComponent(code)}`,
    });
  } catch (err) {
    console.error('referral GET:', err.message);
    return json(res, 500, { error: 'fetch_failed' });
  }
};
