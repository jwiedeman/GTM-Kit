import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGtmConsent, useGtmPush } from '@jwiedeman/gtm-kit-react';

type ConsentState = 'granted' | 'denied';
type RelayState = 'idle' | 'sending' | 'success' | 'error';

interface RelayStatus {
  state: RelayState;
  message?: string;
}

interface ClientContext {
  clientId: string;
  sessionId?: number;
}

interface PurchaseItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

interface PurchasePayload {
  currency: string;
  value: number;
  transaction_id: string;
  items: PurchaseItem[];
}

interface RelayEvent {
  name: string;
  timestampMicros: number;
  params: Record<string, unknown>;
}

interface RelayRequestBody {
  client: {
    id: string;
    sessionId?: number;
    userAgent?: string;
  };
  consent?: Record<string, string>;
  events: RelayEvent[];
}

type DataLayerEntry = unknown;

interface DataLayerWithPush extends Array<DataLayerEntry> {
  push: (...args: unknown[]) => number;
}

type GtagGetCallback<T> = (value: T) => void;

interface Gtag {
  (...args: unknown[]): void;
  (command: 'get', targetId: string, fieldName: string, callback: GtagGetCallback<string | number | undefined>): void;
}

declare global {
  interface Window {
    dataLayer?: DataLayerWithPush;
    gtag?: Gtag;
  }
}

export const consentDefaults = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_personalization: 'denied',
  ad_user_data: 'denied'
} as const;

const defaultRelayUrl = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:4001/events';
const initialMeasurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID ?? 'G-XXXXXXX';
const dataLayerName = import.meta.env.VITE_GTM_DATALAYER ?? 'dataLayer';

const getDataLayer = (): DataLayerWithPush | undefined => {
  const globalObject = window as unknown as Record<string, unknown>;
  const candidate = globalObject[dataLayerName];
  if (Array.isArray(candidate) && typeof (candidate as DataLayerWithPush).push === 'function') {
    return candidate as DataLayerWithPush;
  }

  return undefined;
};

const formatJson = (value: unknown): string => {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatDataLayerEntry = (entry: DataLayerEntry): string => {
  if (typeof entry === 'function') {
    return '[Function]';
  }

  return formatJson(entry);
};

const useDataLayerSnapshot = (): string[] => {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    const capture = () => {
      const dataLayer = getDataLayer();
      if (dataLayer) {
        setEntries(dataLayer.map((entry) => formatDataLayerEntry(entry)));
      } else {
        setEntries([]);
      }
    };

    capture();
    const interval = window.setInterval(capture, 500);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return entries;
};

const createRandomClientId = (): string => `${Date.now()}.${Math.floor(Math.random() * 1_000_000)}`;

const loadClientContext = async (measurementId: string): Promise<ClientContext> => {
  const fallback: ClientContext = {
    clientId: createRandomClientId()
  };

  if (!measurementId || measurementId === 'G-XXXXXXX') {
    return fallback;
  }

  const dataLayer = getDataLayer();

  if (!dataLayer) {
    return fallback;
  }

  return new Promise<ClientContext>((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve(fallback);
    }, 1500);

    try {
      dataLayer.push(() => {
        if (typeof window.gtag !== 'function') {
          window.clearTimeout(timeout);
          resolve(fallback);
          return;
        }

        window.gtag('get', measurementId, 'client_id', (clientId) => {
          if (typeof clientId !== 'string' || clientId.length === 0) {
            window.clearTimeout(timeout);
            resolve(fallback);
            return;
          }

          window.gtag?.('get', measurementId, 'session_id', (session) => {
            window.clearTimeout(timeout);
            const sessionId = typeof session === 'number' && Number.isFinite(session) ? session : undefined;
            resolve({ clientId, sessionId });
          });
        });
      });
    } catch {
      window.clearTimeout(timeout);
      resolve(fallback);
    }
  });
};

const readConsentState = (): Record<string, string> | undefined => {
  const dataLayer = getDataLayer();

  if (!dataLayer) {
    return undefined;
  }

  for (let index = dataLayer.length - 1; index >= 0; index -= 1) {
    const entry = dataLayer[index];
    if (Array.isArray(entry) && entry[0] === 'consent') {
      const state = entry[2];
      if (state && typeof state === 'object') {
        return state as Record<string, string>;
      }
    }
  }

  return undefined;
};

