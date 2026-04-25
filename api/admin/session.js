const { isAuthed } = require('../_lib/auth');

module.exports = async (req, res) => {
  res.status(200).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify({ authed: isAuthed(req) }));
};
