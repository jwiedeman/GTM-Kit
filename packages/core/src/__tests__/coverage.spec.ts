/**
 * Comprehensive coverage tests for edge cases and SSR scenarios.
 * This file aims to achieve 100% code coverage across the core package.
 */

import { createGtmClient, createNoscriptMarkup } from '../index';
import { createLogger } from '../logger';
import { ScriptManager } from '../script-manager';
import { ensureDataLayer } from '../data-layer';
import { installAutoQueue, attachToInlineBuffer } from '../auto-queue';

describe('Logger coverage', () => {
  it('binds provided logger functions', () => {
    const debugFn = jest.fn();
    const infoFn = jest.fn();
    const warnFn = jest.fn();
    const errorFn = jest.fn();

    const logger = createLogger({
      debug: debugFn,
      info: infoFn,
      warn: warnFn,
      error: errorFn
    });

    logger.debug('debug msg', { key: 'val' });
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    expect(debugFn).toHaveBeenCalledWith('debug msg', { key: 'val' });
    expect(infoFn).toHaveBeenCalledWith('info msg');
    expect(warnFn).toHaveBeenCalledWith('warn msg');
    expect(errorFn).toHaveBeenCalledWith('error msg');
  });

  it('uses noop for missing logger functions', () => {
    const logger = createLogger({ debug: jest.fn() });

    // These should not throw
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  it('handles undefined logger', () => {
    const logger = createLogger(undefined);

    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });
});

describe('ScriptManager SSR and edge cases', () => {
  const createManager = (options?: Partial<ConstructorParameters<typeof ScriptManager>[0]>) =>
    new ScriptManager({ instanceId: 'test-instance', ...(options ?? {}) });

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('handles ErrorEvent with message but no error object', async () => {
    const manager = createManager();
    const { inserted } = manager.ensure([{ id: 'GTM-ERROR-MSG-ONLY' }]);

    const ready = manager.whenReady();
    inserted[0].dispatchEvent(new ErrorEvent('error', { message: 'Network error' }));

    const states = await ready;
    expect(states[0].error).toBe('Network error');
  });

  it('handles ErrorEvent with neither message nor error', async () => {
    const manager = createManager();
    const { inserted } = manager.ensure([{ id: 'GTM-ERROR-EMPTY' }]);

    const ready = manager.whenReady();
    inserted[0].dispatchEvent(new ErrorEvent('error'));

    const states = await ready;
    expect(states[0].error).toBe('Failed to load GTM script.');
  });

  it('handles regular Event (not ErrorEvent) for error case', async () => {
    const manager = createManager();
    const { inserted } = manager.ensure([{ id: 'GTM-REGULAR-ERROR' }]);

    const ready = manager.whenReady();
    inserted[0].dispatchEvent(new Event('error'));

    const states = await ready;
    expect(states[0].error).toBe('Failed to load GTM script.');
  });

  it('skips undefined and null attribute values', () => {
    const manager = createManager({
      scriptAttributes: {
        'data-defined': 'value',
        'data-undefined': undefined as unknown as string,
        'data-null': null as unknown as string
      }
    });

    const { inserted } = manager.ensure([{ id: 'GTM-NULL-ATTRS' }]);

    expect(inserted[0].getAttribute('data-defined')).toBe('value');
    expect(inserted[0].hasAttribute('data-undefined')).toBe(false);
    expect(inserted[0].hasAttribute('data-null')).toBe(false);
  });

  it('skips id param if explicitly passed in queryParams', () => {
    const manager = createManager({
      defaultQueryParams: { id: 'SHOULD-BE-IGNORED' }
    });

    const { inserted } = manager.ensure([{ id: 'GTM-REAL-ID' }]);
    const url = new URL(inserted[0].src);

    expect(url.searchParams.get('id')).toBe('GTM-REAL-ID');
  });

  it('unsubscribes ready callback', async () => {
    const manager = createManager();
    const callback = jest.fn();

    const unsubscribe = manager.onReady(callback);
    unsubscribe();

    const { inserted } = manager.ensure([{ id: 'GTM-UNSUB' }]);
    inserted[0].dispatchEvent(new Event('load'));

    await manager.whenReady();

    // Callback should NOT be called after unsubscribe
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores duplicate load/error events after settlement', async () => {
    const manager = createManager();
    const callback = jest.fn();
    manager.onReady(callback);

    const { inserted } = manager.ensure([{ id: 'GTM-DUPLICATE-EVENTS' }]);

    inserted[0].dispatchEvent(new Event('load'));
    inserted[0].dispatchEvent(new Event('load')); // Duplicate
    inserted[0].dispatchEvent(new Event('error')); // After already loaded

    await manager.whenReady();

    // Callback should only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('ScriptManager SSR environment simulation', () => {
  // SSR tests are handled by checking the code paths where document is undefined
  // We can't easily mock document being undefined in JSDOM without causing issues
  it('handles scripts with orphaned parent nodes during teardown', () => {
    const manager = new ScriptManager({ instanceId: 'orphan-test' });
    const { inserted } = manager.ensure([{ id: 'GTM-ORPHAN' }]);

    // Remove script from DOM before teardown (simulating edge case)
    if (inserted[0].parentNode) {
      inserted[0].parentNode.removeChild(inserted[0]);
    }

    // Teardown should not throw even if script already removed
    expect(() => manager.teardown()).not.toThrow();
  });
});

describe('Noscript edge cases', () => {
  it('throws error for container without id', () => {
    expect(() => createNoscriptMarkup({ id: '' })).toThrow('Container ID is required to build noscript markup.');
  });

  it('throws error for empty container array', () => {
    expect(() => createNoscriptMarkup([])).toThrow('At least one container is required to build noscript markup.');
  });

  it('handles empty iframeAttributes object', () => {
    const markup = createNoscriptMarkup('GTM-EMPTY-ATTRS', {
      iframeAttributes: {}
    });

    // Should still have default attributes
    expect(markup).toContain('height="0"');
  });

  it('escapes special characters in attribute values', () => {
    const markup = createNoscriptMarkup('GTM-TEST', {
      iframeAttributes: {
        title: 'Test <script>&"quotes"</script>'
      }
    });

    expect(markup).toContain('&lt;script&gt;');
    expect(markup).toContain('&amp;');
    expect(markup).toContain('&quot;quotes&quot;');
  });

  it('skips id param in queryParams', () => {
    const markup = createNoscriptMarkup({
      id: 'GTM-REAL',
      queryParams: { id: 'GTM-FAKE', other: 'value' }
    });

    expect(markup).toContain('id=GTM-REAL');
    expect(markup).not.toContain('id=GTM-FAKE');
    expect(markup).toContain('other=value');
  });
});

describe('Client edge cases', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  it('throws error when no containers provided', () => {
    expect(() => createGtmClient({ containers: [] })).toThrow(
      'At least one GTM container ID is required to initialize the client.'
    );
  });

  it('ignores null push values', () => {
    const client = createGtmClient({ containers: 'GTM-NULL' });
    client.init();

    const beforeLength = ((globalThis as Record<string, unknown>).dataLayer as unknown[]).length;
    client.push(null as unknown as Record<string, unknown>);
    const afterLength = ((globalThis as Record<string, unknown>).dataLayer as unknown[]).length;

    expect(afterLength).toBe(beforeLength);
  });

  it('ignores undefined push values', () => {
    const client = createGtmClient({ containers: 'GTM-UNDEFINED' });
    client.init();

    const beforeLength = ((globalThis as Record<string, unknown>).dataLayer as unknown[]).length;
    client.push(undefined as unknown as Record<string, unknown>);
    const afterLength = ((globalThis as Record<string, unknown>).dataLayer as unknown[]).length;

    expect(afterLength).toBe(beforeLength);
  });

  it('deduplicates consent commands in queue', () => {
    const client = createGtmClient({ containers: 'GTM-CONSENT-DEDUP' });

    // Push same consent command twice before init
    client.setConsentDefaults({ ad_storage: 'denied' });
    client.setConsentDefaults({ ad_storage: 'denied' }); // Duplicate

    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    const consentCommands = dataLayer.filter((item) => Array.isArray(item) && item[0] === 'consent');

    // Should only have one consent command (deduplicated)
    expect(consentCommands.length).toBe(1);
  });

  it('prioritizes consent commands before other events in queue', () => {
    const client = createGtmClient({ containers: 'GTM-CONSENT-ORDER' });

    client.push({ event: 'regular_event' });
    client.setConsentDefaults({ ad_storage: 'denied' });

    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

    // Find indices
    const consentIndex = dataLayer.findIndex((item) => Array.isArray(item) && item[0] === 'consent');
    const eventIndex = dataLayer.findIndex(
      (item) =>
        !Array.isArray(item) &&
        typeof item === 'object' &&
        item !== null &&
        (item as Record<string, unknown>).event === 'regular_event'
    );

    // Consent should come before regular event
    expect(consentIndex).toBeLessThan(eventIndex);
  });

  it('throws when setConsentDefaults is called after init', () => {
    const client = createGtmClient({ containers: 'GTM-POST-INIT-DEDUP' });
    client.init();

    expect(() => {
      client.setConsentDefaults({ ad_storage: 'denied' });
    }).toThrow(/must be called BEFORE init/);
  });

  it('skips gtm.js event when already present in dataLayer snapshot', () => {
    // Pre-populate dataLayer with gtm.js event
    (globalThis as Record<string, unknown>).dataLayer = [{ 'gtm.start': Date.now(), event: 'gtm.js' }];

    const client = createGtmClient({ containers: 'GTM-EXISTING-START' });
    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    const startEvents = dataLayer.filter(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).event === 'gtm.js'
    );

    // Should only have the original gtm.js event
    expect(startEvents.length).toBe(1);
  });

  it('skips values already in dataLayer snapshot during hydration', () => {
    // Pre-populate dataLayer
    (globalThis as Record<string, unknown>).dataLayer = [{ event: 'existing_event', data: 123 }];

    const client = createGtmClient({ containers: 'GTM-HYDRATION' });

    // Push same event that's already in snapshot
    client.push({ event: 'existing_event', data: 123 });

    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    const matchingEvents = dataLayer.filter(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).event === 'existing_event'
    );

    // Should only have one instance (the original)
    expect(matchingEvents.length).toBe(1);
  });

  it('handles consent in snapshot during hydration', () => {
    // Pre-populate with consent command
    (globalThis as Record<string, unknown>).dataLayer = [['consent', 'default', { ad_storage: 'denied' }]];

    const client = createGtmClient({ containers: 'GTM-CONSENT-HYDRATION' });

    // Push same consent command before init (already in snapshot)
    client.setConsentDefaults({ ad_storage: 'denied' });

    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    const consentCommands = dataLayer.filter((item) => Array.isArray(item) && item[0] === 'consent');

    // Should only have the original consent command (deduplicated during hydration)
    expect(consentCommands.length).toBe(1);
  });

  it('restores dataLayer on teardown', () => {
    const client = createGtmClient({ containers: 'GTM-RESTORE' });
    client.init();
    client.push({ event: 'test_event' });

    client.teardown();

    expect((globalThis as Record<string, unknown>).dataLayer).toBeUndefined();
  });

  it('clears internal state on teardown', () => {
    const client = createGtmClient({ containers: 'GTM-TEARDOWN-STATE' });

    // Queue some values
    client.push({ event: 'queued' });
    client.setConsentDefaults({ ad_storage: 'denied' });

    client.teardown();

    // Internal state should be cleared, so re-init should work fresh
    expect(client.isInitialized()).toBe(false);
  });
});

describe('Data layer edge cases', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  it('restores empty array when original dataLayer did not exist', () => {
    const state = ensureDataLayer('dataLayer');

    // Push some values
    state.dataLayer.push({ event: 'test' });

    // Restore should delete the dataLayer
    state.restore();

    expect((globalThis as Record<string, unknown>).dataLayer).toBeUndefined();
  });

  it('restores original snapshot when dataLayer existed', () => {
    (globalThis as Record<string, unknown>).dataLayer = [{ event: 'original' }];

    const state = ensureDataLayer('dataLayer');
    state.dataLayer.push({ event: 'new' });

    state.restore();

    const restored = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    expect(restored).toEqual([{ event: 'original' }]);
  });
});

