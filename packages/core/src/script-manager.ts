import { DEFAULT_DATA_LAYER_NAME, DEFAULT_GTM_HOST } from './constants';
import { createLogger } from './logger';
import type {
  ContainerDescriptor,
  CreateGtmClientOptions,
  ScriptAttributes,
  ScriptLoadState,
  ScriptLoadStatus,
  ScriptRetryOptions
} from './types';
import { getGoogleTagManager } from './types';
import { buildGtmScriptUrl } from './url-utils';

const CONTAINER_ATTR = 'data-gtm-container-id';
const INSTANCE_ATTR = 'data-gtm-kit-instance';

// Default values for retry and timeout
const DEFAULT_RETRY_ATTEMPTS = 0;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_RETRY_MAX_DELAY = 30000;
const DEFAULT_SCRIPT_TIMEOUT = 30000;
const DEFAULT_INITIALIZATION_TIMEOUT = 5000;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  settled: boolean;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolved = false;
  let resolver: (value: T) => void;

  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });

  return {
    get settled() {
      return resolved;
    },
    promise,
    resolve: (value: T) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolver(value);
    }
  } as Deferred<T>;
};

export interface NormalizedContainer extends ContainerDescriptor {
  queryParams?: Record<string, string | number | boolean>;
}

export interface ScriptManagerOptions {
  instanceId: string;
  host?: string;
  dataLayerName?: string;
  scriptAttributes?: ScriptAttributes;
  defaultQueryParams?: Record<string, string | number | boolean>;
  logger?: CreateGtmClientOptions['logger'];
  retry?: ScriptRetryOptions;
  scriptTimeout?: number;
  onScriptError?: (state: ScriptLoadState) => void;
  onScriptTimeout?: (containerId: string) => void;
  verifyInitialization?: boolean;
  initializationTimeout?: number;
  onPartialLoad?: (state: ScriptLoadState) => void;
}

export interface EnsureResult {
  inserted: HTMLScriptElement[];
}

const findExistingScript = (containerId: string): HTMLScriptElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const attrSelector = `script[${CONTAINER_ATTR}="${containerId}"]`;
  const existingWithAttr = document.querySelector(attrSelector);
  if (existingWithAttr) {
    return existingWithAttr as HTMLScriptElement;
  }

  const scripts = Array.from(document.getElementsByTagName('script'));
  return scripts.find((script) => script.src.includes(`id=${encodeURIComponent(containerId)}`)) || null;
};

const formatErrorMessage = (event: Event): string => {
  if (event instanceof ErrorEvent) {
    if (event.error) {
      return String(event.error);
    }

    if (event.message) {
      return event.message;
    }
  }

  return 'Failed to load GTM script.';
};

export class ScriptManager {
  private readonly logger = createLogger(this.options.logger);
  private readonly host = this.options.host ?? DEFAULT_GTM_HOST;
  private readonly dataLayerName = this.options.dataLayerName ?? DEFAULT_DATA_LAYER_NAME;
  private readonly defaultQueryParams = this.options.defaultQueryParams;
  private readonly scriptAttributes = this.options.scriptAttributes;
  private readonly insertedScripts = new Set<HTMLScriptElement>();
  private readonly readyCallbacks = new Set<(state: ScriptLoadState[]) => void>();
  private readiness = createDeferred<ScriptLoadState[]>();
  private readonly loadStates = new Map<string, ScriptLoadState>();
  private readonly pendingContainers = new Set<string>();

  // Retry configuration
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly retryMaxDelay: number;
  private readonly scriptTimeout: number;
  private readonly onScriptError?: (state: ScriptLoadState) => void;
  private readonly onScriptTimeout?: (containerId: string) => void;

  // Initialization verification
  private readonly verifyInitialization: boolean;
  private readonly initializationTimeout: number;
  private readonly onPartialLoad?: (state: ScriptLoadState) => void;

  // Retry tracking
  private readonly retryCounters = new Map<string, number>();
  private readonly activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly verificationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // Page unload handling
  private unloadHandler: (() => void) | null = null;
  private isUnloading = false;

  constructor(private readonly options: ScriptManagerOptions) {
    // Initialize retry configuration
    this.retryAttempts = options.retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryDelay = options.retry?.delay ?? DEFAULT_RETRY_DELAY;
    this.retryMaxDelay = options.retry?.maxDelay ?? DEFAULT_RETRY_MAX_DELAY;
    this.scriptTimeout = options.scriptTimeout ?? DEFAULT_SCRIPT_TIMEOUT;
    this.onScriptError = options.onScriptError;
    this.onScriptTimeout = options.onScriptTimeout;

    // Initialize verification configuration
    this.verifyInitialization = options.verifyInitialization ?? false;
    this.initializationTimeout = options.initializationTimeout ?? DEFAULT_INITIALIZATION_TIMEOUT;
    this.onPartialLoad = options.onPartialLoad;
  }

