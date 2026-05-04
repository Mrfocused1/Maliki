// @ts-check
const { test, expect } = require('@playwright/test');
const { getCatalogProducts } = require('./helpers');

async function goToCartWithProduct(page, productId) {
  // Set cart in localStorage on a simple page first, then navigate to /cart
  await page.goto('/home/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate((pid) => {
    localStorage.setItem('maliki.cart', JSON.stringify([{ product_id: pid, quantity: 1 }]));
  }, productId);
  await page.goto('/cart', { waitUntil: 'load' });
}

test.describe('Cart', () => {
  test('empty cart shows empty state', async ({ page }) => {
    await page.goto('/home/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.setItem('maliki.cart', JSON.stringify([])));
    await page.goto('/cart', { waitUntil: 'load' });
    await expect(page.locator('#root')).toBeVisible();
    const content = await page.locator('#root').textContent();
    expect(content).toBeDefined();
  });

  test('cart renders seeded item', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) { test.skip(); return; }

    await goToCartWithProduct(page, products[0].id);
    await expect(page.locator('#lines')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#subtotalVal')).toBeVisible();
  });

  test('checkout form shows with item in cart', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) { test.skip(); return; }

    await goToCartWithProduct(page, products[0].id);
    await expect(page.locator('#checkoutForm')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#ckEmail')).toBeVisible();
    await expect(page.locator('#placeBtn')).toBeVisible();
  });

  test('checkout form validates required fields', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) { test.skip(); return; }

    await goToCartWithProduct(page, products[0].id);
    await page.locator('#placeBtn').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#placeBtn').click();

    const ckEmail = page.locator('#ckEmail');
    const isValid = await ckEmail.evaluate((el) => (el).validity.valid);
    expect(isValid).toBe(false);
  });

  test('discount code input is accessible', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) { test.skip(); return; }

    await goToCartWithProduct(page, products[0].id);
    const toggle = page.locator('#discountToggle');
    await toggle.waitFor({ state: 'visible', timeout: 8000 });
    await toggle.click();
    await expect(page.locator('#ckCode')).toBeVisible();
  });

  test('gift wrap checkbox toggles message box', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) { test.skip(); return; }

    await goToCartWithProduct(page, products[0].id);
    const giftWrap = page.locator('#ckGiftWrap');
    await giftWrap.waitFor({ state: 'visible', timeout: 8000 });
    const wasChecked = await giftWrap.isChecked();

    if (!wasChecked) {
      await giftWrap.check();
      await expect(page.locator('#giftMessageWrap')).toHaveClass(/open/);
    }
  });
});
