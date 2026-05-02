// LocalStorage-backed store. All pages (admin, shop, cart) read and write
// through here so a change in admin is reflected on the storefront in the
// same browser. Resets to the seed mock data on first visit, or whenever
// the seed version bumps.
(function () {
  const KEYS = {
    products:          'maliki.products',
    customers:         'maliki.customers',
    orders:            'maliki.orders',
    cart:              'maliki.cart',
    email_templates:   'maliki.email_templates',
    email_log:         'maliki.email_log',
    subscribers:       'maliki.subscribers',
    discounts:         'maliki.discounts',
    pages:             'maliki.pages',
    settings:          'maliki.settings',
    customer_profiles: 'maliki.customer_profiles',
    version:           'maliki.seed_version',
  };

  const seed = () => window.MOCK_DATA || {
    products: [], customers: [], orders: [],
    email_templates: [], email_log: [], subscribers: [],
    discounts: [], pages: [], settings: {},
    seed_version: 0,
  };

  const safeParse = (raw, fallback) => {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };

  const read = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const ensureSeeded = () => {
    if (!window.MOCK_DATA) return; // no seed data available — preserve existing localStorage
    const s = seed();
    const stored = Number(localStorage.getItem(KEYS.version) || 0);
    if (stored !== s.seed_version) {
      write(KEYS.products,        s.products);
      write(KEYS.customers,       s.customers);
      write(KEYS.orders,          s.orders);
      write(KEYS.email_templates, s.email_templates || []);
      write(KEYS.email_log,       s.email_log || []);
      write(KEYS.subscribers,     s.subscribers || []);
      write(KEYS.discounts,       s.discounts || []);
      write(KEYS.pages,           s.pages || []);
      write(KEYS.settings,        s.settings || {});
      localStorage.setItem(KEYS.version, String(s.seed_version));
      // Cart belongs to the visitor — don't wipe on seed bump.
      if (localStorage.getItem(KEYS.cart) === null) write(KEYS.cart, []);
    }
  };

  // Listeners — pages can subscribe to refresh themselves on changes.
  const listeners = new Set();
  const notify = (kind) => listeners.forEach((fn) => { try { fn(kind); } catch {} });
  // Cross-tab sync: when localStorage changes in another tab, fire local listeners too.
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    const kind = Object.entries(KEYS).find(([, v]) => v === e.key);
    if (kind) notify(kind[0]);
  });

  const uid = (prefix) =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const slugify = (s) =>
    String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  // ---------- Products ----------
  const products = () => read(KEYS.products, []);
  const publishedProducts = () => products().filter((p) => p.published !== false);
  const productById = (id) => products().find((p) => p.id === id) || null;
  const productBySlug = (slug) => products().find((p) => p.slug === slug) || null;

  const addProduct = (data) => {
    const list = products();
    let slug = slugify(data.slug || data.title);
    if (!slug) throw new Error('slug_required');
    let n = 2;
    while (list.some((p) => p.slug === slug)) slug = `${slugify(data.title)}-${n++}`;
    const now = new Date().toISOString();
    const p = {
      id: uid('prd'),
      slug,
      title: String(data.title || '').trim(),
      subtitle: String(data.subtitle || '').trim(),
      description: String(data.description || ''),
      price_cents: Math.max(0, Math.round(Number(data.price_cents) || 0)),
      currency: (data.currency || 'GBP').toUpperCase(),
      images: Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : [],
      category: 'ring',
      metal: String(data.metal || ''),
      stone: String(data.stone || ''),
      hand_size: String(data.hand_size || ''),
      stock: data.stock === '' || data.stock == null ? null : Math.max(0, Math.floor(Number(data.stock) || 0)),
      published: data.published !== false,
      featured: !!data.featured,
      created_at: now,
      updated_at: now,
    };
    write(KEYS.products, [p, ...list]);
    notify('products');
    return p;
  };

  const updateProduct = (id, patch) => {
    const list = products();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const cur = list[i];
    const next = { ...cur };
    for (const k of Object.keys(patch)) {
      if (k === 'price_cents') next[k] = Math.max(0, Math.round(Number(patch[k]) || 0));
      else if (k === 'stock') next[k] = patch[k] === '' || patch[k] == null ? null : Math.max(0, Math.floor(Number(patch[k]) || 0));
      else if (k === 'slug') next[k] = slugify(patch[k]) || cur.slug;
      else if (k === 'images') next[k] = Array.isArray(patch[k]) ? patch[k].filter(Boolean).slice(0, 8) : cur.images;
      else next[k] = patch[k];
    }
    next.updated_at = new Date().toISOString();
    list[i] = next;
    write(KEYS.products, list);
    notify('products');
    return next;
  };

  const deleteProduct = (id) => {
    write(KEYS.products, products().filter((p) => p.id !== id));
    notify('products');
  };

  // ---------- Customers ----------
  const customers = () => read(KEYS.customers, []);
  const customerById = (id) => customers().find((c) => c.id === id) || null;

  const upsertCustomer = ({ name, email, city, country }) => {
    const list = customers();
    const existing = list.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
    const c = {
      id: uid('cus'),
      name: name || email.split('@')[0],
      email,
      city: city || '',
      country: country || '',
      joined_at: new Date().toISOString(),
    };
    write(KEYS.customers, [c, ...list]);
    notify('customers');
    return c;
  };

  // ---------- Orders ----------
  const orders = () => read(KEYS.orders, []);
  const orderById = (id) => orders().find((o) => o.id === id) || null;

  const updateOrderStatus = (id, status) => {
    const list = orders();
    const i = list.findIndex((o) => o.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], status };
    write(KEYS.orders, list);
    notify('orders');
    return list[i];
  };

  const placeOrder = ({ customer, items, shipping_address }) => {
    const list = orders();
    const now = new Date().toISOString();
    const lineItems = items.map((it) => {
      const p = productById(it.product_id);
      return {
        product_id: it.product_id,
        title: p ? p.title : 'Unknown',
        image: p ? p.images[0] : '',
        quantity: it.quantity,
        price_cents: p ? p.price_cents : 0,
      };
    });
    const subtotal = lineItems.reduce((s, it) => s + it.price_cents * it.quantity, 0);
    const numericNum = 1042 + list.length + 25;
    const o = {
      id: uid('ord'),
      number: `MA-${String(numericNum).padStart(4, '0')}`,
      customer_id: customer.id,
      customer_email: customer.email,
      customer_name: customer.name,
      items: lineItems,
      subtotal_cents: subtotal,
      shipping_cents: 0,
      discount_cents: 0,
      discount_code: '',
      total_cents: subtotal,
      currency: 'GBP',
      status: 'paid',
      created_at: now,
      shipping_address: shipping_address || { line1: '', city: customer.city, postal: '', country: customer.country },
    };
    write(KEYS.orders, [o, ...list]);

    // Decrement stock where tracked.
    const ps = products();
    for (const it of items) {
      const i = ps.findIndex((p) => p.id === it.product_id);
      if (i >= 0 && typeof ps[i].stock === 'number') {
        ps[i] = { ...ps[i], stock: Math.max(0, ps[i].stock - it.quantity) };
      }
    }
    write(KEYS.products, ps);

    notify('orders');
    notify('products');
    return o;
  };

  // ---------- Cart ----------
  const cart = () => read(KEYS.cart, []);
  const cartCount = () => cart().reduce((n, it) => n + it.quantity, 0);

  const addToCart = (product_id, quantity = 1) => {
    const list = cart();
    const i = list.findIndex((it) => it.product_id === product_id);
    if (i >= 0) list[i].quantity = Math.min(99, list[i].quantity + quantity);
    else list.push({ product_id, quantity });
    write(KEYS.cart, list);
    notify('cart');
  };

  const setCartQuantity = (product_id, quantity) => {
    const list = cart();
    const i = list.findIndex((it) => it.product_id === product_id);
    if (i < 0) return;
    if (quantity <= 0) list.splice(i, 1);
    else list[i].quantity = Math.min(99, quantity);
    write(KEYS.cart, list);
    notify('cart');
  };

  const removeFromCart = (product_id) => setCartQuantity(product_id, 0);
  const clearCart = () => { write(KEYS.cart, []); notify('cart'); };

  // ---------- Customer profiles (registered accounts) ----------
  const customerProfiles = () => read(KEYS.customer_profiles, []);
  const profileByEmail = (email) => {
    if (!email) return null;
    const lower = email.toLowerCase();
    return customerProfiles().find((p) => p.email && p.email.toLowerCase() === lower) || null;
  };

  // ---------- Customer derived stats ----------
  const customersWithStats = () => {
    const list = customers();
    const orderList = orders();
    return list.map((c) => {
      const mine = orderList.filter((o) => o.customer_id === c.id && o.status !== 'refunded');
      const total = mine.reduce((s, o) => s + o.total_cents, 0);
      const last = mine[0];
      const profile = profileByEmail(c.email);
      return {
        ...c,
        orders_count: mine.length,
        total_spent_cents: total,
        last_order_at: last ? last.created_at : null,
        has_account: !!profile,
        profile: profile || null,
      };
    });
  };

  // ---------- Email templates ----------
  const emailTemplates = () => read(KEYS.email_templates, []);
  const templateByKey = (key) => emailTemplates().find((t) => t.key === key) || null;
  const updateTemplate = (key, patch) => {
    const list = emailTemplates();
    const i = list.findIndex((t) => t.key === key);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
    write(KEYS.email_templates, list);
    notify('email_templates');
    return list[i];
  };

  // ---------- Email log ----------
  const emails = () => read(KEYS.email_log, []);
  const sendEmail = ({ template_key, recipient_email, recipient_name, subject, order_id }) => {
    const list = emails();
    const e = {
      id: uid('em'),
      template_key,
      recipient_email, recipient_name,
      subject,
      order_id,
      status: 'queued',
      sent_at: new Date().toISOString(),
      opened_at: null,
    };
    list.unshift(e);
    write(KEYS.email_log, list);
    notify('email_log');
    return e;
  };
  const resendEmail = (id) => {
    const list = emails();
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const copy = { ...list[i], id: uid('em'), status: 'queued', sent_at: new Date().toISOString(), opened_at: null };
    list.unshift(copy);
    write(KEYS.email_log, list);
    notify('email_log');
    return copy;
  };

  // ---------- Subscribers ----------
  const subscribers = () => read(KEYS.subscribers, []);
  const subscriberByEmail = (email) => subscribers().find((s) => s.email.toLowerCase() === email.toLowerCase()) || null;
  const addSubscriber = ({ email, source = 'manual' }) => {
    if (!email) throw new Error('email_required');
    const list = subscribers();
    if (list.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('already_subscribed');
    }
    const s = {
      id: uid('sub'),
      email: email.toLowerCase(),
      source,
      status: 'subscribed',
      subscribed_at: new Date().toISOString(),
    };
    list.unshift(s);
    write(KEYS.subscribers, list);
    notify('subscribers');
    return s;
  };
  const updateSubscriber = (id, patch) => {
    const list = subscribers();
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch };
    write(KEYS.subscribers, list);
    notify('subscribers');
    return list[i];
  };
  const removeSubscriber = (id) => {
    write(KEYS.subscribers, subscribers().filter((s) => s.id !== id));
    notify('subscribers');
  };

  // ---------- Discounts ----------
  const discounts = () => read(KEYS.discounts, []);
  const discountById = (id) => discounts().find((d) => d.id === id) || null;
  const addDiscount = (data) => {
    const list = discounts();
    if (list.some((d) => d.code.toLowerCase() === String(data.code || '').toLowerCase())) {
      throw new Error('code_taken');
    }
    const d = {
      id: uid('disc'),
      code: String(data.code || '').toUpperCase().trim(),
      type: data.type === 'fixed' ? 'fixed' : 'percent',
      value: Math.max(0, Number(data.value) || 0),
      minimum_cents: Math.max(0, Math.round(Number(data.minimum_cents) || 0)),
      applies_to: data.applies_to || 'all',
      status: data.status || 'active',
      starts_at: data.starts_at || new Date().toISOString(),
      ends_at: data.ends_at || null,
      usage_count: 0,
      usage_limit: data.usage_limit ? Math.max(0, Math.floor(Number(data.usage_limit))) : null,
      description: String(data.description || ''),
    };
    if (!d.code) throw new Error('code_required');
    list.unshift(d);
    write(KEYS.discounts, list);
    notify('discounts');
    return d;
  };
  const updateDiscount = (id, patch) => {
    const list = discounts();
    const i = list.findIndex((d) => d.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch };
    write(KEYS.discounts, list);
    notify('discounts');
    return list[i];
  };
  const deleteDiscount = (id) => {
    write(KEYS.discounts, discounts().filter((d) => d.id !== id));
    notify('discounts');
  };

  // ---------- Pages ----------
  const pages = () => read(KEYS.pages, []);
  const pageById = (id) => pages().find((p) => p.id === id) || null;
  const pageBySlug = (slug) => pages().find((p) => p.slug === slug) || null;
  const addPage = (data) => {
    const list = pages();
    let slug = slugify(data.slug || data.title);
    if (!slug) throw new Error('slug_required');
    let n = 2;
    while (list.some((p) => p.slug === slug)) slug = `${slugify(data.title)}-${n++}`;
    const p = {
      id: uid('pg'),
      slug,
      title: String(data.title || '').trim(),
      body: String(data.body || ''),
      status: data.status === 'draft' ? 'draft' : 'published',
      updated_at: new Date().toISOString(),
    };
    list.unshift(p);
    write(KEYS.pages, list);
    notify('pages');
    return p;
  };
  const updatePage = (id, patch) => {
    const list = pages();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const next = { ...list[i], ...patch, updated_at: new Date().toISOString() };
    if (patch.slug) next.slug = slugify(patch.slug) || list[i].slug;
    list[i] = next;
    write(KEYS.pages, list);
    notify('pages');
    return next;
  };
  const deletePage = (id) => {
    write(KEYS.pages, pages().filter((p) => p.id !== id));
    notify('pages');
  };

  // ---------- Settings ----------
  const settings = () => read(KEYS.settings, {});
  const updateSettings = (section, patch) => {
    const cur = settings();
    cur[section] = { ...(cur[section] || {}), ...patch };
    write(KEYS.settings, cur);
    notify('settings');
    return cur;
  };

  const reset = () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    ensureSeeded();
    notify('products'); notify('customers'); notify('orders'); notify('cart');
    notify('email_templates'); notify('email_log'); notify('subscribers');
    notify('discounts'); notify('pages'); notify('settings');
  };

  ensureSeeded();

  window.Store = {
    products, publishedProducts, productById, productBySlug,
    addProduct, updateProduct, deleteProduct,
    customers, customersWithStats, customerById, upsertCustomer,
    customerProfiles, profileByEmail,
    orders, orderById, updateOrderStatus, placeOrder,
    cart, cartCount, addToCart, setCartQuantity, removeFromCart, clearCart,
    emailTemplates, templateByKey, updateTemplate,
    emails, sendEmail, resendEmail,
    subscribers, subscriberByEmail, addSubscriber, updateSubscriber, removeSubscriber,
    discounts, discountById, addDiscount, updateDiscount, deleteDiscount,
    pages, pageById, pageBySlug, addPage, updatePage, deletePage,
    settings, updateSettings,
    reset,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
