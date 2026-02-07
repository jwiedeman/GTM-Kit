import { DEFAULT_DATA_LAYER_NAME, DEFAULT_MAX_DATA_LAYER_SIZE, MAX_CONSENT_WAIT_MS } from './constants';
import { ensureDataLayer, pushToDataLayer, createTracedDataLayer } from './data-layer';
import { createConsentCommandValue } from './consent';
import type { ConsentRegionOptions, ConsentState } from './consent';
import { createLogger, createDebugLogger } from './logger';
import { ScriptManager } from './script-manager';
import { normalizeContainer } from './url-utils';
import { isValidDataLayerName } from './types';
import type { CreateGtmClientOptions, DataLayerValue, GtmClient, GtmDiagnostics, ScriptLoadState } from './types';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * WeakMap cache for serialization results.
 * Uses WeakMap to automatically clean up when objects are garbage collected,
 * preventing memory leaks while avoiding redundant serialization of the same objects.
 */
const serializationCache = new WeakMap<object, string | null>();

/**
 * Serialize a value with circular reference detection.
 * @param value - The value to serialize
 * @param seen - Set of objects currently being serialized (for cycle detection)
 */
const serializeUnknown = (value: unknown, seen: Set<object> = new Set()): string | null => {
  // Check cache for object values (arrays and plain objects)
  if (typeof value === 'object' && value !== null) {
    if (serializationCache.has(value)) {
      return serializationCache.get(value) ?? null;
    }
    // Detect circular reference - if we've seen this object in the current path
    if (seen.has(value)) {
      // Circular reference detected, return null (cannot serialize)
      return null;
    }
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    // Add to seen set before recursing
    seen.add(value);
    const parts: string[] = [];
    for (const entry of value) {
      const serialized = serializeUnknown(entry, seen);
      if (serialized === null) {
        seen.delete(value);
        serializationCache.set(value, null);
        return null;
      }
      parts.push(serialized);
    }
    seen.delete(value);
    const result = `[${parts.join(',')}]`;
    serializationCache.set(value, result);
    return result;
  }

  if (isPlainObject(value)) {
    // Add to seen set before recursing
    seen.add(value);
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const serialized = serializeUnknown(value[key], seen);
      if (serialized === null) {
        seen.delete(value);
        serializationCache.set(value, null);
        return null;
      }
      parts.push(`${JSON.stringify(key)}:${serialized}`);
    }
    seen.delete(value);
    const result = `{${parts.join(',')}}`;
    serializationCache.set(value, result);
    return result;
  }

  return null;
};

const serializeDataLayerValue = (value: DataLayerValue): string | null => {
  if (Array.isArray(value)) {
    return serializeUnknown(value);
  }

  if (isPlainObject(value)) {
    return serializeUnknown(value);
  }

  return null;
};

const isConsentCommandValue = (value: DataLayerValue): value is unknown[] =>
  Array.isArray(value) &&
  value.length >= 3 &&
  value[0] === 'consent' &&
  (value[1] === 'default' || value[1] === 'update');

const isStartEvent = (value: DataLayerValue): boolean => {
  if (!isPlainObject(value)) {
    return false;
  }

  return value.event === 'gtm.js';
};

interface QueuedEntry {
  value: DataLayerValue;
  signature: string | null;
}

let instanceCounter = 0;

// Track active client instances per dataLayer name to warn about potential conflicts
const activeClientsPerDataLayer = new Map<string, Set<string>>();

/**
 * Internal implementation of the GTM client.
 * Use {@link createGtmClient} to create instances.
 * @internal
 */
