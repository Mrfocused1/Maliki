const sb = require('./_lib/supabase');
const { isAuthed, requireAdmin, sameOrigin } = require('./_lib/auth');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const RESEND_BASE = 'https://api.resend.com';

const sendNotification = async (inquiry, productTitle) => {
  const { RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_FROM || !NOTIFY_TO) return;
  try {
    await fetch(`${RESEND_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: NOTIFY_TO,
        reply_to: inquiry.email,
        subject: `Purchase inquiry — ${productTitle || 'ring'}`,
        html: `
          <p><strong>${productTitle || 'Untitled ring'}</strong></p>
          <p>From: ${inquiry.name ? `${inquiry.name} &lt;${inquiry.email}&gt;` : inquiry.email}</p>
          ${inquiry.message ? `<p style="white-space:pre-wrap">${String(inquiry.message).replace(/[<>]/g, '')}</p>` : ''}
        `,
      }),
    });
  } catch (e) {
    console.error('inquiry notification failed', e);
  }
};

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const r = await sb.get(
      `/inquiries?select=*,product:products(id,slug,title)&order=created_at.desc&limit=200`
    );
    if (!r.ok) {
      console.error('inquiries list failed', r.status, r.data);
      return json(res, 502, { error: 'fetch_failed' });
    }
    return json(res, 200, { inquiries: r.data || [] });
  }

  if (req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

    const product_id = body.product_id ? String(body.product_id) : null;
    if (product_id && !UUID_RX.test(product_id)) {
      return json(res, 400, { error: 'invalid_product' });
    }

    const row = {
      product_id,
      email,
      name: body.name ? String(body.name).trim().slice(0, 200) : null,
      message: body.message ? String(body.message).slice(0, 4000) : null,
    };

    const r = await sb.insert('inquiries', row);
    if (!r.ok) {
      console.error('inquiry insert failed', r.status, r.data);
      return json(res, 502, { error: 'insert_failed' });
    }

    let title = null;
    if (product_id) {
      const p = await sb.get(
        `/products?select=title&id=eq.${encodeURIComponent(product_id)}&limit=1`
      );
      if (p.ok && Array.isArray(p.data) && p.data[0]) title = p.data[0].title;
    }
    await sendNotification(row, title);

    return json(res, 201, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method_not_allowed' });
};
