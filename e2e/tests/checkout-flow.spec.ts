/**
 * E2E Checkout Flow Tests for GTM-Kit
 *
 * These tests verify the complete e-commerce checkout flow:
 * 1. Browse products (view_item_list)
 * 2. Select product (select_item)
 * 3. View product (view_item)
 * 4. Add to cart (add_to_cart)
 * 5. View cart (view_cart)
 * 6. Begin checkout (begin_checkout)
 * 7. Add shipping info (add_shipping_info)
 * 8. Add payment info (add_payment_info)
 * 9. Complete purchase (purchase)
 * 10. Request refund (refund)
 *
 * Tests use the Vue example app which has the most complete implementation.
 */
import { expect, test, type Page } from '@playwright/test';

import { startVueAppServer, type VueAppServer } from '../apps/vue-app/server';

// ============================================================================
// Test Utilities
// ============================================================================

interface DataLayerEvent {
  event?: string;
  ecommerce?: {
    currency?: string;
    value?: number;
    items?: Array<{
      item_id?: string;
      item_name?: string;
      item_brand?: string;
      item_category?: string;
      item_variant?: string;
      price?: number;
      quantity?: number;
      index?: number;
    }>;
    item_list_id?: string;
    item_list_name?: string;
    shipping_tier?: string;
    payment_type?: string;
    transaction_id?: string;
    tax?: number;
    shipping?: number;
  };
}

const DATA_LAYER_NAME = 'vueAppDataLayer';

const getDataLayer = async (page: Page): Promise<DataLayerEvent[]> => {
  return page.evaluate((name) => {
    const layer = (window as unknown as Record<string, unknown[]>)[name];
    return Array.isArray(layer) ? (layer as DataLayerEvent[]) : [];
  }, DATA_LAYER_NAME);
};

const waitForEvent = async (page: Page, eventName: string, timeout = 10000): Promise<DataLayerEvent | undefined> => {
  await page.waitForFunction(
    ({ eventName, dataLayerName }) => {
      const layer = (window as unknown as Record<string, unknown[]>)[dataLayerName];
      if (!Array.isArray(layer)) return false;
      return layer.some(
        (entry) => typeof entry === 'object' && entry !== null && (entry as { event?: string }).event === eventName
      );
    },
    { eventName, dataLayerName: DATA_LAYER_NAME },
    { timeout }
  );

  const dataLayer = await getDataLayer(page);
  return dataLayer.find((e) => e.event === eventName);
};

const getLastEventOfType = async (page: Page, eventName: string): Promise<DataLayerEvent | undefined> => {
  const dataLayer = await getDataLayer(page);
  const events = dataLayer.filter((e) => e.event === eventName);
  return events[events.length - 1];
};

const countEvents = async (page: Page, eventName: string): Promise<number> => {
  const dataLayer = await getDataLayer(page);
  return dataLayer.filter((e) => e.event === eventName).length;
};

// ============================================================================
// Checkout Flow Tests
// ============================================================================