export class GtmClientImpl implements GtmClient {
  private readonly logger = this.options.debug ? createDebugLogger() : createLogger(this.options.logger);
  private readonly resolvedDataLayerName = this.options.dataLayerName ?? DEFAULT_DATA_LAYER_NAME;
  private readonly maxDataLayerSize = this.options.maxDataLayerSize ?? DEFAULT_MAX_DATA_LAYER_SIZE;
  private readonly containers = Array.isArray(this.options.containers)
    ? this.options.containers.map(normalizeContainer)
    : [normalizeContainer(this.options.containers)];
  private readonly queue: QueuedEntry[] = [];
  private readonly queuedConsentSignatures = new Set<string>();
  private readonly deliveredConsentSignatures = new Set<string>();
  private snapshotSignatures: Set<string> | null = null;
  private readonly scriptManager = new ScriptManager({
    instanceId: this.instanceId,
    host: this.options.host,
    dataLayerName: this.resolvedDataLayerName,
    defaultQueryParams: this.options.defaultQueryParams,
    scriptAttributes: this.options.scriptAttributes,
    logger: this.options.logger,
    retry: this.options.retry,
    scriptTimeout: this.options.scriptTimeout,
    onScriptError: this.options.onScriptError,
    onScriptTimeout: this.options.onScriptTimeout,
    verifyInitialization: this.options.verifyInitialization,
    initializationTimeout: this.options.initializationTimeout,
    onPartialLoad: this.options.onPartialLoad
  });
  private dataLayerState: ReturnType<typeof ensureDataLayer> | null = null;
  private initialized = false;
  private readonly startTimestamp = Date.now();

  constructor(
    private readonly options: CreateGtmClientOptions,
    private readonly instanceId: string
  ) {
    if (!this.containers.length) {
      throw new Error(
        'At least one GTM container ID is required to initialize the client. ' +
          'Example: createGtmClient({ containers: "GTM-XXXXXX" })'
      );
    }

    // Validate container IDs - filter out empty/whitespace-only IDs
    const invalidContainers = this.containers.filter((c) => !c.id || !c.id.trim());
    if (invalidContainers.length > 0) {
      if (invalidContainers.length === this.containers.length) {
        // All containers are invalid - throw
        throw new Error(
          'All container IDs are empty or invalid. At least one valid GTM container ID is required. ' +
            'Container IDs should be in the format "GTM-XXXXXX". ' +
            'Example: createGtmClient({ containers: "GTM-ABC123" })'
        );
      } else {
        // Some containers are invalid - warn and continue with valid ones
        this.logger.warn(
          `${invalidContainers.length} container ID(s) are empty or invalid and will be skipped. ` +
            'Valid container IDs should be in the format "GTM-XXXXXX".'
        );
      }
    }

    // Validate dataLayer name if provided
    if (this.options.dataLayerName !== undefined && !isValidDataLayerName(this.options.dataLayerName)) {
      throw new Error(
        `Invalid dataLayer name: "${this.options.dataLayerName}". ` +
          'DataLayer names must be valid JavaScript identifiers (letters, numbers, underscores, dollar signs) ' +
          'and cannot be reserved words. Example: "dataLayer", "myCustomLayer", "gtm_data"'
      );
    }
  }

