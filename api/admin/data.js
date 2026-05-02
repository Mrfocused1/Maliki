const { requireAdmin } = require('../_lib/auth');
const { normalizeOrder, normalizeProduct, supabaseFetch } = require('../_lib/supabase');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const settingsObject = (rows) =>
  Object.fromEntries((rows || []).map((row) => [row.section, row.value || {}]));

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const [
      products,
      customers,
      orders,
      subscribers,
      discounts,
      pages,
      settings,
      emailTemplates,
      emailLog,
      customerProfiles,
      productReviews,
    ] = await Promise.all([
      supabaseFetch('/products?select=*,product_images(url,alt,position)&order=created_at.asc'),
      supabaseFetch('/customers?select=*&order=joined_at.desc&limit=10000'),
      supabaseFetch('/orders?select=*,order_items(*)&order=created_at.desc&limit=10000'),
      supabaseFetch('/subscribers?select=*&order=subscribed_at.desc'),
      supabaseFetch('/discounts?select=*&order=created_at.desc'),
      supabaseFetch('/pages?select=*&order=updated_at.desc'),
      supabaseFetch('/settings?select=*'),
      supabaseFetch('/email_templates?select=*&order=updated_at.desc'),
      supabaseFetch('/email_log?select=*&order=sent_at.desc&limit=500'),
      supabaseFetch('/customer_profiles?select=*&order=updated_at.desc&limit=10000'),
      supabaseFetch('/product_reviews?select=*&order=created_at.desc&limit=2000'),
    ]);

    return json(res, 200, {
      products: products.map(normalizeProduct),
      customers,
      orders: orders.map(normalizeOrder),
      subscribers,
      discounts,
      pages,
      settings: settingsObject(settings),
      email_templates: emailTemplates,
      email_log: emailLog.map((email) => ({
        ...email,
        to: email.recipient_email,
        to_name: email.recipient_name,
      })),
      customer_profiles: customerProfiles,
      product_reviews: productReviews,
    });
  } catch (error) {
    console.error('admin/data:', error.status || error.message);
    return json(res, 500, { error: 'admin_data_unavailable' });
  }
};
