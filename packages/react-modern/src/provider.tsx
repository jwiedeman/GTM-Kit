import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
  type JSX
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
 * Check if code is running in a server-side rendering environment.
 * Returns true if window is undefined (Node.js/SSR), false in browser.
 */
export const isSsr = (): boolean => typeof window === 'undefined';

/**
 * Hook that returns false during SSR and initial hydration, then true after hydration completes.
 * Use this to prevent hydration mismatches when rendering GTM-dependent content.
 *
 * @example
 * ```tsx
 * const isHydrated = useHydrated();
 *
 * // Safe: won't cause hydration mismatch
 * return isHydrated ? <DynamicContent /> : <StaticPlaceholder />;
 * ```
 */
export const useHydrated = (): boolean => {
  // useSyncExternalStore with getServerSnapshot ensures consistent SSR/hydration
  return useSyncExternalStore(
    // Subscribe function (no-op, state never changes after hydration)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => () => {},
    // getSnapshot (client): always true after first render
    () => true,
    // getServerSnapshot (server): always false
    () => false
  );
};

export interface GtmProviderProps extends PropsWithChildren {
  config: CreateGtmClientOptions;

  /**
   * Callback executed before GTM initialization.
   * Use this to set consent defaults.
   *
   * @example
   * ```tsx
   * <GtmProvider
   *   config={{ containers: 'GTM-XXXXXX' }}
   *   onBeforeInit={(client) => {
   *     client.setConsentDefaults({
   *       ad_storage: 'denied',
   *       analytics_storage: 'denied'
   *     });
   *   }}
   * >
   * ```
   */
  onBeforeInit?: (client: GtmClient) => void;

  /**
   * Callback executed after GTM initialization.
   */
  onAfterInit?: (client: GtmClient) => void;
}

export interface GtmContextValue {
  client: GtmClient;
  push: (value: DataLayerValue) => void;
  setConsentDefaults: (state: ConsentState, options?: ConsentRegionOptions) => void;
  updateConsent: (state: ConsentState, options?: ConsentRegionOptions) => void;
  /** Synchronously check if all GTM scripts have finished loading */
  isReady: () => boolean;
  whenReady: () => Promise<ScriptLoadState[]>;
  onReady: (callback: (state: ScriptLoadState[]) => void) => () => void;
}

export interface GtmConsentApi {
  setConsentDefaults: (state: ConsentState, options?: ConsentRegionOptions) => void;
  updateConsent: (state: ConsentState, options?: ConsentRegionOptions) => void;
}

const GtmContext = createContext<GtmContextValue | null>(null);

const warnOnNestedProvider = (): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[gtm-kit/react] Nested GtmProvider detected. You should only have one GtmProvider at the root of your app. ' +
        'The nested provider will be ignored.'
    );
  }
};

const warnOnConfigChange = (initialConfig: CreateGtmClientOptions, nextConfig: CreateGtmClientOptions): void => {
  if (process.env.NODE_ENV !== 'production' && initialConfig !== nextConfig) {
    console.warn(
      '[gtm-kit/react] GtmProvider received new configuration; reconfiguration after mount is not supported. ' +
        'The initial configuration will continue to be used.'
    );
  }
};

/**
 * Extracts container IDs from the provider config.
 */
const extractContainerIds = (config: CreateGtmClientOptions): string[] => {
  const containers = config.containers;
  const containerArray = Array.isArray(containers) ? containers : [containers];

  return containerArray.map((container) => {
    if (typeof container === 'string') {
      return container;
    }
    return container.id;
  });
};

/**
 * Warns in development if there are orphaned SSR-rendered GTM scripts without a matching client.
 * This helps developers identify hydration mismatches where GTM was rendered on the server
 * but the GtmProvider config doesn't match or is missing.
 */
