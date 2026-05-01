const { verifyWebhook } = require('./_lib/stripe');
const { supabaseFetch } = require('./_lib/supabase');

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
        await supabaseFetch(`/orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'paid' }),
        });

        // Decrement stock now that payment is confirmed
        const items = await supabaseFetch(
          `/order_items?order_id=eq.${encodeURIComponent(orderId)}&select=product_id,quantity`
        );
        await Promise.all((items || []).map(async (item) => {
          if (!item.product_id) return;
          const products = await supabaseFetch(
            `/products?id=eq.${encodeURIComponent(item.product_id)}&select=stock`
          );
          const stock = products?.[0]?.stock;
          if (typeof stock === 'number') {
            await supabaseFetch(`/products?id=eq.${encodeURIComponent(item.product_id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ stock: Math.max(0, stock - item.quantity) }),
            });
          }
        }));
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
      }
    }

    return reply(res, 200, { received: true });
  } catch (err) {
    console.error('stripe-webhook handler:', err.message, err.data || '');
    return reply(res, 500, { error: 'handler_error' });
  }
};
