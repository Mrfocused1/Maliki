const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');

const RESEND_BASE = 'https://api.resend.com';

const { EMAIL_RX } = require('./_lib/email');

const uid = () => `em_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

const resend = async (path, body) => {
  const r = await fetch(`${RESEND_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
};

const logEmail = ({ template_key, recipient_email, recipient_name, subject, status }) => {
  supabaseFetch('/email_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: uid(),
      template_key,
      recipient_email,
      recipient_name: recipient_name || '',
      subject,
      order_id: null,
      status,
      sent_at: new Date().toISOString(),
    }),
  }).catch((e) => console.error('contact: log failed', e.message));
};

const escHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const notificationHtml = ({ name, email, subject, message, source }) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#f5ecda;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.52em;text-transform:uppercase;color:rgba(245,236,218,0.62);">
              Maliki&nbsp;Atelier &middot; New Enquiry
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;width:64px;height:1px;background:linear-gradient(90deg, transparent, rgba(217,176,112,0.45), transparent);line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                style="border:1px solid rgba(217,176,112,0.22);background:rgba(20,19,17,0.6);">
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(217,176,112,0.15);">
                    <span style="font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);">Name</span><br>
                    <span style="font-size:16px;color:#f5ecda;">${escHtml(name)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(217,176,112,0.15);">
                    <span style="font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);">Email</span><br>
                    <span style="font-size:16px;color:#e8c488;">${escHtml(email)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(217,176,112,0.15);">
                    <span style="font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);">Subject</span><br>
                    <span style="font-size:16px;color:#f5ecda;">${escHtml(subject || 'General enquiry')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid rgba(217,176,112,0.15);">
                    <span style="font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);">Source</span><br>
                    <span style="font-size:14px;color:rgba(245,236,218,0.75);">${escHtml(source || '—')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;">
                    <span style="font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);display:block;margin-bottom:10px;">Message</span>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(245,236,218,0.88);white-space:pre-wrap;">${escHtml(message)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:8px;font-size:11px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(245,236,218,0.42);">
              Reply directly to this email to respond to ${escHtml(name)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const notificationText = ({ name, email, subject, message, source }) =>
  [
    'MALIKI ATELIER — NEW ENQUIRY',
    '',
    `From:    ${name}`,
    `Email:   ${email}`,
    `Subject: ${subject || 'General enquiry'}`,
    `Source:  ${source || '—'}`,
    '',
    'Message:',
    message,
    '',
    '—',
    'Reply directly to this email to respond.',
  ].join('\n');

const confirmationHtml = (name, subject) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Maliki Atelier — Your enquiry</title>
</head>
<body style="margin:0;padding:0;background:#0a0908;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;color:#f5ecda;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr>
      <td align="center" style="padding:64px 24px 48px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">
              By&nbsp;Appointment&nbsp;Only
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 4px;">
              <div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);margin:0 auto;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 20px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:21px;line-height:1.55;letter-spacing:0.06em;color:#f5ecda;">
              Your message has been received.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;line-height:1.7;letter-spacing:0.04em;color:rgba(245,236,218,0.82);">
              Dear ${escHtml(name)}, thank you for your enquiry regarding <em>${escHtml(subject || 'your commission')}</em>.<br/>
              A member of the atelier will be in touch shortly.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 0 0;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">
              Maliki&nbsp;Atelier &middot; By&nbsp;Appointment
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const confirmationText = (name, subject) =>
  [
    'MALIKI ATELIER',
    '',
    'Your message has been received.',
    '',
    `Dear ${name}, thank you for your enquiry regarding ${subject || 'your commission'}.`,
    'A member of the atelier will be in touch shortly.',
    '',
    '— Maliki Atelier · By Appointment',
  ].join('\n');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  // Same-origin check
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const expected = [`https://${host}`, `http://${host}`];
  const sameOrigin =
    (origin && expected.includes(origin)) ||
    (referer && expected.some((p) => referer.startsWith(p + '/') || referer === p));
  if (!sameOrigin) {
    return json(res, 403, { error: 'forbidden' });
  }

  if (rateLimit(req, { key: 'contact', max: 5, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Validate
  const name    = String(body.name    || '').trim().slice(0, 200);
  const email   = String(body.email   || '').trim().toLowerCase();
  const message = String(body.message || '').trim().slice(0, 4000);
  const subject = String(body.subject || '').trim().slice(0, 200);
  const source  = String(body.source  || '').trim().slice(0, 100);

  if (!name)                 return json(res, 400, { error: 'name_required' });
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });
  if (!message)              return json(res, 400, { error: 'message_required' });

  const { RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO } = process.env;

  if (!RESEND_API_KEY || !NOTIFY_FROM || !NOTIFY_TO) {
    console.error('contact: missing required env vars (RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO)');
    return json(res, 500, { error: 'server_misconfigured' });
  }

  const payload = { name, email, subject, message, source };
  const adminSubject = `New enquiry — ${subject || 'General'} — ${name}`;

  // Fire both emails without blocking — message is received regardless of Resend uptime
  Promise.all([
    resend('/emails', {
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      reply_to: email.replace(/[\r\n]/g, ''),
      subject: adminSubject,
      html: notificationHtml(payload),
      text: notificationText(payload),
    }).then((r) => {
      if (!r.ok) console.error('contact: admin notify failed', r.status, r.data);
      logEmail({
        template_key: 'contact_notification',
        recipient_email: NOTIFY_TO,
        recipient_name: 'Admin',
        subject: adminSubject,
        status: r.ok ? 'sent' : 'failed',
      });
    }).catch((e) => console.error('contact: admin notify error', e.message)),

    resend('/emails', {
      from: NOTIFY_FROM,
      to: email,
      subject: 'Maliki Atelier — Your enquiry has been received',
      html: confirmationHtml(name, subject),
      text: confirmationText(name, subject),
    }).then((r) => {
      if (!r.ok) console.error('contact: confirmation send failed', r.status, r.data);
      logEmail({
        template_key: 'contact_confirmation',
        recipient_email: email,
        recipient_name: name,
        subject: 'Maliki Atelier — Your enquiry has been received',
        status: r.ok ? 'sent' : 'failed',
      });
    }).catch((e) => console.error('contact: confirmation error', e.message)),
  ]);

  return json(res, 200, { ok: true });
};
