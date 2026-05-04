const { supabaseFetch } = require('./_lib/supabase');
const { rateLimit } = require('./_lib/rate-limit');
const { EMAIL_RX } = require('./_lib/email');

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

const parseBody = (req) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
};

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const productId = req.query?.product_id;
    if (!productId) return json(res, 400, { error: 'product_id_required' });

    try {
      const reviews = await supabaseFetch(
        `/product_reviews?product_id=eq.${encodeURIComponent(productId)}&approved=eq.true&order=created_at.desc&limit=20&select=id,product_id,customer_name,rating,title,body,verified_purchase,created_at`
      );

      const count = reviews.length;
      const avg_rating =
        count > 0
          ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count) * 10) / 10
          : null;

      return json(res, 200, { reviews, avg_rating, count });
    } catch (err) {
      console.error('reviews GET:', err.message);
      return json(res, 500, { error: 'fetch_failed' });
    }
  }

  if (req.method === 'POST') {
    if (rateLimit(req, { key: 'reviews', max: 3, windowMs: 3600000 })) {
      return json(res, 429, { error: 'too_many_requests' });
    }

    const body = parseBody(req);
    const product_id = String(body.product_id || '').trim();
    const name       = String(body.name       || '').trim().slice(0, 200);
    const email      = String(body.email      || '').trim().toLowerCase();
    const rating     = parseInt(body.rating, 10);
    const title      = String(body.title      || '').trim().slice(0, 200);
    const reviewBody = String(body.body       || '').trim().slice(0, 4000);

    if (!product_id)              return json(res, 400, { error: 'product_id_required' });
    if (!name)                    return json(res, 400, { error: 'name_required' });
    if (!EMAIL_RX.test(email))    return json(res, 400, { error: 'invalid_email' });
    if (!rating || rating < 1 || rating > 5) return json(res, 400, { error: 'rating_must_be_1_to_5' });
    if (!reviewBody)              return json(res, 400, { error: 'body_required' });

    const id = `rev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    try {
      const existing = await supabaseFetch(
        `/product_reviews?product_id=eq.${encodeURIComponent(product_id)}&customer_email=eq.${encodeURIComponent(email)}&select=id&limit=1`
      ).catch(() => []);
      if (existing?.length > 0) {
        return json(res, 409, { error: 'already_reviewed' });
      }

      await supabaseFetch('/product_reviews', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id,
          product_id,
          customer_name: name,
          customer_email: email,
          rating,
          title,
          body: reviewBody,
          approved: false,
          verified_purchase: false,
          created_at: new Date().toISOString(),
        }),
      });

      return json(res, 201, {
        success: true,
        message: 'Thank you — your review is pending approval.',
      });
    } catch (err) {
      console.error('reviews POST:', err.message);
      return json(res, 500, { error: 'insert_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
