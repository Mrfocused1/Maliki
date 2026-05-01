const { isAuthed } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ error: 'method_not_allowed' }));
  }
  res.status(200).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify({ authed: isAuthed(req) }));
};
