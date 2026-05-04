const { requireAdmin, sameOrigin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const uid = () => `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const slugify = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  if (req.method === 'GET') {
    const rows = await supabaseFetch('/pages?select=*&order=updated_at.desc').catch(() => []);
    return json(res, 200, { pages: rows });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = String(body.title || '').trim().slice(0, 300);
    const slug = slugify(body.slug || body.title);
    const pageBody = String(body.body || '').slice(0, 100000);
    const status = ['published', 'draft'].includes(body.status) ? body.status : 'published';

    if (!title) return json(res, 400, { error: 'title_required' });
    if (!slug) return json(res, 400, { error: 'slug_required' });

    try {
      const created = await supabaseFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          id: uid(),
          slug,
          title,
          body: pageBody,
          status,
          updated_at: new Date().toISOString(),
        }),
      });
      return json(res, 200, { page: created[0] || null });
    } catch (err) {
      if (err.data?.code === '23505') return json(res, 409, { error: 'slug_in_use' });
      console.error('admin/pages POST:', err.message);
      return json(res, 500, { error: 'page_save_failed' });
    }
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'id_required' });

    const patch = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 300);
    if (body.slug !== undefined) patch.slug = slugify(body.slug);
    if (body.body !== undefined) patch.body = String(body.body).slice(0, 100000);
    if (body.status !== undefined && ['published', 'draft'].includes(body.status)) patch.status = body.status;

    try {
      const updated = await supabaseFetch(`/pages?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return json(res, 200, { page: updated[0] || { id, ...patch } });
    } catch (err) {
      if (err.data?.code === '23505') return json(res, 409, { error: 'slug_in_use' });
      console.error('admin/pages PATCH:', err.message);
      return json(res, 500, { error: 'page_save_failed' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || (req.body || {}).id || '').trim();
    if (!id) return json(res, 400, { error: 'id_required' });

    try {
      await supabaseFetch(`/pages?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error('admin/pages DELETE:', err.message);
      return json(res, 500, { error: 'page_delete_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
