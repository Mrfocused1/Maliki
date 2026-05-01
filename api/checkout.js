const { sameOrigin } = require('./_lib/auth');
const { supabaseFetch } = require('./_lib/supabase');
const { createPaymentIntent } = require('./_lib/stripe');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const orderNumber = () =>
  `MA-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;

const cents = (value) => Math.max(0, Math.round(Number(value) || 0));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const body = req.body || {};
  const customerInput = body.customer || {};
  const name = String(customerInput.name || '').trim().slice(0, 200);
  const email = String(customerInput.email || '').trim().toLowerCase();
  const city = String(customerInput.city || '').trim().slice(0, 120);
  const country = String(customerInput.country || '').trim().slice(0, 120);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name) return json(res, 400, { error: 'name_required' });
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });
  if (!country) return json(res, 400, { error: 'country_required' });
  if (!items.length) return json(res, 400, { error: 'cart_empty' });

  try {
    const products = await supabaseFetch('/products?select=*,product_images(url,position)&published=eq.true');
    const productById = new Map(products.map((p) => [p.id, p]));
    const lineItems = [];

    for (const item of items) {
      const product = productById.get(String(item.product_id || ''));
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      if (!product) return json(res, 400, { error: 'invalid_product' });
      if (typeof product.stock === 'number' && product.stock < quantity) {
        return json(res, 409, { error: 'insufficient_stock', product_id: product.id });
      }
      const images = (product.product_images || []).sort((a, b) => a.position - b.position);
      lineItems.push({
        product_id: product.id,
        title: product.title,
        image: images[0]?.url || '',
        quantity,
        price_cents: cents(product.price_cents),
      });
    }

    // Upsert customer
    const existing = await supabaseFetch(`/customers?email=eq.${encodeURIComponent(email)}&limit=1`);
    let customer = existing[0];
    if (customer) {
      const updated = await supabaseFetch(`/customers?id=eq.${encodeURIComponent(customer.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, city, country }),
      });
      customer = updated[0] || { ...customer, name, city, country };
    } else {
      const created = await supabaseFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({ id: uid('cus'), name, email, city, country, joined_at: new Date().toISOString() }),
      });
      customer = created[0];
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
    const orderId = uid('ord');
    const orderNum = orderNumber();

    // Create Stripe Payment Intent
    const intent = await createPaymentIntent({
      amount: subtotal,
      currency: 'GBP',
      metadata: { order_id: orderId, order_number: orderNum },
    });

    // Create pending order
    const createdOrders = await supabaseFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        number: orderNum,
        customer_id: customer.id,
        customer_email: email,
        customer_name: name,
        subtotal_cents: subtotal,
        shipping_cents: 0,
        total_cents: subtotal,
        currency: 'GBP',
        status: 'pending',
        shipping_address: { city, country },
        stripe_payment_intent_id: intent.id,
      }),
    });
    const order = createdOrders[0];

    await supabaseFetch('/order_items', {
      method: 'POST',
      body: JSON.stringify(lineItems.map((item) => ({ order_id: order.id, ...item }))),
    });

    return json(res, 200, {
      clientSecret: intent.client_secret,
      order: {
        id: order.id,
        number: order.number,
        customer_email: email,
        total_cents: subtotal,
        currency: 'GBP',
      },
    });
  } catch (error) {
    console.error('checkout:', error.status || error.message, error.data || '');
    return json(res, 500, { error: 'checkout_failed' });
  }
};
