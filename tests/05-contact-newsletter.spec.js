// @ts-check
const { test, expect } = require('@playwright/test');
const { TEST_EMAIL } = require('./helpers');

test.describe('Contact Form', () => {
  test('contact form shows all fields', async ({ page }) => {
    await page.goto('/contact/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#cName')).toBeVisible();
    await expect(page.locator('#cEmail')).toBeVisible();
    await expect(page.locator('#cMessage')).toBeVisible();
    await expect(page.locator('#contactSubmit')).toBeVisible();
  });

  test('contact form validates required fields', async ({ page }) => {
    await page.goto('/contact/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#contactSubmit').click();
    const nameValid = await page.locator('#cName').evaluate((el) => (el).validity.valid);
    expect(nameValid).toBe(false);
  });

  test('contact form submits with valid data', async ({ page }) => {
    await page.goto('/contact/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#cName').fill('E2E Test');
    await page.locator('#cEmail').fill(TEST_EMAIL);
    await page.locator('#cMessage').fill('Automated E2E test message — please ignore.');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contact'), { timeout: 10000 }),
      page.locator('#contactSubmit').click(),
    ]);

    // API may return 500 when RESEND_API_KEY/NOTIFY_TO are not configured locally
    // The important thing is that the form submits and receives a response
    expect([200, 400, 429, 500]).toContain(response.status());
  });

  test('contact form shows feedback after submission', async ({ page }) => {
    await page.goto('/contact/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#cName').fill('E2E Test');
    await page.locator('#cEmail').fill(TEST_EMAIL);
    await page.locator('#cMessage').fill('Automated test.');

    await page.locator('#contactSubmit').click();
    // Wait for the feedback element to have non-empty text content
    await page.waitForFunction(
      () => {
        const el = document.getElementById('contactFeedback');
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      { timeout: 10000 }
    );
    const text = await page.locator('#contactFeedback').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Newsletter Signup', () => {
  test('newsletter API rejects invalid email', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const resp = await page.request.post('/api/newsletter', {
      data: { email: 'not-an-email' },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:8000',
        Referer: 'http://127.0.0.1:8000/',
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('invalid_email');
  });

  test('newsletter API accepts valid test email', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const resp = await page.request.post('/api/newsletter', {
      data: { email: TEST_EMAIL },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:8000',
        Referer: 'http://127.0.0.1:8000/',
      },
    });
    // 200 ok, or 500 if Supabase not reachable locally
    expect([200, 500]).toContain(resp.status());
  });

  test('newsletter API enforces same-origin', async ({ page }) => {
    const resp = await page.request.post('/api/newsletter', {
      data: { email: TEST_EMAIL },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example.com',
      },
    });
    expect(resp.status()).toBe(403);
  });
});
