const { requireAdmin, sameOrigin } = require('../_lib/auth');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB decoded
const BUCKET = 'maliki-media';

const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const ensureBucket = async (baseUrl, key) => {
  const res = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 200 = created, 409 = already exists — both are fine
  if (!res.ok && res.status !== 409) {
    console.error('ensureBucket failed:', res.status);
  }
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const { data, contentType } = req.body || {};

  if (!data || typeof data !== 'string') return json(res, 400, { error: 'missing_data' });

  const mimeType = (contentType || 'image/jpeg').split(';')[0].trim();
  if (!ALLOWED_TYPES.includes(mimeType)) return json(res, 400, { error: 'invalid_type' });

  // Strip optional data-URL prefix
  const base64 = data.replace(/^data:[^;]+;base64,/, '');

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return json(res, 400, { error: 'invalid_base64' });
  }
  if (buffer.length > MAX_BYTES) return json(res, 413, { error: 'image_too_large' });

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return json(res, 500, { error: 'storage_not_configured' });

  const ext = EXT_MAP[mimeType] || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  try {
    await ensureBucket(supabaseUrl, key);

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${filename}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      console.error('admin/upload storage error:', uploadRes.status, text);
      return json(res, 500, { error: 'upload_failed' });
    }

    const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filename}`;
    return json(res, 200, { url });
  } catch (err) {
    console.error('admin/upload:', err.message);
    return json(res, 500, { error: 'upload_failed' });
  }
};
