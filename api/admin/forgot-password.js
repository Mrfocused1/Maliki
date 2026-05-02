const { persistentRateLimit } = require('../_lib/persistent-rate-limit');

const RESEND_BASE = 'https://api.resend.com';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const escHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const buildResetEmail = (resetUrl) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reset Your Maliki Atelier Password</title></head>
<body style="margin:0;padding:0;background:#0a0908;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr><td align="center" style="padding:64px 24px 48px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">

        <tr><td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">By&nbsp;Appointment&nbsp;Only</td></tr>
        <tr><td align="center" style="padding:8px 0 4px;"><div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div></td></tr>
        <tr><td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td></tr>
        <tr><td align="center" style="padding-bottom:32px;"><div style="width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);margin:0 auto;font-size:0;">&nbsp;</div></td></tr>

        <tr><td style="padding:0 0 24px;">
          <p style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">A password reset was requested for your Maliki Atelier admin account.</p>
          <p style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">Click the button below to set a new password. This link will expire in 1 hour.</p>
        </td></tr>

        <tr><td align="center" style="padding:8px 0 40px;">
          <a href="${escHtml(resetUrl)}" style="display:inline-block;background:linear-gradient(180deg,#d9b070,#b68a4e);color:#1a120a;font-family:'Playfair Display',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;padding:16px 36px;text-decoration:none;">Reset Password</a>
        </td></tr>

        <tr><td style="padding:0 0 32px;">
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;line-height:1.6;letter-spacing:0.04em;color:rgba(245,236,218,0.55);">If you did not request this, you can safely ignore this email.<br/>If the button does not work, copy and paste this link:<br/><span style="color:#d9b070;word-break:break-all;">${escHtml(resetUrl)}</span></p>
        </td></tr>

        <tr><td align="center" style="padding-top:36px;border-top:1px solid rgba(217,176,112,0.15);font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">Maliki&nbsp;Atelier &middot; London</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (await persistentRateLimit(req, { key: 'admin_forgot', max: 3, windowMs: 15 * 60 * 1000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !NOTIFY_FROM) {
    return json(res, 500, { error: 'server_misconfigured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = String((body || {}).email || '').trim().toLowerCase();
  const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  const siteUrl = process.env.SITE_URL || 'https://www.malikiatelier.com';
  const redirectTo = `${siteUrl}/admin/setup`;

  try {
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'recovery', email, redirect_to: redirectTo }),
    });

    const linkData = await linkRes.json();
    const actionLink = linkData.action_link || linkData.properties?.action_link;

    if (!linkRes.ok || !actionLink) {
      // Always return 200 to avoid leaking whether an account exists
      return json(res, 200, { ok: true });
    }

    const emailRes = await fetch(`${RESEND_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [email],
        subject: 'Reset Your Maliki Atelier Admin Password',
        html: buildResetEmail(actionLink),
      }),
    });

    if (!emailRes.ok) {
      console.error('forgot-password: resend failed', await emailRes.json());
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('forgot-password:', err.message);
    return json(res, 200, { ok: true });
  }
};