  whenReady(): Promise<ScriptLoadState[]> {
    return this.readiness.promise;
  }

  isReady(): boolean {
    return this.readiness.settled;
  }

  getScriptStates(): ScriptLoadState[] {
    return Array.from(this.loadStates.values());
  }

  onReady(callback: (state: ScriptLoadState[]) => void): () => void {
    this.readyCallbacks.add(callback);

    if (this.readiness.settled) {
      callback(Array.from(this.loadStates.values()));
    }

    return () => {
      this.readyCallbacks.delete(callback);
    };
  }

  private notifyReady(): void {
    const snapshot = Array.from(this.loadStates.values());

    if (!this.readiness.settled) {
      this.readiness.resolve(snapshot);
    }

    for (const callback of this.readyCallbacks) {
      callback(snapshot);
    }
  }

  private maybeNotifyReady(): void {
    if (this.pendingContainers.size === 0) {
      this.notifyReady();
    }
  }

  private recordState(state: ScriptLoadState): void {
    this.loadStates.set(state.containerId, state);
  }

  private resetReadiness(): void {
    this.pendingContainers.clear();
    this.loadStates.clear();
    this.readiness = createDeferred<ScriptLoadState[]>();
  }

  /**
   * Calculate delay for retry attempt using exponential backoff.
   * delay = min(initialDelay * 2^attempt, maxDelay)
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryDelay * Math.pow(2, attempt);
    return Math.min(delay, this.retryMaxDelay);
  }

  /**
   * Get current retry count for a container.
   */
  private getRetryCount(containerId: string): number {
    return this.retryCounters.get(containerId) ?? 0;
  }

  /**
   * Check if retry is available for a container.
   */
  private canRetry(containerId: string): boolean {
    return this.getRetryCount(containerId) < this.retryAttempts;
  }

  /**
   * Clear timeout for a container.
   */
  private clearContainerTimeout(containerId: string): void {
    const timeout = this.activeTimeouts.get(containerId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(containerId);
    }
  }

  /**
   * Schedule a retry for a failed container.
   */
  private scheduleRetry(container: NormalizedContainer, targetParent: HTMLElement): void {
    const containerId = container.id;
    const currentAttempt = this.getRetryCount(containerId);
    const delay = this.calculateRetryDelay(currentAttempt);

    this.logger.info('Scheduling retry for GTM container.', {
      containerId,
      attempt: currentAttempt + 1,
      maxAttempts: this.retryAttempts,
      delay
    });

    this.retryCounters.set(containerId, currentAttempt + 1);

    const timerId = setTimeout(() => {
      this.activeTimeouts.delete(containerId);
      this.loadScript(container, targetParent);
    }, delay);
    this.activeTimeouts.set(containerId, timerId);
  }

  /**
   * Handle final failure after all retries exhausted.
   */
  private handleFinalFailure(containerId: string, url: string, error: string, isTimeout: boolean): void {
    const state: ScriptLoadState = {
      containerId,
      src: url,
      status: 'failed',
      error: isTimeout ? `Script load timeout (${this.scriptTimeout}ms)` : error,
      fromCache: false
    };

    this.recordState(state);
    this.pendingContainers.delete(containerId);

    // Call error callback
    if (this.onScriptError) {
      try {
        this.onScriptError(state);
      } catch (callbackError) {
        this.logger.error('Error in onScriptError callback.', { error: callbackError });
      }
    }

    this.maybeNotifyReady();
  }

  /**
   * Load a single container script with retry and timeout support.
   * Returns the created script element.
   */
  private loadScript(container: NormalizedContainer, targetParent: HTMLElement): HTMLScriptElement {
    const containerId = container.id;
    const params = {
      ...this.defaultQueryParams,
      ...container.queryParams
    };

    const script = document.createElement('script');
    const url = buildGtmScriptUrl(this.host, containerId, params, this.dataLayerName);
    script.src = url;
    script.setAttribute(CONTAINER_ATTR, containerId);
    script.setAttribute(INSTANCE_ATTR, this.options.instanceId);

    const attributes = this.scriptAttributes ?? {};
    if (attributes.async !== undefined) {
      script.async = attributes.async;
    } else {
      script.async = true;
    }
    if (attributes.defer !== undefined) {
      script.defer = attributes.defer;
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'async' || key === 'defer') {
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      const stringValue = String(value);

      if (key === 'nonce') {
        script.nonce = stringValue;
        continue;
      }

      // Block src (already set) and event handler attributes to prevent XSS
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'src' || lowerKey.startsWith('on')) {
        continue;
      }

      script.setAttribute(key, stringValue);
    }

