(function () {
  if (!window.Store || !window.fetch) return;

  const KEYS = {
    products: 'maliki.products',
    customers: 'maliki.customers',
    orders: 'maliki.orders',
    email_templates: 'maliki.email_templates',
    email_log: 'maliki.email_log',
    subscribers: 'maliki.subscribers',
    discounts: 'maliki.discounts',
    pages: 'maliki.pages',
    settings: 'maliki.settings',
    customer_profiles: 'maliki.customer_profiles',
  };

  const writeStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    } catch {}
  };

  const replaceProducts = (products) => writeStore(KEYS.products, products);

  const loadCatalog = async () => {
    try {
      const res = await fetch('/api/catalog', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.products)) replaceProducts(data.products);
      if (data.homepage && typeof data.homepage === 'object') {
        const cur = JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
        cur.homepage = data.homepage;
        writeStore(KEYS.settings, cur);
      }
    } catch {}
  };

  const loadAdminData = async () => {
    const res = await fetch('/api/admin/data', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('admin_data_unavailable');
    const data = await res.json();
    for (const [name, key] of Object.entries(KEYS)) {
      if (Object.prototype.hasOwnProperty.call(data, name)) writeStore(key, data[name]);
    }
    return data;
  };

  const syncProduct = async (method, payload) => {
    // For DELETE, pass id as query param — Vercel does not reliably parse DELETE bodies.
    // For POST/PATCH, strip base64 images so we don't blow the 4.5 MB body limit;
    // image URLs that are already remote URLs are kept.
    let url = '/api/admin/products';
    let body;
    if (method === 'DELETE') {
      url += `?id=${encodeURIComponent(payload.id)}`;
      body = undefined;
    } else {
      const clean = { ...payload };
      if (Array.isArray(clean.images)) {
        clean.images = clean.images.filter((u) => u && !u.startsWith('data:'));
      }
      body = JSON.stringify(clean);
    }
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body } : {}),
    });
    if (!res.ok) throw new Error('product_sync_failed');
    return await res.json().catch(() => ({}));
  };

  const emitSyncError = (msg) =>
    window.dispatchEvent(new CustomEvent('maliki:sync-error', { detail: msg }));

  const syncPage = async (method, payload) => {
    let url = '/api/admin/pages';
    if (method === 'DELETE') url += `?id=${encodeURIComponent(payload.id)}`;
    const body = method !== 'DELETE' ? JSON.stringify(payload) : undefined;
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body } : {}),
    });
    if (!res.ok) throw new Error('page_sync_failed');
    return res.json().catch(() => ({}));
  };

  const base = {
    addProduct: window.Store.addProduct,
    updateProduct: window.Store.updateProduct,
    deleteProduct: window.Store.deleteProduct,
    updateOrderStatus: window.Store.updateOrderStatus,
    addPage: window.Store.addPage,
    updatePage: window.Store.updatePage,
    deletePage: window.Store.deletePage,
  };

  window.Store.addProduct = (data) => {
    const product = base.addProduct(data);
    product.remoteSync = syncProduct('POST', product)
      .catch((err) => emitSyncError(`Product save failed: ${err.message}`));
    return product;
  };

  window.Store.updateProduct = (id, data) => {
    const product = base.updateProduct(id, data);
    if (product) product.remoteSync = syncProduct('PATCH', product)
      .catch((err) => emitSyncError(`Product update failed: ${err.message}`));
    return product;
  };

  window.Store.deleteProduct = (id) => {
    base.deleteProduct(id);
    return syncProduct('DELETE', { id })
      .catch((err) => emitSyncError(`Product delete failed: ${err.message}`));
  };

  window.Store.addPage = (data) => {
    const page = base.addPage(data);
    syncPage('POST', page).catch((err) => emitSyncError(`Page save failed: ${err.message}`));
    return page;
  };

  window.Store.updatePage = (id, data) => {
    const page = base.updatePage(id, data);
    if (page) syncPage('PATCH', { id, ...data }).catch((err) => emitSyncError(`Page update failed: ${err.message}`));
    return page;
  };

  window.Store.deletePage = (id) => {
    base.deletePage(id);
    return syncPage('DELETE', { id }).catch((err) => emitSyncError(`Page delete failed: ${err.message}`));
  };

  window.Store.updateOrderStatus = (id, status) => {
    const order = base.updateOrderStatus(id, status);
    fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch((err) => emitSyncError(`Order status failed: ${err.message}`));
    return order;
  };


  const baseUpdateSettings = window.Store.updateSettings;
  window.Store.updateSettings = (section, value) => {
    const result = baseUpdateSettings(section, value);
    fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, value }),
    }).catch((err) => emitSyncError(`Settings save failed: ${err.message}`));
    return result;
  };

  const syncTemplate = async (key, patch) => {
    const res = await fetch('/api/admin/emails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ...patch }),
    });
    if (!res.ok) throw new Error('template_sync_failed');
  };

  const baseUpdateTemplate = window.Store.updateTemplate;
  window.Store.updateTemplate = (key, patch) => {
    const result = baseUpdateTemplate(key, patch);
    if (result) result.remoteSync = syncTemplate(key, patch);
    return result;
  };

  const loadHomepageSettings = async () => {
    try {
      const res = await fetch('/api/homepage', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data.homepage && typeof data.homepage === 'object') {
        const cur = JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
        cur.homepage = data.homepage;
        writeStore(KEYS.settings, cur);
      }
    } catch {}
  };

  window.Store.loadRemoteCatalog = loadCatalog;
  window.Store.loadRemoteAdminData = loadAdminData;
  window.Store.loadHomepageSettings = loadHomepageSettings;
  loadCatalog();
})();
