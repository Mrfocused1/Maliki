// Thin PostgREST wrapper. Uses the service role key, so callers must enforce
// auth themselves before invoking writes (or before exposing unfiltered reads).

const base = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('supabase_misconfigured');
  }
  return {
    url: SUPABASE_URL.replace(/\/+$/, ''),
    key: SUPABASE_SERVICE_ROLE_KEY,
  };
};

const headers = (extra = {}) => {
  const { key } = base();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
};

const request = async (method, path, { body, prefer } = {}) => {
  const { url } = base();
  const init = {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const r = await fetch(`${url}/rest/v1${path}`, init);
  let data = null;
  const text = await r.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: r.ok, status: r.status, data };
};

module.exports = {
  get: (path) => request('GET', path),
  insert: (table, row) =>
    request('POST', `/${table}`, { body: row, prefer: 'return=representation' }),
  update: (table, filter, patch) =>
    request('PATCH', `/${table}?${filter}`, {
      body: patch,
      prefer: 'return=representation',
    }),
  remove: (table, filter) => request('DELETE', `/${table}?${filter}`),
};