  /**
   * Initializes the GTM client, setting up the dataLayer and loading GTM scripts.
   *
   * **Important**: Call `setConsentDefaults()` BEFORE `init()` if you need consent mode.
   * Events pushed before `init()` are queued and delivered after initialization.
   *
   * This method is idempotent - calling it multiple times has no effect after
   * the first call.
   *
   * @example
   * ```ts
   * const client = createGtmClient({ containers: 'GTM-XXXXXX' });
   *
   * // Set consent BEFORE init
   * client.setConsentDefaults({ analytics_storage: 'denied' });
   *
   * // Initialize GTM
   * client.init();
   *
   * // Now safe to push events
   * client.push({ event: 'page_view' });
   * ```
   */
  init(): void {
    if (this.initialized) {
      this.logger.debug('GTM client already initialized; skipping.');
      return;
    }

    this.initialized = true;

    this.logger.info('Initializing GTM client.', {
      containers: this.containers.map((container) => container.id),
      dataLayerName: this.resolvedDataLayerName
    });

    // Track this client instance for the dataLayer name
    if (!activeClientsPerDataLayer.has(this.resolvedDataLayerName)) {
      activeClientsPerDataLayer.set(this.resolvedDataLayerName, new Set());
    }
    const activeClients = activeClientsPerDataLayer.get(this.resolvedDataLayerName)!;

    // Warn if another client is already using this dataLayer
    if (activeClients.size > 0) {
      this.logger.warn(
        `Multiple GTM client instances are sharing the same dataLayer "${this.resolvedDataLayerName}". ` +
          'This may cause unexpected behavior if one instance tears down while others are active. ' +
          'Consider using different dataLayerName values for separate clients.',
        { activeInstances: activeClients.size + 1, dataLayerName: this.resolvedDataLayerName }
      );
    }
    activeClients.add(this.instanceId);

    // Warn if using custom dataLayerName but default 'dataLayer' already exists
    // This is a common misconfiguration - the existing dataLayer will be ignored
    const existingDataLayer = (globalThis as Record<string, unknown>)['dataLayer'];
    if (this.resolvedDataLayerName !== 'dataLayer' && typeof existingDataLayer !== 'undefined') {
      this.logger.warn(
        `Using custom dataLayerName "${this.resolvedDataLayerName}" but global "dataLayer" already exists. ` +
          'The existing dataLayer will NOT be used. If you have existing GTM code using "dataLayer", ' +
          'either remove the custom dataLayerName option or update your existing code to use the new name.',
        {
          customName: this.resolvedDataLayerName,
          existingDataLayerLength: Array.isArray(existingDataLayer) ? existingDataLayer.length : undefined
        }
      );
    }

    this.dataLayerState = ensureDataLayer(this.resolvedDataLayerName);

    // Wrap dataLayer with tracing proxy in debug mode
    if (this.options.debug) {
      const tracedDataLayer = createTracedDataLayer(this.dataLayerState.dataLayer, {
        logger: this.logger,
        dataLayerName: this.resolvedDataLayerName
      });
      // Update the global reference to use the traced version
      const globalScope = globalThis as Record<string, unknown>;
      globalScope[this.resolvedDataLayerName] = tracedDataLayer;
      // Also update our local reference
      this.dataLayerState.dataLayer = tracedDataLayer;
      this.logger.debug('DataLayer mutation tracing enabled.', {
        dataLayerName: this.resolvedDataLayerName
      });
    }

    this.captureSnapshotSignatures();
    this.pushStartEvent();
    this.flushQueue();
    this.scriptManager.ensure(this.containers);
  }

  /**
   * Pushes a value to the GTM dataLayer.
   *
   * **Queuing behavior:** If called before `init()`, values are silently queued
   * and delivered when `init()` is called. This allows you to push events early
   * (e.g., during app startup) without waiting for GTM initialization.
   *
   * **Error handling:** Push errors are caught and logged but do not throw.
   * This ensures analytics failures never crash your application.
   *
   * @param value - The value to push to the dataLayer. Can be:
   *   - An event object: `{ event: 'page_view', page_title: 'Home' }`
   *   - Data variables: `{ user_id: '123', user_type: 'premium' }`
   *   - A callback function for timing: `() => console.log('Processed')`
   *
   * @example Pushing events
   * ```ts
   * // Page view event
   * client.push({ event: 'page_view', page_title: 'Home' });
   *
   * // Custom event with data
   * client.push({
   *   event: 'button_click',
   *   button_id: 'signup-cta',
   *   button_text: 'Sign Up Now'
   * });
   * ```
   *
   * @example Pushing data (no event)
   * ```ts
   * // Set user properties (no event fired)
   * client.push({
   *   user_id: 'usr_123',
   *   user_type: 'premium',
   *   account_age_days: 365
   * });
   * ```
   *
   * @example Pre-init queuing
   * ```ts
   * const client = createGtmClient({ containers: 'GTM-XXXXX' });
   *
   * // These are queued (init not called yet)
   * client.push({ event: 'early_event_1' });
   * client.push({ event: 'early_event_2' });
   *
   * // Later, when ready to initialize:
   * client.init(); // Queued events are now delivered to dataLayer
   * ```
   */
  push(value: DataLayerValue): void {
    if (value === undefined || value === null) {
      this.logger.warn('Skipped dataLayer push: value is null or undefined.', { value });
      return;
    }

    const immediate = this.deliverToDataLayer(value);

    if (immediate) {
      this.logger.debug('Pushed value to dataLayer.', { immediate: true });
    } else {
      this.logger.debug('Queued dataLayer value (pre-init).', { queueLength: this.queue.length });
      // Show queue visualization when items are queued
      this.logQueueVisualization('Current queue state');
    }
  }

