import React, {
  Component,
  createContext,
  useContext,
  useEffect,
  useRef,
  useMemo,
  type ErrorInfo,
  type ReactNode
} from 'react';
import {
  createGtmClient,
  type ConsentRegionOptions,
  type ConsentState,
  type CreateGtmClientOptions,
  type DataLayerValue,
  type GtmClient,
  type ScriptLoadState
} from '@jwiedeman/gtm-kit';

/**
 * Props for the GTM Provider component.
 */
export interface GtmProviderProps {
  /** GTM client configuration */
  config: CreateGtmClientOptions;

  /** Child components */
  children: ReactNode;

  /**
   * Callback executed before GTM initialization.
   * Use this to set consent defaults.
   */
  onBeforeInit?: (client: GtmClient) => void;

  /**
   * Callback executed after GTM initialization.
   */
  onAfterInit?: (client: GtmClient) => void;
}

/**
 * The GTM context value containing all GTM functionality.
 */
export interface GtmContextValue {
  /** The underlying GTM client instance */
  client: GtmClient;
  /** Push a value to the data layer */
  push: (value: DataLayerValue) => void;
  /** Set consent defaults (must be called before init) */
  setConsentDefaults: (state: ConsentState, options?: ConsentRegionOptions) => void;
  /** Update consent state */
  updateConsent: (state: ConsentState, options?: ConsentRegionOptions) => void;
  /** Synchronously check if all GTM scripts have finished loading */
  isReady: () => boolean;
  /** Returns a promise that resolves when all GTM scripts are loaded */
  whenReady: () => Promise<ScriptLoadState[]>;
}

/**
 * Consent-specific API subset.
 */
export interface GtmConsentApi {
  setConsentDefaults: (state: ConsentState, options?: ConsentRegionOptions) => void;
  updateConsent: (state: ConsentState, options?: ConsentRegionOptions) => void;
}

/**
 * The GTM context for Remix.
 */
export const GtmContext = createContext<GtmContextValue | null>(null);

const warnOnNestedProvider = (): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[gtm-kit/remix] Nested GtmProvider detected. You should only have one GtmProvider at the root of your app. ' +
        'The nested provider will be ignored.'
    );
  }
};

/**
 * GTM Provider component for Remix.
 * Handles StrictMode correctly and provides GTM context to children.
 *
 * @example
 * ```tsx
 * // app/root.tsx
 * import { GtmProvider } from '@jwiedeman/gtm-kit-remix';
 *
 * export default function App() {
 *   return (
 *     <html>
 *       <head />
 *       <body>
 *         <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
 *           <Outlet />
 *         </GtmProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function GtmProvider({ config, children, onBeforeInit, onAfterInit }: GtmProviderProps): React.ReactElement {
  // Check for nested provider
  const existingContext = useContext(GtmContext);

  // Warn if we're inside another GtmProvider (nested providers)
  useEffect(() => {
    if (existingContext) {
      warnOnNestedProvider();
    }
  }, [existingContext]);

  // If nested, just pass through children without creating a new context
  if (existingContext) {
    return <>{children}</>;
  }

  return (
    <GtmProviderInner config={config} onBeforeInit={onBeforeInit} onAfterInit={onAfterInit}>
      {children}
    </GtmProviderInner>
  );
}

function GtmProviderInner({ config, children, onBeforeInit, onAfterInit }: GtmProviderProps): React.ReactElement {
  // Create client once and store in ref to survive StrictMode remounts
  const clientRef = useRef<GtmClient | null>(null);
  const initializedRef = useRef(false);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create client on first render only
  if (!clientRef.current) {
    clientRef.current = createGtmClient(config);
  }

  const client = clientRef.current;

  // Initialize GTM (handles StrictMode correctly)
  useEffect(() => {
    // Clear any pending teardown from StrictMode unmount/remount cycle
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    // Skip if already initialized (StrictMode protection)
    if (initializedRef.current) {
      return;
    }

    // Call onBeforeInit hook for consent defaults
    if (onBeforeInit) {
      onBeforeInit(client);
    }

    // Initialize GTM
    client.init();
    initializedRef.current = true;

    // Call onAfterInit hook
    if (onAfterInit) {
      onAfterInit(client);
    }

    // Cleanup on unmount - defer to allow StrictMode remount
    return () => {
      teardownTimerRef.current = setTimeout(() => {
        teardownTimerRef.current = null;
        // Only teardown if we're truly unmounting (no provider in DOM)
        if (!document.querySelector('[data-gtm-kit-provider]')) {
          client.teardown();
          clientRef.current = null;
          initializedRef.current = false;
        }
      }, 100);
    };
  }, [client, onBeforeInit, onAfterInit]);

  // Clear deferred teardown timer on final unmount to prevent leaked timers
  useEffect(() => {
    return () => {
      if (teardownTimerRef.current) {
        clearTimeout(teardownTimerRef.current);
        teardownTimerRef.current = null;
      }
    };
  }, []);

  // Memoize context value
  const contextValue = useMemo<GtmContextValue>(
    () => ({
      client,
      push: (value: DataLayerValue) => client.push(value),
      setConsentDefaults: (state: ConsentState, options?: ConsentRegionOptions) =>
        client.setConsentDefaults(state, options),
      updateConsent: (state: ConsentState, options?: ConsentRegionOptions) => client.updateConsent(state, options),
      isReady: () => client.isReady(),
      whenReady: () => client.whenReady()
    }),
    [client]
  );

  return (
    <GtmContext.Provider value={contextValue}>
      <div data-gtm-kit-provider="" style={{ display: 'contents' }}>
        {children}
      </div>
    </GtmContext.Provider>
  );
}

/**
 * Internal helper to get the GTM context with proper error handling.
 */
