module.exports = (req, res) => {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /cart/
Disallow: /account/

Sitemap: https://www.malikiatelier.com/sitemap.xml
`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(body);
};