    let settled = false;
    const loadStartTime = performance.now();

    const settle = (status: ScriptLoadStatus, event?: Event): void => {
      if (settled) {
        return;
      }
      settled = true;

      // Calculate load time
      const loadTimeMs = Math.round(performance.now() - loadStartTime);

      // Clear the timeout
      this.clearContainerTimeout(containerId);

      if (status === 'loaded') {
        // Script loaded - check if we need to verify GTM initialization
        if (this.verifyInitialization) {
          this.startInitializationVerification(containerId, url, loadTimeMs);
        } else {
          // No verification, mark as success immediately
          const state: ScriptLoadState = {
            containerId,
            src: url,
            status: 'loaded',
            fromCache: false,
            loadTimeMs
          };
          this.recordState(state);
          this.pendingContainers.delete(containerId);
          this.logger.info('GTM container script loaded successfully.', { containerId, src: url, loadTimeMs });
          this.maybeNotifyReady();
        }
        return;
      }

      // Failure - check if we can retry
      const errorMessage = event ? formatErrorMessage(event) : 'Script load failed';
      const canRetry = this.canRetry(containerId);

      if (canRetry) {
        this.logger.warn('GTM script load failed, will retry.', {
          containerId,
          src: url,
          error: errorMessage,
          retriesRemaining: this.retryAttempts - this.getRetryCount(containerId)
        });
        // Remove the failed script
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        this.insertedScripts.delete(script);
        this.scheduleRetry(container, targetParent);
      } else {
        this.logger.error('GTM script load failed, no retries remaining.', {
          containerId,
          src: url,
          error: errorMessage
        });
        this.handleFinalFailure(containerId, url, errorMessage, false);
      }
    };

    script.addEventListener('load', () => settle('loaded'));
    script.addEventListener('error', (event) => settle('failed', event));

    // Set up timeout if configured
    if (this.scriptTimeout > 0) {
      const timeoutId = setTimeout(() => {
        if (!settled) {
          this.logger.warn('GTM script load timeout.', {
            containerId,
            src: url,
            timeout: this.scriptTimeout
          });

          // Call timeout callback
          if (this.onScriptTimeout) {
            try {
              this.onScriptTimeout(containerId);
            } catch (callbackError) {
              this.logger.error('Error in onScriptTimeout callback.', { error: callbackError });
            }
          }

          // Treat timeout as failure for retry logic
          const canRetry = this.canRetry(containerId);
          if (canRetry) {
            settled = true;
            // Remove the timed-out script
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
            this.insertedScripts.delete(script);
            this.scheduleRetry(container, targetParent);
          } else {
            settled = true;
            this.clearContainerTimeout(containerId);
            this.handleFinalFailure(containerId, url, `Script load timeout (${this.scriptTimeout}ms)`, true);
          }
        }
      }, this.scriptTimeout);

      this.activeTimeouts.set(containerId, timeoutId);
    }

    targetParent.appendChild(script);
    this.insertedScripts.add(script);
    this.logger.debug('Injecting GTM container script.', { containerId, src: url });

