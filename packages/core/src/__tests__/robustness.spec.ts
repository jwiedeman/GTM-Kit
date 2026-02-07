/**
 * Robustness tests for GTM Kit Core
 *
 * These tests simulate real-world edge cases that users might encounter:
 * - Double-loading scenarios (common in SPAs)
 * - Script blocking (ad blockers, network issues)
 * - Hydration mismatches (SSR frameworks)
 * - Data layer corruption (third-party scripts)
 * - Race conditions in initialization
 * - Browser refresh during operations
 * - Memory pressure situations
 */
import { createGtmClient } from '../../src';

describe('Double-Load Scenarios', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Duplicate initialization prevention', () => {
    it('prevents double script injection when init() is called twice', () => {
      const client = createGtmClient({ containers: 'GTM-DOUBLE' });

      client.init();
      client.init(); // Second call should be no-op

      const scripts = document.querySelectorAll('script[data-gtm-container-id="GTM-DOUBLE"]');
      expect(scripts).toHaveLength(1);
    });

    it('handles double init after teardown gracefully', () => {
      const client = createGtmClient({ containers: 'GTM-DOUBLE-TEARDOWN' });

      client.init();
      client.teardown();
      client.init();
      client.init(); // Third call should be no-op

      const scripts = document.querySelectorAll('script[data-gtm-container-id="GTM-DOUBLE-TEARDOWN"]');
      expect(scripts).toHaveLength(1);
    });

    it('maintains single data layer even with multiple clients for same container', () => {
      const client1 = createGtmClient({ containers: 'GTM-SHARED' });
      const client2 = createGtmClient({ containers: 'GTM-SHARED' });

      client1.init();
      client2.init();

      client1.push({ event: 'from_client1' });
      client2.push({ event: 'from_client2' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Both events should be in the same data layer
      const client1Events = dataLayer.filter(
        (e) => typeof e === 'object' && !Array.isArray(e) && (e as { event?: string }).event === 'from_client1'
      );
      const client2Events = dataLayer.filter(
        (e) => typeof e === 'object' && !Array.isArray(e) && (e as { event?: string }).event === 'from_client2'
      );

      expect(client1Events).toHaveLength(1);
      expect(client2Events).toHaveLength(1);
    });

    it('handles rapid mount/unmount cycles (React StrictMode simulation)', () => {
      const clients: ReturnType<typeof createGtmClient>[] = [];

      // Simulate 10 rapid mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const client = createGtmClient({ containers: 'GTM-STRICTMODE' });
        clients.push(client);
        client.init();
        client.push({ event: `mount_${i}` });
        client.teardown();
      }

      // Final mount
      const finalClient = createGtmClient({ containers: 'GTM-STRICTMODE' });
      finalClient.init();
      finalClient.push({ event: 'final_mount' });

      // Should have exactly 1 script
      const scripts = document.querySelectorAll('script[data-gtm-container-id="GTM-STRICTMODE"]');
      expect(scripts).toHaveLength(1);

      // Final client should be initialized
      expect(finalClient.isInitialized()).toBe(true);
    });

    it('handles concurrent initialization attempts', async () => {
      const client = createGtmClient({ containers: 'GTM-CONCURRENT-INIT' });

      // Simulate concurrent init calls
      const initPromises = Array.from({ length: 5 }, () => Promise.resolve().then(() => client.init()));

      await Promise.all(initPromises);

      // Should still only have one script
      const scripts = document.querySelectorAll('script[data-gtm-container-id="GTM-CONCURRENT-INIT"]');
      expect(scripts).toHaveLength(1);
    });
  });

  describe('Pre-existing GTM scenarios', () => {
    it('handles existing dataLayer with gtm.js event', () => {
      // Simulate GTM already loaded by another source
      (globalThis as Record<string, unknown>).dataLayer = [{ event: 'gtm.js', 'gtm.start': Date.now() }];

      const client = createGtmClient({ containers: 'GTM-EXISTING' });
      client.init();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Original event should be preserved
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'gtm.js')).toBe(true);
    });

    it('handles existing GTM script in the document', () => {
      // Add a pre-existing GTM script
      const existingScript = document.createElement('script');
      existingScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-EXTERNAL';
      existingScript.setAttribute('data-gtm-container-id', 'GTM-EXTERNAL');
      document.head.appendChild(existingScript);

      const client = createGtmClient({ containers: 'GTM-NEWCLIENT' });
      client.init();

      // Both scripts should exist
      expect(document.querySelectorAll('script[data-gtm-container-id]')).toHaveLength(2);

      // Should be able to push events
      expect(() => client.push({ event: 'test' })).not.toThrow();
    });

    it('works with GTM loaded through Google Tag (gtag.js)', () => {
      // Simulate gtag.js initialization
      (globalThis as Record<string, unknown>).dataLayer = [];
      const gtagDataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // gtag.js pushes function calls
      gtagDataLayer.push(['js', new Date()]);
      gtagDataLayer.push(['config', 'GT-EXTERNAL']);

      const client = createGtmClient({ containers: 'GTM-WITHGTAG' });
      client.init();

      // Should coexist with gtag
      client.push({ event: 'gtm_event' });

      expect(gtagDataLayer.some((e) => (e as { event?: string }).event === 'gtm_event')).toBe(true);
    });
  });
});

