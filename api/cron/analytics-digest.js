const { computeAnalytics } = require('../_lib/analytics');

const fmtGBP = (cents) => {
  const v = (cents || 0) / 100;
  return `£${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`;
};

const fmtPct = (n) => `${Math.round(n * 100)}%`;

const fmtDur = (secs) => {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const delta = (cur, prev) => {
  if (!prev) return '';
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct >= 0 ? ` (+${pct}%)` : ` (${pct}%)`;
};

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const topList = (items, label, n = 5) =>
  items
    .slice(0, n)
    .map((x, i) => `${i + 1}. ${x.key}  (${x.count})`)
    .join('\n') || `  No ${label} data yet`;

const topListHtml = (items, n = 5) => {
  if (!items.length) return '<em style="color:rgba(245,236,218,0.55)">No data yet</em>';
  const max = items[0]?.count || 1;
  return items
    .slice(0, n)
    .map(
      (x) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:rgba(245,236,218,0.88);font-family:'Cormorant Garamond',Georgia,serif;vertical-align:middle;">
          ${esc(x.key)}
        </td>
        <td style="padding:6px 0 6px 12px;text-align:right;font-size:13px;color:#f3d89e;font-family:'Cormorant Garamond',Georgia,serif;white-space:nowrap;">
          ${x.count}
        </td>
        <td style="padding:6px 0 6px 10px;width:80px;vertical-align:middle;">
          <div style="background:rgba(217,176,112,0.18);height:4px;border-radius:2px;">
            <div style="background:#d9b070;height:4px;border-radius:2px;width:${Math.round((x.count / max) * 100)}%;"></div>
          </div>
        </td>
      </tr>`
    )
    .join('');
};

const buildHtml = (cur, prev) => {
  const k = cur.kpis;
  const pk = prev?.kpis;
  const f = cur.funnel;

  const funnelPct = (num, den) =>
    den > 0 ? `${Math.round((num / den) * 100)}%` : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Maliki Atelier — Weekly Analytics</title>
</head>
<body style="margin:0;padding:0;background:#0a0908;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;color:#f5ecda;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
  <tr>
    <td align="center" style="padding:56px 24px 40px;">
      <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;width:100%;">

        <!-- Wordmark -->
        <tr>
          <td align="center" style="padding-bottom:8px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.58em;text-transform:uppercase;color:rgba(245,236,218,0.72);">
            By&nbsp;Appointment&nbsp;Only
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:6px 0 4px;">
            <div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:76px;line-height:1;color:#d9b070;">Maliki</div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:10px 0 28px;font-family:'Italiana',Georgia,serif;font-size:13px;letter-spacing:0.52em;text-transform:uppercase;color:#f5ecda;">Atelier</td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.5),transparent);margin:0 auto;"></div>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td align="center" style="padding:0 0 6px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">
            Weekly Analytics Digest
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:19px;color:#f5ecda;">
            ${cur.range.since.slice(0, 10)} — ${new Date().toISOString().slice(0, 10)}
          </td>
        </tr>

        <!-- KPI cards -->
        <tr>
          <td style="padding:0 0 24px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                ${[
                  ['Page Views', k.page_views, pk?.page_views],
                  ['Visitors', k.visitors, pk?.visitors],
                  ['Sessions', k.sessions, pk?.sessions],
                  ['Revenue', fmtGBP(k.revenue_cents), pk ? fmtGBP(pk.revenue_cents) : null],
                ].map(([label, val, pval]) => `
                  <td width="25%" style="padding:0 4px;" align="center">
                    <div style="border:1px solid rgba(217,176,112,0.2);padding:16px 10px;text-align:center;">
                      <div style="font-family:'Italiana',Georgia,serif;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:8px;">${esc(label)}</div>
                      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:26px;color:#f3d89e;line-height:1;">${esc(String(val))}</div>
                      ${pval != null ? `<div style="font-size:11px;color:rgba(245,236,218,0.42);margin-top:4px;">${esc(delta(typeof val === 'number' ? val : k.revenue_cents, typeof pval === 'number' ? pval : pk?.revenue_cents))}&nbsp;vs prev wk</div>` : ''}
                    </div>
                  </td>`).join('')}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Secondary KPIs -->
        <tr>
          <td style="padding:0 0 28px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                ${[
                  ['Bounce Rate', fmtPct(k.bounce_rate)],
                  ['Avg Session', fmtDur(k.avg_session_seconds)],
                  ['Orders', k.orders],
                ].map(([label, val]) => `
                  <td width="33%" style="padding:0 4px;" align="center">
                    <div style="background:rgba(217,176,112,0.06);padding:12px 8px;text-align:center;">
                      <div style="font-size:9px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(245,236,218,0.5);margin-bottom:6px;">${esc(label)}</div>
                      <div style="font-size:20px;font-style:italic;color:#f5ecda;">${esc(String(val))}</div>
                    </div>
                  </td>`).join('')}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 0 24px;"><div style="height:1px;background:rgba(217,176,112,0.15);"></div></td></tr>

        <!-- Funnel -->
        <tr>
          <td style="padding:0 0 28px;">
            <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:14px;">Conversion Funnel</div>
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
              ${[
                ['Visitors', f.visitors, null],
                ['Product Views', f.product_views, f.visitors],
                ['Cart Views', f.cart_views, f.product_views],
                ['Orders', f.orders, f.cart_views],
              ].map(([label, val, den]) => {
                const pct = den != null ? funnelPct(val, den) : '';
                const barW = f.visitors > 0 ? Math.round((val / f.visitors) * 100) : 0;
                return `
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:rgba(245,236,218,0.75);width:130px;">${esc(label)}</td>
                    <td style="padding:5px 8px;font-size:13px;color:#f3d89e;white-space:nowrap;width:60px;">${val}</td>
                    <td style="padding:5px 0;vertical-align:middle;">
                      <div style="background:rgba(217,176,112,0.1);height:5px;border-radius:3px;">
                        <div style="background:linear-gradient(90deg,#d9b070,#b68a4e);height:5px;border-radius:3px;width:${barW}%;"></div>
                      </div>
                    </td>
                    <td style="padding:5px 0 5px 10px;font-size:11px;color:rgba(245,236,218,0.45);white-space:nowrap;width:50px;">${pct}</td>
                  </tr>`;
              }).join('')}
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 0 24px;"><div style="height:1px;background:rgba(217,176,112,0.15);"></div></td></tr>

        <!-- Top pages + Top referrers -->
        <tr>
          <td style="padding:0 0 28px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr valign="top">
                <td width="50%" style="padding-right:16px;">
                  <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:12px;">Top Pages</div>
                  <table width="100%" cellspacing="0" cellpadding="0">${topListHtml(cur.top_pages, 5)}</table>
                </td>
                <td width="50%" style="padding-left:16px;border-left:1px solid rgba(217,176,112,0.12);">
                  <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:12px;">Top Referrers</div>
                  <table width="100%" cellspacing="0" cellpadding="0">${topListHtml(cur.top_referrers, 5)}</table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Countries + Devices -->
        <tr>
          <td style="padding:0 0 28px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr valign="top">
                <td width="50%" style="padding-right:16px;">
                  <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:12px;">Countries</div>
                  <table width="100%" cellspacing="0" cellpadding="0">${topListHtml(cur.top_countries, 5)}</table>
                </td>
                <td width="50%" style="padding-left:16px;border-left:1px solid rgba(217,176,112,0.12);">
                  <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:12px;">Devices</div>
                  <table width="100%" cellspacing="0" cellpadding="0">${topListHtml(cur.devices, 4)}</table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${cur.utm.length ? `
        <!-- UTM campaigns -->
        <tr><td style="padding:0 0 24px;"><div style="height:1px;background:rgba(217,176,112,0.15);"></div></td></tr>
        <tr>
          <td style="padding:0 0 28px;">
            <div style="font-size:9px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.55);margin-bottom:12px;">UTM Campaigns</div>
            <table width="100%" cellspacing="0" cellpadding="0">${topListHtml(cur.utm, 5)}</table>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr><td style="padding:0 0 20px;"><div style="height:1px;background:rgba(217,176,112,0.15);"></div></td></tr>
        <tr>
          <td align="center" style="padding:0 0 8px;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(245,236,218,0.38);">
            Maliki&nbsp;Atelier &middot; Weekly Digest &middot; Sent automatically every Monday
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size:11px;color:rgba(245,236,218,0.3);">
            <a href="https://www.malikiatelier.com/admin/" style="color:rgba(217,176,112,0.5);text-decoration:none;">View full analytics in admin</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};

const buildText = (cur, prev) => {
  const k = cur.kpis;
  const pk = prev?.kpis;
  const f = cur.funnel;
  const funnelPct = (num, den) => den > 0 ? `${Math.round((num / den) * 100)}%` : '—';

  return [
    'MALIKI ATELIER — WEEKLY ANALYTICS DIGEST',
    `${cur.range.since.slice(0, 10)} to ${new Date().toISOString().slice(0, 10)}`,
    '',
    'KEY METRICS',
    `  Page views:   ${k.page_views}${pk ? delta(k.page_views, pk.page_views) : ''}`,
    `  Visitors:     ${k.visitors}${pk ? delta(k.visitors, pk.visitors) : ''}`,
    `  Sessions:     ${k.sessions}`,
    `  Bounce rate:  ${fmtPct(k.bounce_rate)}`,
    `  Avg session:  ${fmtDur(k.avg_session_seconds)}`,
    `  Orders:       ${k.orders}`,
    `  Revenue:      ${fmtGBP(k.revenue_cents)}${pk ? delta(k.revenue_cents, pk.revenue_cents) : ''}`,
    '',
    'CONVERSION FUNNEL',
    `  Visitors       ${f.visitors}`,
    `  Product views  ${f.product_views}  (${funnelPct(f.product_views, f.visitors)} of visitors)`,
    `  Cart views     ${f.cart_views}  (${funnelPct(f.cart_views, f.product_views)} of product viewers)`,
    `  Orders         ${f.orders}  (${funnelPct(f.orders, f.cart_views)} of cart viewers)`,
    '',
    'TOP PAGES',
    ...cur.top_pages.slice(0, 5).map((x, i) => `  ${i + 1}. ${x.key}  (${x.count})`),
    '',
    'TOP REFERRERS',
    ...cur.top_referrers.slice(0, 5).map((x, i) => `  ${i + 1}. ${x.key}  (${x.count})`),
    '',
    'COUNTRIES',
    ...cur.top_countries.slice(0, 5).map((x, i) => `  ${i + 1}. ${x.key}  (${x.count})`),
    '',
    'DEVICES',
    ...cur.devices.map((x) => `  ${x.key}: ${x.count}`),
    ...(cur.utm.length ? [
      '',
      'UTM CAMPAIGNS',
      ...cur.utm.slice(0, 5).map((x, i) => `  ${i + 1}. ${x.key}  (${x.count})`),
    ] : []),
    '',
    '— Maliki Atelier · https://www.malikiatelier.com/admin/',
  ].join('\n');
};

module.exports = async (req, res) => {
  // Vercel automatically adds Authorization: Bearer <CRON_SECRET> for cron invocations
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      res.statusCode = 401;
      res.end('Unauthorized');
      return;
    }
  }

  const { RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_FROM || !NOTIFY_TO) {
    console.error('analytics-digest: missing env vars');
    res.statusCode = 500;
    res.end('misconfigured');
    return;
  }

  try {
    // Fetch current week and previous week in parallel for week-over-week comparison
    const [cur, prev] = await Promise.all([
      computeAnalytics(7),
      computeAnalytics(14).then((d) => {
        // Derive previous-week page views from the older half of the 14-day series.
        // Visitors and revenue can't be accurately sliced from the aggregate,
        // so we only expose page_views to avoid misleading week-over-week deltas.
        const prevSeries = d.series.slice(0, 7);
        const prevViews = prevSeries.reduce((s, x) => s + x.views, 0);
        return { kpis: { page_views: prevViews } };
      }),
    ]);

    const subject = `Maliki Atelier — Weekly Digest · ${cur.kpis.page_views} views, ${cur.kpis.visitors} visitors`;
    const html = buildHtml(cur, prev);
    const text = buildText(cur, prev);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: NOTIFY_FROM, to: NOTIFY_TO, subject, html, text }),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      console.error('analytics-digest: send failed', r.status, data);
      res.statusCode = 502;
      res.end('send_failed');
      return;
    }

    console.log('analytics-digest: sent', subject);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, views: cur.kpis.page_views, visitors: cur.kpis.visitors }));
  } catch (err) {
    console.error('analytics-digest:', err.message);
    res.statusCode = 500;
    res.end('error');
  }
};
