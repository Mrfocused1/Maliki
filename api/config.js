const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(JSON.stringify(body));
};

module.exports = (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  if (!stripeKey) {
    console.error('config: STRIPE_PUBLISHABLE_KEY is not set');
    return json(res, 500, { error: 'stripe_not_configured' });
  }
  return json(res, 200, {
    stripe_publishable_key: stripeKey,
    supabase_url: process.env.SUPABASE_URL || '',
    supabase_anon_key: process.env.SUPABASE_ANON_KEY || '',
  });
};
