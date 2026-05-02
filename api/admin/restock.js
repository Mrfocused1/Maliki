const { requireAdmin, sameOrigin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');
const { sendTemplatedEmail } = require('../_lib/mailer');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const parseBody = (req) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  if (req.method === 'GET') {
    try {
      const alerts = await supabaseFetch(
        '/restock_alerts?notified=eq.false&select=product_id,email'
      );

      // Fetch product titles in a single query for all unique product ids
      const productIds = [...new Set(alerts.map((a) => a.product_id))];
      const titleMap = {};
      if (productIds.length) {
        const products = await supabaseFetch(
          `/products?id=in.(${productIds.map(encodeURIComponent).join(',')})&select=id,title`
        ).catch(() => []);
        for (const p of products) titleMap[p.id] = p.title;
      }

      // Group by product_id
      const grouped = {};
      for (const row of alerts) {
        const pid = row.product_id;
        if (!grouped[pid]) {
          grouped[pid] = {
            product_id: pid,
            product_title: titleMap[pid] || pid,
            emails: [],
          };
        }
        grouped[pid].emails.push(row.email);
      }

      const result = Object.values(grouped).map((g) => ({
        ...g,
        count: g.emails.length,
      }));

      return json(res, 200, { alerts: result });
    } catch (err) {
      console.error('admin/restock GET:', err.message);
      return json(res, 500, { error: 'fetch_failed' });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const product_id = String(body.product_id || '').trim();

    if (!product_id) return json(res, 400, { error: 'product_id_required' });

    try {
      // Fetch unnotified alerts for this product
      const alerts = await supabaseFetch(
        `/restock_alerts?product_id=eq.${encodeURIComponent(product_id)}&notified=eq.false&select=email`
      );

      if (!alerts.length) {
        return json(res, 200, { sent: 0 });
      }

      // Fetch product details
      let productTitle = product_id;
      try {
        const products = await supabaseFetch(
          `/products?id=eq.${encodeURIComponent(product_id)}&select=title&limit=1`
        );
        if (products[0]?.title) productTitle = products[0].title;
      } catch (e) {
        console.warn('admin/restock: could not fetch product title', e.message);
      }

      // Send restock notification email to each subscriber
      const emailPromises = alerts.map(({ email }) =>
        sendTemplatedEmail({
          template_key: 'restock_notification',
          subject: `Back in stock — {{product_title}}`,
          body: `We are delighted to inform you that {{product_title}} is now back in stock.\n\nVisit our shop to secure your piece before it sells out again.\n\nhttps://www.malikiatelier.com/shop\n\n— Maliki Atelier`,
          vars: { product_title: productTitle },
          to: email,
        }).catch((e) => console.error('admin/restock: email failed for', email, e.message))
      );

      await Promise.all(emailPromises);

      // Mark all alerts for this product as notified
      await supabaseFetch(
        `/restock_alerts?product_id=eq.${encodeURIComponent(product_id)}&notified=eq.false`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ notified: true }),
        }
      );

      return json(res, 200, { sent: alerts.length });
    } catch (err) {
      console.error('admin/restock POST:', err.message);
      return json(res, 500, { error: 'notify_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
