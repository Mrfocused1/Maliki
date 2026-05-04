const { rateLimit } = require('../_lib/rate-limit');
const { EMAIL_RX } = require('../_lib/email');

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

const buildInviteEmail = (setupUrl) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your Maliki Atelier Admin Account</title></head>
<body style="margin:0;padding:0;background:#0a0908;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr><td align="center" style="padding:64px 24px 48px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">

        <tr><td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">By&nbsp;Appointment&nbsp;Only</td></tr>
        <tr><td align="center" style="padding:8px 0 4px;"><div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div></td></tr>
        <tr><td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td></tr>
        <tr><td align="center" style="padding-bottom:32px;"><div style="width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);margin:0 auto;font-size:0;">&nbsp;</div></td></tr>

        <tr><td style="padding:0 0 24px;">
          <p style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">You have been invited to manage the Maliki Atelier online presence.</p>
          <p style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">Click the button below to create your administrator account. This link will expire in 24 hours.</p>
        </td></tr>

        <tr><td align="center" style="padding:8px 0 40px;">
          <a href="${escHtml(setupUrl)}" style="display:inline-block;background:linear-gradient(180deg,#d9b070,#b68a4e);color:#1a120a;font-family:'Playfair Display',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;padding:16px 36px;text-decoration:none;">Create My Account</a>
        </td></tr>

        <tr><td style="padding:0 0 32px;">
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;line-height:1.6;letter-spacing:0.04em;color:rgba(245,236,218,0.55);">If the button does not work, copy and paste this link into your browser:<br/><span style="color:#d9b070;word-break:break-all;">${escHtml(setupUrl)}</span></p>
        </td></tr>

        <tr><td align="center" style="padding-top:36px;border-top:1px solid rgba(217,176,112,0.15);font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">Maliki&nbsp;Atelier &middot; London</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (rateLimit(req, { key: 'admin_invite', max: 3, windowMs: 60 * 60 * 1000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const secret = (req.headers['x-invite-secret'] || '').trim();
  if (!secret || secret !== (process.env.INVITE_SECRET || '').trim()) {
    return json(res, 403, { error: 'forbidden' });
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
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  const siteUrl = process.env.SITE_URL || 'https://www.malikiatelier.com';
  const redirectTo = `${siteUrl}/admin/setup`;

  const authHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Try invite link first (creates new user + link in one call)
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'invite',
        email,
        data: { role: 'admin' },
        redirect_to: redirectTo,
      }),
    });

    let linkData = await linkRes.json();
    let actionLink = linkData.action_link || linkData.properties?.action_link;

    // User already exists — ensure they're confirmed, then generate recovery link
    if (!linkRes.ok || !actionLink) {
      // Confirm the existing user so recovery links work (idempotent if already confirmed)
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, email_confirm: true }),
      }).catch(() => {});

      const recoveryRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'recovery', email, redirect_to: redirectTo }),
      });
      const recoveryData = await recoveryRes.json();
      actionLink = recoveryData.action_link || recoveryData.properties?.action_link;

      if (!recoveryRes.ok || !actionLink) {
        console.error('invite: generate_link failed', JSON.stringify(linkData), JSON.stringify(recoveryData));
        return json(res, 502, { error: 'invite_failed', detail: linkData.message || recoveryData.message });
      }
    }

    // Send branded invite email via Resend
    const emailRes = await fetch(`${RESEND_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [email],
        subject: 'Your Maliki Atelier Admin Account',
        html: buildInviteEmail(actionLink),
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('invite: resend failed', err);
      return json(res, 502, { error: 'email_failed' });
    }

    return json(res, 200, { ok: true, email });
  } catch (err) {
    console.error('invite:', err.message);
    return json(res, 500, { error: 'invite_failed' });
  }
};