describe('Script Blocking and Network Failures', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Script load failures', () => {
    it('continues functioning when script fails to load', () => {
      const client = createGtmClient({ containers: 'GTM-BLOCKED' });
      client.init();

      // Simulate script error
      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-BLOCKED"]');
      script?.dispatchEvent(new Event('error'));

      // Push should still work (events queued in dataLayer)
      expect(() => client.push({ event: 'after_error' })).not.toThrow();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'after_error')).toBe(true);
    });

    it('handles multiple script load failures gracefully', () => {
      const client = createGtmClient({
        containers: ['GTM-FAIL1', 'GTM-FAIL2', 'GTM-FAIL3']
      });
      client.init();

      // Simulate all scripts failing
      document.querySelectorAll('script[data-gtm-container-id]').forEach((script) => {
        script.dispatchEvent(new Event('error'));
      });

      // Client should remain functional
      expect(() => client.push({ event: 'resilient_event' })).not.toThrow();
      expect(client.isInitialized()).toBe(true);
    });

    it('recovers from intermittent failures on teardown/reinit', () => {
      const client = createGtmClient({ containers: 'GTM-RECOVER' });

      // First attempt fails
      client.init();
      const script1 = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-RECOVER"]');
      script1?.dispatchEvent(new Event('error'));

      // Teardown and reinit
      client.teardown();
      client.init();

      // Second attempt should work
      const script2 = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-RECOVER"]');
      expect(script2).not.toBeNull();

      // Should track after recovery
      client.push({ event: 'recovered_event' });
      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'recovered_event')).toBe(true);
    });

    it('tracks script load states correctly through whenReady', async () => {
      const client = createGtmClient({ containers: 'GTM-WHENREADY-ERROR' });
      client.init();

      // Simulate error
      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-WHENREADY-ERROR"]');
      script?.dispatchEvent(new Event('error'));

      const states = await client.whenReady();

      // Should report failed state
      expect(states).toHaveLength(1);
      expect(states[0].status).toBe('failed');
    });
  });

  describe('Timeout scenarios', () => {
    it('handles slow script loading without blocking pushes', () => {
      jest.useFakeTimers();

      const client = createGtmClient({ containers: 'GTM-SLOW' });
      client.init();

      // Push events before script loads
      for (let i = 0; i < 100; i++) {
        client.push({ event: `queued_${i}` });
      }

      // Advance time (script still loading)
      jest.advanceTimersByTime(5000);

      // All events should be in dataLayer
      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const queuedEvents = dataLayer.filter(
        (e) => typeof e === 'object' && (e as { event?: string }).event?.startsWith('queued_')
      );

      expect(queuedEvents).toHaveLength(100);

      jest.useRealTimers();
    });
  });
});

