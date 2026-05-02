const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');
const { url: unsubUrl } = require('./_lib/unsub-token');

const RESEND_BASE = 'https://api.resend.com';
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const welcomeHtml = (email) => {
  const unsub = unsubUrl(email);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome to Maliki Atelier</title></head>
<body style="margin:0;padding:0;background:#0a0908;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr><td align="center" style="padding:64px 24px 48px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">

        <tr><td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">By&nbsp;Appointment&nbsp;Only</td></tr>
        <tr><td align="center" style="padding:8px 0 4px;"><div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div></td></tr>
        <tr><td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td></tr>
        <tr><td align="center" style="padding-bottom:32px;"><div style="width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);margin:0 auto;font-size:0;">&nbsp;</div></td></tr>

        <tr><td align="center" style="padding:0 8px 20px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:22px;line-height:1.55;letter-spacing:0.06em;color:#f5ecda;">
          You are now part of the atelier.
        </td></tr>

        <tr><td style="padding:0 0 32px;">
          <p style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">Thank you for joining the Maliki Atelier private list. You will be among the first to hear about new pieces, exclusive commissions, and events.</p>
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.75;letter-spacing:0.04em;color:rgba(245,236,218,0.88);">Each piece is made with intention — and so is every message we send.</p>
        </td></tr>

        <tr><td align="center" style="padding:8px 0 40px;">
          <a href="https://www.malikiatelier.com/shop" style="display:inline-block;background:linear-gradient(180deg,#d9b070,#b68a4e);color:#1a120a;font-family:'Playfair Display',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;padding:16px 36px;text-decoration:none;">View the Collection</a>
        </td></tr>

        <tr><td align="center" style="padding-top:36px;border-top:1px solid rgba(217,176,112,0.15);font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">Maliki&nbsp;Atelier &middot; London</td></tr>

        <tr><td align="center" style="padding-top:20px;">
          <a href="${unsub}" style="font-size:11px;color:rgba(245,236,218,0.35);text-decoration:underline;font-family:'Cormorant Garamond',Georgia,serif;letter-spacing:0.06em;">Unsubscribe</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (rateLimit(req, { key: 'newsletter', max: 5, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });

  try {
    await supabaseFetch('/subscribers', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        email,
        subscribed_at: new Date().toISOString(),
        source: 'popup',
        status: 'active',
      }),
    });

    // Send welcome email (fire-and-forget — don't fail the signup if email fails)
    const { RESEND_API_KEY, NOTIFY_FROM } = process.env;
    if (RESEND_API_KEY && NOTIFY_FROM) {
      fetch(`${RESEND_BASE}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: NOTIFY_FROM,
          to: [email],
          subject: 'Welcome to Maliki Atelier',
          html: welcomeHtml(email),
          headers: {
            'List-Unsubscribe': `<${unsubUrl(email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      }).catch((e) => console.error('newsletter: welcome email failed', e.message));
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('newsletter:', err.message);
    return json(res, 500, { error: 'subscribe_failed' });
  }
};
