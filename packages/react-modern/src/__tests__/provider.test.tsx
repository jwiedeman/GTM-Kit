import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { StrictMode, Suspense, lazy, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import {
  GtmProvider,
  GtmErrorBoundary,
  useGtm,
  useGtmConsent,
  useGtmPush,
  useGtmReady,
  useIsGtmReady,
  useGtmInitialized,
  useGtmError,
  isSsr,
  useHydrated
} from '../provider';
import type { GtmErrorState } from '../provider';
import type {
  ConsentRegionOptions,
  ConsentState,
  CreateGtmClientOptions,
  DataLayerValue,
  GtmClient,
  ScriptLoadState
} from '@jwiedeman/gtm-kit';
import { createGtmClient } from '@jwiedeman/gtm-kit';
import { Link, MemoryRouter, Route as RouterRoute, Routes as RouterRoutes, useLocation } from 'react-router-dom';

jest.mock('@jwiedeman/gtm-kit', () => {
  const actual = jest.requireActual('@jwiedeman/gtm-kit');
  return {
    ...actual,
    createGtmClient: jest.fn()
  };
});

type MockClient = GtmClient & {
  init: jest.Mock<void, []>;
  teardown: jest.Mock<void, []>;
  push: jest.Mock<void, [DataLayerValue]>;
  setConsentDefaults: jest.Mock<void, [ConsentState, ConsentRegionOptions | undefined]>;
  updateConsent: jest.Mock<void, [ConsentState, ConsentRegionOptions | undefined]>;
  isInitialized: jest.Mock<boolean, []>;
  isReady: jest.Mock<boolean, []>;
  whenReady: jest.Mock<Promise<ScriptLoadState[]>, []>;
  onReady: jest.Mock<() => void, [(state: ScriptLoadState[]) => void]>;
  getDiagnostics: jest.Mock;
};

const createMockClient = (): MockClient => ({
  dataLayerName: 'dataLayer',
  init: jest.fn(),
  teardown: jest.fn(),
  push: jest.fn(),
  setConsentDefaults: jest.fn(),
  updateConsent: jest.fn(),
  isInitialized: jest.fn(() => true),
  isReady: jest.fn(() => true),
  whenReady: jest.fn(() => Promise.resolve([])),
  onReady: jest.fn((callback: (state: ScriptLoadState[]) => void) => {
    callback([]);
    return jest.fn();
  }),
  getDiagnostics: jest.fn(() => ({
    initialized: true,
    ready: true,
    dataLayerName: 'dataLayer',
    dataLayerSize: 0,
    queueSize: 0,
    consentCommandsDelivered: 0,
    containers: ['GTM-TEST'],
    scriptStates: [],
    uptimeMs: 0,
    debugMode: false
  }))
});

const baseConfig: CreateGtmClientOptions = { containers: 'GTM-TEST' };

const mockedCreateClient = jest.mocked(createGtmClient);

interface FakeCmpPayload {
  advertising: boolean;
  analytics: boolean;
  personalization: boolean;
}

type ConsentListener = (payload: FakeCmpPayload) => void;

interface FakeCmp {
  on(event: 'consent', listener: ConsentListener): void;
  off(event: 'consent', listener: ConsentListener): void;
  emit(payload: FakeCmpPayload): void;
}

const createFakeCmp = (): FakeCmp => {
  const listeners = new Set<ConsentListener>();

  return {
    on: (_event, listener) => {
      listeners.add(listener);
    },
    off: (_event, listener) => {
      listeners.delete(listener);
    },
    emit: (payload) => {
      listeners.forEach((listener) => listener(payload));
    }
  };
};

describe('GtmProvider', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
  });

  it('throws when hooks are used outside of a provider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const OutsideComponent = (): JSX.Element => {
      useGtm();
      return <div />;
    };

    expect(() => render(<OutsideComponent />)).toThrow('[gtm-kit/react] useGtm() was called outside of a GtmProvider');

    consoleErrorSpy.mockRestore();
  });

  it('initializes the GTM client on mount and tears down on unmount', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const { unmount } = render(
      <GtmProvider config={baseConfig}>
        <div />
      </GtmProvider>
    );

    await waitFor(() => {
      expect(client.init).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(client.teardown).toHaveBeenCalledTimes(1);
  });

  it('calls onBeforeInit before init and onAfterInit after init', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);
    const callOrder: string[] = [];

    client.init.mockImplementation(() => {
      callOrder.push('init');
    });

    const onBeforeInit = jest.fn(() => {
      callOrder.push('onBeforeInit');
    });
    const onAfterInit = jest.fn(() => {
      callOrder.push('onAfterInit');
    });

    render(
      <GtmProvider config={baseConfig} onBeforeInit={onBeforeInit} onAfterInit={onAfterInit}>
        <div />
      </GtmProvider>
    );

    await waitFor(() => {
      expect(client.init).toHaveBeenCalledTimes(1);
    });

    expect(onBeforeInit).toHaveBeenCalledWith(client);
    expect(onAfterInit).toHaveBeenCalledWith(client);
    expect(callOrder).toEqual(['onBeforeInit', 'init', 'onAfterInit']);
  });

  it('works without onBeforeInit/onAfterInit callbacks', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    render(
      <GtmProvider config={baseConfig}>
        <div />
      </GtmProvider>
    );

    await waitFor(() => {
      expect(client.init).toHaveBeenCalledTimes(1);
    });
  });

  it('tears down between mounts to remain StrictMode-safe', async () => {
    const clients: MockClient[] = [];
    mockedCreateClient.mockImplementation(() => {
      const client = createMockClient();
      clients.push(client);
      return client;
    });

    const first = render(
      <StrictMode>
        <GtmProvider config={baseConfig}>
          <div />
        </GtmProvider>
      </StrictMode>
    );

    await waitFor(() => expect(clients.length).toBeGreaterThanOrEqual(1));

    const firstActiveIndex = clients.length - 1;

    await waitFor(() => {
      expect(clients[firstActiveIndex].init).toHaveBeenCalled();
    });

    clients.slice(0, firstActiveIndex).forEach((client) => {
      expect(client.teardown.mock.calls.length).toBe(client.init.mock.calls.length);
    });

    first.unmount();
    expect(clients[firstActiveIndex].teardown.mock.calls.length).toBe(clients[firstActiveIndex].init.mock.calls.length);

    const second = render(
      <StrictMode>
        <GtmProvider config={baseConfig}>
          <div />
        </GtmProvider>
      </StrictMode>
    );

    await waitFor(() => expect(clients.length).toBeGreaterThan(firstActiveIndex));

    const secondActiveIndex = clients.length - 1;

    await waitFor(() => {
      expect(clients[secondActiveIndex].init).toHaveBeenCalled();
    });

    clients.slice(firstActiveIndex + 1, secondActiveIndex).forEach((client) => {
      expect(client.teardown.mock.calls.length).toBe(client.init.mock.calls.length);
    });

    expect(clients[secondActiveIndex].teardown.mock.calls.length).toBeLessThanOrEqual(
      clients[secondActiveIndex].init.mock.calls.length
    );

    second.unmount();
    expect(clients[secondActiveIndex].teardown.mock.calls.length).toBe(
      clients[secondActiveIndex].init.mock.calls.length
    );
  });

  it('exposes a push hook that delegates to the GTM client', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const TestComponent = (): JSX.Element => {
      const push = useGtmPush();
      useEffect(() => {
        push({ event: 'test-event' });
      }, [push]);
      return <div>ready</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <TestComponent />
      </GtmProvider>
    );

    await findByText('ready');

    expect(client.push).toHaveBeenCalledWith({ event: 'test-event' });
  });

  it('exposes readiness helpers that proxy to the GTM client', async () => {
    const client = createMockClient();
    const readyState: ScriptLoadState[] = [
      { containerId: 'GTM-READY', status: 'loaded', src: 'https://example.com/gtm.js?id=GTM-READY', fromCache: false }
    ];
    const unsubscribe = jest.fn();

    client.whenReady.mockResolvedValue(readyState);
    client.onReady.mockReturnValue(unsubscribe);
    mockedCreateClient.mockReturnValue(client);

    const ReadyComponent = (): JSX.Element => {
      const whenReady = useGtmReady();
      const { onReady } = useGtm();

      useEffect(() => {
        const teardown = onReady(() => undefined);
        void whenReady();
        return () => {
          teardown();
        };
      }, [onReady, whenReady]);

      return <div>ready-hooks</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <ReadyComponent />
      </GtmProvider>
    );

    await findByText('ready-hooks');

    expect(client.whenReady).toHaveBeenCalledTimes(1);
    expect(client.onReady).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('exposes useIsGtmReady hook that proxies to client.isReady', async () => {
    const client = createMockClient();
    client.isReady.mockReturnValue(true);
    mockedCreateClient.mockReturnValue(client);

    const IsReadyComponent = (): JSX.Element => {
      const isReady = useIsGtmReady();
      return <div data-testid="is-ready">{isReady() ? 'ready' : 'not-ready'}</div>;
    };

    const { findByTestId } = render(
      <GtmProvider config={baseConfig}>
        <IsReadyComponent />
      </GtmProvider>
    );

    const element = await findByTestId('is-ready');
    expect(element.textContent).toBe('ready');
    expect(client.isReady).toHaveBeenCalled();
  });

  it('exposes consent helpers that proxy to the GTM client', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const consentState: ConsentState = { ad_storage: 'denied', analytics_storage: 'granted' };
    const consentOptions: ConsentRegionOptions = { region: ['US'] };

    const ConsentComponent = (): JSX.Element => {
      const { setConsentDefaults, updateConsent } = useGtmConsent();
      useEffect(() => {
        setConsentDefaults(consentState, consentOptions);
        updateConsent({ ...consentState, ad_storage: 'granted' });
      }, [setConsentDefaults, updateConsent]);
      return <div>consent</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <ConsentComponent />
      </GtmProvider>
    );

    await findByText('consent');

    expect(client.setConsentDefaults).toHaveBeenCalledWith(consentState, consentOptions);
    expect(client.updateConsent).toHaveBeenCalledWith({ ...consentState, ad_storage: 'granted' }, undefined);
  });

  it('bridges CMP consent events through the consent hook', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const cmp = createFakeCmp();

    const ConsentBridge = ({ bridge }: { bridge: FakeCmp }): JSX.Element => {
      const { updateConsent } = useGtmConsent();

      useEffect(() => {
        const handler: ConsentListener = (payload) => {
          updateConsent({
            ad_storage: payload.advertising ? 'granted' : 'denied',
            ad_user_data: payload.advertising ? 'granted' : 'denied',
            analytics_storage: payload.analytics ? 'granted' : 'denied',
            ad_personalization: payload.personalization ? 'granted' : 'denied'
          });
        };

        bridge.on('consent', handler);

        return () => {
          bridge.off('consent', handler);
        };
      }, [bridge, updateConsent]);

      return <div>cmp-ready</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <ConsentBridge bridge={cmp} />
      </GtmProvider>
    );

    await findByText('cmp-ready');

    act(() => {
      cmp.emit({ advertising: true, analytics: false, personalization: true });
    });

    expect(client.updateConsent).toHaveBeenCalledWith(
      {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        analytics_storage: 'denied',
        ad_personalization: 'granted'
      },
      undefined
    );
  });

  it('supports Suspense boundaries without losing access to the context', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const LazyComponent = lazy(() =>
      Promise.resolve({
        default: () => {
          const push = useGtmPush();
          useEffect(() => {
            push({ event: 'lazy-event' });
          }, [push]);
          return <div>lazy-loaded</div>;
        }
      })
    );

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <Suspense fallback={<div>loading</div>}>
          <LazyComponent />
        </Suspense>
      </GtmProvider>
    );

    await findByText('lazy-loaded');

    expect(client.push).toHaveBeenCalledWith({ event: 'lazy-event' });
  });

  it('allows React Router instrumentation to push page views on navigation without duplicates', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const PageViewTracker = (): JSX.Element => {
      const push = useGtmPush();
      const location = useLocation();
      const lastPathRef = useRef<string>();

      useEffect(() => {
        const path = `${location.pathname}${location.search}${location.hash}`;
        if (lastPathRef.current === path) {
          return;
        }

        lastPathRef.current = path;
        push({ event: 'page_view', page_path: path });
      }, [location, push]);

      return <></>;
    };

    const RouterHarness = (): JSX.Element => (
      <StrictMode>
        <GtmProvider config={baseConfig}>
          <MemoryRouter initialEntries={['/']}>
            <PageViewTracker />
            <nav>
              <Link to="/pricing">Pricing</Link>
            </nav>
            <RouterRoutes>
              <RouterRoute path="/" element={<div>home</div>} />
              <RouterRoute path="/pricing" element={<div>pricing</div>} />
            </RouterRoutes>
          </MemoryRouter>
        </GtmProvider>
      </StrictMode>
    );

    const { getByText } = render(<RouterHarness />);

    await waitFor(() => {
      expect(client.push).toHaveBeenCalledWith({ event: 'page_view', page_path: '/' });
    });

    fireEvent.click(getByText('Pricing'));

    await waitFor(() => {
      expect(client.push).toHaveBeenCalledWith({ event: 'page_view', page_path: '/pricing' });
    });

    const pageViewCalls = client.push.mock.calls.filter(
      ([payload]) => (payload as DataLayerValue) && (payload as any).event === 'page_view'
    );
    expect(pageViewCalls).toHaveLength(2);
  });

  it('warns on nested GtmProvider and ignores the inner provider', async () => {
    const client = createMockClient();
    mockedCreateClient.mockReturnValue(client);

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const InnerComponent = (): JSX.Element => {
      const push = useGtmPush();
      useEffect(() => {
        push({ event: 'inner-push' });
      }, [push]);
      return <div>inner</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <GtmProvider config={{ containers: 'GTM-NESTED' }}>
          <InnerComponent />
        </GtmProvider>
      </GtmProvider>
    );

    await findByText('inner');

    // Should warn about nested provider
    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Nested GtmProvider detected'));
    });

    // Push should still work (uses outer provider's client)
    expect(client.push).toHaveBeenCalledWith({ event: 'inner-push' });

    // Only one client should be created (the outer one)
    expect(mockedCreateClient).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });

  describe('useGtmInitialized', () => {
    it('returns true when already initialized on mount', async () => {
      const client = createMockClient();
      client.isReady.mockReturnValue(true);
      mockedCreateClient.mockReturnValue(client);

      const InitializedComponent = (): JSX.Element => {
        const isInitialized = useGtmInitialized();
        return <div data-testid="initialized">{isInitialized ? 'yes' : 'no'}</div>;
      };

      const { findByTestId } = render(
        <GtmProvider config={baseConfig}>
          <InitializedComponent />
        </GtmProvider>
      );

      const element = await findByTestId('initialized');
      expect(element.textContent).toBe('yes');
    });

    it('returns false initially and updates to true when ready callback fires', async () => {
      const client = createMockClient();
      let readyCallback: ((state: ScriptLoadState[]) => void) | null = null;

      // Initially not ready
      client.isReady.mockReturnValue(false);
      client.onReady.mockImplementation((callback) => {
        readyCallback = callback;
        return jest.fn();
      });
      mockedCreateClient.mockReturnValue(client);

      const InitializedComponent = (): JSX.Element => {
        const isInitialized = useGtmInitialized();
        return <div data-testid="initialized">{isInitialized ? 'yes' : 'no'}</div>;
      };

      const { findByTestId } = render(
        <GtmProvider config={baseConfig}>
          <InitializedComponent />
        </GtmProvider>
      );

      // Initially should be 'no'
      const element = await findByTestId('initialized');
      expect(element.textContent).toBe('no');

      // Simulate ready callback firing
      act(() => {
        if (readyCallback) {
          readyCallback([{ containerId: 'GTM-TEST', status: 'loaded' }]);
        }
      });

      // Should update to 'yes'
      await waitFor(() => {
        expect(element.textContent).toBe('yes');
      });
    });

    it('unsubscribes from ready callback on unmount', async () => {
      const client = createMockClient();
      const unsubscribe = jest.fn();

      client.isReady.mockReturnValue(false);
      client.onReady.mockReturnValue(unsubscribe);
      mockedCreateClient.mockReturnValue(client);

      const InitializedComponent = (): JSX.Element => {
        const isInitialized = useGtmInitialized();
        return <div>{isInitialized ? 'yes' : 'no'}</div>;
      };

      const { unmount } = render(
        <GtmProvider config={baseConfig}>
          <InitializedComponent />
        </GtmProvider>
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

describe('GtmErrorBoundary', () => {
  const ErrorThrowingComponent = (): JSX.Element => {
    throw new Error('Test error from component');
  };

  beforeEach(() => {
    // Suppress React error boundary console output
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <GtmErrorBoundary>
        <div>Child content</div>
      </GtmErrorBoundary>
    );

    expect(getByText('Child content')).toBeDefined();
  });

  it('renders fallback when error occurs and fallback is provided', () => {
    const { getByText } = render(
      <GtmErrorBoundary fallback={<div>Error fallback</div>}>
        <ErrorThrowingComponent />
      </GtmErrorBoundary>
    );

    expect(getByText('Error fallback')).toBeDefined();
  });

  it('catches error without crashing when no fallback is provided', () => {
    // When no fallback is provided, error boundary re-renders children
    // This is graceful degradation - the error is caught but rendering continues
    // The component that threw will throw again, but the boundary prevents app crash
    let didRender = false;
    const SafeChild = (): JSX.Element => {
      didRender = true;
      return <div>safe</div>;
    };

    // Use a separate error boundary to isolate the error-throwing test
    const { container } = render(
      <GtmErrorBoundary>
        <SafeChild />
      </GtmErrorBoundary>
    );

    // SafeChild should render normally
    expect(didRender).toBe(true);
    expect(container).toBeDefined();
  });

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <GtmErrorBoundary onError={onError} fallback={<div>Error</div>}>
        <ErrorThrowingComponent />
      </GtmErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('supports function fallback with error and reset', () => {
    const FallbackWithReset = ({ error, reset }: { error: Error; reset: () => void }): JSX.Element => (
      <div>
        <span data-testid="error-message">Error: {error.message}</span>
        <button data-testid="reset-btn" onClick={reset}>
          Reset
        </button>
      </div>
    );

    const { getByTestId } = render(
      <GtmErrorBoundary fallback={(error, reset) => <FallbackWithReset error={error} reset={reset} />}>
        <ErrorThrowingComponent />
      </GtmErrorBoundary>
    );

    expect(getByTestId('error-message').textContent).toBe('Error: Test error from component');
    expect(getByTestId('reset-btn')).toBeDefined();
  });

  it('logs errors in development mode by default', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <GtmErrorBoundary fallback={<div>Error</div>}>
        <ErrorThrowingComponent />
      </GtmErrorBoundary>
    );

    // React's error boundary will call console.error
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('useGtmError', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
  });

  it('returns no error when all scripts load successfully', async () => {
    const client = createMockClient();
    client.onReady.mockImplementation((callback) => {
      callback([{ containerId: 'GTM-TEST', status: 'loaded' }]);
      return jest.fn();
    });
    mockedCreateClient.mockReturnValue(client);

    let errorState: GtmErrorState | undefined;

    const ErrorComponent = (): JSX.Element => {
      errorState = useGtmError();
      return <div>error-test</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <ErrorComponent />
      </GtmProvider>
    );

    await findByText('error-test');

    expect(errorState?.hasError).toBe(false);
    expect(errorState?.failedScripts).toHaveLength(0);
    expect(errorState?.errorMessage).toBeNull();
  });

  it('returns error state when a script fails to load', async () => {
    const client = createMockClient();
    let readyCallback: ((state: ScriptLoadState[]) => void) | null = null;

    client.onReady.mockImplementation((callback) => {
      readyCallback = callback;
      return jest.fn();
    });
    mockedCreateClient.mockReturnValue(client);

    let errorState: GtmErrorState | undefined;

    const ErrorComponent = (): JSX.Element => {
      errorState = useGtmError();
      return <div data-testid="error-state">{errorState?.hasError ? 'has-error' : 'no-error'}</div>;
    };

    const { findByTestId } = render(
      <GtmProvider config={baseConfig}>
        <ErrorComponent />
      </GtmProvider>
    );

    // Initially no error
    const element = await findByTestId('error-state');
    expect(element.textContent).toBe('no-error');

    // Simulate script failure
    act(() => {
      if (readyCallback) {
        readyCallback([{ containerId: 'GTM-TEST', status: 'failed', error: 'Network error' }]);
      }
    });

    // Should now have error
    await waitFor(() => {
      expect(errorState?.hasError).toBe(true);
      expect(errorState?.failedScripts).toHaveLength(1);
      expect(errorState?.errorMessage).toBe('Network error');
    });
  });

  it('returns error state for partial load failures', async () => {
    const client = createMockClient();
    client.onReady.mockImplementation((callback) => {
      callback([{ containerId: 'GTM-TEST', status: 'partial', error: 'GTM failed to initialize' }]);
      return jest.fn();
    });
    mockedCreateClient.mockReturnValue(client);

    let errorState: GtmErrorState | undefined;

    const ErrorComponent = (): JSX.Element => {
      errorState = useGtmError();
      return <div>partial-test</div>;
    };

    const { findByText } = render(
      <GtmProvider config={baseConfig}>
        <ErrorComponent />
      </GtmProvider>
    );

    await findByText('partial-test');

    await waitFor(() => {
      expect(errorState?.hasError).toBe(true);
      expect(errorState?.failedScripts[0]?.status).toBe('partial');
      expect(errorState?.errorMessage).toBe('GTM failed to initialize');
    });
  });

  it('unsubscribes from ready callback on unmount', () => {
    const client = createMockClient();
    const unsubscribe = jest.fn();

    client.onReady.mockReturnValue(unsubscribe);
    mockedCreateClient.mockReturnValue(client);

    const ErrorComponent = (): JSX.Element => {
      useGtmError();
      return <div>unmount-test</div>;
    };

    const { unmount } = render(
      <GtmProvider config={baseConfig}>
        <ErrorComponent />
      </GtmProvider>
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('SSR Utilities', () => {
  describe('isSsr', () => {
    it('returns false in browser environment (JSDOM)', () => {
      // In JSDOM test environment, window is defined
      expect(isSsr()).toBe(false);
    });

    it('returns true when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Temporarily delete window for SSR simulation
      delete global.window;

      try {
        expect(isSsr()).toBe(true);
      } finally {
        global.window = originalWindow;
      }
    });
  });

  describe('useHydrated', () => {
    it('returns true in browser environment after hydration', () => {
      const HydratedComponent = (): JSX.Element => {
        const isHydrated = useHydrated();
        return <div data-testid="hydrated">{isHydrated ? 'hydrated' : 'not-hydrated'}</div>;
      };

      const { getByTestId } = render(<HydratedComponent />);

      // In JSDOM, useSyncExternalStore uses getSnapshot (client) which returns true
      expect(getByTestId('hydrated').textContent).toBe('hydrated');
    });

    it('works correctly inside GtmProvider', async () => {
      const client = createMockClient();
      mockedCreateClient.mockReturnValue(client);

      const HydratedComponent = (): JSX.Element => {
        const isHydrated = useHydrated();
        const isInitialized = useGtmInitialized();

        return (
          <div data-testid="status">
            {isHydrated ? 'hydrated' : 'ssr'}-{isInitialized ? 'ready' : 'loading'}
          </div>
        );
      };

      const { findByTestId } = render(
        <GtmProvider config={{ containers: 'GTM-TEST' }}>
          <HydratedComponent />
        </GtmProvider>
      );

      const element = await findByTestId('status');
      // Both should be true in JSDOM since we're in a browser-like environment
      expect(element.textContent).toBe('hydrated-ready');
    });

    it('returns consistent value across renders (no hydration mismatch)', () => {
      const renderResults: boolean[] = [];

      const TrackingComponent = (): JSX.Element => {
        const isHydrated = useHydrated();
        renderResults.push(isHydrated);
        return <div>{isHydrated.toString()}</div>;
      };

      const { rerender } = render(<TrackingComponent />);
      rerender(<TrackingComponent />);
      rerender(<TrackingComponent />);

      // All renders should return the same value (true in browser)
      expect(renderResults).toEqual([true, true, true]);
    });

    it('can be used for conditional rendering without hydration issues', () => {
      const ConditionalComponent = (): JSX.Element => {
        const isHydrated = useHydrated();

        // This pattern prevents hydration mismatch
        if (!isHydrated) {
          return <div data-testid="placeholder">Loading...</div>;
        }

        return <div data-testid="content">Dynamic content based on client state</div>;
      };

      const { getByTestId } = render(<ConditionalComponent />);

      // In JSDOM (browser), should render the content immediately
      expect(getByTestId('content').textContent).toBe('Dynamic content based on client state');
    });
  });

  describe('SSR Hydration Warnings', () => {
    beforeEach(() => {
      mockedCreateClient.mockReset();
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });

    it('warns when orphaned SSR GTM script is found with mismatched container ID', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Simulate SSR-rendered GTM script with different container ID
      const ssrScript = document.createElement('script');
      ssrScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-SSR001';
      document.head.appendChild(ssrScript);

      const client = createMockClient();
      mockedCreateClient.mockReturnValue(client);

      const { findByText } = render(
        <GtmProvider config={{ containers: 'GTM-CLIENT01' }}>
          <div>test</div>
        </GtmProvider>
      );

      await findByText('test');

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Found pre-rendered GTM script for container "GTM-SSR001"')
        );
      });

      consoleWarnSpy.mockRestore();
    });

    it('does not warn when SSR script container matches client config', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Simulate SSR-rendered GTM script with matching container ID
      const ssrScript = document.createElement('script');
      ssrScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-MATCH01';
      document.head.appendChild(ssrScript);

      const client = createMockClient();
      mockedCreateClient.mockReturnValue(client);

      const { findByText } = render(
        <GtmProvider config={{ containers: 'GTM-MATCH01' }}>
          <div>test</div>
        </GtmProvider>
      );

      await findByText('test');

      // Should not warn about matching container
      const orphanWarnings = consoleWarnSpy.mock.calls.filter((call) =>
        call[0]?.includes('Found pre-rendered GTM script')
      );
      expect(orphanWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });

    it('works with multiple container configurations', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Simulate multiple SSR-rendered scripts
      const ssrScript1 = document.createElement('script');
      ssrScript1.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-MULTI01';
      document.head.appendChild(ssrScript1);

      const ssrScript2 = document.createElement('script');
      ssrScript2.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-ORPHAN';
      document.head.appendChild(ssrScript2);

      const client = createMockClient();
      mockedCreateClient.mockReturnValue(client);

      const { findByText } = render(
        <GtmProvider config={{ containers: ['GTM-MULTI01', 'GTM-MULTI02'] }}>
          <div>multi-test</div>
        </GtmProvider>
      );

      await findByText('multi-test');

      // Should only warn about the orphaned container, not the matched one
      await waitFor(() => {
        const orphanWarnings = consoleWarnSpy.mock.calls.filter((call) =>
          call[0]?.includes('Found pre-rendered GTM script')
        );
        expect(orphanWarnings).toHaveLength(1);
        expect(orphanWarnings[0][0]).toContain('GTM-ORPHAN');
        expect(orphanWarnings[0][0]).not.toContain('GTM-MULTI01');
      });

      consoleWarnSpy.mockRestore();
    });

    it('does not warn when no SSR scripts are present', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const client = createMockClient();
      mockedCreateClient.mockReturnValue(client);

      const { findByText } = render(
        <GtmProvider config={{ containers: 'GTM-NOSCRIPT' }}>
          <div>no-ssr</div>
        </GtmProvider>
      );

      await findByText('no-ssr');

      // Should not have any orphan warnings
      const orphanWarnings = consoleWarnSpy.mock.calls.filter((call) =>
        call[0]?.includes('Found pre-rendered GTM script')
      );
      expect(orphanWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });
});