const warnOnOrphanedSsrScripts = (configuredContainers: string[]): void => {
  if (process.env.NODE_ENV !== 'production' && typeof document !== 'undefined') {
    // Find all GTM scripts on the page
    const gtmScripts = document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');

    gtmScripts.forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      const idMatch = src.match(/[?&]id=([^&]+)/);
      const scriptContainerId = idMatch?.[1];

      if (scriptContainerId && !configuredContainers.includes(scriptContainerId)) {
        console.warn(
          `[gtm-kit/react] Found pre-rendered GTM script for container "${scriptContainerId}" that is not configured in GtmProvider. ` +
            'This may indicate a hydration mismatch between SSR and client-side rendering. ' +
            `Configure GtmProvider with containers: "${scriptContainerId}" to properly hydrate.`
        );
      }
    });

    // Also check for noscript iframes
    const gtmNoscripts = document.querySelectorAll('noscript iframe[src*="googletagmanager.com/ns.html"]');
    gtmNoscripts.forEach((iframe) => {
      const src = (iframe as HTMLIFrameElement).src;
      const idMatch = src.match(/[?&]id=([^&]+)/);
      const iframeContainerId = idMatch?.[1];

      if (iframeContainerId && !configuredContainers.includes(iframeContainerId)) {
        console.warn(
          `[gtm-kit/react] Found pre-rendered GTM noscript iframe for container "${iframeContainerId}" that is not configured in GtmProvider. ` +
            'If you pre-render noscript fallbacks on the server, ensure your GtmProvider has the same container ID.'
        );
      }
    });
  }
};

const useStableClient = (config: CreateGtmClientOptions): GtmClient => {
  const clientRef = useRef<GtmClient>();
  const configRef = useRef<CreateGtmClientOptions>();

  if (!clientRef.current) {
    clientRef.current = createGtmClient(config);
    configRef.current = config;
  } else if (configRef.current) {
    warnOnConfigChange(configRef.current, config);
  }

  return clientRef.current!;
};

/**
 * GTM Provider component that initializes Google Tag Manager for your React app.
 *
 * ## SSR/Hydration Behavior
 *
 * This provider is SSR-safe and handles hydration correctly:
 * - **Server**: No GTM initialization occurs (no window/document access)
 * - **Client Hydration**: GTM initializes only after hydration via useEffect
 * - **No Hydration Mismatch**: Provider renders the same on server and client
 *
 * ## Usage with SSR Frameworks
 *
 * ```tsx
 * // Next.js, Remix, etc.
 * export default function App({ children }) {
 *   return (
 *     <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
 *       {children}
 *     </GtmProvider>
 *   );
 * }
 * ```
 *
 * ## Preventing Hydration Mismatches
 *
 * If you render different content based on GTM state, use `useHydrated`:
 *
 * ```tsx
 * const isHydrated = useHydrated();
 * const isGtmReady = useGtmInitialized();
 *
 * // Safe: both server and client initially render the placeholder
 * if (!isHydrated) return <Placeholder />;
 * return isGtmReady ? <TrackedContent /> : <LoadingContent />;
 * ```
 */
export const GtmProvider = ({ config, children, onBeforeInit, onAfterInit }: GtmProviderProps): JSX.Element => {
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
};

const GtmProviderInner = ({ config, children, onBeforeInit, onAfterInit }: GtmProviderProps): JSX.Element => {
  const client = useStableClient(config);

  useEffect(() => {
    // Check for orphaned SSR scripts before initializing
    warnOnOrphanedSsrScripts(extractContainerIds(config));

    // Call onBeforeInit hook for consent defaults
    if (onBeforeInit) {
      onBeforeInit(client);
    }

    client.init();

    // Call onAfterInit hook
    if (onAfterInit) {
      onAfterInit(client);
    }

    return () => {
      client.teardown();
    };
  }, [client, config, onBeforeInit, onAfterInit]);

  const value = useMemo<GtmContextValue>(
    () => ({
      client,
      push: (value) => client.push(value),
      setConsentDefaults: (state, options) => client.setConsentDefaults(state, options),
      updateConsent: (state, options) => client.updateConsent(state, options),
      isReady: () => client.isReady(),
      whenReady: () => client.whenReady(),
      onReady: (callback) => client.onReady(callback)
    }),
    [client]
  );

  return <GtmContext.Provider value={value}>{children}</GtmContext.Provider>;
};

const useGtmContext = (): GtmContextValue => {
  const context = useContext(GtmContext);
  if (!context) {
    throw new Error(
      '[gtm-kit/react] useGtm() was called outside of a GtmProvider. ' +
        'Make sure to wrap your app with <GtmProvider config={{ containers: "GTM-XXXXXX" }}>.'
    );
  }
  return context;
};

