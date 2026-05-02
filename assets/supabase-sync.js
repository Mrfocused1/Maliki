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

  const base = {
    addProduct: window.Store.addProduct,
    updateProduct: window.Store.updateProduct,
    deleteProduct: window.Store.deleteProduct,
    updateOrderStatus: window.Store.updateOrderStatus,
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

  window.Store.updateOrderStatus = (id, status) => {
    const order = base.updateOrderStatus(id, status);
    fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch((err) => emitSyncError(`Order status failed: ${err.message}`));
    return order;
  };

  window.Store.placeRemoteOrder = async ({ customer, items, shipping_address }) => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items, shipping_address }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || 'checkout_failed');
      error.data = data;
      throw error;
    }
    return data.order;
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

  const baseUpdateTemplate = window.Store.updateTemplate;
  window.Store.updateTemplate = (key, patch) => {
    const result = baseUpdateTemplate(key, patch);
    fetch('/api/admin/emails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ...patch }),
    }).catch((err) => emitSyncError(`Template save failed: ${err.message}`));
    return result;
  };

  window.Store.loadRemoteCatalog = loadCatalog;
  window.Store.loadRemoteAdminData = loadAdminData;
  loadCatalog();
})();
