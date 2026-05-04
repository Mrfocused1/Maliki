const requireSupabaseEnv = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('supabase_env_missing');
  }
};

const supabaseFetch = async (path, options = {}) => {
  requireSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1${path}`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!response.ok) {
    const error = new Error('supabase_request_failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

const normalizeProduct = (product) => ({
  ...product,
  images: (product.product_images || [])
    .sort((a, b) => a.position - b.position)
    .map((image) => image.url),
  product_images: undefined,
});

const normalizeOrder = (order) => ({
  ...order,
  items: order.order_items || [],
  order_items: undefined,
});

module.exports = {
  supabaseFetch,
  normalizeProduct,
  normalizeOrder,
};
