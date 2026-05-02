const { verifyWebhook } = require('./_lib/stripe');
const { supabaseFetch } = require('./_lib/supabase');
const { sendTemplatedEmail } = require('./_lib/mailer');

module.exports.config = { api: { bodyParser: false } };

const getRawBody = (req) => {
  if (typeof req.rawBody === 'string') return Promise.resolve(req.rawBody);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
};

const reply = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const fmtGBP = (cents) => {
  const v = (cents || 0) / 100;
  return `£${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`;
};

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const orderConfirmationHtml = (order) => {
  const items = order.order_items || [];
  const addr = order.shipping_address || {};
  const addrParts = [addr.line1, addr.line2, [addr.city, addr.postal].filter(Boolean).join(' '), addr.country].filter(Boolean);

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid rgba(217,176,112,0.15);font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;letter-spacing:0.05em;color:#f5ecda;">
        ${esc(item.title)}&nbsp;&times;&nbsp;${item.quantity}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid rgba(217,176,112,0.15);text-align:right;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:15px;color:#f3d89e;">
        ${fmtGBP(item.price_cents * item.quantity)}
      </td>
    </tr>`
    )
    .join('');

  const discountRow =
    order.discount_cents > 0
      ? `<tr>
      <td style="padding:10px 0 4px;font-size:14px;color:rgba(245,236,218,0.72);font-style:italic;font-family:'Cormorant Garamond',Georgia,serif;">
        Discount${order.discount_code ? ` (${esc(order.discount_code)})` : ''}
      </td>
      <td style="padding:10px 0 4px;text-align:right;font-size:14px;color:#a3c08b;font-style:italic;font-family:'Cormorant Garamond',Georgia,serif;">
        &minus;${fmtGBP(order.discount_cents)}
      </td>
    </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your Maliki Atelier Order</title>
</head>
<body style="margin:0;padding:0;background:#0a0908;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;color:#f5ecda;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0908;">
    <tr>
      <td align="center" style="padding:64px 24px 48px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.62em;text-transform:uppercase;color:rgba(245,236,218,0.78);">
              By&nbsp;Appointment&nbsp;Only
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 4px;">
              <div style="font-family:'Pinyon Script','Apple Chancery',cursive;font-size:84px;line-height:1;color:#d9b070;letter-spacing:0.01em;">Maliki</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 0 36px;font-family:'Italiana',Georgia,serif;font-size:14px;letter-spacing:0.55em;text-transform:uppercase;color:#f5ecda;">Atelier</td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;width:96px;height:1px;background:linear-gradient(90deg,transparent,rgba(217,176,112,0.55),transparent);line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 20px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:21px;line-height:1.55;letter-spacing:0.06em;color:#f5ecda;">
              Your order has been received.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 8px 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;line-height:1.7;letter-spacing:0.04em;color:rgba(245,236,218,0.82);">
              Dear ${esc(order.customer_name)}, we are preparing your piece with the care it deserves.<br/>
              The atelier will be in touch to arrange your white-glove delivery.
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 8px;">
              <div style="border:1px solid rgba(217,176,112,0.22);padding:24px 28px;">
                <div style="font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.7);margin-bottom:20px;">
                  Order&nbsp;${esc(order.number)}
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  ${itemRows}
                  ${discountRow}
                  <tr>
                    <td style="padding:18px 0 0;font-family:'Italiana',Georgia,serif;font-size:12px;letter-spacing:0.38em;text-transform:uppercase;color:#f5ecda;">Total</td>
                    <td style="padding:18px 0 0;text-align:right;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:22px;color:#f3d89e;">
                      ${fmtGBP(order.total_cents)}
                    </td>
                  </tr>
                </table>
                ${
                  addrParts.length
                    ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(217,176,112,0.15);font-size:13px;color:rgba(245,236,218,0.6);letter-spacing:0.04em;line-height:1.7;">${addrParts.map(esc).join('<br/>')}</div>`
                    : ''
                }
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 0 0;font-family:'Italiana',Georgia,serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(245,236,218,0.6);">
              Maliki&nbsp;Atelier &middot; By&nbsp;Appointment
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const orderConfirmationText = (order) => {
  const items = (order.order_items || [])
    .map((i) => `  ${i.title} x${i.quantity}  ${fmtGBP(i.price_cents * i.quantity)}`)
    .join('\n');
  return [
    'MALIKI ATELIER',
    '',
    `Order ${order.number} — Confirmed`,
    '',
    `Dear ${order.customer_name},`,
    '',
    'Your order has been received. The atelier will be in touch to arrange your white-glove delivery.',
    '',
    'ORDER SUMMARY',
    items,
    order.discount_cents > 0
      ? `  Discount${order.discount_code ? ` (${order.discount_code})` : ''}: -${fmtGBP(order.discount_cents)}`
      : null,
    `  Total: ${fmtGBP(order.total_cents)}`,
    '',
    '— Maliki Atelier · By Appointment',
  ]
    .filter((l) => l !== null)
    .join('\n');
};

const sendConfirmation = async (order) => {
  const { RESEND_API_KEY, NOTIFY_FROM } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_FROM) return;

  // Only send if the template exists and is enabled
  const tplRows = await supabaseFetch('/email_templates?key=eq.order_confirmation&limit=1').catch(() => []);
  const tpl = tplRows?.[0];
  if (!tpl?.enabled) return;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: order.customer_email,
      subject: `Maliki Atelier — Order ${order.number} Confirmed`,
      html: orderConfirmationHtml(order),
      text: orderConfirmationText(order),
    }),
  });
  const status = r.ok ? 'sent' : 'failed';
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    console.error('stripe-webhook: confirmation email failed', r.status, data);
  }
  supabaseFetch('/email_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: `em_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      template_key: 'order_confirmation',
      recipient_email: order.customer_email,
      recipient_name: order.customer_name,
      subject: `Maliki Atelier — Order ${order.number} Confirmed`,
      order_id: order.id,
      status,
      sent_at: new Date().toISOString(),
    }),
  }).catch(() => {});
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return reply(res, 405, { error: 'method_not_allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return reply(res, 500, { error: 'webhook_not_configured' });

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'] || '';
    event = verifyWebhook(rawBody, sig, secret);
  } catch (err) {
    console.error('stripe-webhook signature:', err.message);
    return reply(res, 400, { error: err.message });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const orderId = intent.metadata?.order_id;
      if (orderId) {
        // Idempotency guard — bail out if this event was already processed
        const existing = await supabaseFetch(
          `/orders?id=eq.${encodeURIComponent(orderId)}&select=status&limit=1`
        ).catch(() => []);
        if (existing?.[0]?.status === 'paid') {
          return reply(res, 200, { received: true });
        }

        await supabaseFetch(`/orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'paid' }),
        });

        // Decrement stock — batch fetch all products in one query
        const items = await supabaseFetch(
          `/order_items?order_id=eq.${encodeURIComponent(orderId)}&select=product_id,quantity`
        );
        const stockItems = (items || []).filter((i) => i.product_id);
        if (stockItems.length) {
          const ids = stockItems.map((i) => encodeURIComponent(i.product_id)).join(',');
          const stockRows = await supabaseFetch(`/products?id=in.(${ids})&select=id,stock`).catch(() => []);
          const stockMap = Object.fromEntries((stockRows || []).map((r) => [r.id, r.stock]));
          await Promise.all(
            stockItems.map((item) => {
              const stock = stockMap[item.product_id];
              if (typeof stock !== 'number') return;
              return supabaseFetch(`/products?id=eq.${encodeURIComponent(item.product_id)}`, {
                method: 'PATCH',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify({ stock: Math.max(0, stock - item.quantity) }),
              });
            })
          );
        }

        // Fetch order for email + discount increment
        const orderRows = await supabaseFetch(
          `/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`
        ).catch(() => []);
        const order = orderRows?.[0];

        // Increment discount usage_count
        if (order?.discount_code) {
          const dRows = await supabaseFetch(
            `/discounts?code=eq.${encodeURIComponent(order.discount_code)}&select=usage_count`
          ).catch(() => []);
          const cur = dRows?.[0]?.usage_count ?? 0;
          await supabaseFetch(`/discounts?code=eq.${encodeURIComponent(order.discount_code)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ usage_count: cur + 1 }),
          }).catch(() => {});
        }

        // Send confirmation email
        try {
          if (order) await sendConfirmation(order);
        } catch (emailErr) {
          console.error('stripe-webhook: confirmation email error:', emailErr.message);
        }

        // VIP welcome — first paid order over £1,000
        if (order?.total_cents >= 100000 && order?.customer_id) {
          (async () => {
            try {
              const [tplRows, prevOrders] = await Promise.all([
                supabaseFetch('/email_templates?key=eq.vip_welcome&limit=1'),
                supabaseFetch(`/orders?customer_id=eq.${encodeURIComponent(order.customer_id)}&status=eq.paid&select=id`),
              ]);
              const tpl = tplRows?.[0];
              if (tpl?.enabled && (prevOrders?.length || 0) === 1) {
                await sendTemplatedEmail({
                  template_key: 'vip_welcome',
                  subject: tpl.subject,
                  body: tpl.body,
                  vars: { name: order.customer_name },
                  to: order.customer_email,
                  to_name: order.customer_name,
                  order_id: orderId,
                });
              }
            } catch (e) { console.error('stripe-webhook: vip_welcome:', e.message); }
          })();
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      const orderId = intent.metadata?.order_id;
      if (orderId) {
        await supabaseFetch(`/orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed' }),
        });

        // Payment failed email
        (async () => {
          try {
            const [tplRows, orderRows] = await Promise.all([
              supabaseFetch('/email_templates?key=eq.payment_failed&limit=1'),
              supabaseFetch(`/orders?id=eq.${encodeURIComponent(orderId)}&select=customer_name,customer_email,number&limit=1`),
            ]);
            const tpl = tplRows?.[0];
            const failedOrder = orderRows?.[0];
            if (tpl?.enabled && failedOrder) {
              await sendTemplatedEmail({
                template_key: 'payment_failed',
                subject: tpl.subject,
                body: tpl.body,
                vars: { name: failedOrder.customer_name, order_number: failedOrder.number },
                to: failedOrder.customer_email,
                to_name: failedOrder.customer_name,
                order_id: orderId,
              });
            }
          } catch (e) { console.error('stripe-webhook: payment_failed email:', e.message); }
        })();
      }
    }

    return reply(res, 200, { received: true });
  } catch (err) {
    console.error('stripe-webhook handler:', err.message, err.data || '');
    return reply(res, 500, { error: 'handler_error' });
  }
};
