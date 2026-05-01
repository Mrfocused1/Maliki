const { requireAdmin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const templates = await supabaseFetch('/email_templates?select=*&order=key').catch(() => []);
    return json(res, 200, { templates });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const key = String(body.key || '').trim();
    if (!key) return json(res, 400, { error: 'key_required' });

    const patch = { updated_at: new Date().toISOString() };
    if (body.subject !== undefined) patch.subject = String(body.subject);
    if (body.body !== undefined) patch.body = String(body.body);
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;

    try {
      const updated = await supabaseFetch(
        `/email_templates?key=eq.${encodeURIComponent(key)}`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      );
      return json(res, 200, { template: updated[0] || null });
    } catch (err) {
      console.error('admin/emails PATCH:', err.message);
      return json(res, 500, { error: 'update_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