const useGtmContext = (): GtmContextValue => {
  const context = useContext(GtmContext);
  if (!context) {
    throw new Error(
      '[gtm-kit/remix] useGtm() was called outside of a GtmProvider. ' +
        'Make sure to wrap your app with <GtmProvider config={{ containers: "GTM-XXXXXX" }}>.'
    );
  }
  return context;
};

/**
 * Hook to access the full GTM context.
 *
 * @example
 * ```tsx
 * import { useGtm } from '@jwiedeman/gtm-kit-remix';
 *
 * function MyComponent() {
 *   const { push, client } = useGtm();
 *
 *   return (
 *     <button onClick={() => push({ event: 'click' })}>
 *       Track
 *     </button>
 *   );
 * }
 * ```
 */
export const useGtm = (): GtmContextValue => {
  return useGtmContext();
};

/**
 * Hook to get just the push function.
 *
 * @example
 * ```tsx
 * import { useGtmPush } from '@jwiedeman/gtm-kit-remix';
 *
 * function BuyButton() {
 *   const push = useGtmPush();
 *
 *   return (
 *     <button onClick={() => push({ event: 'purchase', value: 99 })}>
 *       Buy
 *     </button>
 *   );
 * }
 * ```
 */
export const useGtmPush = (): ((value: DataLayerValue) => void) => {
  return useGtmContext().push;
};

/**
 * Hook to access consent management functions.
 *
 * @example
 * ```tsx
 * import { useGtmConsent } from '@jwiedeman/gtm-kit-remix';
 *
 * function CookieBanner() {
 *   const { updateConsent } = useGtmConsent();
 *
 *   return (
 *     <button onClick={() => updateConsent({ analytics_storage: 'granted' })}>
 *       Accept
 *     </button>
 *   );
 * }
 * ```
 */
export const useGtmConsent = (): GtmConsentApi => {
  const { setConsentDefaults, updateConsent } = useGtmContext();
  return { setConsentDefaults, updateConsent };
};

/**
 * Hook to get the raw GTM client instance.
 *
 * @example
 * ```tsx
 * import { useGtmClient } from '@jwiedeman/gtm-kit-remix';
 *
 * function MyComponent() {
 *   const client = useGtmClient();
 *   return <div>{client.isInitialized() ? 'Ready' : 'Loading'}</div>;
 * }
 * ```
 */
export const useGtmClient = (): GtmClient => {
  return useGtmContext().client;
};

/**
 * Hook to get the whenReady function.
 *
 * @example
 * ```tsx
 * import { useGtmReady } from '@jwiedeman/gtm-kit-remix';
 * import { useEffect } from 'react';
 *
 * function MyComponent() {
 *   const whenReady = useGtmReady();
 *
 *   useEffect(() => {
 *     whenReady().then(() => console.log('GTM ready!'));
 *   }, [whenReady]);
 *
 *   return <div>Loading...</div>;
 * }
 * ```
 */
export const useGtmReady = (): (() => Promise<ScriptLoadState[]>) => {
  return useGtmContext().whenReady;
};

/**
 * Hook to check if GTM scripts have finished loading synchronously.
 *
 * @example
 * ```tsx
 * import { useIsGtmReady } from '@jwiedeman/gtm-kit-remix';
 *
 * function MyComponent() {
 *   const isReady = useIsGtmReady();
 *   return <div>{isReady() ? 'GTM Ready' : 'Loading...'}</div>;
 * }
 * ```
 */
export const useIsGtmReady = (): (() => boolean) => {
  return useGtmContext().isReady;
};

/**
 * Props for GtmErrorBoundary component.
 */
export interface GtmErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to log errors to console (default: true in development) */
  logErrors?: boolean;
}

interface GtmErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for GTM provider in Remix apps.
 * Catches errors during GTM initialization and renders a fallback UI.
 * Analytics and tracking will be disabled when an error occurs.
 *
 * @example
 * ```tsx
 * import { GtmProvider, GtmErrorBoundary } from '@jwiedeman/gtm-kit-remix';
 *
 * export default function App() {
 *   return (
 *     <GtmErrorBoundary fallback={<div>GTM failed to load</div>}>
 *       <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
 *         <Outlet />
 *       </GtmProvider>
 *     </GtmErrorBoundary>
 *   );
 * }
 * ```
 */
export class GtmErrorBoundary extends Component<GtmErrorBoundaryProps, GtmErrorBoundaryState> {
  constructor(props: GtmErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GtmErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, logErrors = process.env.NODE_ENV !== 'production' } = this.props;

    if (logErrors) {
      console.error('[gtm-kit/remix] Error caught by GtmErrorBoundary:', error);
      console.error('[gtm-kit/remix] Component stack:', errorInfo.componentStack);
    }

    if (onError) {
      try {
        onError(error, errorInfo);
      } catch {
        // Ignore callback errors
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback === undefined) {
        // Default: render children without GTM (silent fallback)
        return children;
      }

      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }

      return fallback;
    }

    return children;
  }
}
