const sanitiseSlug = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const parseProduct = (body, { creating } = {}) => {
  const out = {};
  if ('title' in body) out.title = String(body.title || '').trim().slice(0, 200);
  if ('slug' in body) out.slug = sanitiseSlug(body.slug);
  if ('description' in body) out.description = String(body.description || '');
  if ('price_cents' in body) {
    const n = Math.round(Number(body.price_cents));
    if (!Number.isFinite(n) || n < 0) throw new Error('invalid_price');
    out.price_cents = n;
  }
  if ('currency' in body) {
    out.currency = String(body.currency || 'GBP').toUpperCase().slice(0, 3);
  }
  if ('images' in body) {
    const arr = Array.isArray(body.images) ? body.images : [];
    out.images = arr.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12);
  }
  if ('stock' in body) {
    const n = Number(body.stock);
    out.stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }
  if ('published' in body) out.published = !!body.published;

  // This storefront is rings only.
  out.category = 'ring';

  if (creating) {
    if (!out.title) throw new Error('title_required');
    if (!out.slug) throw new Error('slug_required');
    if (out.price_cents == null) out.price_cents = 0;
    if (!out.currency) out.currency = 'GBP';
    if (!out.images) out.images = [];
    if (out.published == null) out.published = false;
  }

  return out;
};

module.exports = { sanitiseSlug, parseProduct };
