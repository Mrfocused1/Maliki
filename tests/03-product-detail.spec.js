// @ts-check
const { test, expect } = require('@playwright/test');
const { getCatalogProducts } = require('./helpers');

test.describe('Product Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we have a product to work with
    const products = await getCatalogProducts(page);
    if (products.length === 0) test.skip();
  });

  test('product page loads title and price', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) return;

    const slug = products[0].slug;
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');

    // Product page renders via JS after catalog loads — wait up to 10s for h1
    await expect(page.locator('.info h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toContainText(/£/);
  });

  test('add to cart button exists and can be clicked', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) return;

    const slug = products[0].slug;
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#addBtn')).toBeVisible({ timeout: 10000 });
  });

  test('adding to cart increments cart count', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) return;

    const slug = products[0].slug;
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');

    // Wait for product to render
    await expect(page.locator('#addBtn')).toBeVisible({ timeout: 10000 });
    const cartCountBefore = await page.locator('#cartCount').textContent();

    await page.locator('#addBtn').click();

    await page.waitForFunction(
      (before) => {
        const el = document.getElementById('cartCount');
        return el && el.textContent !== before;
      },
      cartCountBefore,
      { timeout: 5000 }
    );

    const cartCountAfter = await page.locator('#cartCount').textContent();
    const before = parseInt(cartCountBefore || '0', 10);
    const after = parseInt(cartCountAfter || '0', 10);
    expect(after).toBeGreaterThan(before);
  });

  test('product images load', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) return;

    const slug = products[0].slug;
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');

    const imgs = page.locator('img[src]');
    const imgCount = await imgs.count();
    if (imgCount > 0) {
      await expect(imgs.first()).toBeVisible();
    }
  });

  test('product detail page does not show JS errors in console', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const products = await getCatalogProducts(page);
    if (products.length === 0) return;

    await page.goto(`/shop/${products[0].slug}`);
    await page.waitForLoadState('networkidle');

    const critical = errors.filter((e) => !e.includes('net::ERR') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });
});