describe('DataLayer mutation tracing', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createTracedDataLayer } = require('../data-layer');

  const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  });

  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  it('logs push operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    traced.push({ event: 'test' });

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataLayer] push() called with 1 item(s)',
      expect.objectContaining({ items: [expect.any(String)], previousLength: 0 })
    );
    expect(dataLayer.length).toBe(1);
  });

  it('logs pop operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'first' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    const popped = traced.pop();

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataLayer] pop() called',
      expect.objectContaining({ previousLength: 1 })
    );
    expect(popped).toEqual({ event: 'first' });
  });

  it('logs shift operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'first' }, { event: 'second' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    const shifted = traced.shift();

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataLayer] shift() called',
      expect.objectContaining({ previousLength: 2 })
    );
    expect(shifted).toEqual({ event: 'first' });
  });

  it('logs unshift operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'existing' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    traced.unshift({ event: 'new' });

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataLayer] unshift() called with 1 item(s)',
      expect.objectContaining({ previousLength: 1 })
    );
    expect(dataLayer[0]).toEqual({ event: 'new' });
  });

  it('logs splice operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'a' }, { event: 'b' }, { event: 'c' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    traced.splice(1, 1, { event: 'replaced' });

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataLayer] splice() called',
      expect.objectContaining({ start: 1, deleteCount: 1 })
    );
    expect(dataLayer[1]).toEqual({ event: 'replaced' });
  });

  it('logs direct index assignment (replacement)', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'original' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    traced[0] = { event: 'replaced' };

    expect(logger.debug).toHaveBeenCalledWith('[dataLayer] Replaced value at index 0', expect.anything());
  });

  it('logs delete operations', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [{ event: 'test' }];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    delete traced[0];

    expect(logger.debug).toHaveBeenCalledWith('[dataLayer] Deleted value at index 0', expect.anything());
  });

  it('handles circular references in value formatting', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    // Create circular reference
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    traced.push(circular);

    // Should not throw, and should log
    expect(logger.debug).toHaveBeenCalled();
    expect(dataLayer.length).toBe(1);
  });

  it('truncates long values in logs', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    const longValue = { data: 'x'.repeat(200) };
    traced.push(longValue);

    const logCall = logger.debug.mock.calls[0];
    const loggedItems = logCall[1].items[0];
    expect(loggedItems.length).toBeLessThanOrEqual(103); // 100 + '...'
  });

  it('formats null, undefined, and function values', () => {
    const logger = createMockLogger();
    const dataLayer: unknown[] = [];
    const traced = createTracedDataLayer(dataLayer, { logger, dataLayerName: 'dataLayer' });

    traced.push(null);
    traced.push(undefined as unknown);
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- Testing empty function handling
    traced.push(() => {});

    expect(logger.debug).toHaveBeenCalledTimes(3);
  });
});