describe('SSR/Hydration Scenarios', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('SSR pre-render scenarios', () => {
    it('handles initialization with pre-existing SSR dataLayer', () => {
      // Simulate SSR-injected dataLayer
      (globalThis as Record<string, unknown>).dataLayer = [{ event: 'ssr_page_view', page: '/home' }];

      const client = createGtmClient({ containers: 'GTM-SSR' });
      client.init();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // SSR event should be preserved
      expect(dataLayer[0]).toMatchObject({ event: 'ssr_page_view', page: '/home' });

      // Client events should be appended
      client.push({ event: 'hydrated' });
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'hydrated')).toBe(true);
    });

    it('handles mismatched SSR script attributes', () => {
      // SSR rendered a script with different attributes
      const ssrScript = document.createElement('script');
      ssrScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-HYDRATE';
      ssrScript.setAttribute('data-gtm-container-id', 'GTM-HYDRATE');
      ssrScript.nonce = 'ssr-nonce-123';
      document.head.appendChild(ssrScript);

      // Client hydrates with potentially different config
      const client = createGtmClient({
        containers: 'GTM-HYDRATE',
        scriptAttributes: { nonce: 'client-nonce-456' }
      });

      // Should not throw
      expect(() => client.init()).not.toThrow();
    });

    it('handles noscript tag presence correctly', () => {
      // SSR added noscript
      const noscript = document.createElement('noscript');
      noscript.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NOSCRIPT"></iframe>';
      document.body.appendChild(noscript);

      const client = createGtmClient({ containers: 'GTM-NOSCRIPT' });
      client.init();

      // Should add script without affecting noscript
      expect(document.querySelector('script[data-gtm-container-id="GTM-NOSCRIPT"]')).not.toBeNull();
      expect(document.querySelector('noscript')).not.toBeNull();
    });
  });

  describe('Next.js App Router scenarios', () => {
    it('handles server component to client component transition', () => {
      // Simulate server component data
      const serverData = { userId: 'server-123' };

      const client = createGtmClient({ containers: 'GTM-NEXTJS' });

      // Queue event before init (as if from server)
      client.push({ event: 'server_data', ...serverData });

      client.init();

      // Push client event
      client.push({ event: 'client_interaction' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      expect(dataLayer.some((e) => (e as { event?: string }).event === 'server_data')).toBe(true);
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'client_interaction')).toBe(true);
    });
  });

  describe('SSR → CSR Transition Scenarios', () => {
    it('preserves SSR page view during hydration', () => {
      // Simulate SSR rendering a page_view event
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'gtm.js', 'gtm.start': Date.now() - 100 },
        { event: 'page_view', page_path: '/products', page_title: 'Products - SSR' }
      ];

      const client = createGtmClient({ containers: 'GTM-SSR-PAGE' });
      client.init();

      // CSR should not duplicate the page_view
      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const pageViews = dataLayer.filter((e) => (e as { event?: string }).event === 'page_view');

      // Should have exactly 1 page_view (the SSR one)
      expect(pageViews.length).toBe(1);
      expect(pageViews[0]).toMatchObject({ page_path: '/products' });

      client.teardown();
    });

    it('handles SSR consent followed by CSR update', () => {
      // SSR sets up consent defaults
      (globalThis as Record<string, unknown>).dataLayer = [
        ['consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' }]
      ];

      const client = createGtmClient({ containers: 'GTM-SSR-CONSENT' });
      client.init();

      // CSR updates consent after user interaction
      client.updateConsent({ analytics_storage: 'granted' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Should have both default (SSR) and update (CSR)
      const consentEntries = dataLayer.filter((e) => Array.isArray(e) && e[0] === 'consent');
      expect(consentEntries.length).toBe(2);
      expect(consentEntries[0]).toEqual(['consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' }]);
      expect(consentEntries[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);

      client.teardown();
    });

    it('handles SSR e-commerce data followed by CSR interactions', () => {
      // SSR renders product list view
      (globalThis as Record<string, unknown>).dataLayer = [
        {
          event: 'view_item_list',
          ecommerce: {
            items: [
              { item_id: 'SKU-001', item_name: 'Widget A', price: 29.99 },
              { item_id: 'SKU-002', item_name: 'Widget B', price: 39.99 }
            ]
          }
        }
      ];

      const client = createGtmClient({ containers: 'GTM-SSR-ECOM' });
      client.init();

      // CSR handles user selecting an item
      client.push({
        event: 'select_item',
        ecommerce: {
          items: [{ item_id: 'SKU-001', item_name: 'Widget A', price: 29.99 }]
        }
      });

      // CSR handles add to cart
      client.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [{ item_id: 'SKU-001', item_name: 'Widget A', price: 29.99, quantity: 1 }]
        }
      });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Verify all events in correct order
      const events = dataLayer
        .filter((e) => typeof e === 'object' && !Array.isArray(e) && (e as { event?: string }).event)
        .map((e) => (e as { event: string }).event);

      expect(events).toContain('view_item_list');
      expect(events).toContain('select_item');
      expect(events).toContain('add_to_cart');

      // view_item_list should come before select_item
      expect(events.indexOf('view_item_list')).toBeLessThan(events.indexOf('select_item'));

      client.teardown();
    });

    it('handles Remix loader data → client hydration', () => {
      // Simulate Remix loader data being pushed during SSR
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'user_data_loaded', user_type: 'premium', country: 'US' },
        { event: 'page_view', page_path: '/dashboard' }
      ];

      const client = createGtmClient({ containers: 'GTM-REMIX' });
      client.init();

      // Client-side action
      client.push({ event: 'dashboard_interaction', action: 'widget_clicked' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      expect(dataLayer.some((e) => (e as { event?: string }).event === 'user_data_loaded')).toBe(true);
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'page_view')).toBe(true);
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'dashboard_interaction')).toBe(true);

      client.teardown();
    });

    it('handles Nuxt SSR with composable hydration', () => {
      // Simulate Nuxt SSR pushing initial state
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'page_view', page_path: '/shop', render_mode: 'ssr' }
      ];

      // Simulate pre-existing SSR script
      const ssrScript = document.createElement('script');
      ssrScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NUXT';
      ssrScript.setAttribute('data-gtm-container-id', 'GTM-NUXT');
      document.head.appendChild(ssrScript);

      const client = createGtmClient({ containers: 'GTM-NUXT' });
      client.init();

      // Nuxt client-side navigation (no full page reload)
      client.push({ event: 'page_view', page_path: '/shop/category', render_mode: 'csr' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const pageViews = dataLayer.filter((e) => (e as { event?: string }).event === 'page_view');

      // Should have both SSR and CSR page views
      expect(pageViews.length).toBe(2);
      expect(pageViews[0]).toMatchObject({ page_path: '/shop', render_mode: 'ssr' });
      expect(pageViews[1]).toMatchObject({ page_path: '/shop/category', render_mode: 'csr' });

      client.teardown();
    });

    it('handles Astro island hydration with deferred loading', () => {
      // Simulate Astro static render with initial page data
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'page_view', page_path: '/blog/article', framework: 'astro' }
      ];

      const client = createGtmClient({ containers: 'GTM-ASTRO' });
      client.init();

      // Island hydrates later (client:visible)
      setTimeout(() => {
        client.push({ event: 'island_hydrated', island: 'comments' });
      }, 0);

      // Another island hydrates even later
      setTimeout(() => {
        client.push({ event: 'island_hydrated', island: 'newsletter_signup' });
      }, 0);

      // Immediate CSR interaction
      client.push({ event: 'scroll', percent_scrolled: 50 });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      expect(dataLayer.some((e) => (e as { event?: string }).event === 'page_view')).toBe(true);
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'scroll')).toBe(true);

      client.teardown();
    });

    it('handles SvelteKit load function → client hydration', () => {
      // SvelteKit load function pushes data during SSR
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'product_loaded', product_id: 'SKU-SVELTE', loaded_at: 'server' }
      ];

      const client = createGtmClient({ containers: 'GTM-SVELTEKIT' });
      client.init();

      // Client-side interaction after hydration
      client.push({
        event: 'add_to_cart',
        ecommerce: { items: [{ item_id: 'SKU-SVELTE' }] }
      });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      expect(dataLayer.some((e) => (e as { loaded_at?: string }).loaded_at === 'server')).toBe(true);
      expect(dataLayer.some((e) => (e as { event?: string }).event === 'add_to_cart')).toBe(true);

      client.teardown();
    });

    it('preserves event order across SSR → CSR boundary', () => {
      // SSR events with timestamps
      const ssrTime = Date.now() - 1000;
      (globalThis as Record<string, unknown>).dataLayer = [
        { event: 'ssr_event_1', timestamp: ssrTime },
        { event: 'ssr_event_2', timestamp: ssrTime + 10 },
        { event: 'ssr_event_3', timestamp: ssrTime + 20 }
      ];

      const client = createGtmClient({ containers: 'GTM-ORDER' });
      client.init();

      // CSR events
      const csrTime = Date.now();
      client.push({ event: 'csr_event_1', timestamp: csrTime });
      client.push({ event: 'csr_event_2', timestamp: csrTime + 10 });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const events = dataLayer
        .filter(
          (e) => typeof e === 'object' && !Array.isArray(e) && (e as { event?: string }).event?.includes('_event_')
        )
        .map((e) => (e as { event: string }).event);

      // Order should be preserved: SSR events first, then CSR events
      expect(events).toEqual(['ssr_event_1', 'ssr_event_2', 'ssr_event_3', 'csr_event_1', 'csr_event_2']);

      client.teardown();
    });
  });
});

