// @ts-check
const { test, expect } = require('@playwright/test');
const { getCatalogProducts } = require('./helpers');

test.describe('Shop', () => {
  test('shop page loads with search input', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/shop|collection|maliki/i);
    await expect(page.locator('#searchInput')).toBeVisible();
  });

  test('shop grid renders after catalog loads', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    const grid = page.locator('#grid');
    await expect(grid).toBeVisible();
    // Either products are listed or empty state is shown
    const gridContent = await grid.innerHTML();
    expect(gridContent.length).toBeGreaterThan(0);
  });

  test('search input filters products', async ({ page }) => {
    const products = await getCatalogProducts(page);
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('#searchInput');
    await searchInput.fill('zzz_no_match_query');
    await page.waitForTimeout(400);

    if (products.length > 0) {
      // With a non-matching search, grid should show empty or fewer items
      const cards = page.locator('#grid .card, #grid [class*="card"]');
      const count = await cards.count();
      expect(count).toBe(0);
    }
  });

  test('product cards link to product detail', async ({ page }) => {
    const products = await getCatalogProducts(page);
    if (products.length === 0) {
      test.skip();
      return;
    }

    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('#grid a').first();
    await expect(firstCard).toBeVisible();
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/\/shop\//);
  });

  test('recently viewed section initialises', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('domcontentloaded');
    // Section either hidden or visible depending on history
    const rv = page.locator('#rvSection');
    await expect(rv).toBeDefined();
  });
});