/**
 * Hook to access the full GTM context. Throws if used outside GtmProvider.
 *
 * For most use cases, prefer the specific hooks:
 * - `useGtmPush()` - Push events to dataLayer
 * - `useGtmConsent()` - Manage consent state
 * - `useGtmClient()` - Access the raw GTM client
 *
 * @throws Error if called outside of GtmProvider
 *
 * @example
 * ```tsx
 * const { push, client, isReady, whenReady } = useGtm();
 * ```
 */
export const useGtm = useGtmContext;

/**
 * Hook to check if GtmProvider is present without throwing.
 *
 * Useful for components that may be rendered before the provider mounts,
 * or for optional GTM integration.
 *
 * @returns `true` if inside GtmProvider, `false` otherwise
 *
 * @example
 * ```tsx
 * const hasProvider = useIsGtmProviderPresent();
 *
 * const handleClick = () => {
 *   if (hasProvider) {
 *     // Safe to use GTM hooks
 *   }
 * };
 * ```
 */
export const useIsGtmProviderPresent = (): boolean => {
  const context = useContext(GtmContext);
  return context !== null;
};

/**
 * Hook to access the raw GTM client instance.
 *
 * @throws Error if called outside of GtmProvider
 * @returns The GTM client instance
 *
 * @example
 * ```tsx
 * const client = useGtmClient();
 *
 * // Access low-level APIs
 * const diagnostics = client.getDiagnostics();
 * ```
 */
export const useGtmClient = (): GtmClient => {
  return useGtmContext().client;
};

/**
 * Hook to get the push function for sending events to the dataLayer.
 *
 * This is the most commonly used hook for tracking events.
 *
 * @throws Error if called outside of GtmProvider
 * @returns Function to push values to the dataLayer
 *
 * @example
 * ```tsx
 * const push = useGtmPush();
 *
 * const handleAddToCart = (product) => {
 *   push({
 *     event: 'add_to_cart',
 *     ecommerce: {
 *       items: [{ item_id: product.id, item_name: product.name }]
 *     }
 *   });
 * };
 * ```
 */
export const useGtmPush = (): ((value: DataLayerValue) => void) => {
  return useGtmContext().push;
};

/**
 * Hook to access consent management functions.
 *
 * @throws Error if called outside of GtmProvider
 * @returns Object with `setConsentDefaults` and `updateConsent` functions
 *
 * @example
 * ```tsx
 * const { updateConsent } = useGtmConsent();
 *
 * const handleAcceptCookies = () => {
 *   updateConsent({
 *     ad_storage: 'granted',
 *     analytics_storage: 'granted'
 *   });
 * };
 * ```
 */
export const useGtmConsent = (): GtmConsentApi => {
  const { setConsentDefaults, updateConsent } = useGtmContext();
  return useMemo(() => ({ setConsentDefaults, updateConsent }), [setConsentDefaults, updateConsent]);
};

/**
 * Hook that returns the `whenReady` promise function.
 *
 * **When to use**: When you need to await GTM script loading before taking an action.
 * The returned function returns a Promise that resolves when scripts finish loading.
 *
 * **Comparison of GTM readiness hooks:**
 * | Hook | Returns | Re-renders | Use Case |
 * |------|---------|------------|----------|
 * | `useGtmReady()` | `() => Promise` | No | Await in event handlers |
 * | `useIsGtmReady()` | `() => boolean` | No | Synchronous checks in callbacks |
 * | `useGtmInitialized()` | `boolean` | Yes | Conditional rendering |
 *
 * @returns Function that returns a Promise resolving to script load states
 *
 * @example
 * ```tsx
 * const whenReady = useGtmReady();
 *
 * const handleClick = async () => {
 *   const states = await whenReady();
 *   if (states.every(s => s.status === 'loaded')) {
 *     // Safe to rely on GTM being fully loaded
 *   }
 * };
 * ```
 */
export const useGtmReady = (): (() => Promise<ScriptLoadState[]>) => {
  const { whenReady } = useGtmContext();
  return whenReady;
};