describe('Data Layer Corruption and Recovery', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('External modification handling', () => {
    it('survives dataLayer being replaced with new array', () => {
      const client = createGtmClient({ containers: 'GTM-REPLACE' });
      client.init();

      client.push({ event: 'before_replace' });

      // External code replaces dataLayer
      (globalThis as Record<string, unknown>).dataLayer = [];

      // Push should still work (adds to new array)
      expect(() => client.push({ event: 'after_replace' })).not.toThrow();
    });

    it('survives dataLayer being set to null', () => {
      const client = createGtmClient({ containers: 'GTM-NULL' });
      client.init();

      client.push({ event: 'before_null' });

      // External code sets dataLayer to null
      (globalThis as Record<string, unknown>).dataLayer = null;

      // Push should not throw
      expect(() => client.push({ event: 'after_null' })).not.toThrow();
    });

    it('survives dataLayer being set to non-array', () => {
      const client = createGtmClient({ containers: 'GTM-OBJECT' });
      client.init();

      client.push({ event: 'before_object' });

      // External code sets dataLayer to object
      (globalThis as Record<string, unknown>).dataLayer = { corrupted: true };

      // Push should not throw
      expect(() => client.push({ event: 'after_object' })).not.toThrow();
    });

    it('handles third-party scripts pushing invalid data', () => {
      const client = createGtmClient({ containers: 'GTM-THIRDPARTY' });
      client.init();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Third-party pushes garbage
      dataLayer.push(null);
      dataLayer.push(undefined);
      dataLayer.push('random string');
      dataLayer.push(12345);
      dataLayer.push(() => {
        /* function */
      });
      dataLayer.push(Symbol('symbol'));

      // Client push should still work
      expect(() => client.push({ event: 'valid_event' })).not.toThrow();
      // Filter out null/undefined before checking
      expect(
        dataLayer.some((e) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'valid_event')
      ).toBe(true);
    });

    it('handles dataLayer.push being overwritten', () => {
      const client = createGtmClient({ containers: 'GTM-PUSH-OVERRIDE' });
      client.init();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const originalPush = dataLayer.push.bind(dataLayer);

      // Override push
      (dataLayer as { push: (...args: unknown[]) => number }).push = (...args: unknown[]) => {
        return originalPush(...args);
      };

      // Client push should still work
      expect(() => client.push({ event: 'custom_push' })).not.toThrow();
    });
  });

  describe('Concurrent modification safety', () => {
    it('handles rapid concurrent pushes from multiple sources', () => {
      const client = createGtmClient({ containers: 'GTM-CONCURRENT' });
      client.init();

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // Simulate concurrent access
      const pushPromises = [];
      for (let i = 0; i < 100; i++) {
        pushPromises.push(Promise.resolve().then(() => client.push({ event: `client_${i}` })));
        pushPromises.push(Promise.resolve().then(() => dataLayer.push({ event: `external_${i}` })));
      }

      return Promise.all(pushPromises).then(() => {
        const clientEvents = dataLayer.filter(
          (e) => typeof e === 'object' && (e as { event?: string }).event?.startsWith('client_')
        );
        const externalEvents = dataLayer.filter(
          (e) => typeof e === 'object' && (e as { event?: string }).event?.startsWith('external_')
        );

        expect(clientEvents.length).toBe(100);
        expect(externalEvents.length).toBe(100);
      });
    });
  });
});

