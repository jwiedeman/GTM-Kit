import { expect, test, type Page } from '@playwright/test';

import { startVueAppServer, type VueAppServer } from '../apps/vue-app/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }

    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('Vue 3 App example', () => {
  let server: VueAppServer;

  test.beforeAll(async () => {
    server = await startVueAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-VUEAPP"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=vueAppDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
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
      const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
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

  test('navigates between pages with Vue Router', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Verify home page (use regex to match URL ending with /)
    await expect(page).toHaveURL(/\/$/);

    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL(/\/products/);

    // Navigate to About
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about/);

    // Navigate back to Home
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('handles consent updates from cookie banner', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check for consent banner (if exists in the example)
    const banner = page.locator('[data-testid="cookie-banner"], .cookie-banner');
    const hasBanner = (await banner.count()) > 0;

    if (hasBanner) {
      // Try to accept cookies
      const acceptButton = page.locator('button:has-text("Accept"), button:has-text("Allow")');
      if ((await acceptButton.count()) > 0) {
        await acceptButton.click();

        // Wait for consent update
        await page.waitForFunction(() => {
          const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
          return Array.isArray(layer)
            ? layer.some((entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update')
            : false;
        });

        const dataLayer = await getDataLayer<unknown>(page);
        const consentUpdate = dataLayer.find(
          (entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update'
        );

        expect(consentUpdate).toBeDefined();
      }
    }
  });

  test('data layer persists through SPA navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Get initial data layer length
    const initialLength = await page.evaluate(() => {
      const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    // Navigate to multiple pages
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/products/);

    await page.getByRole('link', { name: 'About' }).click();
    await page.waitForURL(/\/about/);

    // Data layer should still exist and potentially have more entries
    const finalLength = await page.evaluate(() => {
      const layer = (window as unknown as { vueAppDataLayer?: unknown[] }).vueAppDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    expect(finalLength).toBeGreaterThanOrEqual(initialLength);
  });
});
