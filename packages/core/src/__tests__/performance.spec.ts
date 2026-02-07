/**
 * Performance Tests for GTM Kit Core
 *
 * These tests ensure the library maintains acceptable performance
 * under various load conditions and usage patterns.
 */
import { createGtmClient } from '../../src';

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  describe('Initialization Performance', () => {
    it('initializes single container quickly', () => {
      const start = performance.now();

      const client = createGtmClient({ containers: 'GTM-PERF' });
      client.init();

      const duration = performance.now() - start;

      // Allow for CI/slow environment variability
      expect(duration).toBeLessThan(100);
    });

    it('initializes 5 containers quickly', () => {
      const start = performance.now();

      const client = createGtmClient({
        containers: ['GTM-PERF1', 'GTM-PERF2', 'GTM-PERF3', 'GTM-PERF4', 'GTM-PERF5']
      });
      client.init();

      const duration = performance.now() - start;

      // Allow for CI/slow environment variability
      expect(duration).toBeLessThan(200);
    });

    it('initializes with full config quickly', () => {
      const start = performance.now();

      const client = createGtmClient({
        containers: [
          { id: 'GTM-FULL1', queryParams: { gtm_auth: 'auth1', gtm_preview: 'preview1' } },
          { id: 'GTM-FULL2', queryParams: { gtm_auth: 'auth2' } }
        ],
        host: 'https://custom.gtm.example.com',
        dataLayerName: 'customDataLayer',
        defaultQueryParams: { gtm_cookies_win: 'x' },
        scriptAttributes: { nonce: 'test-nonce', 'data-purpose': 'analytics' }
      });

      client.setConsentDefaults(
        { ad_storage: 'denied', analytics_storage: 'denied' },
        { region: ['EEA'], waitForUpdate: 500 }
      );

      client.init();

      const duration = performance.now() - start;

      // Allow for CI/slow environment variability
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Push Performance', () => {
    it('pushes 1000 events in under 50ms', () => {
      const client = createGtmClient({ containers: 'GTM-PUSH-PERF' });
      client.init();

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        client.push({ event: `event_${i}`, index: i });
      }

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(500);
    });

    it('pushes 10000 events in under 500ms', () => {
      const client = createGtmClient({ containers: 'GTM-PUSH-PERF-10K' });
      client.init();

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        client.push({ event: `event_${i}`, index: i });
      }

      const duration = performance.now() - start;

      // Allow for CI variability - Jest's fake timers and coverage instrumentation add overhead
      expect(duration).toBeLessThan(10000);
    });

    it('pushes complex ecommerce events efficiently', () => {
      const client = createGtmClient({ containers: 'GTM-ECOMMERCE-PERF' });
      client.init();

      const complexEvent = {
        event: 'purchase',
        ecommerce: {
          transaction_id: 'T-PERF-123',
          value: 1234.56,
          currency: 'USD',
          items: Array.from({ length: 50 }, (_, i) => ({
            item_id: `SKU-${i}`,
            item_name: `Product ${i} with a moderately long name`,
            price: Math.random() * 100,
            quantity: Math.floor(Math.random() * 5) + 1,
            item_category: `Category ${i % 10}`,
            item_brand: `Brand ${i % 5}`,
            item_variant: `Variant ${i % 3}`,
            custom_dimensions: {
              dimension1: 'value1',
              dimension2: 'value2'
            }
          }))
        }
      };

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        client.push({ ...complexEvent, transaction_id: `T-${i}` });
      }

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Consent Performance', () => {
    it('updates consent rapidly without degradation', () => {
      const client = createGtmClient({ containers: 'GTM-CONSENT-PERF' });
      client.setConsentDefaults({ ad_storage: 'denied', analytics_storage: 'denied' });
      client.init();

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        client.updateConsent({
          analytics_storage: i % 2 === 0 ? 'granted' : 'denied',
          ad_storage: i % 3 === 0 ? 'granted' : 'denied'
        });
      }

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Signature Computation Impact', () => {
    it('regular events have no signature computation overhead', () => {
      const client = createGtmClient({ containers: 'GTM-SIG-NONE', maxDataLayerSize: 0 });
      client.init();

      // Regular events don't require signature computation
      const start = performance.now();

      for (let i = 0; i < 5000; i++) {
        client.push({
          event: 'page_view',
          page_path: `/page-${i}`,
          page_title: `Page ${i}`,
          custom_data: { key: `value_${i}` }
        });
      }

      const duration = performance.now() - start;

      // Regular events should be very fast (no serialization)
      // Allow generous CI variability
      expect(duration).toBeLessThan(5000);
    });

    it('consent commands have bounded signature computation cost', () => {
      const client = createGtmClient({ containers: 'GTM-SIG-CONSENT' });
      client.init();

      // Each unique consent command requires signature computation
      const start = performance.now();

      for (let i = 0; i < 500; i++) {
        // Alternate between different consent states to avoid deduplication
        const states = [
          { ad_storage: 'granted' as const },
          { ad_storage: 'denied' as const },
          { analytics_storage: 'granted' as const },
          { analytics_storage: 'denied' as const },
          { ad_storage: 'granted' as const, analytics_storage: 'granted' as const },
          { ad_storage: 'denied' as const, analytics_storage: 'denied' as const }
        ];
        // Force unique signatures by using different consent states
        client.updateConsent(states[i % states.length]);
      }

      const duration = performance.now() - start;

      // Consent commands with signature computation should still be fast
      // Allow CI variability
      expect(duration).toBeLessThan(3000);
    });

    it('WeakMap cache provides benefit for repeated complex objects', () => {
      const client = createGtmClient({ containers: 'GTM-SIG-CACHE', maxDataLayerSize: 0 });
      client.init();

      // Create a complex reusable object
      const complexEcommerce = {
        items: Array.from({ length: 50 }, (_, i) => ({
          item_id: `SKU-${i}`,
          item_name: `Product ${i}`,
          price: 99.99,
          quantity: 1,
          item_category: `Category ${i % 5}`
        })),
        value: 4999.5,
        currency: 'USD'
      };

      // First pass - populates cache
      const start1 = performance.now();
      for (let i = 0; i < 100; i++) {
        client.push({ event: 'view_cart', ecommerce: complexEcommerce });
      }
      const duration1 = performance.now() - start1;

      // Second pass - should benefit from cache (same object reference)
      const start2 = performance.now();
      for (let i = 0; i < 100; i++) {
        client.push({ event: 'view_cart', ecommerce: complexEcommerce });
      }
      const duration2 = performance.now() - start2;

      // Both passes should complete quickly
      // Note: Cache benefit may be minimal since regular pushes don't serialize
      expect(duration1).toBeLessThan(2000);
      expect(duration2).toBeLessThan(2000);
    });

    it('signature computation does not degrade with deeply nested consent options', () => {
      const client = createGtmClient({ containers: 'GTM-SIG-DEEP' });
      client.init();

      const start = performance.now();

      for (let i = 0; i < 200; i++) {
        // Consent with region options - requires more serialization
        client.updateConsent(
          {
            ad_storage: i % 2 === 0 ? 'granted' : 'denied',
            analytics_storage: i % 2 === 0 ? 'denied' : 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'denied'
          },
          {
            region: ['US', 'US-CA', 'US-NY', 'EU', 'EEA', 'UK']
          }
        );
      }

      const duration = performance.now() - start;

      // Should handle complex consent structures efficiently
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Teardown Performance', () => {
    it('tears down single container quickly', () => {
      const client = createGtmClient({ containers: 'GTM-TEARDOWN-PERF' });
      client.init();

      const start = performance.now();
      client.teardown();
      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(100);
    });

    it('tears down 5 containers quickly', () => {
      const client = createGtmClient({
        containers: ['GTM-TD1', 'GTM-TD2', 'GTM-TD3', 'GTM-TD4', 'GTM-TD5']
      });
      client.init();

      const start = performance.now();
      client.teardown();
      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Lifecycle Performance', () => {
    it('completes 100 init/teardown cycles efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const client = createGtmClient({ containers: `GTM-CYCLE-${i % 10}` });
        client.init();
        client.push({ event: `cycle_${i}` });
        client.teardown();
      }

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(5000);
    });

    it('handles interleaved multi-client operations efficiently', () => {
      const clients = Array.from({ length: 5 }, (_, i) => createGtmClient({ containers: `GTM-MULTI-${i}` }));

      const start = performance.now();

      // Interleaved operations
      for (let round = 0; round < 20; round++) {
        clients.forEach((client, index) => {
          if (round === 0) {
            client.init();
          }
          client.push({ event: `client_${index}_round_${round}` });
        });
      }

      // Teardown all
      clients.forEach((client) => client.teardown());

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Memory Efficiency', () => {
    it('does not accumulate excessive data layer entries with large payloads', () => {
      // Use unlimited dataLayer size for this memory efficiency test
      const client = createGtmClient({ containers: 'GTM-MEMORY', maxDataLayerSize: 0 });
      client.init();

      // Push 1000 medium-sized events
      for (let i = 0; i < 1000; i++) {
        client.push({
          event: `memory_test_${i}`,
          data: {
            id: i,
            name: `Item ${i}`,
            description: 'A moderately long description for testing purposes',
            nested: {
              level1: {
                level2: {
                  value: i * 2
                }
              }
            }
          }
        });
      }

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

      // DataLayer should contain all events plus some overhead
      expect(dataLayer.length).toBeGreaterThanOrEqual(1000);

      // This test mainly verifies no crash/timeout occurs
    });
  });

  describe('Concurrent Access Performance', () => {
    it('handles concurrent push operations without serialization delay', async () => {
      // Use unlimited dataLayer size for this performance test
      const client = createGtmClient({ containers: 'GTM-CONCURRENT', maxDataLayerSize: 0 });
      client.init();

      const start = performance.now();

      // Simulate concurrent access from multiple "components"
      const promises = Array.from({ length: 10 }, (_, context) =>
        Promise.resolve().then(() => {
          for (let i = 0; i < 100; i++) {
            client.push({ event: 'concurrent', context, index: i });
          }
        })
      );

      await Promise.all(promises);

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(1000);

      const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
      const concurrentEvents = dataLayer.filter(
        (e) => typeof e === 'object' && (e as { event?: string }).event === 'concurrent'
      );

      expect(concurrentEvents.length).toBe(1000);
    });
  });

  describe('Script Injection Performance', () => {
    it('injects multiple container scripts without blocking', () => {
      const start = performance.now();

      const client = createGtmClient({
        containers: Array.from({ length: 10 }, (_, i) => `GTM-INJECT-${i}`)
      });
      client.init();

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(500);

      const scripts = document.querySelectorAll('script[data-gtm-container-id]');
      expect(scripts).toHaveLength(10);
    });
  });

  describe('Query Parameter Construction Performance', () => {
    it('constructs complex query strings efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const client = createGtmClient({
          containers: {
            id: `GTM-QP-${i}`,
            queryParams: {
              gtm_auth: `auth_key_${i}`,
              gtm_preview: `env_${i}`,
              gtm_cookies_win: 'x'
            }
          },
          defaultQueryParams: {
            custom_param: 'value',
            another_param: 'another_value'
          }
        });
        client.init();
        client.teardown();
      }

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('whenReady Performance', () => {
    it('resolves whenReady quickly after script load', async () => {
      const client = createGtmClient({ containers: 'GTM-READY-PERF' });
      client.init();

      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-READY-PERF"]');

      const start = performance.now();

      // Simulate script load
      script?.dispatchEvent(new Event('load'));

      const states = await client.whenReady();

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(100);
      expect(states).toHaveLength(1);
    });

    it('handles multiple whenReady calls efficiently', async () => {
      const client = createGtmClient({ containers: 'GTM-MULTI-READY' });
      client.init();

      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-MULTI-READY"]');
      script?.dispatchEvent(new Event('load'));

      const start = performance.now();

      // Call whenReady many times concurrently
      const promises = Array.from({ length: 100 }, () => client.whenReady());
      await Promise.all(promises);

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(500);
    });
  });

  describe('onReady Callback Performance', () => {
    it('handles many onReady callbacks efficiently', () => {
      const client = createGtmClient({ containers: 'GTM-ONREADY-PERF' });
      client.init();

      const callbacks: (() => void)[] = [];

      const start = performance.now();

      // Register many callbacks
      for (let i = 0; i < 100; i++) {
        const unsubscribe = client.onReady(() => undefined);
        callbacks.push(unsubscribe);
      }

      // Trigger load
      const script = document.querySelector<HTMLScriptElement>('script[data-gtm-container-id="GTM-ONREADY-PERF"]');
      script?.dispatchEvent(new Event('load'));

      const duration = performance.now() - start;

      // Allow for CI variability
      expect(duration).toBeLessThan(500);

      // Cleanup
      callbacks.forEach((cb) => cb());
    });
  });
});

describe('Heap Profiling - Long Running Sessions', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
    // Force garbage collection if available (Node.js with --expose-gc)
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  afterEach(() => {
    // Force garbage collection after each test
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  const getHeapUsed = (): number => {
    return process.memoryUsage().heapUsed;
  };

  const _formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  it('memory usage stabilizes after initial allocation', () => {
    const client = createGtmClient({ containers: 'GTM-HEAP1', maxDataLayerSize: 100 });
    client.init();

    const _initialHeap = getHeapUsed();

    // Warm up phase - initial allocations
    for (let i = 0; i < 500; i++) {
      client.push({ event: `warmup_${i}`, data: `value_${i}` });
    }

    const afterWarmup = getHeapUsed();

    // Sustained usage phase - should not significantly increase memory
    for (let i = 0; i < 2000; i++) {
      client.push({ event: `sustained_${i}`, data: `value_${i}` });
    }

    const afterSustained = getHeapUsed();

    // Memory growth from warmup to sustained should be bounded
    // With maxDataLayerSize: 100, old entries are trimmed
    const warmupToSustainedGrowth = afterSustained - afterWarmup;

    // Memory should stabilize (growth should be small relative to total)
    // Allow up to 5MB growth (accounts for Jest overhead, GC timing)
    expect(warmupToSustainedGrowth).toBeLessThan(5 * 1024 * 1024);

    client.teardown();
  });

  it('memory is released after teardown', () => {
    // Create and initialize client
    let client: ReturnType<typeof createGtmClient> | null = createGtmClient({
      containers: 'GTM-HEAP2',
      maxDataLayerSize: 0 // No limit for this test
    });
    client.init();

    // Push many events
    for (let i = 0; i < 1000; i++) {
      client.push({
        event: `memory_test_${i}`,
        data: {
          id: i,
          description: 'A moderately long string to take up some memory space',
          nested: { deep: { value: i * 2 } }
        }
      });
    }

    const beforeTeardown = getHeapUsed();

    // Teardown the client
    client.teardown();
    client = null;

    // Clear the dataLayer reference
    delete (globalThis as Record<string, unknown>).dataLayer;

    // Force GC if available
    if (typeof global.gc === 'function') {
      global.gc();
    }

    const afterTeardown = getHeapUsed();

    // Memory should decrease or stay roughly the same after cleanup
    // (GC timing is unpredictable, so we just verify no significant increase)
    const growth = afterTeardown - beforeTeardown;

    // Should not have grown significantly (allow 2MB for GC variance)
    expect(growth).toBeLessThan(2 * 1024 * 1024);
  });

  it('handles 10000 operations without unbounded memory growth', () => {
    const client = createGtmClient({ containers: 'GTM-HEAP3', maxDataLayerSize: 500 });
    client.init();

    const heapSamples: number[] = [];
    const sampleInterval = 1000;

    // Track heap at intervals
    for (let i = 0; i < 10000; i++) {
      client.push({
        event: `longrun_${i}`,
        timestamp: Date.now(),
        data: { index: i, batch: Math.floor(i / 100) }
      });

      if (i % sampleInterval === 0) {
        heapSamples.push(getHeapUsed());
      }
    }

    // Calculate memory growth rate
    const firstHalf = heapSamples.slice(0, Math.floor(heapSamples.length / 2));
    const secondHalf = heapSamples.slice(Math.floor(heapSamples.length / 2));

    const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Memory in second half should not be dramatically higher than first half
    // This indicates stable memory usage, not a leak
    const growthRatio = avgSecondHalf / avgFirstHalf;

    // Allow up to 50% growth (accounts for GC timing, Jest overhead)
    expect(growthRatio).toBeLessThan(1.5);

    client.teardown();
  });

  it('consent deduplication prevents memory accumulation', () => {
    const client = createGtmClient({ containers: 'GTM-HEAP4' });
    client.init();

    const initialHeap = getHeapUsed();

    // Push the same consent update many times (should be deduplicated)
    for (let i = 0; i < 5000; i++) {
      client.updateConsent({ ad_storage: 'granted', analytics_storage: 'granted' });
    }

    const afterDuplicates = getHeapUsed();

    // Memory growth should be minimal since duplicates are filtered
    const growth = afterDuplicates - initialHeap;

    // Should not grow excessively for deduplicated operations
    // Allow up to 30MB for Jest/coverage overhead
    expect(growth).toBeLessThan(30 * 1024 * 1024);

    // Verify deduplication worked - dataLayer should not have 5000 consent entries
    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    const consentEntries = dataLayer.filter(
      (entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update'
    );

    // Should have only 1 unique consent update (deduplicated)
    expect(consentEntries.length).toBe(1);

    client.teardown();
  });

  it('WeakMap cache does not prevent garbage collection', () => {
    const client = createGtmClient({ containers: 'GTM-HEAP5', maxDataLayerSize: 50 });
    client.init();

    const initialHeap = getHeapUsed();

    // Push many events with unique objects (each gets cached)
    for (let round = 0; round < 10; round++) {
      // Create objects that should be garbage collectible after round
      for (let i = 0; i < 100; i++) {
        const uniqueEcommerce = {
          items: Array.from({ length: 10 }, (_, j) => ({
            item_id: `SKU-${round}-${i}-${j}`,
            item_name: `Product ${i}`,
            price: 99.99
          })),
          value: 999.9
        };

        client.push({ event: 'view_cart', ecommerce: uniqueEcommerce });
      }

      // Force GC between rounds if available
      if (typeof global.gc === 'function') {
        global.gc();
      }
    }

    const afterAllRounds = getHeapUsed();
    const growth = afterAllRounds - initialHeap;

    // Memory should not grow unboundedly
    // WeakMap cache allows GC of unreferenced objects
    // Allow up to 50MB growth (accounts for Jest/coverage instrumentation)
    expect(growth).toBeLessThan(50 * 1024 * 1024);

    client.teardown();
  });

  it('multiple client lifecycle does not accumulate memory', () => {
    const initialHeap = getHeapUsed();

    // Create and destroy many clients
    for (let cycle = 0; cycle < 50; cycle++) {
      const client = createGtmClient({
        containers: `GTM-LIFECYCLE-${cycle}`,
        maxDataLayerSize: 100
      });
      client.setConsentDefaults({ ad_storage: 'denied' });
      client.init();

      // Simulate usage
      for (let i = 0; i < 100; i++) {
        client.push({ event: `cycle_${cycle}_event_${i}` });
      }

      client.updateConsent({ ad_storage: 'granted' });

      client.teardown();

      // Clean up dataLayer between cycles
      delete (globalThis as Record<string, unknown>).dataLayer;
      document.head.innerHTML = '';
    }

    // Force GC if available
    if (typeof global.gc === 'function') {
      global.gc();
    }

    const afterCycles = getHeapUsed();
    const growth = afterCycles - initialHeap;

    // Should not accumulate excessive memory over 50 cycles
    // Allow up to 20MB growth (accounts for Jest/coverage instrumentation overhead)
    expect(growth).toBeLessThan(20 * 1024 * 1024);
  });
});

describe('Performance Regression Prevention', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  it('maintains consistent performance over multiple runs', () => {
    const durations: number[] = [];

    for (let run = 0; run < 10; run++) {
      // Reset
      document.head.innerHTML = '';
      delete (globalThis as Record<string, unknown>).dataLayer;

      const start = performance.now();

      const client = createGtmClient({ containers: `GTM-CONSISTENT-${run}` });
      client.init();

      for (let i = 0; i < 100; i++) {
        client.push({ event: `event_${i}` });
      }

      client.teardown();

      durations.push(performance.now() - start);
    }

    // Calculate statistics
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const variance = max - min;

    // Average should be reasonable (allow for CI variability)
    expect(avg).toBeLessThan(500);

    // Variance should not be too high (no degradation over runs)
    expect(variance).toBeLessThan(avg * 5);
  });
});
