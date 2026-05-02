const { supabaseFetch } = require('./supabase');

const DAY = 86400000;

const inferDevice = (ua) => {
  if (!ua) return 'unknown';
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return 'tablet';
  if (/mobile|iphone|android|blackberry|opera mini|webos/.test(u)) return 'mobile';
  return 'desktop';
};

const hostFromReferrer = (r) => {
  if (!r) return '(direct)';
  try { return new URL(r).hostname.replace(/^www\./, ''); } catch { return '(direct)'; }
};

const topN = (m, n = 10) =>
  Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));

async function computeAnalytics(days) {
  const since = new Date(Date.now() - days * DAY).toISOString();

  const [rows, ordersSince] = await Promise.all([
    supabaseFetch(
      `/page_views?created_at=gte.${encodeURIComponent(since)}&select=path,referrer,session_id,visitor_id,user_agent,country,utm_source,utm_medium,utm_campaign,created_at&order=created_at.desc&limit=50000`
    ).catch(() => []),
    supabaseFetch(
      `/orders?created_at=gte.${encodeURIComponent(since)}&select=status,total_cents,created_at&limit=10000`
    ).catch(() => []),
  ]);

  const visitors = new Set();
  const sessions = new Set();
  const productViews = new Set();
  const cartViews = new Set();
  const sessionPathCount = new Map();
  const sessionFirstSeen = new Map();
  const sessionLastSeen = new Map();
  const dayBucket = new Map();
  const pageCount = new Map();
  const referrerCount = new Map();
  const countryCount = new Map();
  const deviceCount = new Map();
  const utmCount = new Map();

  for (const r of rows) {
    if (r.visitor_id) visitors.add(r.visitor_id);
    if (r.session_id) {
      sessions.add(r.session_id);
      sessionPathCount.set(r.session_id, (sessionPathCount.get(r.session_id) || 0) + 1);
      const t = new Date(r.created_at).getTime();
      if (!sessionFirstSeen.has(r.session_id) || t < sessionFirstSeen.get(r.session_id)) sessionFirstSeen.set(r.session_id, t);
      if (!sessionLastSeen.has(r.session_id) || t > sessionLastSeen.get(r.session_id)) sessionLastSeen.set(r.session_id, t);
      if (r.path && r.path.startsWith('/shop/') && r.path !== '/shop/' && r.path !== '/shop') productViews.add(r.session_id);
      if (r.path && r.path.startsWith('/cart')) cartViews.add(r.session_id);
    }
    const day = new Date(r.created_at).toISOString().slice(0, 10);
    const b = dayBucket.get(day) || { views: 0, visitors: new Set() };
    b.views++;
    if (r.visitor_id) b.visitors.add(r.visitor_id);
    dayBucket.set(day, b);

    pageCount.set(r.path || '/', (pageCount.get(r.path || '/') || 0) + 1);
    const ref = hostFromReferrer(r.referrer);
    referrerCount.set(ref, (referrerCount.get(ref) || 0) + 1);
    if (r.country) countryCount.set(r.country, (countryCount.get(r.country) || 0) + 1);
    deviceCount.set(inferDevice(r.user_agent), (deviceCount.get(inferDevice(r.user_agent)) || 0) + 1);
    if (r.utm_source) {
      const key = `${r.utm_source}${r.utm_medium ? ' / ' + r.utm_medium : ''}${r.utm_campaign ? ' · ' + r.utm_campaign : ''}`;
      utmCount.set(key, (utmCount.get(key) || 0) + 1);
    }
  }

  let bounced = 0;
  for (const c of sessionPathCount.values()) if (c === 1) bounced++;
  const bounceRate = sessions.size ? bounced / sessions.size : 0;

  let totalDur = 0; let durCount = 0;
  for (const sid of sessions) {
    const f = sessionFirstSeen.get(sid);
    const l = sessionLastSeen.get(sid);
    if (f != null && l != null && l > f) { totalDur += (l - f) / 1000; durCount++; }
  }

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    const b = dayBucket.get(day) || { views: 0, visitors: new Set() };
    series.push({ date: day, views: b.views, visitors: b.visitors.size });
  }

  const paidOrders = (ordersSince || []).filter(o => o.status === 'paid' || o.status === 'fulfilled').length;
  const paidRevenue = (ordersSince || [])
    .filter(o => o.status === 'paid' || o.status === 'fulfilled')
    .reduce((s, o) => s + (o.total_cents || 0), 0);

  return {
    range: { days, since },
    kpis: {
      page_views: rows.length,
      visitors: visitors.size,
      sessions: sessions.size,
      bounce_rate: bounceRate,
      avg_session_seconds: durCount ? Math.round(totalDur / durCount) : 0,
      orders: paidOrders,
      revenue_cents: paidRevenue,
    },
    series,
    top_pages:     topN(pageCount, 10),
    top_referrers: topN(referrerCount, 10),
    top_countries: topN(countryCount, 10),
    devices:       topN(deviceCount, 5),
    utm:           topN(utmCount, 10),
    funnel: {
      visitors: visitors.size,
      product_views: productViews.size,
      cart_views: cartViews.size,
      orders: paidOrders,
    },
  };
}

module.exports = { computeAnalytics };