const App = (): JSX.Element => {
  const push = useGtmPush();
  const { updateConsent } = useGtmConsent();
  const dataLayerEntries = useDataLayerSnapshot();
  const [consent, setConsent] = useState<ConsentState>('denied');
  const [relayUrl, setRelayUrl] = useState<string>(defaultRelayUrl);
  const [measurementId, setMeasurementId] = useState<string>(initialMeasurementId);
  const [relayStatus, setRelayStatus] = useState<RelayStatus>({ state: 'idle' });
  const [lastRequest, setLastRequest] = useState<string>('');
  const [lastResponse, setLastResponse] = useState<string>('');
  const [purchaseCount, setPurchaseCount] = useState(0);

  const consentSummary = useMemo(() => formatJson({ consent, defaults: consentDefaults }), [consent]);

  const handleGrantConsent = useCallback(() => {
    setConsent('granted');
    updateConsent({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_personalization: 'granted',
      ad_user_data: 'granted'
    });
  }, [updateConsent]);

  const handleRevokeConsent = useCallback(() => {
    setConsent('denied');
    updateConsent(consentDefaults);
  }, [updateConsent]);

  const trackPurchase = useCallback(async () => {
    if (!relayUrl || relayUrl.trim().length === 0) {
      setRelayStatus({ state: 'error', message: 'Set the relay URL before sending events.' });
      return;
    }

    const nextCount = purchaseCount + 1;
    setPurchaseCount(nextCount);

    const transactionId = `ORDER-${nextCount.toString().padStart(4, '0')}`;
    const ecommerce: PurchasePayload = {
      currency: 'USD',
      value: 249,
      transaction_id: transactionId,
      items: [
        {
          item_id: 'sku-boost-analytics',
          item_name: 'Analytics Boost Plan',
          price: 249,
          quantity: 1
        }
      ]
    };

    push({
      event: 'purchase',
      event_source: 'fullstack-web-example',
      ecommerce
    });

    setRelayStatus({ state: 'sending', message: 'Forwarding purchase event to relay…' });
    setLastResponse('');

    try {
      const context = await loadClientContext(measurementId);
      const consentState = readConsentState();
      const relayEvent: RelayEvent = {
        name: 'purchase',
        timestampMicros: Date.now() * 1000,
        params: {
          currency: ecommerce.currency,
          value: ecommerce.value,
          transaction_id: ecommerce.transaction_id,
          items: ecommerce.items,
          event_source: 'fullstack-web-example'
        }
      };

      const body: RelayRequestBody = {
        client: {
          id: context.clientId,
          sessionId: context.sessionId,
          userAgent: navigator.userAgent
        },
        consent: consentState,
        events: [relayEvent]
      };

      const bodyJson = JSON.stringify(body, null, 2);
      setLastRequest(bodyJson);

      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(responseText || `Relay returned HTTP ${response.status}`);
      }

      setRelayStatus({ state: 'success', message: `Relay accepted purchase (HTTP ${response.status}).` });
      setLastResponse(responseText ? formatJson(responseText) : 'Relay returned an empty response body.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error sending purchase to relay.';
      setRelayStatus({ state: 'error', message });
    }
  }, [measurementId, push, purchaseCount, relayUrl]);

  const relayStatusLabel = useMemo(() => {
    switch (relayStatus.state) {
      case 'sending':
        return 'Sending to relay…';
      case 'success':
        return relayStatus.message ?? 'Relay accepted events.';
      case 'error':
        return relayStatus.message ?? 'Relay rejected events.';
      default:
        return 'Relay idle.';
    }
  }, [relayStatus]);

  const limitedDataLayerEntries = useMemo(() => dataLayerEntries.slice(-8), [dataLayerEntries]);

  return (
    <main className="page">
      <section className="app-shell">
        <header className="card hero">
          <div className="hero-badge">Full-stack demo</div>
          <h1>React GTM Kit + server relay</h1>
          <p>
            Initialize the GTM client, sync Consent Mode updates, and forward high-value events to the server relay.
            Configure your relay endpoint and GA4 measurement ID to match the server sample under{' '}
            <code>examples/server</code>.
          </p>
          <div className="hero-meta">
            <span>Current consent: {consent}</span>
            <span>Relay status: {relayStatusLabel}</span>
          </div>
        </header>

        <section className="grid">
          <article className="card">
            <h2>Consent controls</h2>
            <p>
              Toggle the consent state to watch Consent Mode entries appear in the data layer. In production the consent
              state would flow from your CMP, but the adapter API makes it easy to wire in any UI.
            </p>
            <div className="actions">
              <button
                type="button"
                className="button primary"
                onClick={handleGrantConsent}
                disabled={consent === 'granted'}
              >
                Grant analytics & ads
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleRevokeConsent}
                disabled={consent === 'denied'}
              >
                Keep essential only
              </button>
            </div>
            <pre className="code-block" aria-label="Consent state preview">
              {consentSummary}
            </pre>
          </article>

          <article className="card">
            <h2>Relay configuration</h2>
            <p>
              Point the example at your running relay and supply the GA4 measurement ID used for Measurement Protocol
              calls.
            </p>
            <label className="field">
              <span>Relay endpoint</span>
              <input
                type="url"
                value={relayUrl}
                onChange={(event) => setRelayUrl(event.target.value)}
                placeholder="http://localhost:4001/events"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>GA4 measurement ID</span>
              <input
                type="text"
                value={measurementId}
                onChange={(event) => setMeasurementId(event.target.value.trim())}
                placeholder="G-XXXXXXX"
                spellCheck={false}
              />
            </label>
            <p className="hint">
              The measurement ID is only used to fetch the GA4 client & session IDs via <code>gtag('get')</code>. If you
              leave the placeholder value, the example generates synthetic identifiers instead.
            </p>
          </article>

          <article className="card">
            <h2>Simulate purchase</h2>
            <p>
              Emit a purchase event into the data layer and forward the same payload to the relay. The relay response is
              shown for quick debugging.
            </p>
            <button type="button" className="button primary" onClick={trackPurchase}>
              Send purchase event
            </button>
            <p className={`status status-${relayStatus.state}`}>{relayStatusLabel}</p>
            {lastRequest && (
              <details className="details">
                <summary>Last request body</summary>
                <pre className="code-block">{lastRequest}</pre>
              </details>
            )}
            {lastResponse && (
              <details className="details">
                <summary>Last relay response</summary>
                <pre className="code-block">{lastResponse}</pre>
              </details>
            )}
          </article>

          <article className="card">
            <h2>Data layer activity</h2>
            <p>
              The latest pushes from <code>{dataLayerName}</code> appear below.
            </p>
            {limitedDataLayerEntries.length === 0 ? (
              <p className="hint">
                No data layer entries yet. Trigger consent or purchase actions to populate the view.
              </p>
            ) : (
              <ol className="data-layer-list">
                {limitedDataLayerEntries.map((entry, index) => (
                  <li key={`${index}-${entry.slice(0, 16)}`}>
                    <pre className="code-block small">{entry}</pre>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>
      </section>
    </main>
  );
};

export default App;
