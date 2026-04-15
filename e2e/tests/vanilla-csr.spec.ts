import { expect, test, type Page } from '@playwright/test';

import { startVanillaAppServer, type VanillaAppServer } from '../apps/vanilla-csr/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }
    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('Vanilla CSR example', () => {
  let server: VanillaAppServer;

  test.beforeAll(async () => {
    server = await startVanillaAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-VANILLA"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=vanillaDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
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
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
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

  test('has initial page_view event', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (e: unknown) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'page_view'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; page_title?: string }>(page);
    const pageViewEvent = dataLayer.find((e) => e.event === 'page_view');

    expect(pageViewEvent).toBeDefined();
    expect(pageViewEvent?.page_title).toBe('Vanilla CSR landing');
  });

  test('pushes page_view on button click', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial data layer
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    const initialDataLayer = await getDataLayer<{ event?: string }>(page);
    const initialPageViews = initialDataLayer.filter((e) => e.event === 'page_view').length;

    // Click the page view button
    await page.click('[data-action="pageview"]');

    // Wait for new page_view event
    await page.waitForFunction((count) => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      if (!Array.isArray(layer)) return false;
      const pageViews = layer.filter(
        (e: unknown) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'page_view'
      );
      return pageViews.length > count;
    }, initialPageViews);

    const dataLayer = await getDataLayer<{ event?: string; page_title?: string }>(page);
    const pageViews = dataLayer.filter((e) => e.event === 'page_view');

    expect(pageViews.length).toBeGreaterThan(initialPageViews);
    expect(pageViews[pageViews.length - 1].page_title).toBe('Manual page view');
  });

  test('pushes CTA event on button click', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial data layer
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    // Click the CTA button
    await page.click('[data-action="cta"]');

    // Wait for cta_click event
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      return Array.isArray(layer)
        ? layer.some(
            (e: unknown) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'cta_click'
          )
        : false;
    });

    const dataLayer = await getDataLayer<{ event?: string; cta_label?: string }>(page);
    const ctaEvent = dataLayer.find((e) => e.event === 'cta_click');

    expect(ctaEvent).toBeDefined();
    expect(ctaEvent?.cta_label).toBe('Get started');
  });

  test('updates consent on grant analytics click', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial consent
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
      return Array.isArray(layer)
        ? layer.some((entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'default')
        : false;
    });

    // Click grant analytics button
    await page.click('[data-action="grant-analytics"]');

    // Wait for consent update
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vanillaDataLayer?: unknown[] }).vanillaDataLayer;
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

  test('displays data layer snapshot in UI', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for data layer display
    const dataLayerPre = page.locator('[data-role="data-layer"]');
    await expect(dataLayerPre).toBeVisible();

    // Should contain data layer content
    const content = await dataLayerPre.textContent();
    expect(content).toContain('gtm.js');
    expect(content).toContain('page_view');
  });

  test('no console errors during initialization', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait a bit for any delayed errors
    await page.waitForTimeout(1000);

    // Filter out network errors (GTM script 404s are expected in tests)
    const realErrors = errors.filter((e) => !e.includes('googletagmanager') && !e.includes('Failed to load resource'));

    expect(realErrors).toHaveLength(0);
  });
});
