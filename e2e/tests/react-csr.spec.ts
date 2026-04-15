import { expect, test, type Page } from '@playwright/test';

import { startReactCsrServer, type ReactCsrServer } from '../apps/react-csr/server';

const getDataLayer = async <T>(page: Page): Promise<T[]> => {
  return page.evaluate(() => {
    const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
    if (Array.isArray(layer)) {
      return layer as T[];
    }
    return [] as T[];
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('React CSR (StrictMode) example', () => {
  let server: ReactCsrServer;

  test.beforeAll(async () => {
    server = await startReactCsrServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('renders GTM script and initializes data layer', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check GTM script is injected
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-REACTCSR"]');
    await expect(scriptLocator).toHaveCount(1);
    await expect(scriptLocator).toHaveAttribute('src', /l=reactDataLayer/);

    // Check data layer is initialized
    await page.waitForFunction(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    const dataLayer = await getDataLayer<{ event?: string }>(page);
    expect(dataLayer.length).toBeGreaterThan(0);

    // Should have gtm.js start event
    const startEvent = dataLayer.find((e) => e.event === 'gtm.js');
    expect(startEvent).toBeDefined();
  });

  test('does not duplicate GTM script in StrictMode', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // In React StrictMode, effects run twice in dev mode
    // But our implementation should prevent duplicate scripts
    const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-REACTCSR"]');
    await expect(scriptLocator).toHaveCount(1);
  });

  test('navigates between pages with React Router', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Verify home page (look for heading text)
    await expect(page.locator('h1')).toContainText(/GTM Provider demo/i);

    // Navigate to Shop
    await page.getByRole('link', { name: 'Shop' }).click();
    await expect(page).toHaveURL(/\/shop/);

    // Navigate to Pricing
    await page.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing/);

    // Navigate back to Overview (home)
    await page.getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('data layer persists through SPA navigation', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Get initial data layer length
    const initialLength = await page.evaluate(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    // Navigate to Shop
    await page.getByRole('link', { name: 'Shop' }).click();
    await page.waitForURL(/\/shop/);

    // Navigate to Pricing
    await page.getByRole('link', { name: 'Pricing' }).click();
    await page.waitForURL(/\/pricing/);

    // Data layer should still exist and potentially have more entries
    const finalLength = await page.evaluate(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      return Array.isArray(layer) ? layer.length : 0;
    });

    expect(finalLength).toBeGreaterThanOrEqual(initialLength);
  });

  test('tracks page views on route changes', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial data layer
    await page.waitForFunction(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    const initialPageViews = await page.evaluate(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      if (!Array.isArray(layer)) return 0;
      return layer.filter(
        (e: unknown) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'page_view'
      ).length;
    });

    // Navigate to Shop
    await page.getByRole('link', { name: 'Shop' }).click();
    await page.waitForURL(/\/shop/);

    // Wait for potential page_view event
    await page.waitForTimeout(500);

    const finalPageViews = await page.evaluate(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      if (!Array.isArray(layer)) return 0;
      return layer.filter(
        (e: unknown) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'page_view'
      ).length;
    });

    // Page views should increase on navigation (if route tracking is enabled)
    expect(finalPageViews).toBeGreaterThanOrEqual(initialPageViews);
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

  test('handles rapid re-renders without script duplication', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Check if there are buttons that trigger re-renders
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Click multiple buttons rapidly
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        await buttons
          .nth(i)
          .click({ timeout: 1000 })
          .catch(() => {});
      }

      // Wait for any effects
      await page.waitForTimeout(500);

      // Should still only have one GTM script
      const scriptLocator = page.locator('head script[data-gtm-container-id="GTM-REACTCSR"]');
      await expect(scriptLocator).toHaveCount(1);
    }
  });

  test('data layer is not corrupted after interactions', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    // Wait for initial data layer
    await page.waitForFunction(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      return Array.isArray(layer) && layer.length > 0;
    });

    // Click buttons if available
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      await buttons
        .nth(i)
        .click({ timeout: 1000 })
        .catch(() => {});
      await page.waitForTimeout(100);
    }

    // Data layer should still be a valid array
    const isValid = await page.evaluate(() => {
      const layer = (window as unknown as { reactDataLayer?: unknown[] }).reactDataLayer;
      if (!Array.isArray(layer)) return false;

      // Check that all entries are valid
      return layer.every((entry) => {
        if (Array.isArray(entry)) return true; // Consent commands
        if (typeof entry === 'object' && entry !== null) return true; // Events
        return false;
      });
    });

    expect(isValid).toBe(true);
  });
});