  setConsentDefaults(state: ConsentState, options?: ConsentRegionOptions): void {
    // Error if called after init - consent defaults MUST be set BEFORE GTM loads
    if (this.initialized) {
      throw new Error(
        'setConsentDefaults() must be called BEFORE init(). ' +
          'Google requires consent defaults to be set before GTM loads to ensure proper tag behavior. ' +
          'Move your setConsentDefaults() call before client.init().'
      );
    }

    // Validate waitForUpdate value
    if (options?.waitForUpdate !== undefined) {
      const waitValue = options.waitForUpdate;

      // Error on invalid values (negative, NaN, Infinity)
      if (typeof waitValue !== 'number' || !Number.isFinite(waitValue) || waitValue < 0) {
        throw new Error(
          `Invalid waitForUpdate value: ${waitValue}. ` +
            'waitForUpdate must be a non-negative finite number representing milliseconds.'
        );
      }

      // Warn if waitForUpdate exceeds the maximum reasonable wait time
      if (waitValue > MAX_CONSENT_WAIT_MS) {
        this.logger.warn(
          `waitForUpdate value of ${waitValue}ms exceeds 30 minutes. ` +
            'This may cause significant delays in tag firing. Consider using a smaller value.',
          { waitForUpdate: waitValue }
        );
      }
    }

    const value = createConsentCommandValue({ command: 'default', state, options });
    const immediate = this.deliverToDataLayer(value);

    this.logger.info('Applied consent defaults.', {
      immediate,
      state,
      options
    });
  }

  /**
   * Updates the consent state. Each unique consent state is pushed to the dataLayer.
   *
   * **Concurrent updates behavior (last-write-wins):**
   * - All unique consent updates are pushed to the dataLayer in the order they are called
   * - Duplicate consent updates (same state and options) are deduplicated via signature comparison
   * - GTM processes consent commands in order, so the last update for a given key wins
   * - This is intentional: it allows rapid UI changes to all be recorded while preventing duplicates
   *
   * @example
   * ```ts
   * // These concurrent updates are all pushed (all unique)
   * client.updateConsent({ ad_storage: 'granted' });       // Pushed
   * client.updateConsent({ analytics_storage: 'granted' }); // Pushed
   * client.updateConsent({ ad_storage: 'denied' });        // Pushed (different state)
   *
   * // This duplicate is deduplicated
   * client.updateConsent({ ad_storage: 'denied' });        // Skipped (duplicate)
   * ```
   */
  updateConsent(state: ConsentState, options?: ConsentRegionOptions): void {
    const value = createConsentCommandValue({ command: 'update', state, options });
    const immediate = this.deliverToDataLayer(value);

    this.logger.info('Updated consent state.', {
      immediate,
      state,
      options
    });
  }

  /**
   * Tears down the GTM client, restoring the dataLayer to its pre-init state.
   *
   * Use this for cleanup in React useEffect, Vue onUnmounted, etc.
   * After teardown, the client cannot be reused - create a new instance instead.
   *
   * **Warning**: If multiple clients share the same dataLayer name, teardown
   * will restore the dataLayer snapshot, which may affect other clients.
   *
   * @example React cleanup
   * ```tsx
   * useEffect(() => {
   *   const client = createGtmClient({ containers: 'GTM-XXXXXX' });
   *   client.init();
   *
   *   return () => client.teardown();
   * }, []);
   * ```
   */
  teardown(): void {
    this.logger.info('Tearing down GTM client instance.', { dataLayerName: this.resolvedDataLayerName });

    // Remove this client from active tracking
    const activeClients = activeClientsPerDataLayer.get(this.resolvedDataLayerName);
    if (activeClients) {
      activeClients.delete(this.instanceId);

      // Warn if other clients are still using this dataLayer (restore may affect them)
      if (activeClients.size > 0 && this.dataLayerState) {
        this.logger.warn(
          `Tearing down GTM client while ${activeClients.size} other instance(s) are still using ` +
            `the same dataLayer "${this.resolvedDataLayerName}". ` +
            "The dataLayer will be restored to this client's snapshot, which may affect other clients.",
          { remainingInstances: activeClients.size, dataLayerName: this.resolvedDataLayerName }
        );
      }

      // Clean up the Map entry if no more clients
      if (activeClients.size === 0) {
        activeClientsPerDataLayer.delete(this.resolvedDataLayerName);
      }
    }

    this.scriptManager.teardown();
    if (this.dataLayerState) {
      this.dataLayerState.restore();
    }
    this.queue.length = 0;
    this.queuedConsentSignatures.clear();
    this.deliveredConsentSignatures.clear();
    this.snapshotSignatures = null;
    this.initialized = false;
    this.dataLayerState = null;
  }

