const { clearSessionCookie, sameOrigin } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ error: 'method_not_allowed' }));
  }
  if (!sameOrigin(req)) {
    res.status(403).setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ error: 'forbidden' }));
  }
  clearSessionCookie(req, res);
  res.status(200).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ ok: true }));
};
