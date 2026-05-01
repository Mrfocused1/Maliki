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

  const { section, value } = req.body || {};
  if (!section || typeof value !== 'object' || value === null) {
    return json(res, 400, { error: 'invalid_payload' });
  }

  try {
    await supabaseFetch('/settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ section, value }),
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('admin/settings:', error.status || error.message);
    return json(res, 500, { error: 'settings_sync_failed' });
  }
};