  /**
   * Returns whether `init()` has been called.
   *
   * Note: This does NOT mean GTM scripts have loaded - use `isReady()` for that.
   *
   * @returns `true` if `init()` has been called, `false` otherwise
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns whether all GTM scripts have finished loading (successfully or not).
   *
   * This is a synchronous check - use `whenReady()` if you need to wait.
   *
   * @returns `true` if all scripts have completed loading, `false` if still loading
   *
   * @example
   * ```ts
   * if (client.isReady()) {
   *   // Scripts loaded, safe to check script states
   * } else {
   *   // Scripts still loading
   *   await client.whenReady();
   * }
   * ```
   */
  isReady(): boolean {
    return this.scriptManager.isReady();
  }

  /**
   * Returns a Promise that resolves when all GTM scripts have finished loading.
   *
   * The promise resolves with an array of script load states - check each state's
   * `status` to determine if scripts loaded successfully.
   *
   * @returns Promise resolving to array of script load states
   *
   * @example
   * ```ts
   * const states = await client.whenReady();
   *
   * const allSuccessful = states.every(s => s.status === 'loaded');
   * if (!allSuccessful) {
   *   console.warn('Some GTM scripts failed to load');
   * }
   * ```
   */
  whenReady(): Promise<ScriptLoadState[]> {
    return this.scriptManager.whenReady();
  }

  /**
   * Registers a callback to be invoked when all GTM scripts have finished loading.
   *
   * If scripts are already loaded, the callback is invoked immediately.
   * Returns an unsubscribe function to cancel the callback.
   *
   * @param callback - Function to call with script load states
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = client.onReady((states) => {
   *   console.log('GTM loaded:', states);
   * });
   *
   * // Later, if needed:
   * unsubscribe();
   * ```
   */
  onReady(callback: (state: ScriptLoadState[]) => void): () => void {
    return this.scriptManager.onReady(callback);
  }

  /**
   * The resolved dataLayer name (defaults to 'dataLayer').
   */
  get dataLayerName(): string {
    return this.resolvedDataLayerName;
  }

  /**
   * Returns diagnostic information about the GTM client state.
   *
   * Useful for debugging and monitoring. Includes initialization status,
   * script states, queue size, and uptime.
   *
   * @returns Diagnostic information object
   *
   * @example
   * ```ts
   * const diagnostics = client.getDiagnostics();
   * console.log('GTM Status:', {
   *   initialized: diagnostics.initialized,
   *   ready: diagnostics.ready,
   *   dataLayerSize: diagnostics.dataLayerSize,
   *   uptime: `${diagnostics.uptimeMs}ms`
   * });
   * ```
   */
  getDiagnostics(): GtmDiagnostics {
    return {
      initialized: this.initialized,
      ready: this.scriptManager.isReady(),
      dataLayerName: this.resolvedDataLayerName,
      dataLayerSize: this.dataLayerState?.dataLayer.length ?? 0,
      queueSize: this.queue.length,
      consentCommandsDelivered: this.deliveredConsentSignatures.size,
      containers: this.containers.map((c) => c.id),
      scriptStates: this.scriptManager.getScriptStates(),
      uptimeMs: Date.now() - this.startTimestamp,
      debugMode: this.options.debug ?? false
    };
  }

  private flushQueue(): void {
    if (!this.dataLayerState) {
      return;
    }

    if (this.options.debug && this.queue.length > 0) {
      this.logQueueVisualization('Flushing queue');
    }

    while (this.queue.length) {
      const entry = this.queue.shift();
      if (!entry) {
        continue;
      }

      this.pushValueToDataLayer(entry.value, entry.signature);

      if (entry.signature) {
        this.queuedConsentSignatures.delete(entry.signature);
      }
    }

    if (this.options.debug) {
      this.logger.debug('Queue flushed successfully.', { queueLength: 0 });
    }
  }

