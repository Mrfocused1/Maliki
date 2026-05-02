const { requireAdmin, sameOrigin } = require('../_lib/auth');
const { supabaseFetch } = require('../_lib/supabase');
const { sendTemplatedEmail } = require('../_lib/mailer');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const getTargets = async (segment, customers, orders) => {
  const now = Date.now();
  const YEAR = 365 * 86400000;
  const MONTH = 30 * 86400000;

  if (segment === 'all') return customers;

  if (segment === 'vip') {
    const spend = new Map();
    for (const o of orders)
      if (o.customer_id) spend.set(o.customer_id, (spend.get(o.customer_id) || 0) + (o.total_cents || 0));
    return customers.filter((c) => (spend.get(c.id) || 0) >= 100000);
  }

  if (segment === 'lapsed') {
    const lastOrder = new Map();
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (!lastOrder.has(o.customer_id) || t > lastOrder.get(o.customer_id))
        lastOrder.set(o.customer_id, t);
    }
    return customers.filter((c) => {
      const t = lastOrder.get(c.id);
      return !t || now - t > YEAR;
    });
  }

  if (segment === 'new') {
    const firstOrder = new Map();
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (!firstOrder.has(o.customer_id) || t < firstOrder.get(o.customer_id))
        firstOrder.set(o.customer_id, t);
    }
    return customers.filter((c) => {
      const t = firstOrder.get(c.id);
      return t && now - t <= MONTH;
    });
  }

  if (segment.startsWith('country:')) {
    const country = segment.slice(8).trim();
    return customers.filter((c) => c.country?.toLowerCase() === country.toLowerCase());
  }

  // Single customer: 'customer:ID'
  if (segment.startsWith('customer:')) {
    const id = segment.slice(9);
    return customers.filter((c) => c.id === id);
  }

  return customers;
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const body = req.body || {};
  const template_key = String(body.template_key || '').trim();
  const segment = String(body.segment || 'all');
  const dry_run = !!body.dry_run;

  if (!template_key) return json(res, 400, { error: 'template_key_required' });

  const MAX_RECIPIENTS = 500;

  try {
    const [tplRows, customers, orders] = await Promise.all([
      supabaseFetch(`/email_templates?key=eq.${encodeURIComponent(template_key)}&limit=1`),
      supabaseFetch('/customers?select=*&limit=10000'),
      supabaseFetch('/orders?select=customer_id,total_cents,status,created_at&status=not.in.(pending,failed)'),
    ]);

    const template = tplRows?.[0];
    if (!template) return json(res, 404, { error: 'template_not_found' });

    const targets = await getTargets(segment, customers || [], orders || []);

    if (dry_run) {
      return json(res, 200, {
        count: targets.length,
        sample: targets.slice(0, 3).map((c) => ({ name: c.name, email: c.email })),
      });
    }

    if (targets.length > MAX_RECIPIENTS) {
      return json(res, 400, {
        error: 'too_many_recipients',
        count: targets.length,
        limit: MAX_RECIPIENTS,
      });
    }

    const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let sent = 0;
    let failed = 0;
    for (const customer of targets) {
      if (!customer.email || !EMAIL_RX.test(customer.email)) { failed++; continue; }
      try {
        const result = await sendTemplatedEmail({
          template_key,
          subject: template.subject,
          body: template.body,
          vars: { name: customer.name, email: customer.email },
          to: customer.email,
          to_name: customer.name,
        });
        if (result.ok) sent++;
        else failed++;
      } catch (err) {
        console.error('campaign:', customer.email, err.message);
        failed++;
      }
    }

    return json(res, 200, { sent, failed, total: targets.length });
  } catch (err) {
    console.error('campaign:', err.message);
    return json(res, 500, { error: 'campaign_failed' });
  }
};