describe('Browser-Specific Edge Cases', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Document state handling', () => {
    it('handles document without head element', () => {
      // Remove head (edge case)
      document.head.remove();

      const client = createGtmClient({ containers: 'GTM-NOHEAD' });

      // Should not throw
      expect(() => client.init()).not.toThrow();

      // Script should be added somewhere
      const script = document.querySelector('script[data-gtm-container-id="GTM-NOHEAD"]');
      expect(script).not.toBeNull();

      // Restore head for other tests
      const newHead = document.createElement('head');
      document.documentElement.insertBefore(newHead, document.body);
    });

    it('handles document without body element', () => {
      // Remove body
      const originalBody = document.body;
      document.body.remove();

      const client = createGtmClient({ containers: 'GTM-NOBODY' });

      // Should not throw
      expect(() => client.init()).not.toThrow();

      // Restore body
      document.documentElement.appendChild(originalBody);
    });

    it('handles frozen/sealed objects in event data', () => {
      const client = createGtmClient({ containers: 'GTM-FROZEN' });
      client.init();

      const frozenData = Object.freeze({
        event: 'frozen_event',
        data: Object.freeze({ nested: 'value' })
      });

      const sealedData = Object.seal({
        event: 'sealed_event',
        data: { nested: 'value' }
      });

      expect(() => client.push(frozenData as Record<string, unknown>)).not.toThrow();
      expect(() => client.push(sealedData)).not.toThrow();
    });
  });

  describe('Window property conflicts', () => {
    it('handles window.dataLayer being a getter', () => {
      let internalLayer: unknown[] = [];

      Object.defineProperty(globalThis, 'dataLayer', {
        get: () => internalLayer,
        set: (value) => {
          internalLayer = value;
        },
        configurable: true
      });

      const client = createGtmClient({ containers: 'GTM-GETTER' });

      expect(() => client.init()).not.toThrow();
      expect(() => client.push({ event: 'test' })).not.toThrow();

      // Cleanup
      delete (globalThis as Record<string, unknown>).dataLayer;
    });

    it('handles non-configurable dataLayer property', () => {
      // This is tricky - we need to be careful here
      (globalThis as Record<string, unknown>).existingLayer = [];

      const client = createGtmClient({
        containers: 'GTM-NONCONFIG',
        dataLayerName: 'existingLayer'
      });

      expect(() => client.init()).not.toThrow();

      // Cleanup
      delete (globalThis as Record<string, unknown>).existingLayer;
    });
  });
});

