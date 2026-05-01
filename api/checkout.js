const { sameOrigin } = require('./_lib/auth');
const { normalizeOrder, supabaseFetch } = require('./_lib/supabase');

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
    const productById = new Map(products.map((product) => [product.id, product]));
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

    const existingCustomers = await supabaseFetch(`/customers?email=eq.${encodeURIComponent(email)}&limit=1`);
    let customer = existingCustomers[0];
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
    const createdOrders = await supabaseFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        id: uid('ord'),
        number: orderNumber(),
        customer_id: customer.id,
        customer_email: email,
        customer_name: name,
        subtotal_cents: subtotal,
        shipping_cents: 0,
        discount_cents: 0,
        total_cents: subtotal,
        currency: 'GBP',
        status: 'pending',
        shipping_address: { city, country },
      }),
    });
    const order = createdOrders[0];

    await supabaseFetch('/order_items', {
      method: 'POST',
      body: JSON.stringify(lineItems.map((item) => ({ order_id: order.id, ...item }))),
    });

    await Promise.all(lineItems.map(async (item) => {
      const product = productById.get(item.product_id);
      if (typeof product.stock !== 'number') return;
      await supabaseFetch(`/products?id=eq.${encodeURIComponent(item.product_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock: Math.max(0, product.stock - item.quantity) }),
      });
    }));

    return json(res, 200, {
      order: normalizeOrder({ ...order, order_items: lineItems }),
      customer,
    });
  } catch (error) {
    console.error('checkout:', error.status || error.message, error.data || '');
    return json(res, 500, { error: 'checkout_failed' });
  }
};
