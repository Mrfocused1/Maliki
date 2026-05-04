const { supabaseFetch } = require('./_lib/supabase');

const SITE = 'https://www.malikiatelier.com';

const STATIC_ROUTES = [
  { path: '/',         priority: '1.0', changefreq: 'weekly' },
  { path: '/shop/',    priority: '0.9', changefreq: 'daily'  },
  { path: '/contact/', priority: '0.6', changefreq: 'monthly'},
  { path: '/about/',   priority: '0.6', changefreq: 'monthly'},
  { path: '/shipping', priority: '0.4', changefreq: 'monthly'},
  { path: '/care',     priority: '0.4', changefreq: 'monthly'},
];

const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));

module.exports = async (req, res) => {
  const products = await supabaseFetch('/products?published=eq.true&select=slug,updated_at&limit=5000').catch(() => []);
  const pages    = await supabaseFetch('/pages?status=eq.published&select=slug,updated_at&limit=500').catch(() => []);

  const urls = [];
  for (const r of STATIC_ROUTES) {
    urls.push(`<url><loc>${SITE}${r.path}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`);
  }
  for (const p of products || []) {
    if (!p.slug) continue;
    const last = p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : '';
    urls.push(`<url><loc>${SITE}/shop/${xmlEsc(p.slug)}</loc>${last}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  for (const p of pages || []) {
    if (!p.slug) continue;
    const last = p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : '';
    urls.push(`<url><loc>${SITE}/page/${xmlEsc(p.slug)}</loc>${last}<changefreq>monthly</changefreq><priority>0.5</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(xml);
};
