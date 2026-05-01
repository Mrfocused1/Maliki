const { supabaseFetch } = require('./supabase');

const RESEND_BASE = 'https://api.resend.com';

const uid = () => `em_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const renderText = (text, vars) =>
  String(text || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : ''
  );

const escHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const buildHtml = (subject, bodyText) => {
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">${p
          .trim()
          .split('\n')
          .map(escHtml)
          .join('<br/>')}</p>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0908;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr><td align="center" style="padding:64px 24px 48px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">By&nbsp;Appointment&nbsp;Only</td></tr>
        <tr><td align="center" style="padding:8px 0 4px;"><div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div></td></tr>
        <tr><td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td></tr>
        <tr><td align="center" style="padding-bottom:32px;"><div style="width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);margin:0 auto;font-size:0;">&nbsp;</div></td></tr>
        <tr><td style="padding:0 0 40px;">${paragraphs}</td></tr>
        <tr><td align="center" style="padding-top:36px;border-top:1px solid rgba(217,176,112,0.15);font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">Maliki&nbsp;Atelier &middot; By&nbsp;Appointment</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const sendTemplatedEmail = async ({
  template_key,
  subject,
  body,
  vars = {},
  to,
  to_name,
  order_id,
}) => {
  const { RESEND_API_KEY, NOTIFY_FROM } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_FROM) {
    console.warn('mailer: RESEND_API_KEY or NOTIFY_FROM not configured');
    return { ok: false };
  }

  const renderedSubject = renderText(subject, vars);
  const renderedBody = renderText(body, vars);

  const r = await fetch(`${RESEND_BASE}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: Array.isArray(to) ? to : [to],
      subject: renderedSubject,
      html: buildHtml(renderedSubject, renderedBody),
      text: renderedBody,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error('mailer: send failed', r.status, data);

  supabaseFetch('/email_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: uid(),
      template_key: template_key || 'manual',
      recipient_email: Array.isArray(to) ? to[0] : to,
      recipient_name: to_name || '',
      subject: renderedSubject,
      order_id: order_id || null,
      status: r.ok ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    }),
  }).catch((e) => console.error('mailer: log failed', e.message));

  return { ok: r.ok };
};

module.exports = { sendTemplatedEmail, renderText };