describe('Auto-queue edge cases', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
    delete (globalThis as Record<string, unknown>).__gtmkit_buffer;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('replay is idempotent when called multiple times', () => {
    const onReplay = jest.fn();
    const state = installAutoQueue({ onReplay });
    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

    dataLayer.push({ event: 'test' });

    state.replay();
    state.replay(); // Second call should be ignored

    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('uninstall is idempotent when called multiple times', () => {
    const state = installAutoQueue();

    state.uninstall();
    state.uninstall(); // Second call should not throw

    expect(state.active).toBe(false);
  });

  it('clears timeout timer on uninstall', () => {
    const onTimeout = jest.fn();
    const state = installAutoQueue({ timeout: 1000, onTimeout });

    state.uninstall();
    jest.advanceTimersByTime(2000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('clears poll timer on uninstall', () => {
    const state = installAutoQueue({ pollInterval: 100 });
    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

    state.uninstall();

    // Manually add gtm.js event
    dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    jest.advanceTimersByTime(200);

    // State should still be inactive
    expect(state.active).toBe(false);
  });

  it('handles timeout without uninstalling to allow late GTM load', () => {
    const onTimeout = jest.fn();
    const onReplay = jest.fn();
    const state = installAutoQueue({ timeout: 1000, onTimeout, onReplay });
    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];

    dataLayer.push({ event: 'early' });

    // Trigger timeout
    jest.advanceTimersByTime(1001);
    expect(onTimeout).toHaveBeenCalledWith(1);
    expect(state.active).toBe(true); // Still active!

    // GTM loads late
    dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    jest.advanceTimersByTime(10);

    expect(onReplay).toHaveBeenCalled();
    expect(state.active).toBe(false);
  });

  it('handles timeout of 0 (unlimited waiting)', () => {
    const onTimeout = jest.fn();
    installAutoQueue({ timeout: 0, onTimeout });

    jest.advanceTimersByTime(100000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('Auto-queue additional coverage', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).dataLayer;
    delete (globalThis as Record<string, unknown>).__gtmkit_buffer;
  });

  it('attachToInlineBuffer returns null when no inline buffer exists', () => {
    // No inline buffer set up
    const result = attachToInlineBuffer();
    expect(result).toBeNull();
  });

  it('handles multiple arguments in intercepted push', () => {
    const state = installAutoQueue();
    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as { push: (...args: unknown[]) => number };

    // Push multiple values at once
    dataLayer.push({ event: 'first' }, { event: 'second' }, { event: 'third' });

    expect(state.bufferedCount).toBe(3);
  });
});

describe('Index exports', () => {
  it('exports all expected functions', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const indexExports = require('../index');

    expect(indexExports.createGtmClient).toBeDefined();
    expect(indexExports.createNoscriptMarkup).toBeDefined();
    expect(indexExports.pushEvent).toBeDefined();
    expect(indexExports.pushEcommerce).toBeDefined();
    expect(indexExports.installAutoQueue).toBeDefined();
    expect(indexExports.createAutoQueueScript).toBeDefined();
    expect(indexExports.attachToInlineBuffer).toBeDefined();
  });
});

describe('Consent edge cases', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildConsentCommand, normalizeConsentState } = require('../consent');

  it('throws error for region that is not an array', () => {
    expect(() =>
      buildConsentCommand({
        command: 'default',
        state: { ad_storage: 'denied' },
        options: { region: 'US-CA' as unknown as string[] }
      })
    ).toThrow('Consent region list must be an array of ISO 3166-2 region codes.');
  });

  it('throws error for unsupported consent command', () => {
    expect(() =>
      buildConsentCommand({
        command: 'invalid' as 'default',
        state: { ad_storage: 'denied' }
      })
    ).toThrow('Unsupported consent command: "invalid"');
  });

  it('throws error for empty state', () => {
    expect(() => normalizeConsentState({})).toThrow('At least one consent key/value pair is required.');
  });

  it('handles empty region array (no regions applied)', () => {
    const result = buildConsentCommand({
      command: 'default',
      state: { ad_storage: 'denied' },
      options: { region: [] }
    });

    // Should not include region in output since array is empty
    expect(result.length).toBe(3); // No options object
  });

  it('rejects __proto__ key in consent state (prototype pollution protection)', () => {
    // Attempt to inject __proto__ via JSON parsing
    const maliciousState = JSON.parse('{"__proto__":{"polluted":"true"},"ad_storage":"granted"}');

    // Should throw because __proto__ is not a valid consent key
    expect(() => normalizeConsentState(maliciousState)).toThrow('Invalid consent key: "__proto__"');

    // Verify no prototype pollution occurred
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects constructor key in consent state (prototype pollution protection)', () => {
    const maliciousState = { constructor: 'granted', ad_storage: 'granted' };

    expect(() => normalizeConsentState(maliciousState as unknown as Record<string, string>)).toThrow(
      'Invalid consent key: "constructor"'
    );
  });

  it('rejects __defineGetter__ key in consent state', () => {
    const maliciousState = { __defineGetter__: 'granted', ad_storage: 'granted' };

    expect(() => normalizeConsentState(maliciousState as unknown as Record<string, string>)).toThrow(
      'Invalid consent key: "__defineGetter__"'
    );
  });

  it('does not pollute Object prototype through consent commands', () => {
    // Store original state
    const originalPolluted = Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted');

    // Try various prototype pollution attempts through buildConsentCommand
    // Use Object.assign to create plain objects with these keys
    const attempts = [
      Object.assign(Object.create(null), { ad_storage: 'granted', toString: 'granted' }),
      Object.assign(Object.create(null), { ad_storage: 'granted', valueOf: 'granted' }),
      Object.assign(Object.create(null), { ad_storage: 'granted', hasOwnProperty: 'granted' })
    ];

    for (const attempt of attempts) {
      expect(() =>
        buildConsentCommand({
          command: 'default',
          state: attempt as Record<string, 'granted' | 'denied'>
        })
      ).toThrow(/Invalid consent key/);
    }

    // Verify no prototype pollution
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(originalPolluted);
    expect(({} as Record<string, unknown>).toString).toBe(Object.prototype.toString);
  });
});

describe('Noscript toRecord edge case', () => {
  it('handles undefined queryParams', () => {
    const markup = createNoscriptMarkup({
      id: 'GTM-NO-PARAMS',
      queryParams: undefined
    });

    expect(markup).toContain('id=GTM-NO-PARAMS');
  });
});

describe('Client flushQueue edge cases', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).dataLayer;
  });

  it('handles queue entry without value', () => {
    const client = createGtmClient({ containers: 'GTM-FLUSH-EDGE' });

    // Push multiple values that might create edge cases
    client.push({ event: 'event1' });
    client.push({ event: 'event2' });
    client.push({ event: 'event3' });

    client.init();

    const dataLayer = (globalThis as Record<string, unknown>).dataLayer as unknown[];
    expect(dataLayer.length).toBeGreaterThan(3);
  });
});
