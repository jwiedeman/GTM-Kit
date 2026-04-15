import { expect, test, type Page } from '@playwright/test';

import { startSolidAppServer, type SolidAppServer } from '../apps/solid-app/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }

    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('SolidJS App example', () => {
  let server: SolidAppServer;

  test.beforeAll(async () => {
    server = await startSolidAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-SOLIDAPP"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=solidDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    const dataLayer = await getDataLayer<{ event?: string }>(page);
    expect(dataLayer.length).toBeGreaterThan(0);

    // Should have gtm.js start event
    const startEvent = dataLayer.find((e) => e.event === 'gtm.js');
    expect(startEvent).toBeDefined();
  });

  test('applies consent defaults', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for consent to be set
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some((entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'default')
        : false;
    });

    const dataLayer = await getDataLayer<unknown>(page);
    const consentDefault = dataLayer.find(
      (entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'default'
    ) as unknown[];

    expect(consentDefault).toBeDefined();
    expect(consentDefault[2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied'
    });
  });

  test('navigates between pages with SolidJS Router', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Debug: Log any errors
    console.log('Console errors:', errors);

    // Debug: Check what's actually on the page
    const bodyHtml = await page.locator('body').innerHTML();
    console.log('Body HTML (first 500 chars):', bodyHtml.substring(0, 500));

    const navHtml = await page
      .locator('nav')
      .innerHTML()
      .catch(() => 'NAV NOT FOUND');
    console.log('Navigation HTML:', navHtml);

    const allLinks = await page
      .locator('a')
      .allTextContents()
      .catch(() => [] as string[]);
    console.log('All links on page:', allLinks);

    // Verify home page
    await expect(page).toHaveURL(/\/$/);

    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL(/\/products/);

    // Navigate to About
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about/);

    // Navigate back to Home
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('tracks page_view events on navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial page_view
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'page_view'
          )
        : false;
    });

    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    // Wait for Products page_view
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) =>
              typeof entry === 'object' &&
              entry !== null &&
              'event' in entry &&
              entry.event === 'page_view' &&
              'page_path' in entry &&
              entry.page_path === '/products'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; page_path?: string }>(page);
    const productsPageView = dataLayer.find((e) => e.event === 'page_view' && e.page_path === '/products');

    expect(productsPageView).toBeDefined();
  });

  test('tracks cta_click event', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Click the CTA button
    const ctaButton = page.locator('button:has-text("Get Started")');
    await ctaButton.click();

    // Wait for cta_click event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'cta_click'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; cta_name?: string }>(page);
    const ctaEvent = dataLayer.find((e) => e.event === 'cta_click');

    expect(ctaEvent).toBeDefined();
    expect(ctaEvent?.cta_name).toBe('hero_get_started');
  });

  test('tracks e-commerce add_to_cart event', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    // Click Add to Cart button
    const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
    await addToCartButton.click();

    // Wait for add_to_cart event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'add_to_cart'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; ecommerce?: { items?: unknown[] } }>(page);
    const addToCartEvent = dataLayer.find((e) => e.event === 'add_to_cart');

    expect(addToCartEvent).toBeDefined();
    expect(addToCartEvent?.ecommerce?.items).toBeDefined();
    expect(addToCartEvent?.ecommerce?.items?.length).toBeGreaterThan(0);
  });

  test('handles consent updates', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Click the Grant Analytics button
    const grantButton = page.locator('button:has-text("Grant Analytics Consent")');
    await grantButton.click();

    // Wait for consent update
    await page.waitForFunction(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer)
        ? layer.some((entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update')
        : false;
    });

    const dataLayer = await getDataLayer<unknown>(page);
    const consentUpdate = dataLayer.find(
      (entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update'
    ) as unknown[];

    expect(consentUpdate).toBeDefined();
    expect(consentUpdate[2]).toMatchObject({
      analytics_storage: 'granted'
    });
  });

  test('data layer persists through SPA navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Get initial data layer length
    const initialLength = await page.evaluate(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    // Navigate to multiple pages
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    await page.getByRole('link', { name: 'About' }).click();
    await page.waitForURL(/\/about/);

    // Data layer should still exist and have more entries
    const finalLength = await page.evaluate(() => {
      const layer = (window as unknown as { solidDataLayer?: unknown[] }).solidDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    expect(finalLength).toBeGreaterThanOrEqual(initialLength);
  });

  test('no console errors during navigation', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(server.url, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);
    await page.getByRole('link', { name: 'About' }).click();
    await page.waitForURL(/\/about/);
    await page.getByRole('link', { name: 'Home' }).click();
    await page.waitForURL(/\/$/);

    // Filter out known acceptable errors (like GTM container not found in dev)
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('GTM-') && !error.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
