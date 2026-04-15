import { createGtmClient } from '../client';
import { installInspector } from '../inspector';
import type { InspectorOptions } from '../inspector';

type FakeConsole = NonNullable<InspectorOptions['console']> & {
  log: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  table: jest.Mock;
  group: jest.Mock;
  groupEnd: jest.Mock;
  calls: Record<string, unknown[][]>;
};

const createFakeConsole = (): FakeConsole => {
  const calls: Record<string, unknown[][]> = {
    log: [],
    info: [],
    warn: [],
    error: [],
    table: [],
    group: [],
    groupEnd: []
  };
  const track =
    (key: string) =>
    (...args: unknown[]) => {
      calls[key]!.push(args);
    };
  return {
    log: jest.fn(track('log')),
    info: jest.fn(track('info')),
    warn: jest.fn(track('warn')),
    error: jest.fn(track('error')),
    table: jest.fn(track('table')),
    group: jest.fn(track('group')),
    groupEnd: jest.fn(track('groupEnd')),
    calls
  };
};

describe('inspector', () => {
  afterEach(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g.__gtmKit;
    delete g.dataLayer;
    delete g.customLayer;
  });

  it('exposes a handle on the global object under the configured key', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    const fakeConsole = createFakeConsole();

    installInspector(client, { console: fakeConsole });

    const scope = globalThis as unknown as Record<string, unknown>;
    expect(scope.__gtmKit).toBeDefined();
    expect(fakeConsole.info).toHaveBeenCalledWith(expect.stringContaining('inspector installed → window.__gtmKit'));
  });

  it('is idempotent — second install returns the same handle', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    const fakeConsole = createFakeConsole();

    const first = installInspector(client, { console: fakeConsole });
    const second = installInspector(client, { console: fakeConsole });

    expect(first).toBe(second);
  });

  it('honours a custom globalKey', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    const fakeConsole = createFakeConsole();

    installInspector(client, { console: fakeConsole, globalKey: 'myDebugger' });

    const scope = globalThis as unknown as Record<string, unknown>;
    expect(scope.myDebugger).toBeDefined();
    expect(scope.__gtmKit).toBeUndefined();
    (scope as Record<string, { uninstall: () => void }>).myDebugger!.uninstall();
  });

  it('dump() reports an empty dataLayer', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.dump();

    expect(fakeConsole.info).toHaveBeenCalledWith(expect.stringContaining('is empty'));
    expect(fakeConsole.table).not.toHaveBeenCalled();
  });

  it('dump() tables formatted rows for object and array entries', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    client.init();
    client.push({ event: 'page_view', page_path: '/home' });
    client.push(['consent', 'default', { analytics_storage: 'denied' }]);

    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.dump();

    expect(fakeConsole.table).toHaveBeenCalledTimes(1);
    const rows = fakeConsole.calls.table[0]![0] as Record<string, unknown>[];
    const pageView = rows.find((row) => row.event === 'page_view');
    expect(pageView).toBeDefined();
    expect(pageView?.keys).toContain('page_path');

    const gtagCommand = rows.find((row) => row.type === 'gtag');
    expect(gtagCommand?.command).toBe('consent');
  });

  it('watch() streams subsequent pushes and can be stopped', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    client.init();
    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    const stop = handle.watch();
    client.push({ event: 'purchase', value: 99 });
    expect(fakeConsole.group).toHaveBeenCalledWith('[gtm-kit] push → purchase');

    stop();
    fakeConsole.group.mockClear();
    client.push({ event: 'refund', value: 99 });
    expect(fakeConsole.group).not.toHaveBeenCalled();
  });

  it('watch() does not break the underlying client even if a watcher throws', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    client.init();
    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.watch();
    fakeConsole.group.mockImplementation(() => {
      throw new Error('watcher exploded');
    });

    expect(() => client.push({ event: 'click' })).not.toThrow();
    const layer = (globalThis as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(Array.isArray(layer)).toBe(true);
    expect(layer.some((entry) => (entry as { event?: string }).event === 'click')).toBe(true);
  });

  it('filter() matches events by substring or regex', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    client.init();
    client.push({ event: 'view_item' });
    client.push({ event: 'add_to_cart' });
    client.push({ event: 'purchase' });

    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.filter('cart');
    let rows = fakeConsole.calls.table.pop()![0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event).toBe('add_to_cart');

    handle.filter(/^view_/);
    rows = fakeConsole.calls.table.pop()![0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event).toBe('view_item');

    handle.filter('nonexistent');
    expect(fakeConsole.info).toHaveBeenCalledWith(expect.stringContaining('no events matched'));
  });

  it('status() prints diagnostics including containers and script states', () => {
    const client = createGtmClient({ containers: ['GTM-ABC', 'GTM-DEF'] });
    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.status();

    expect(fakeConsole.group).toHaveBeenCalledWith(expect.stringContaining('status'));
    const infoCalls = fakeConsole.calls.info.map((args) => args.join(' '));
    expect(infoCalls.some((line) => line.includes('GTM-ABC'))).toBe(true);
    expect(fakeConsole.groupEnd).toHaveBeenCalled();
  });

  it('uninstall() stops taps firing and removes the global handle', () => {
    const client = createGtmClient({ containers: 'GTM-ABC' });
    client.init();
    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.watch();
    handle.uninstall();
    fakeConsole.group.mockClear();

    client.push({ event: 'post_uninstall' });

    expect(fakeConsole.group).not.toHaveBeenCalled();
    const scope = globalThis as unknown as Record<string, unknown>;
    expect(scope.__gtmKit).toBeUndefined();
  });

  it('uses a custom dataLayer name when the client is configured with one', () => {
    const client = createGtmClient({ containers: 'GTM-ABC', dataLayerName: 'customLayer' });
    client.init();
    client.push({ event: 'hello' });

    const fakeConsole = createFakeConsole();
    const handle = installInspector(client, { console: fakeConsole });

    handle.dump();
    expect(fakeConsole.table).toHaveBeenCalled();
  });
});
