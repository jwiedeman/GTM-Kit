import { expect, test, type Page } from '@playwright/test';

import { startSvelteAppServer, type SvelteAppServer } from '../apps/svelte-app/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }

    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('SvelteKit App example', () => {
  let server: SvelteAppServer;

  test.beforeAll(async () => {
    server = await startSvelteAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-SVELTE"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=svelteDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
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
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
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

  test('pushes page_view event on mount', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for page_view event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'page_view'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; page_title?: string; page_path?: string }>(page);
    const pageView = dataLayer.find((e) => e.event === 'page_view');

    expect(pageView).toBeDefined();
    expect(pageView?.page_title).toBe('Home');
    expect(pageView?.page_path).toBe('/');
  });

  test('navigates between pages with SvelteKit routing', async ({ page }) => {
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

  test('pushes events on navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    // Wait for Products page e-commerce event (view_item_list)
    // The Svelte e-commerce demo tracks view_item_list instead of page_view on the products page
    await page.waitForFunction(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) =>
              typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'view_item_list'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; ecommerce?: unknown }>(page);
    const viewItemList = dataLayer.find((e) => e.event === 'view_item_list');

    expect(viewItemList).toBeDefined();
    expect(viewItemList?.ecommerce).toBeDefined();
  });

  test('data layer persists through SPA navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Get initial data layer length
    const initialLength = await page.evaluate(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    // Navigate to multiple pages
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    await page.getByRole('link', { name: 'About' }).click();
    await page.waitForURL(/\/about/);

    // Data layer should still exist and have more entries
    const finalLength = await page.evaluate(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    expect(finalLength).toBeGreaterThanOrEqual(initialLength);
  });

  test('handles consent updates via button click', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Click the Grant Analytics button
    const grantButton = page.locator('button:has-text("Grant Analytics")');
    await grantButton.click();

    // Wait for consent update
    await page.waitForFunction(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
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

  test('pushes custom events via button clicks', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Click the CTA button
    const ctaButton = page.locator('button:has-text("Push CTA Click")');
    await ctaButton.click();

    // Wait for cta_click event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { svelteDataLayer?: unknown[] }).svelteDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (entry) => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'cta_click'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; cta_label?: string }>(page);
    const ctaEvent = dataLayer.find((e) => e.event === 'cta_click');

    expect(ctaEvent).toBeDefined();
    expect(ctaEvent?.cta_label).toBe('Get Started');
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