  /**
   * Logs a visual representation of the event queue for debugging.
   * Shows event types, order, and basic structure.
   */
  private logQueueVisualization(action: string): void {
    if (!this.options.debug || this.queue.length === 0) {
      return;
    }

    const queueSummary = this.queue.map((entry, index) => {
      const value = entry.value;
      let eventType = 'unknown';
      let details = '';

      if (Array.isArray(value)) {
        // Consent command
        eventType = `consent:${value[1] ?? 'command'}`;
        details = JSON.stringify(value[2] ?? {}).slice(0, 50);
      } else if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if (obj.event) {
          eventType = String(obj.event);
          // Add ecommerce indicator if present
          if (obj.ecommerce) {
            details = '[ecommerce]';
          }
        } else {
          eventType = 'data';
          details = Object.keys(obj).slice(0, 3).join(', ');
        }
      } else if (typeof value === 'function') {
        eventType = 'callback';
      }

      return `  ${index + 1}. ${eventType}${details ? ` (${details})` : ''}`;
    });

    this.logger.debug(`[Queue Visualization] ${action}`, {
      queueLength: this.queue.length,
      entries: '\n' + queueSummary.join('\n')
    });
  }

  private deliverToDataLayer(value: DataLayerValue): boolean {
    if (this.initialized && this.dataLayerState) {
      this.pushValueToDataLayer(value);
      return true;
    }

    this.queueValue(value);
    return false;
  }

  private pushStartEvent(): void {
    if (!this.dataLayerState) {
      return;
    }

    if (this.hasExistingStartEvent()) {
      this.logger.debug('Detected existing gtm.js event; skipping duplicate start push.');
      return;
    }

    const startEvent = { 'gtm.start': this.startTimestamp, event: 'gtm.js' } as const;
    this.pushValueToDataLayer(startEvent);
  }

  private captureSnapshotSignatures(): void {
    if (!this.dataLayerState) {
      return;
    }

    const snapshot = this.dataLayerState.snapshot ?? [];
    this.snapshotSignatures = new Set<string>();

    for (const value of snapshot) {
      const signature = serializeDataLayerValue(value);
      if (signature) {
        this.snapshotSignatures.add(signature);
        if (isConsentCommandValue(value)) {
          this.deliveredConsentSignatures.add(signature);
        }
      }
    }
  }

  private queueValue(value: DataLayerValue): void {
    const signature = isConsentCommandValue(value) ? serializeDataLayerValue(value) : null;

    if (signature && this.queuedConsentSignatures.has(signature)) {
      this.logger.debug('Skipping duplicate queued dataLayer value.', { value });
      return;
    }

    const entry: QueuedEntry = { value, signature };

    if (isConsentCommandValue(value)) {
      const firstNonConsentIndex = this.queue.findIndex((queued) => !isConsentCommandValue(queued.value));

      if (firstNonConsentIndex === -1) {
        this.queue.push(entry);
      } else {
        this.queue.splice(firstNonConsentIndex, 0, entry);
      }
    } else {
      this.queue.push(entry);
    }

    if (signature) {
      this.queuedConsentSignatures.add(signature);
    }
  }

  private pushValueToDataLayer(value: DataLayerValue, existingSignature?: string | null): void {
    if (!this.dataLayerState) {
      return;
    }

    const signature = existingSignature ?? serializeDataLayerValue(value);
    const isConsentCommand = isConsentCommandValue(value);
    const seenInSnapshot = signature ? this.snapshotSignatures?.has(signature) : false;
    const alreadyDeliveredConsent =
      isConsentCommand && signature ? this.deliveredConsentSignatures.has(signature) : false;

    if (signature && seenInSnapshot) {
      this.logger.debug('Skipping duplicate dataLayer value detected during hydration.', { value });
      if (isConsentCommand) {
        this.deliveredConsentSignatures.add(signature);
      }
      return;
    }

    if (isConsentCommand && alreadyDeliveredConsent) {
      this.logger.debug('Skipping duplicate consent command.', { value });
      return;
    }

    // Enforce size limit before pushing to prevent unbounded growth
    this.enforceDataLayerSizeLimit();

    // Wrap dataLayer push in try/catch to prevent errors from crashing the app
    try {
      pushToDataLayer(this.dataLayerState, value);
    } catch (error) {
      this.logger.error('Failed to push value to dataLayer.', {
        error: error instanceof Error ? error.message : String(error),
        value
      });
      // Don't rethrow - let the app continue even if GTM tracking fails
      return;
    }

    if (isConsentCommand && signature) {
      this.deliveredConsentSignatures.add(signature);
    }
  }

  private hasExistingStartEvent(): boolean {
    if (!this.dataLayerState) {
      return false;
    }

    const snapshot = this.dataLayerState.snapshot ?? [];
    if (snapshot.some(isStartEvent)) {
      return true;
    }

    return this.dataLayerState.dataLayer.some(isStartEvent);
  }

  private enforceDataLayerSizeLimit(): void {
    if (this.maxDataLayerSize <= 0 || !this.dataLayerState) {
      return;
    }

    const dataLayer = this.dataLayerState.dataLayer;
    // Trim when at or above the limit to make room for the incoming push
    const excess = dataLayer.length - this.maxDataLayerSize;

    if (excess < 0) {
      return;
    }

    // Find indices of critical entries that should not be trimmed
    const criticalIndices = new Set<number>();
    for (let i = 0; i < dataLayer.length; i++) {
      const value = dataLayer[i];
      if (isStartEvent(value) || isConsentCommandValue(value)) {
        criticalIndices.add(i);
      }
    }

    // Remove at least 1 entry to make room for the incoming push
    const targetTrimCount = Math.max(1, excess);
    let trimmedCount = 0;
    let index = 0;

    while (trimmedCount < targetTrimCount && index < dataLayer.length) {
      if (!criticalIndices.has(index)) {
        dataLayer.splice(index, 1);
        trimmedCount++;
        // Adjust critical indices for removed element
        const newCriticalIndices = new Set<number>();
        for (const criticalIndex of criticalIndices) {
          if (criticalIndex > index) {
            newCriticalIndices.add(criticalIndex - 1);
          } else {
            newCriticalIndices.add(criticalIndex);
          }
        }
        criticalIndices.clear();
        for (const ci of newCriticalIndices) {
          criticalIndices.add(ci);
        }
      } else {
        index++;
      }
    }

    if (trimmedCount > 0) {
      this.logger.warn('DataLayer size limit reached; trimmed oldest entries.', {
        trimmedCount,
        currentSize: dataLayer.length,
        maxSize: this.maxDataLayerSize
      });

      this.options.onDataLayerTrim?.(trimmedCount, dataLayer.length);
    }
  }
}

