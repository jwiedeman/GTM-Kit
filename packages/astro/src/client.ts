import {
  createGtmClient,
  type ConsentRegionOptions,
  type ConsentState,
  type CreateGtmClientOptions,
  type DataLayerValue,
  type GtmClient,
  type ScriptLoadState
} from '@jwiedeman/gtm-kit';

let clientInstance: GtmClient | null = null;
let clientConfig: CreateGtmClientOptions | null = null;

/**
 * Initialize the GTM client for use in Astro.
 * Should be called once when the page loads.
 *
 * @example
 * ```ts
 * // In a client-side script
 * import { initGtm } from '@jwiedeman/gtm-kit-astro';
 *
 * initGtm({ containers: 'GTM-XXXXXX' });
 * ```
 */
export const initGtm = (options: CreateGtmClientOptions): GtmClient => {
  // If already initialized, return existing instance
  // (common in Astro with view transitions where initGtm may be called multiple times)
  if (clientInstance) {
    if (
      process.env.NODE_ENV === 'development' &&
      clientConfig &&
      JSON.stringify(options) !== JSON.stringify(clientConfig)
    ) {
      console.warn(
        '[gtm-kit/astro] initGtm() called again with different options. ' +
          'The original configuration is kept. Call teardown() first if you need to reinitialize with new options.'
      );
    }
    return clientInstance;
  }

  clientInstance = createGtmClient(options);
  clientConfig = options;
  clientInstance.init();

  return clientInstance;
};

/**
 * Get the current GTM client instance.
 * Returns null if not initialized.
 *
 * @example
 * ```ts
 * import { getGtmClient } from '@jwiedeman/gtm-kit-astro';
 *
 * const client = getGtmClient();
 * if (client) {
 *   client.push({ event: 'page_view' });
 * }
 * ```
 */
export const getGtmClient = (): GtmClient | null => clientInstance;

/**
 * Get the GTM client or throw if not initialized.
 * Use this when you expect the client to be available.
 *
 * @throws Error if GTM client is not initialized
 */
export const requireGtmClient = (): GtmClient => {
  if (!clientInstance) {
    throw new Error(
      '[gtm-kit/astro] GTM client not initialized. Call initGtm() first or ensure the GTM script has loaded.'
    );
  }
  return clientInstance;
};

/**
 * Push a value to the GTM dataLayer.
 * This is a convenience function that handles the case where GTM isn't initialized.
 *
 * @returns true if the value was pushed successfully, false otherwise
 *
 * @example
 * ```ts
 * import { push } from '@jwiedeman/gtm-kit-astro';
 *
 * const success = push({ event: 'button_click', button_name: 'hero_cta' });
 * if (!success) {
 *   console.warn('GTM not ready');
 * }
 * ```
 */
/**
 * Type-safe access to window properties for dataLayer.
 */
const getWindowDataLayer = (name: string): DataLayerValue[] | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const win = window as typeof window & Record<string, unknown>;
  const layer = win[name];
  return Array.isArray(layer) ? (layer as DataLayerValue[]) : undefined;
};

export const push = (value: DataLayerValue): boolean => {
  const client = getGtmClient();
  if (client) {
    client.push(value);
    return true;
  } else if (typeof window !== 'undefined') {
    // Fallback: push directly to dataLayer if it exists
    const dataLayerName = clientConfig?.dataLayerName ?? 'dataLayer';
    const dataLayer = getWindowDataLayer(dataLayerName);
    if (dataLayer) {
      dataLayer.push(value);
      return true;
    } else {
      console.warn('[gtm-kit/astro] GTM not initialized and dataLayer not found.');
      return false;
    }
  }
  return false;
};

/**
 * Set consent defaults (must be called before GTM loads).
 *
 * @returns true if consent defaults were set, false if GTM not initialized
 *
 * @example
 * ```ts
 * import { setConsentDefaults } from '@jwiedeman/gtm-kit-astro';
 *
 * const success = setConsentDefaults({
 *   ad_storage: 'denied',
 *   analytics_storage: 'denied'
 * });
 * ```
 */
export const setConsentDefaults = (state: ConsentState, options?: ConsentRegionOptions): boolean => {
  const client = getGtmClient();
  if (client) {
    client.setConsentDefaults(state, options);
    return true;
  } else {
    console.warn('[gtm-kit/astro] GTM not initialized. Consent defaults should be set before init.');
    return false;
  }
};

/**
 * Update consent state after user interaction.
 *
 * @returns true if consent was updated, false if GTM not initialized
 *
 * @example
 * ```ts
 * import { updateConsent } from '@jwiedeman/gtm-kit-astro';
 *
 * // When user accepts cookies
 * const success = updateConsent({
 *   ad_storage: 'granted',
 *   analytics_storage: 'granted',
 *   ad_user_data: 'granted',
 *   ad_personalization: 'granted'
 * });
 * ```
 */
export const updateConsent = (state: ConsentState, options?: ConsentRegionOptions): boolean => {
  const client = getGtmClient();
  if (client) {
    client.updateConsent(state, options);
    return true;
  } else {
    console.warn('[gtm-kit/astro] GTM not initialized. Cannot update consent.');
    return false;
  }
};

/**
 * Wait for GTM scripts to be ready.
 *
 * @example
 * ```ts
 * import { whenReady } from '@jwiedeman/gtm-kit-astro';
 *
 * whenReady().then((states) => {
 *   console.log('GTM loaded:', states);
 * });
 * ```
 */
export const whenReady = (): Promise<ScriptLoadState[]> => {
  const client = getGtmClient();
  if (client) {
    return client.whenReady();
  }
  return Promise.reject(new Error('[gtm-kit/astro] GTM not initialized.'));
};

/**
 * Clean up the GTM client.
 * Call this when navigating away or cleaning up.
 */
export const teardown = (): void => {
  if (clientInstance) {
    clientInstance.teardown();
    clientInstance = null;
    clientConfig = null;
  }
};
