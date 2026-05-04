const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');
const { url: unsubUrl } = require('./_lib/unsub-token');
const { sendTemplatedEmail } = require('./_lib/mailer');

const RESEND_BASE = 'https://api.resend.com';
const { EMAIL_RX } = require('./_lib/email');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};


module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const expected = [`https://${host}`, `http://${host}`];
  const isSameOrigin =
    (origin && expected.includes(origin)) ||
    (referer && expected.some((p) => referer.startsWith(p + '/') || referer === p));
  if (!isSameOrigin) return json(res, 403, { error: 'forbidden' });

  if (rateLimit(req, { key: 'newsletter', max: 5, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  try {
    const subId = `sub_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await supabaseFetch('/subscribers', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        id: subId,
        email,
        subscribed_at: new Date().toISOString(),
        source: 'popup',
        status: 'subscribed',
      }),
    });

    // Send welcome email using the admin-editable 'welcome' template
    const { RESEND_API_KEY, NOTIFY_FROM } = process.env;
    if (RESEND_API_KEY && NOTIFY_FROM) {
      supabaseFetch('/email_templates?key=eq.welcome&limit=1')
        .then((rows) => {
          const tpl = rows?.[0];
          if (!tpl?.enabled) return;
          return sendTemplatedEmail({
            template_key: 'welcome',
            subject: tpl.subject,
            body: tpl.body,
            vars: { name: '', email },
            to: email,
          });
        })
        .catch((e) => console.error('newsletter: welcome email failed', e.message));
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('newsletter:', err.message);
    return json(res, 500, { error: 'subscribe_failed' });
  }
};