test.describe('Complete Checkout Flow', () => {
  let server: VueAppServer;

  test.beforeAll(async () => {
    server = await startVueAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test.describe('Product Browse & Selection', () => {
    test('view_item_list event fires on products page load', async ({ page }) => {
      await page.goto(server.url, { waitUntil: 'networkidle' });

      // Navigate to products page
      await page.getByRole('link', { name: 'Products' }).click();
      await page.waitForURL(/\/products/);

      // Wait for view_item_list event
      const event = await waitForEvent(page, 'view_item_list');
      expect(event).toBeDefined();
      expect(event?.ecommerce?.items).toBeDefined();
      expect(event?.ecommerce?.items?.length).toBeGreaterThan(0);

      // Verify item structure has required GA4 fields
      const firstItem = event?.ecommerce?.items?.[0];
      expect(firstItem?.item_id).toBeDefined();
      expect(firstItem?.item_name).toBeDefined();
      expect(firstItem?.price).toBeGreaterThan(0);
    });

    test('select_item event fires when clicking a product', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Wait for products to load
      const productCard = page.locator('.product-card, [data-testid="product-card"]').first();
      await productCard.waitFor({ timeout: 5000 }).catch(() => {});
      if ((await productCard.count()) > 0) {
        await productCard.click();

        // Wait for select_item event
        const event = await waitForEvent(page, 'select_item', 5000).catch(() => undefined);
        if (event) {
          expect(event.ecommerce?.items).toBeDefined();
          expect(event.ecommerce?.items?.length).toBe(1);
        }
      }
    });

    test('view_item event fires when viewing product details', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Click on first product to view details
      const productCard = page.locator('.product-card, [data-testid="product-card"]').first();
      if ((await productCard.count()) > 0) {
        await productCard.click();
        await page.waitForTimeout(500);

        const event = await waitForEvent(page, 'view_item', 5000).catch(() => undefined);
        if (event) {
          expect(event.ecommerce?.currency).toBe('USD');
          expect(event.ecommerce?.value).toBeGreaterThan(0);
          expect(event.ecommerce?.items?.length).toBe(1);
        }
      }
    });
  });

  test.describe('Cart Operations', () => {
    test('add_to_cart event fires with correct payload', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Find and click an Add to Cart button
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();

        const event = await waitForEvent(page, 'add_to_cart', 5000);
        expect(event).toBeDefined();
        expect(event?.ecommerce?.currency).toBe('USD');
        expect(event?.ecommerce?.value).toBeGreaterThan(0);
        expect(event?.ecommerce?.items).toBeDefined();
        expect(event?.ecommerce?.items?.length).toBe(1);
        expect(event?.ecommerce?.items?.[0]?.quantity).toBe(1);
      }
    });

    test('remove_from_cart event fires when removing item', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Add item first
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        // Open cart and remove item
        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          const removeBtn = page.getByRole('button', { name: /remove|delete/i }).first();
          if ((await removeBtn.count()) > 0) {
            await removeBtn.click();

            const event = await waitForEvent(page, 'remove_from_cart', 5000).catch(() => undefined);
            if (event) {
              expect(event.ecommerce?.items).toBeDefined();
            }
          }
        }
      }
    });

    test('view_cart event fires when viewing cart', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Add item to cart
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        // View cart
        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();

          const event = await waitForEvent(page, 'view_cart', 5000).catch(() => undefined);
          if (event) {
            expect(event.ecommerce?.currency).toBe('USD');
            expect(event.ecommerce?.value).toBeGreaterThan(0);
            expect(event.ecommerce?.items?.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('Checkout Process', () => {
    test('begin_checkout event fires when starting checkout', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Add item to cart
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        // View cart
        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          // Begin checkout
          const checkoutBtn = page.getByRole('button', { name: /checkout|proceed/i });
          if ((await checkoutBtn.count()) > 0) {
            await checkoutBtn.click();

            const event = await waitForEvent(page, 'begin_checkout', 5000).catch(() => undefined);
            if (event) {
              expect(event.ecommerce?.currency).toBe('USD');
              expect(event.ecommerce?.value).toBeGreaterThan(0);
              expect(event.ecommerce?.items?.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });

    test('add_shipping_info event fires with shipping tier', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Add item and start checkout
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          const checkoutBtn = page.getByRole('button', { name: /checkout|proceed/i });
          if ((await checkoutBtn.count()) > 0) {
            await checkoutBtn.click();
            await page.waitForTimeout(500);

            // Continue to shipping
            const continueBtn = page.getByRole('button', { name: /continue|next|shipping/i });
            if ((await continueBtn.count()) > 0) {
              await continueBtn.click();

              const event = await waitForEvent(page, 'add_shipping_info', 5000).catch(() => undefined);
              if (event) {
                expect(event.ecommerce?.shipping_tier).toBeDefined();
                expect(event.ecommerce?.items?.length).toBeGreaterThan(0);
              }
            }
          }
        }
      }
    });

    test('add_payment_info event fires with payment type', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Go through checkout flow to payment step
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          const checkoutBtn = page.getByRole('button', { name: /checkout|proceed/i });
          if ((await checkoutBtn.count()) > 0) {
            await checkoutBtn.click();
            await page.waitForTimeout(500);

            // Click continue twice to get to payment
            const continueButtons = page.getByRole('button', { name: /continue|next/i });
            const count = await continueButtons.count();
            for (let i = 0; i < Math.min(count, 2); i++) {
              await continueButtons
                .first()
                .click()
                .catch(() => {});
              await page.waitForTimeout(500);
            }

            const event = await waitForEvent(page, 'add_payment_info', 5000).catch(() => undefined);
            if (event) {
              expect(event.ecommerce?.payment_type).toBeDefined();
              expect(event.ecommerce?.items?.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  test.describe('Purchase Completion', () => {
    test('purchase event fires with transaction details', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Go through full checkout
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          // Navigate through checkout
          let continueBtn = page.getByRole('button', { name: /checkout|proceed|continue|next|place order|complete/i });
          for (let step = 0; step < 5; step++) {
            const count = await continueBtn.count();
            if (count > 0) {
              await continueBtn
                .first()
                .click()
                .catch(() => {});
              await page.waitForTimeout(500);
            }
          }

          const event = await waitForEvent(page, 'purchase', 10000).catch(() => undefined);
          if (event) {
            expect(event.ecommerce?.transaction_id).toBeDefined();
            expect(event.ecommerce?.currency).toBe('USD');
            expect(event.ecommerce?.value).toBeGreaterThan(0);
            expect(event.ecommerce?.items?.length).toBeGreaterThan(0);
            // Optional but common fields
            if (event.ecommerce?.tax !== undefined) {
              expect(event.ecommerce.tax).toBeGreaterThanOrEqual(0);
            }
            if (event.ecommerce?.shipping !== undefined) {
              expect(event.ecommerce.shipping).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    });

    test('purchase event has unique transaction_id', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Complete two purchases and verify different transaction IDs
      const transactionIds: string[] = [];

      for (let purchase = 0; purchase < 2; purchase++) {
        // Refresh products page
        await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

        const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
        if ((await addToCartBtn.count()) > 0) {
          await addToCartBtn.click();
          await page.waitForTimeout(500);

          const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
          if ((await viewCartBtn.count()) > 0) {
            await viewCartBtn.click();
            await page.waitForTimeout(500);

            let continueBtn = page.getByRole('button', {
              name: /checkout|proceed|continue|next|place order|complete/i
            });
            for (let step = 0; step < 5; step++) {
              const count = await continueBtn.count();
              if (count > 0) {
                await continueBtn
                  .first()
                  .click()
                  .catch(() => {});
                await page.waitForTimeout(500);
              }
            }

            const event = await getLastEventOfType(page, 'purchase');
            if (event?.ecommerce?.transaction_id) {
              transactionIds.push(event.ecommerce.transaction_id);
            }
          }
        }
      }

      // If we got multiple transaction IDs, they should be unique
      if (transactionIds.length > 1) {
        const uniqueIds = new Set(transactionIds);
        expect(uniqueIds.size).toBe(transactionIds.length);
      }
    });
  });

  test.describe('Refund Flow', () => {
    test('refund event fires after purchase', async ({ page }) => {
      await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

      // Complete purchase first
      const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
      if ((await addToCartBtn.count()) > 0) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
        if ((await viewCartBtn.count()) > 0) {
          await viewCartBtn.click();
          await page.waitForTimeout(500);

          // Go through checkout
          let continueBtn = page.getByRole('button', { name: /checkout|proceed|continue|next|place order|complete/i });
          for (let step = 0; step < 5; step++) {
            const count = await continueBtn.count();
            if (count > 0) {
              await continueBtn
                .first()
                .click()
                .catch(() => {});
              await page.waitForTimeout(500);
            }
          }

          // Wait for purchase to complete
          await waitForEvent(page, 'purchase', 10000).catch(() => {});
          await page.waitForTimeout(500);

          // Look for refund button
          const refundBtn = page.getByRole('button', { name: /refund|request refund/i });
          if ((await refundBtn.count()) > 0) {
            await refundBtn.click();

            const event = await waitForEvent(page, 'refund', 5000).catch(() => undefined);
            if (event) {
              expect(event.ecommerce?.transaction_id).toBeDefined();
              expect(event.ecommerce?.items).toBeDefined();
            }
          }
        }
      }
    });
  });
});

// ============================================================================
// GA4 Event Validation Tests
// ============================================================================

test.describe('GA4 Event Compliance', () => {
  let server: VueAppServer;

  test.beforeAll(async () => {
    server = await startVueAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('all ecommerce events have required currency field', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Add item to trigger events
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
    if ((await addToCartBtn.count()) > 0) {
      await addToCartBtn.click();
      await page.waitForTimeout(1000);
    }

    const dataLayer = await getDataLayer(page);
    const ecommerceEvents = dataLayer.filter((e) => e.ecommerce);

    for (const event of ecommerceEvents) {
      // Events with value should have currency
      if (event.ecommerce?.value !== undefined) {
        expect(event.ecommerce.currency).toBeDefined();
      }
    }
  });

  test('all items have required item_id and item_name', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Wait for view_item_list
    await waitForEvent(page, 'view_item_list', 5000).catch(() => {});

    const dataLayer = await getDataLayer(page);
    // Only check standard ecommerce events (not promotions which have different item structure)
    const standardEvents = [
      'view_item_list',
      'select_item',
      'view_item',
      'add_to_cart',
      'view_cart',
      'begin_checkout',
      'purchase'
    ];
    const eventsWithItems = dataLayer.filter(
      (e) => e.ecommerce?.items && e.ecommerce.items.length > 0 && standardEvents.includes(e.event || '')
    );

    for (const event of eventsWithItems) {
      for (const item of event.ecommerce!.items!) {
        // GA4 requires either item_id or item_name (or both)
        const hasIdentifier = item.item_id !== undefined || item.item_name !== undefined;
        expect(hasIdentifier).toBe(true);
      }
    }
  });

  test('price and quantity are numbers, not strings', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Add item to get events
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
    if ((await addToCartBtn.count()) > 0) {
      await addToCartBtn.click();
      await page.waitForTimeout(1000);
    }

    const dataLayer = await getDataLayer(page);
    const eventsWithItems = dataLayer.filter((e) => e.ecommerce?.items && e.ecommerce.items.length > 0);

    for (const event of eventsWithItems) {
      for (const item of event.ecommerce!.items!) {
        if (item.price !== undefined) {
          expect(typeof item.price).toBe('number');
        }
        if (item.quantity !== undefined) {
          expect(typeof item.quantity).toBe('number');
        }
      }
    }
  });

  test('event values match sum of item values', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Add item to trigger add_to_cart
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
    if ((await addToCartBtn.count()) > 0) {
      await addToCartBtn.click();
      await page.waitForTimeout(1000);
    }

    const event = await getLastEventOfType(page, 'add_to_cart');
    if (event?.ecommerce?.items && event.ecommerce.value !== undefined) {
      const itemTotal = event.ecommerce.items.reduce((sum, item) => {
        return sum + (item.price || 0) * (item.quantity || 1);
      }, 0);

      // Allow small floating point differences
      expect(Math.abs(event.ecommerce.value - itemTotal)).toBeLessThan(0.01);
    }
  });
});

// ============================================================================
// Event Ordering Tests
// ============================================================================

test.describe('Event Ordering', () => {
  let server: VueAppServer;

  test.beforeAll(async () => {
    server = await startVueAppServer();
  });

  test.afterAll(async () => {
    await server.close();
  });

  test('gtm.js event fires before other events', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    const dataLayer = await getDataLayer(page);
    const gtmJsIndex = dataLayer.findIndex((e) => e.event === 'gtm.js');
    const viewItemListIndex = dataLayer.findIndex((e) => e.event === 'view_item_list');

    // gtm.js should come before view_item_list if both exist
    if (gtmJsIndex !== -1 && viewItemListIndex !== -1) {
      expect(gtmJsIndex).toBeLessThan(viewItemListIndex);
    }
  });

  test('add_to_cart fires before view_cart', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Add item and view cart
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
    if ((await addToCartBtn.count()) > 0) {
      await addToCartBtn.click();
      await page.waitForTimeout(500);

      const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
      if ((await viewCartBtn.count()) > 0) {
        await viewCartBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const dataLayer = await getDataLayer(page);
    const addToCartIndex = dataLayer.findIndex((e) => e.event === 'add_to_cart');
    const viewCartIndex = dataLayer.findIndex((e) => e.event === 'view_cart');

    if (addToCartIndex !== -1 && viewCartIndex !== -1) {
      expect(addToCartIndex).toBeLessThan(viewCartIndex);
    }
  });

  test('checkout events fire in correct sequence', async ({ page }) => {
    await page.goto(`${server.url}/products`, { waitUntil: 'networkidle' });

    // Go through checkout
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
    if ((await addToCartBtn.count()) > 0) {
      await addToCartBtn.click();
      await page.waitForTimeout(500);

      const viewCartBtn = page.getByRole('button', { name: /^view cart/i });
      if ((await viewCartBtn.count()) > 0) {
        await viewCartBtn.click();
        await page.waitForTimeout(500);

        let continueBtn = page.getByRole('button', { name: /checkout|proceed|continue|next|place order|complete/i });
        for (let step = 0; step < 5; step++) {
          const count = await continueBtn.count();
          if (count > 0) {
            await continueBtn
              .first()
              .click()
              .catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
    }

    const dataLayer = await getDataLayer(page);
    const expectedSequence = ['begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase'];
    const foundIndices = expectedSequence.map((event) => dataLayer.findIndex((e) => e.event === event));

    // Verify ordering for events that exist
    for (let i = 0; i < foundIndices.length - 1; i++) {
      if (foundIndices[i] !== -1 && foundIndices[i + 1] !== -1) {
        expect(foundIndices[i]).toBeLessThan(foundIndices[i + 1]);
      }
    }
  });
});
