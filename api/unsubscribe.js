const { verify } = require('./_lib/unsub-token');
const { supabaseFetch } = require('./_lib/supabase');

const html = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — Maliki Atelier</title>
</head>
<body style="margin:0;padding:0;background:#0a0908;font-family:'Cormorant Garamond',Georgia,serif;color:#f5ecda;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;min-height:100vh;">
    <tr><td align="center" style="padding:80px 24px;">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;">
        <tr><td align="center" style="padding:8px 0 4px;">
          <div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:72px;line-height:1;color:#d9b070;">Maliki</div>
        </td></tr>
        <tr><td align="center" style="padding:12px 0 40px;font-size:12px;letter-spacing:0.5em;text-transform:uppercase;color:rgba(245,236,218,0.6);">Atelier</td></tr>
        <tr><td align="center" style="padding:0 0 24px;border-top:1px solid rgba(217,176,112,0.2);padding-top:32px;">${body}</td></tr>
        <tr><td align="center" style="padding-top:32px;">
          <a href="https://www.malikiatelier.com/" style="font-size:11px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(245,236,218,0.5);text-decoration:none;">Return to Atelier</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const SUCCESS_BODY = `
  <p style="font-style:italic;font-size:20px;line-height:1.6;color:#f5ecda;margin:0 0 16px;">You have been unsubscribed.</p>
  <p style="font-size:15px;line-height:1.7;color:rgba(245,236,218,0.7);margin:0;">You will no longer receive marketing emails from Maliki Atelier.</p>`;

const ERROR_BODY = `
  <p style="font-style:italic;font-size:20px;line-height:1.6;color:#f5ecda;margin:0 0 16px;">This link is not valid.</p>
  <p style="font-size:15px;line-height:1.7;color:rgba(245,236,218,0.7);margin:0;">If you would like to unsubscribe, please contact us at <a href="mailto:hello@malikiatelier.com" style="color:#d9b070;">hello@malikiatelier.com</a>.</p>`;

const processUnsub = async (email) => {
  await supabaseFetch(`/subscribers?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'unsubscribed' }),
  }).catch(() => {});

  const { RESEND_API_KEY, RESEND_AUDIENCE_ID } = process.env;
  if (RESEND_API_KEY && RESEND_AUDIENCE_ID) {
    fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: true }),
      }
    ).catch(() => {});
  }
};

module.exports = async (req, res) => {
  const email = String((req.query?.email || req.body?.email || '')).trim().toLowerCase();
  const token = String(req.query?.token || req.body?.token || '');

  if (!email || !verify(email, token)) {
    if (req.method === 'POST') {
      res.statusCode = 400;
      res.end('invalid');
      return;
    }
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html('Invalid Link', ERROR_BODY));
    return;
  }

  await processUnsub(email);

  if (req.method === 'POST') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html('Unsubscribed', SUCCESS_BODY));
};
