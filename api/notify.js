const RESEND_BASE = 'https://api.resend.com';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const thankYouHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Maliki Atelier</title>
</head>
<body style="margin:0;padding:0;background:#0a0908;font-family:'Cormorant Garamond', Georgia, 'Times New Roman', serif;color:#f5ecda;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr>
      <td align="center" style="padding:64px 24px;">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:40px;font-family:'Italiana', Georgia, serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">
              By&nbsp;Invitation&nbsp;Only
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 4px;">
              <div style="font-family:'Pinyon Script', 'Apple Chancery', cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">
                Maliki
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 0 36px;font-family:'Italiana', Georgia, serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">
              Atelier
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;width:96px;height:1px;background:linear-gradient(90deg, transparent, rgba(217,176,112,0.55), transparent);line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 28px;font-family:'Cormorant Garamond', Georgia, serif;font-style:italic;font-size:20px;line-height:1.55;letter-spacing:0.06em;color:#f5ecda;">
              Thank&nbsp;you for joining the private list.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 28px;font-family:'Cormorant Garamond', Georgia, serif;font-size:16px;line-height:1.7;letter-spacing:0.04em;color:rgba(245,236,218,0.82);">
              A new standard of craftsmanship is being prepared.<br/>
              When the doors open, your invitation will follow &mdash; quietly, and before all else.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 0 0;">
              <div style="display:inline-block;width:40px;height:1px;background:linear-gradient(90deg, transparent, rgba(217,176,112,0.55), transparent);line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0 0;font-family:'Italiana', Georgia, serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">
              Maliki&nbsp;Atelier &middot; By&nbsp;Appointment
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const thankYouText = () =>
  [
    'MALIKI ATELIER',
    'By Invitation Only',
    '',
    'Thank you for joining the private list.',
    '',
    'A new standard of craftsmanship is being prepared.',
    'When the doors open, your invitation will follow — quietly, and before all else.',
    '',
    '— Maliki Atelier',
    'By Appointment',
  ].join('\n');

const escHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const notificationHtml = (email) => `<!DOCTYPE html>
<html><body style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#222;">
  <p>New waitlist signup on malikiatelier.com:</p>
  <p style="font-size:18px;font-weight:600;">${escHtml(email)}</p>
  <p style="color:#777;font-size:12px;">Added to Resend audience &laquo;Waiting List&raquo;.</p>
</body></html>`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RX.test(email)) {
    return json(res, 400, { error: 'invalid_email' });
  }

  const {
    RESEND_API_KEY,
    RESEND_AUDIENCE_ID,
    NOTIFY_TO,
    NOTIFY_FROM,
  } = process.env;

  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID || !NOTIFY_FROM) {
    console.error('notify: missing required env vars');
    return json(res, 500, { error: 'server_misconfigured' });
  }

  const audience = await resend(`/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
    email,
    unsubscribed: false,
  });

  if (!audience.ok && audience.status !== 409) {
    console.error('notify: audience add failed', audience.status, audience.data);
    return json(res, 502, { error: 'signup_failed' });
  }

  const thankYou = await resend('/emails', {
    from: NOTIFY_FROM,
    to: email,
    subject: 'Maliki Atelier — Your Invitation Will Follow',
    html: thankYouHtml(),
    text: thankYouText(),
  });
  if (!thankYou.ok) {
    console.error('notify: thank-you send failed', thankYou.status, thankYou.data);
  }

  if (NOTIFY_TO) {
    const notification = await resend('/emails', {
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      reply_to: email,
      subject: `New waitlist signup — ${email}`,
      html: notificationHtml(email),
    });
    if (!notification.ok) {
      console.error('notify: notification send failed', notification.status, notification.data);
    }
  }

  return json(res, 200, { ok: true });
};