/**
 * Creates a new GTM client instance for managing Google Tag Manager interactions.
 *
 * The client handles:
 * - DataLayer initialization and management
 * - GTM script loading with retry support
 * - Consent mode commands (defaults and updates)
 * - Event queuing before initialization
 * - Hydration-aware deduplication for SSR apps
 *
 * @param options - Configuration options for the GTM client
 * @returns A GTM client instance
 *
 * @example Basic usage
 * ```ts
 * import { createGtmClient } from '@jwiedeman/gtm-kit';
 *
 * const client = createGtmClient({
 *   containers: 'GTM-XXXXXX'
 * });
 *
 * client.init();
 * client.push({ event: 'page_view', page_title: 'Home' });
 * ```
 *
 * @example With consent mode
 * ```ts
 * const client = createGtmClient({
 *   containers: 'GTM-XXXXXX',
 *   debug: true
 * });
 *
 * // Set consent defaults BEFORE init
 * client.setConsentDefaults({
 *   ad_storage: 'denied',
 *   analytics_storage: 'denied'
 * });
 *
 * client.init();
 *
 * // Update consent after user interaction
 * client.updateConsent({ analytics_storage: 'granted' });
 * ```
 *
 * @example With error handling
 * ```ts
 * const client = createGtmClient({
 *   containers: 'GTM-XXXXXX',
 *   retry: { attempts: 3, delay: 1000 },
 *   onScriptError: (state) => {
 *     console.error('GTM failed to load:', state.error);
 *   }
 * });
 * ```
 *
 * @see {@link CreateGtmClientOptions} for all configuration options
 */
export const createGtmClient = (options: CreateGtmClientOptions): GtmClient => {
  const instanceId = `gtm-kit-${++instanceCounter}`;
  return new GtmClientImpl(options, instanceId);
};
