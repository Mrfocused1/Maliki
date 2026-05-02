const requireCustomer = async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { send401(res); return null; }

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) { send401(res); return null; }
    return await r.json();
  } catch { send401(res); return null; }
};

const send401 = (res) => {
  res.status(401).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify({ error: 'unauthorized' }));
};

module.exports = { requireCustomer };
