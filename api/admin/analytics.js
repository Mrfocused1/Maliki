const { requireAdmin } = require('../_lib/auth');
const { computeAnalytics } = require('../_lib/analytics');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const days = Math.max(1, Math.min(365, parseInt(req.query?.days || '30', 10)));

  try {
    const data = await computeAnalytics(days);
    return json(res, 200, data);
  } catch (err) {
    console.error('admin/analytics:', err.message);
    return json(res, 500, { error: 'analytics_failed' });
  }
};
