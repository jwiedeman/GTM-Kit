import { expect, test, type Page } from '@playwright/test';

import { startAstroAppServer, type AstroAppServer } from '../apps/astro-app/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }

    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('Astro App example', () => {
  let server: AstroAppServer;

  test.beforeAll(async () => {
    server = await startAstroAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-ASTROAPP"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=astroDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
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
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
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
      ad_storage: 'denied',
      analytics_storage: 'denied'
    });
  });

  test('tracks page_view events', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial page_view
    await page.waitForFunction(() => {
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'page_view'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; page_path?: string }>(page);
    const pageView = dataLayer.find((e) => e.event === 'page_view');

    expect(pageView).toBeDefined();
    expect(pageView?.page_path).toBe('/');
  });

  test('navigates between pages', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

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

  test('tracks cta_click event', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Click the CTA button
    const ctaButton = page.locator('#cta-button');
    await ctaButton.click();

    // Wait for cta_click event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
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
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Click Add to Cart button
    const addToCartButton = page.locator('.add-to-cart').first();
    await addToCartButton.click();

    // Wait for add_to_cart event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
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
    const grantButton = page.locator('#grant-analytics');
    await grantButton.click();

    // Wait for consent update
    await page.waitForFunction(() => {
      const layer = (window as unknown as { astroDataLayer?: unknown[] }).astroDataLayer;
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

  test('no console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Filter out known acceptable errors (like GTM container not found in dev)
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('GTM-') && !error.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('no console errors on products page', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('GTM-') && !error.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