    return script;
  }

  ensure(containers: NormalizedContainer[]): EnsureResult {
    if (typeof document === 'undefined') {
      this.logger.warn('No document available – skipping script injection.');

      for (const container of containers) {
        if (!container.id) {
          continue;
        }

        this.recordState({
          containerId: container.id,
          status: 'skipped',
          error: 'Document unavailable for script injection.'
        });
      }

      this.maybeNotifyReady();
      return { inserted: [] };
    }

    const inserted: HTMLScriptElement[] = [];
    const targetParent = document.head || document.body;
    if (!targetParent) {
      this.logger.error('Unable to find document.head or document.body for script injection.');

      for (const container of containers) {
        if (!container.id) {
          continue;
        }

        this.recordState({
          containerId: container.id,
          status: 'skipped',
          error: 'Missing document.head and document.body for GTM script injection.'
        });
      }

      this.maybeNotifyReady();
      return { inserted: [] };
    }

    // Set up page unload handler to gracefully handle navigation during script load
    this.setupUnloadHandler();

    for (const container of containers) {
      if (!container.id || !container.id.trim()) {
        this.logger.warn('Skipping container with empty or invalid id.', { container });
        continue;
      }

      const existing = findExistingScript(container.id);
      if (existing) {
        this.logger.debug('Container script already present, skipping injection.', {
          containerId: container.id
        });

        this.recordState({
          containerId: container.id,
          src: existing.src,
          status: 'loaded',
          fromCache: true
        });
        continue;
      }

      // Initialize retry counter for this container
      this.retryCounters.set(container.id, 0);
      this.pendingContainers.add(container.id);

      // Load script with retry and timeout support
      const script = this.loadScript(container, targetParent);
      inserted.push(script);
    }

    this.maybeNotifyReady();
    return { inserted };
  }

  /**
   * Set up handler for page unload to gracefully resolve pending scripts.
   * Uses 'pagehide' event which is more reliable than 'beforeunload' for cleanup.
   */
  private setupUnloadHandler(): void {
    if (typeof window === 'undefined' || this.unloadHandler) {
      return;
    }

    this.unloadHandler = () => {
      this.handlePageUnload();
    };

    // Use 'pagehide' as it's more reliable for cleanup (fires even on bfcache navigation)
    window.addEventListener('pagehide', this.unloadHandler);
  }

  /**
   * Handle page unload by marking pending scripts as skipped and resolving promises.
   * This prevents hanging promises and ensures clean state during navigation.
   */
  private handlePageUnload(): void {
    if (this.isUnloading) {
      return;
    }

    this.isUnloading = true;

    // Mark all pending containers as skipped
    for (const containerId of this.pendingContainers) {
      this.recordState({
        containerId,
        status: 'skipped',
        error: 'Page navigation interrupted script load.'
      });
    }

    // Clear all pending containers
    this.pendingContainers.clear();

    // Clear all timeouts to prevent callbacks from firing after unload
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();

    for (const timeout of this.verificationTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.verificationTimeouts.clear();

    // Resolve the readiness promise immediately to prevent hanging
    this.notifyReady();
  }

  /**
   * Remove page unload handler.
   */
  private removeUnloadHandler(): void {
    if (typeof window === 'undefined' || !this.unloadHandler) {
      return;
    }

    window.removeEventListener('pagehide', this.unloadHandler);
    this.unloadHandler = null;
  }

  /**
   * Start initialization verification after script loads.
   * Checks for GTM initialization by looking for google_tag_manager global.
   */
  private startInitializationVerification(containerId: string, url: string, loadTimeMs?: number): void {
    const startTime = Date.now();
    const pollInterval = 100; // Check every 100ms

    const checkInitialization = (): boolean => {
      // Check for google_tag_manager global with this container
      const gtm = getGoogleTagManager();
      return gtm !== undefined && typeof gtm[containerId] !== 'undefined';
    };

    const poll = (): void => {
      if (checkInitialization()) {
        // GTM initialized successfully
        this.clearVerificationTimeout(containerId);
        const state: ScriptLoadState = {
          containerId,
          src: url,
          status: 'loaded',
          fromCache: false,
          loadTimeMs
        };
        this.recordState(state);
        this.pendingContainers.delete(containerId);
        this.logger.info('GTM container initialized successfully.', { containerId, src: url, loadTimeMs });
        this.maybeNotifyReady();
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= this.initializationTimeout) {
        // Timeout - mark as partial load failure
        this.clearVerificationTimeout(containerId);
        const state: ScriptLoadState = {
          containerId,
          src: url,
          status: 'partial',
          fromCache: false,
          error: `GTM failed to initialize within ${this.initializationTimeout}ms`,
          loadTimeMs
        };
        this.recordState(state);
        this.pendingContainers.delete(containerId);
        this.logger.warn('GTM container loaded but failed to initialize.', {
          containerId,
          src: url,
          timeout: this.initializationTimeout,
          loadTimeMs
        });

        // Call partial load callback
        if (this.onPartialLoad) {
          try {
            this.onPartialLoad(state);
          } catch (callbackError) {
            this.logger.error('Error in onPartialLoad callback.', { error: callbackError });
          }
        }

        this.maybeNotifyReady();
        return;
      }

      // Schedule next poll
      const timeoutId = setTimeout(poll, pollInterval);
      this.verificationTimeouts.set(containerId, timeoutId);
    };

    // Start polling
    poll();
  }

  /**
   * Clear verification timeout for a container.
   */
  private clearVerificationTimeout(containerId: string): void {
    const timeout = this.verificationTimeouts.get(containerId);
    if (timeout) {
      clearTimeout(timeout);
      this.verificationTimeouts.delete(containerId);
    }
  }

  teardown() {
    if (typeof document === 'undefined') {
      return;
    }

    // Remove page unload handler
    this.removeUnloadHandler();
    this.isUnloading = false;

    // Clear any active timeouts
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();

    // Clear verification timeouts
    for (const timeout of this.verificationTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.verificationTimeouts.clear();

    // Clear retry counters
    this.retryCounters.clear();

    for (const script of this.insertedScripts) {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    this.insertedScripts.clear();
    this.resetReadiness();
  }
}
