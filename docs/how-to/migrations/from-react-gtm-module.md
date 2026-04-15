# Migrating from `react-gtm-module`

Most React apps that use GTM started with [`react-gtm-module`](https://www.npmjs.com/package/react-gtm-module). It works, but it's unmaintained, has no SSR support, no consent-mode helpers, and no typing beyond a loose `DataLayerArgs`. This guide swaps it out for `@jwiedeman/gtm-kit-react` in five concrete steps.

The migration is **non-destructive**: GTM container IDs, tags, and existing dataLayer events continue working unchanged. You're only replacing the client-side JS wrapper.

## TL;DR

| Concept                | `react-gtm-module`                 | `@jwiedeman/gtm-kit-react`                         |
| ---------------------- | ---------------------------------- | -------------------------------------------------- |
| Init                   | `TagManager.initialize({ gtmId })` | `<GtmProvider config={{ containers: 'GTM-XXX' }}>` |
| Push an event          | `TagManager.dataLayer({...})`      | `useGtmPush()` / `pushEvent(client, ...)`          |
| Multiple containers    | Call initialize once per container | `containers: ['GTM-A', 'GTM-B']`                   |
| StrictMode double-fire | Your problem                       | Handled automatically                              |
| SSR-safe               | No                                 | Yes (Next, Remix, etc.)                            |
| Consent Mode v2        | Roll your own                      | `useGtmConsent()` / presets                        |
| TypeScript             | Loose `DataLayerArgs`              | Full GA4 event types                               |
| Bundle size (gzip)     | ~3.4 KB                            | Core 3.7 KB + React adapter 2.8 KB                 |

## Step 1 — Install & remove

```bash
pnpm remove react-gtm-module @types/react-gtm-module
pnpm add @jwiedeman/gtm-kit-react @jwiedeman/gtm-kit
```

## Step 2 — Replace `initialize()` with `GtmProvider`

**Before:**

```tsx
// src/index.tsx
import TagManager from 'react-gtm-module';

TagManager.initialize({ gtmId: 'GTM-XXXXXXX' });

ReactDOM.createRoot(root).render(<App />);
```

**After:**

```tsx
// src/index.tsx
import { GtmProvider } from '@jwiedeman/gtm-kit-react';

ReactDOM.createRoot(root).render(
  <GtmProvider config={{ containers: 'GTM-XXXXXXX' }}>
    <App />
  </GtmProvider>
);
```

The provider initializes the client inside `useEffect`, so it's SSR-safe and won't double-fire under `<React.StrictMode>`.

### With `gtm_auth` / `gtm_preview` (environments)

**Before:**

```tsx
TagManager.initialize({
  gtmId: 'GTM-XXXXXXX',
  auth: 'xyz123',
  preview: 'env-2'
});
```

**After:**

```tsx
<GtmProvider
  config={{
    containers: [{ id: 'GTM-XXXXXXX', queryParams: { gtm_auth: 'xyz123', gtm_preview: 'env-2' } }]
  }}
>
```

## Step 3 — Replace `TagManager.dataLayer({...})` with hooks

**Before:**

```tsx
import TagManager from 'react-gtm-module';

const onClickCheckout = () => {
  TagManager.dataLayer({
    dataLayer: { event: 'begin_checkout', value: 99.99 }
  });
};
```

**After (inside any component under `<GtmProvider>`):**

```tsx
import { useGtmPush } from '@jwiedeman/gtm-kit-react';

const Checkout = () => {
  const push = useGtmPush();

  const onClickCheckout = () => {
    push({ event: 'begin_checkout', value: 99.99 });
  };
};
```

For typed GA4 ecommerce payloads, use `pushEcommerce` from the core package:

```tsx
import { useGtmClient } from '@jwiedeman/gtm-kit-react';
import { pushEcommerce } from '@jwiedeman/gtm-kit';

const client = useGtmClient();
pushEcommerce(client, 'purchase', {
  transaction_id: 'T-1234',
  value: 99.99,
  currency: 'USD',
  items: [{ item_id: 'SKU-001', item_name: 'Blue T-Shirt', price: 29.99, quantity: 1 }]
});
```

## Step 4 — Multiple containers

**Before (what most people do):**

```tsx
TagManager.initialize({ gtmId: 'GTM-MAIN' });
TagManager.initialize({ gtmId: 'GTM-ADS' }); // second snippet in the head, no coordination
```

**After:**

```tsx
<GtmProvider config={{ containers: ['GTM-MAIN', 'GTM-ADS'] }}>
```

Both containers share the same dataLayer and consent state. Use `client.getDiagnostics()` to see which loaded successfully vs. failed.

## Step 5 — Add Consent Mode v2 (optional but recommended)

`react-gtm-module` has no consent-mode primitives. You'd typically push raw `['consent', 'default', {...}]` arrays and hope. With GTM Kit:

```tsx
import { consentPresets } from '@jwiedeman/gtm-kit';

<GtmProvider
  config={{ containers: 'GTM-XXX' }}
  onBeforeInit={(client) => {
    // Set defaults BEFORE the GTM script loads — required by Google.
    client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
    client.setConsentDefaults(consentPresets.allGranted); // rest of world
  }}
>
```

After the user accepts cookies:

```tsx
const { updateConsent } = useGtmConsent();
updateConsent({ analytics_storage: 'granted', ad_storage: 'granted' });
```

## Gotchas

1. **`dataLayerName`**: If you passed a custom name to `TagManager.initialize({ dataLayerName: 'myLayer' })`, pass the same to GTM Kit: `createGtmClient({ containers: ..., dataLayerName: 'myLayer' })`. Otherwise events go to a fresh `window.dataLayer` and your old tags stop firing.
2. **`events`/`dataLayer` initialize option**: `react-gtm-module` accepted an initial `dataLayer` object at init time. GTM Kit's `onBeforeInit` is the replacement — push whatever you need there and it gets replayed in order after the container loads.
3. **Testing**: `react-gtm-module` quietly no-ops during SSR by checking `window`. GTM Kit's provider does the same — no test-environment guards needed.
4. **`react-gtm-hook`/`@sooro-io/react-gtm-hook`**: The same migration steps apply. Replace `useGTMDispatch()` with `useGtmPush()`.

## Verifying the swap worked

Install the [DataLayer Inspector](../../../README.md#datalayer-inspector) in dev:

```tsx
if (import.meta.env.DEV) {
  const { installInspector } = await import('@jwiedeman/gtm-kit/inspector');
  const client = /* useGtmClient() inside a component, or import your singleton */;
  installInspector(client);
}
```

Then in DevTools, `__gtmKit.dump()` should show your `gtm.js` start event plus any events you pushed since page load — identical to what `react-gtm-module` produced.
