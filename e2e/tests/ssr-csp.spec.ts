import { expect, test } from '@playwright/test';

import { startSsrServer, type SsrServer } from '../apps/ssr-server/server';

test.describe('SSR CSP + noscript integration', () => {
  let server: SsrServer;

  test.beforeAll(async () => {
    server = await startSsrServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('injects container script with nonce and renders noscript fallback', async ({ page }) => {
    await page.goto(server.url, { waitUntil: 'networkidle' });

    const containerScripts = page.locator('script[data-gtm-container-id="GTM-TEST"]');
    await expect(containerScripts).toHaveCount(1);

    // Under CSP, Chromium hides the nonce content attribute (returns null/empty) but preserves
    // the IDL nonce property, which is exposed via the bootstrap below.
    const body = page.locator('body');
    await expect(body).toHaveAttribute('data-gtm-nonce-prop', 'test-nonce-123');
    await expect(containerScripts).toHaveAttribute(
      'src',
      /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-TEST&l=dataLayer/
    );

    const noscript = page.locator('noscript');
    await expect(noscript).toHaveCount(1);
    const noscriptHtml = await noscript.evaluate((element) => element.innerHTML || '');
    const normalizedNoscriptHtml = noscriptHtml.replace(/&amp;/g, '&');
    expect(normalizedNoscriptHtml).toContain('https://www.googletagmanager.com/ns.html?id=GTM-TEST&l=dataLayer');
    expect(normalizedNoscriptHtml).toContain('height="0"');
    expect(normalizedNoscriptHtml).toContain('width="0"');
  });
});
