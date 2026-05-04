const { sameOrigin } = require('./_lib/auth');
const { rateLimit } = require('./_lib/rate-limit');
const { supabaseFetch } = require('./_lib/supabase');
const { createPaymentIntent } = require('./_lib/stripe');

const { EMAIL_RX } = require('./_lib/email');

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
  if (rateLimit(req, { key: 'checkout', max: 10, windowMs: 60000 })) {
    return json(res, 429, { error: 'too_many_requests' });
  }
  if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  const body = req.body || {};
  const customerInput = body.customer || {};
  const name = String(customerInput.name || '').trim().slice(0, 200);
  const email = String(customerInput.email || '').trim().toLowerCase();
  const line1 = String(customerInput.line1 || '').trim().slice(0, 300);
  const line2 = String(customerInput.line2 || '').trim().slice(0, 300);
  const city = String(customerInput.city || '').trim().slice(0, 120);
  const postal = String(customerInput.postal || '').trim().slice(0, 20);
  const country = String(customerInput.country || '').trim().slice(0, 60);
  const discount_code_input = String(body.discount_code || '').trim().toUpperCase();
  const gift_wrap = body.gift_wrap === true;
  const gift_message = String(body.gift_message || '').trim().slice(0, 200);
  const newsletter_subscribe = body.newsletter_subscribe !== false;
  const referral_code = String(body.referral_code || '').trim().toUpperCase().slice(0, 40);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name) return json(res, 400, { error: 'name_required' });
  if (!EMAIL_RX.test(email)) return json(res, 400, { error: 'invalid_email' });
  if (!line1) return json(res, 400, { error: 'address_required' });
  if (!country) return json(res, 400, { error: 'country_required' });
  if (!/^[\p{L}\s\-'.]{2,60}$/u.test(country)) return json(res, 400, { error: 'invalid_country' });
  if (!Array.isArray(body.items) || body.items.length === 0) return json(res, 400, { error: 'items_required' });
  if (body.items.length > 100) return json(res, 400, { error: 'too_many_items' });

  try {
    const products = await supabaseFetch('/products?select=*,product_images(url,position)&published=eq.true');
    const productById = new Map(products.map((p) => [p.id, p]));
    const lineItems = [];

    let engravingText = '';
    for (const item of items) {
      const product = productById.get(String(item.product_id || ''));
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      if (!product) return json(res, 400, { error: 'invalid_product' });
      if (typeof product.stock === 'number' && product.stock < quantity) {
        return json(res, 409, { error: 'insufficient_stock', product_id: product.id });
      }
      const images = (product.product_images || []).sort((a, b) => a.position - b.position);
      const engraving = String(item.engraving || '').trim().slice(0, 60);
      if (engraving && !engravingText) engravingText = engraving;
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
      if (!customer) throw new Error('customer_create_failed');
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);

    // Validate discount code
    const cleanDiscount = /^[A-Z0-9\-]{1,40}$/.test(discount_code_input) ? discount_code_input : '';
    let discount_cents = 0;
    let validatedCode = '';
    if (cleanDiscount) {
      const now = new Date().toISOString();
      const dRows = await supabaseFetch(
        `/discounts?code=eq.${encodeURIComponent(cleanDiscount)}&status=eq.active&limit=1`
      ).catch(() => []);
      const discount = dRows?.[0];
      if (discount) {
        const started = !discount.starts_at || discount.starts_at <= now;
        const notEnded = !discount.ends_at || discount.ends_at >= now;
        const underLimit = !discount.usage_limit || discount.usage_count < discount.usage_limit;
        const meetsMin = subtotal >= discount.minimum_cents;
        if (started && notEnded && underLimit && meetsMin) {
          validatedCode = discount.code;
          if (discount.type === 'percent') {
            discount_cents = Math.round(subtotal * Number(discount.value) / 100);
          } else {
            discount_cents = Math.min(Number(discount.value), subtotal);
          }
        }
      }
    }

    const total = subtotal - discount_cents;
    if (total <= 0) return json(res, 400, { error: 'total_must_be_positive' });

    const orderId = uid('ord');
    const orderNum = orderNumber();

    // Create Stripe Payment Intent
    const intent = await createPaymentIntent({
      amount: total,
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
        discount_cents,
        discount_code: validatedCode,
        total_cents: total,
        currency: 'GBP',
        status: 'pending',
        shipping_address: { line1, line2, city, postal, country },
        stripe_payment_intent_id: intent.id,
        gift_wrap,
        gift_message,
        engraving_text: engravingText,
      }),
    });
    const order = createdOrders[0];
    if (!order) throw new Error('order_insert_returned_empty');

    await supabaseFetch('/order_items', {
      method: 'POST',
      body: JSON.stringify(lineItems.map((item) => ({ order_id: order.id, ...item }))),
    });

    // Newsletter opt-in
    if (newsletter_subscribe) {
      supabaseFetch('/subscribers', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          id: uid('sub'),
          email,
          subscribed_at: new Date().toISOString(),
          source: 'checkout',
          status: 'subscribed',
        }),
      }).catch((e) => console.error('checkout: subscriber sync failed:', e.message));
    }

    // Record referral — only if the code maps to a real customer
    if (referral_code) {
      supabaseFetch(`/customer_profiles?referral_code=eq.${encodeURIComponent(referral_code)}&select=user_id&limit=1`)
        .then((rows) => {
          if (!rows?.length) return;
          return supabaseFetch('/referrals', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              id: uid('ref'),
              referral_code,
              referee_email: email,
              order_id: order.id,
              created_at: new Date().toISOString(),
            }),
          });
        })
        .catch((e) => console.error('checkout: referral sync failed:', e.message));
    }

    return json(res, 200, {
      clientSecret: intent.client_secret,
      order: {
        id: order.id,
        number: order.number,
        customer_email: email,
        subtotal_cents: subtotal,
        discount_cents,
        total_cents: total,
        currency: 'GBP',
      },
    });
  } catch (error) {
    console.error('checkout:', error.status || error.message);
    return json(res, 500, { error: 'checkout_failed' });
  }
};