/**
 * Hook that returns a function to synchronously check if GTM is ready.
 *
 * **When to use**: When you need to check readiness without triggering re-renders,
 * typically in event handlers or callbacks.
 *
 * **Comparison of GTM readiness hooks:**
 * | Hook | Returns | Re-renders | Use Case |
 * |------|---------|------------|----------|
 * | `useGtmReady()` | `() => Promise` | No | Await in event handlers |
 * | `useIsGtmReady()` | `() => boolean` | No | Synchronous checks in callbacks |
 * | `useGtmInitialized()` | `boolean` | Yes | Conditional rendering |
 *
 * @returns Function that returns `true` if scripts loaded, `false` if still loading
 *
 * @example
 * ```tsx
 * const checkReady = useIsGtmReady();
 *
 * const handleSubmit = () => {
 *   if (checkReady()) {
 *     // GTM is ready, proceed with tracking
 *     push({ event: 'form_submit' });
 *   }
 * };
 * ```
 */
export const useIsGtmReady = (): (() => boolean) => {
  const { isReady } = useGtmContext();
  return isReady;
};

/**
 * Reactive hook that returns `true` when GTM scripts have finished loading.
 *
 * **When to use**: When you need to conditionally render UI based on GTM readiness.
 * This hook triggers a re-render when the state changes.
 *
 * **Comparison of GTM readiness hooks:**
 * | Hook | Returns | Re-renders | Use Case |
 * |------|---------|------------|----------|
 * | `useGtmReady()` | `() => Promise` | No | Await in event handlers |
 * | `useIsGtmReady()` | `() => boolean` | No | Synchronous checks in callbacks |
 * | `useGtmInitialized()` | `boolean` | Yes | Conditional rendering |
 *
 * @returns `true` if GTM is initialized, `false` otherwise (reactive)
 *
 * @example
 * ```tsx
 * const isInitialized = useGtmInitialized();
 *
 * if (!isInitialized) {
 *   return <LoadingSpinner />;
 * }
 *
 * return <AnalyticsDashboard />;
 * ```
 */
export const useGtmInitialized = (): boolean => {
  const { isReady, onReady } = useGtmContext();
  const [initialized, setInitialized] = useState(() => isReady());

  useEffect(() => {
    // Already initialized on mount
    if (isReady()) {
      setInitialized(true);
      return;
    }

    // Subscribe to ready event
    const unsubscribe = onReady(() => {
      setInitialized(true);
    });

    return unsubscribe;
  }, [isReady, onReady]);

  return initialized;
};

/**
 * Result from the useGtmError hook.
 */
export interface GtmErrorState {
  /** Whether any scripts failed to load */
  hasError: boolean;
  /** Array of failed script states (status 'failed' or 'partial') */
  failedScripts: ScriptLoadState[];
  /** Convenience getter for the first error message, if any */
  errorMessage: string | null;
}

/**
 * Hook to capture GTM script load errors.
 * Returns reactive state that updates when scripts fail to load.
 *
 * @example
 * ```tsx
 * const { hasError, failedScripts, errorMessage } = useGtmError();
 *
 * if (hasError) {
 *   console.error('GTM failed to load:', errorMessage);
 *   // Optionally show fallback UI or retry logic
 * }
 * ```
 */
export const useGtmError = (): GtmErrorState => {
  const { onReady } = useGtmContext();
  const [errorState, setErrorState] = useState<GtmErrorState>({
    hasError: false,
    failedScripts: [],
    errorMessage: null
  });

  useEffect(() => {
    const unsubscribe = onReady((states) => {
      const failedScripts = states.filter((s) => s.status === 'failed' || s.status === 'partial');

      if (failedScripts.length > 0) {
        const firstError = failedScripts.find((s) => s.error)?.error ?? null;
        setErrorState({
          hasError: true,
          failedScripts,
          errorMessage: firstError
        });
      }
    });

    return unsubscribe;
  }, [onReady]);

  return errorState;
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
 * Error boundary component for GTM provider.
 * Catches errors during GTM initialization and renders a fallback UI.
 * Analytics and tracking will be disabled when an error occurs.
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
      console.error('[gtm-kit/react] Error caught by GtmErrorBoundary:', error);
      console.error('[gtm-kit/react] Component stack:', errorInfo.componentStack);
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
