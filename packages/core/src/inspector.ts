import type { GtmClient, DataLayerValue } from './types';

/**
 * Browser-console debugging helpers.
 *
 * This module is tree-shakeable — importing it has zero cost for production
 * builds that don't call `installInspector()`. A typical dev-only setup:
 *
 *   if (import.meta.env.DEV) {
 *     const { installInspector } = await import('@jwiedeman/gtm-kit/inspector');
 *     installInspector(client);
 *   }
 *
 * Once installed, a `__gtmKit` object is exposed on `window` with methods
 * described below. The inspector is idempotent: calling `installInspector()`
 * twice returns the existing handle.
 */

export interface InspectorHandle {
  /** Dump the current dataLayer to `console.table` with row numbers. */
  readonly dump: () => void;
  /** Print diagnostics (init state, containers, script load times, queue size). */
  readonly status: () => void;
  /** Start streaming every push to the console as a formatted group. */
  readonly watch: () => () => void;
  /** Print every event whose name matches the predicate (string or regex). */
  readonly filter: (pattern: string | RegExp) => void;
  /** Remove the inspector and its global handle. */
  readonly uninstall: () => void;
}

export interface InspectorOptions {
  /**
   * Global key the inspector attaches to. Defaults to `__gtmKit`.
   * Change this if you want multiple clients or the default clashes with your app.
   */
  globalKey?: string;
  /**
   * Pre-installed console logger. Defaults to `globalThis.console`.
   * Tests and Node environments can pass a fake console here.
   */
  console?: Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'table' | 'group' | 'groupEnd'>;
}

const DEFAULT_GLOBAL_KEY = '__gtmKit';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readDataLayer = (client: GtmClient): DataLayerValue[] => {
  const globalScope = globalThis as unknown as Record<string, unknown>;
  const layer = globalScope[client.dataLayerName];
  return Array.isArray(layer) ? (layer as DataLayerValue[]) : [];
};

const formatEventRow = (entry: DataLayerValue, index: number): Record<string, unknown> => {
  if (Array.isArray(entry)) {
    return { '#': index, type: 'gtag', command: entry[0], args: entry.slice(1).length };
  }
  if (isRecord(entry)) {
    const { event, ...rest } = entry;
    return {
      '#': index,
      event: typeof event === 'string' ? event : '(no event)',
      keys: Object.keys(rest).join(', ')
    };
  }
  return { '#': index, type: typeof entry, value: String(entry) };
};

/**
 * Wraps `client.push` so every subsequent call also notifies the inspector's
 * watchers. Returns a restore function.
 */
const attachPushTap = (client: GtmClient, onPush: (value: DataLayerValue) => void): (() => void) => {
  const original = client.push.bind(client);
  const tapped = (value: DataLayerValue) => {
    try {
      onPush(value);
    } catch {
      /* a misbehaving tap must never break the real push */
    }
    original(value);
  };
  (client as { push: (value: DataLayerValue) => void }).push = tapped;

  return () => {
    (client as { push: (value: DataLayerValue) => void }).push = original;
  };
};

const eventName = (value: DataLayerValue): string | null => {
  if (isRecord(value) && typeof value.event === 'string') {
    return value.event;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
};

export const installInspector = (client: GtmClient, options: InspectorOptions = {}): InspectorHandle => {
  const globalKey = options.globalKey ?? DEFAULT_GLOBAL_KEY;
  const log = options.console ?? (typeof console !== 'undefined' ? console : undefined);

  if (!log) {
    throw new Error(
      'installInspector() requires a console. In a non-browser environment, pass options.console to provide one.'
    );
  }

  const scope = globalThis as unknown as Record<string, InspectorHandle | undefined>;
  const existing = scope[globalKey];
  if (existing) {
    return existing;
  }

  const watchers = new Set<(value: DataLayerValue) => void>();
  const restorePush = attachPushTap(client, (value) => {
    for (const watcher of watchers) {
      watcher(value);
    }
  });

  const handle: InspectorHandle = {
    dump: () => {
      const layer = readDataLayer(client);
      if (layer.length === 0) {
        log.info(`[gtm-kit] dataLayer "${client.dataLayerName}" is empty.`);
        return;
      }
      log.table(layer.map(formatEventRow));
    },
    status: () => {
      const diagnostics = client.getDiagnostics();
      log.group(`[gtm-kit] status (${diagnostics.dataLayerName})`);
      log.info('initialized:', diagnostics.initialized, '| ready:', diagnostics.ready);
      log.info('containers:', diagnostics.containers.join(', ') || '(none)');
      log.info(
        'dataLayer size:',
        diagnostics.dataLayerSize,
        '| queue size:',
        diagnostics.queueSize,
        '| consent commands:',
        diagnostics.consentCommandsDelivered
      );
      log.info('uptime:', `${diagnostics.uptimeMs}ms`, '| debug:', diagnostics.debugMode);
      if (diagnostics.scriptStates.length > 0) {
        log.table(
          diagnostics.scriptStates.map((state) => ({
            container: state.containerId,
            status: state.status,
            loadTimeMs: state.loadTimeMs ?? '—',
            error: state.error ?? ''
          }))
        );
      }
      log.groupEnd();
    },
    watch: () => {
      const watcher = (value: DataLayerValue) => {
        const name = eventName(value) ?? '(no event)';
        log.group(`[gtm-kit] push → ${name}`);
        log.log(value);
        log.groupEnd();
      };
      watchers.add(watcher);
      return () => {
        watchers.delete(watcher);
      };
    },
    filter: (pattern) => {
      const match =
        typeof pattern === 'string' ? (name: string) => name.includes(pattern) : (name: string) => pattern.test(name);
      const layer = readDataLayer(client);
      const matches = layer
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => {
          const name = eventName(entry);
          return name !== null && match(name);
        });
      if (matches.length === 0) {
        log.info(`[gtm-kit] no events matched ${String(pattern)}.`);
        return;
      }
      log.table(matches.map(({ entry, index }) => formatEventRow(entry, index)));
    },
    uninstall: () => {
      watchers.clear();
      restorePush();
      delete scope[globalKey];
    }
  };

  scope[globalKey] = handle;
  log.info(
    `[gtm-kit] inspector installed → window.${globalKey}. Try: ${globalKey}.dump(), ${globalKey}.status(), ${globalKey}.watch().`
  );
  return handle;
};