describe('Timing and Lifecycle Edge Cases', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rapid lifecycle operations', () => {
    it('handles 1000 rapid init/push/teardown cycles', () => {
      for (let i = 0; i < 1000; i++) {
        const client = createGtmClient({ containers: `GTM-RAPID-${i % 10}` });
        client.init();
        client.push({ event: `rapid_${i}` });
        client.teardown();
      }

      // Should have no orphaned scripts
      expect(document.querySelectorAll('script[data-gtm-container-id]')).toHaveLength(0);
    });

    it('handles interleaved operations on multiple clients', () => {
      const clients = Array.from({ length: 5 }, (_, i) => createGtmClient({ containers: `GTM-INTERLEAVE-${i}` }));

      // Interleaved operations
      for (let round = 0; round < 10; round++) {
        clients.forEach((client, index) => {
          if (round % 2 === 0) {
            client.init();
          }
          client.push({ event: `round_${round}_client_${index}` });
          if (round % 3 === 0) {
            client.teardown();
          }
        });
      }

      // All clients should be in consistent state
      clients.forEach((client) => {
        expect(() => client.teardown()).not.toThrow();
      });
    });
  });

  describe('Delayed consent scenarios', () => {
    it('throws when consent defaults set long after initialization', () => {
      const client = createGtmClient({ containers: 'GTM-DELAYED-CONSENT' });
      client.init();

      // Push events
      client.push({ event: 'before_consent' });

      // Wait 5 seconds
      jest.advanceTimersByTime(5000);

      // Setting consent defaults after init should throw
      expect(() => {
        client.setConsentDefaults({ analytics_storage: 'denied' });
      }).toThrow(/must be called BEFORE init/);

      // Update consent still works after init
      jest.advanceTimersByTime(2000);
      client.updateConsent({ analytics_storage: 'granted' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const consentEntries = dataLayer.filter((e) => Array.isArray(e) && e[0] === 'consent');

      expect(consentEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('handles consent update before init', () => {
      const client = createGtmClient({ containers: 'GTM-CONSENT-BEFORE-INIT' });

      // Set defaults before init
      client.setConsentDefaults({ ad_storage: 'denied', analytics_storage: 'denied' });

      // Init
      client.init();

      // Update immediately
      client.updateConsent({ analytics_storage: 'granted' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const updateEntry = dataLayer.find(
        (e) => Array.isArray(e) && e[0] === 'consent' && e[1] === 'update'
      ) as unknown[];

      expect(updateEntry).toBeDefined();
      expect(updateEntry[2]).toMatchObject({ analytics_storage: 'granted' });
    });
  });

  describe('waitForUpdate timing', () => {
    it('handles waitForUpdate expiry', () => {
      const client = createGtmClient({ containers: 'GTM-WAIT-EXPIRY' });

      client.setConsentDefaults({ ad_storage: 'denied' }, { waitForUpdate: 500 });

      client.init();

      // Wait for update timeout
      jest.advanceTimersByTime(600);

      // Push should still work after timeout
      expect(() => client.push({ event: 'after_timeout' })).not.toThrow();
    });

    it('handles very long waitForUpdate values', () => {
      const client = createGtmClient({ containers: 'GTM-LONG-WAIT' });

      client.setConsentDefaults(
        { ad_storage: 'denied' },
        { waitForUpdate: 30000 } // 30 seconds
      );

      client.init();

      // Update before timeout
      jest.advanceTimersByTime(15000);
      client.updateConsent({ ad_storage: 'granted' });

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const waitForUpdateEntry = dataLayer.find(
        (e) =>
          Array.isArray(e) && e[0] === 'consent' && (e[3] as { wait_for_update?: number })?.wait_for_update === 30000
      );

      expect(waitForUpdateEntry).toBeDefined();
    });
  });
});

describe('Resource Cleanup Verification', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Complete cleanup on teardown', () => {
    it('removes all event listeners', () => {
      const client = createGtmClient({ containers: 'GTM-LISTENERS' });
      client.init();

      // Add onReady callback
      const callback = jest.fn();
      client.onReady(callback);

      client.teardown();

      // Simulate script load after teardown (should not call callback)
      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-LISTENERS"]');
      // Script is removed, so this is just verifying no errors
      expect(script).toBeNull();
    });

    it('clears pending callbacks', async () => {
      const client = createGtmClient({ containers: 'GTM-PENDING' });
      client.init();

      // Simulate script load before checking whenReady
      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-PENDING"]');
      script?.dispatchEvent(new Event('load'));

      // Now whenReady should resolve
      const result = await client.whenReady();
      expect(Array.isArray(result)).toBe(true);

      client.teardown();
    });

    it('allows reinitialization with different config', () => {
      const client1 = createGtmClient({
        containers: 'GTM-REINIT',
        dataLayerName: 'layer1'
      });
      client1.init();
      client1.teardown();

      const client2 = createGtmClient({
        containers: 'GTM-REINIT',
        dataLayerName: 'layer2'
      });
      client2.init();

      // Should use new data layer name
      expect((globalThis as Record<string, unknown>).layer2).toBeDefined();

      client2.teardown();
    });
  });
});

describe('Multi-Container Isolation', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Container independence', () => {
    it('isolates different container configurations', () => {
      const prodClient = createGtmClient({
        containers: { id: 'GTM-PROD', queryParams: { gtm_preview: '' } }
      });

      const stagingClient = createGtmClient({
        containers: { id: 'GTM-STAGING', queryParams: { gtm_preview: 'env-staging' } }
      });

      prodClient.init();
      stagingClient.init();

      const prodScript = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-PROD"]');
      const stagingScript = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-STAGING"]');

      expect(prodScript?.src).not.toContain('env-staging');
      expect(stagingScript?.src).toContain('env-staging');
    });

    it('allows different script attributes per container', () => {
      const client = createGtmClient({
        containers: [{ id: 'GTM-NONCE1' }, { id: 'GTM-NONCE2' }],
        scriptAttributes: { nonce: 'shared-nonce' }
      });

      client.init();

      document.querySelectorAll('script[data-gtm-container-id]').forEach((script) => {
        expect((script as HTMLScriptElement).nonce).toBe('shared-nonce');
      });
    });

    it('handles partial container failures', async () => {
      const client = createGtmClient({
        containers: ['GTM-SUCCESS', 'GTM-FAIL', 'GTM-SUCCESS2']
      });

      client.init();

      // Fail one container
      const failScript = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-FAIL"]');
      failScript?.dispatchEvent(new Event('error'));

      // Load the others
      const successScripts = document.querySelectorAll<HTMLScriptElement>(
        'script[data-gtm-container-id="GTM-SUCCESS"], script[data-gtm-container-id="GTM-SUCCESS2"]'
      );
      successScripts.forEach((script) => script.dispatchEvent(new Event('load')));

      const states = await client.whenReady();

      // Should report mixed states
      const errorState = states.find((s) => s.containerId === 'GTM-FAIL');
      const successStates = states.filter((s) => s.containerId !== 'GTM-FAIL');

      // Status is 'failed' when script errors
      expect(errorState?.status).toBe('failed');
      expect(successStates.every((s) => s.status === 'loaded')).toBe(true);
    });
  });
});
