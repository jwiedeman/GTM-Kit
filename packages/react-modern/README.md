# @jwiedeman/gtm-kit-react

[![CI](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/jwiedeman/GTM-Kit/graph/badge.svg?flag=react-modern)](https://codecov.io/gh/jwiedeman/GTM-Kit)
[![npm version](https://img.shields.io/npm/v/@jwiedeman/gtm-kit-react.svg)](https://www.npmjs.com/package/@jwiedeman/gtm-kit-react)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@jwiedeman/gtm-kit-react)](https://bundlephobia.com/package/@jwiedeman/gtm-kit-react)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-16.8+-61DAFB.svg?logo=react)](https://reactjs.org/)

**React hooks and provider for Google Tag Manager. StrictMode-safe. Zero double-fires.**

The modern React adapter for GTM Kit - uses hooks and Context API for clean, idiomatic React code.

---

## Installation

```bash
npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react
```

```bash
yarn add @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react
```

```bash
pnpm add @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react
```

---

## Quick Start

### Step 1: Wrap Your App

```tsx
// App.tsx or index.tsx
import { GtmProvider } from '@jwiedeman/gtm-kit-react';

function App() {
  return (
    <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
      <YourApp />
    </GtmProvider>
  );
}
```

### Step 2: Push Events

```tsx
import { useGtmPush } from '@jwiedeman/gtm-kit-react';

function BuyButton() {
  const push = useGtmPush();

  const handleClick = () => {
    push({ event: 'purchase', value: 49.99 });
  };

  return <button onClick={handleClick}>Buy Now</button>;
}
```

**That's it!** GTM is now running.

---

## Features

| Feature             | Description                               |
| ------------------- | ----------------------------------------- |
| **StrictMode-Safe** | No double-fires in React development mode |
| **Hooks-Based**     | Modern React patterns with Context API    |
| **React 16.8+**     | Works with any modern React version       |
| **TypeScript**      | Full type definitions included            |
| **Consent Mode v2** | Built-in GDPR compliance hooks            |
| **SSR Compatible**  | Safe for Next.js, Remix, etc.             |

---

## Available Hooks

### `useGtmPush()`

Get a push function to send events to GTM.

```tsx
const push = useGtmPush();

push({ event: 'button_click', button_id: 'cta-main' });
```

### `useGtm()`

Get the full GTM context with all methods.

```tsx
const { client, push, updateConsent, setConsentDefaults } = useGtm();
```

### `useGtmConsent()`

Manage consent state.

```tsx
const { updateConsent, setConsentDefaults } = useGtmConsent();

// After user accepts cookies
updateConsent({
  ad_storage: 'granted',
  analytics_storage: 'granted'
});
```

### `useGtmClient()`

Get the raw GTM client instance.

```tsx
const client = useGtmClient();
```

### `useGtmReady()`

Get a function that resolves when GTM is fully loaded. Best for awaiting in event handlers.

```tsx
const whenReady = useGtmReady();

const handleClick = async () => {
  await whenReady();
  console.log('GTM is ready!');
};
```

### `useIsGtmReady()`

Get a function for synchronous ready checks. Best for conditionals in callbacks.

```tsx
const isReady = useIsGtmReady();

const handleClick = () => {
  if (isReady()) {
    // GTM is loaded, safe to use advanced features
  }
};
```

### `useGtmInitialized()`

Get a reactive boolean that updates when GTM initializes. Best for conditional rendering.

```tsx
const isInitialized = useGtmInitialized();

return isInitialized ? <Analytics /> : <Skeleton />;
```

### `useGtmError()`

Get error state from the GTM provider.

```tsx
const { hasError, errorMessage } = useGtmError();

if (hasError) {
  console.error('GTM failed:', errorMessage);
}
```

### `useIsGtmProviderPresent()`

Check if GtmProvider exists without throwing. Useful for optional GTM integration.

```tsx
const hasProvider = useIsGtmProviderPresent();

// Safe to call - won't throw if provider is missing
if (hasProvider) {
  const push = useGtmPush();
  push({ event: 'optional_tracking' });
}
```

---

## Consent Mode v2 (GDPR)

### Setting Consent Defaults Before GTM Loads

**Recommended:** Use the `onBeforeInit` callback to set consent defaults before GTM loads:

```tsx
import { GtmProvider } from '@jwiedeman/gtm-kit-react';
import { consentPresets } from '@jwiedeman/gtm-kit';

function App() {
  return (
    <GtmProvider
      config={{ containers: 'GTM-XXXXXX' }}
      onBeforeInit={(client) => {
        client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
      }}
    >
      <YourApp />
    </GtmProvider>
  );
}
```

**Alternative:** Use `useGtmConsent` in a child component (child effects run before parent effects in React):

```tsx
import { GtmProvider, useGtmConsent } from '@jwiedeman/gtm-kit-react';
import { consentPresets } from '@jwiedeman/gtm-kit';

function ConsentInitializer({ children }) {
  const { setConsentDefaults } = useGtmConsent();

  useEffect(() => {
    setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
  }, [setConsentDefaults]);

  return <>{children}</>;
}

function App() {
  return (
    <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
      <ConsentInitializer>
        <YourApp />
      </ConsentInitializer>
    </GtmProvider>
  );
}
```

### Cookie Banner Component

```tsx
import { useGtmConsent } from '@jwiedeman/gtm-kit-react';
import { consentPresets } from '@jwiedeman/gtm-kit';

function CookieBanner() {
  const { updateConsent } = useGtmConsent();

  // Accept all tracking
  const acceptAll = () => updateConsent(consentPresets.allGranted);

  // Reject all tracking
  const rejectAll = () => updateConsent(consentPresets.eeaDefault);

  // Analytics only (mixed consent)
  const analyticsOnly = () => updateConsent(consentPresets.analyticsOnly);

  // Granular: update specific categories
  const customChoice = () =>
    updateConsent({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });

  return (
    <div>
      <button onClick={acceptAll}>Accept All</button>
      <button onClick={rejectAll}>Reject All</button>
      <button onClick={analyticsOnly}>Analytics Only</button>
    </div>
  );
}
```

**Partial Updates** - Only update what changed:

```tsx
// User later opts into ads from preference center
updateConsent({ ad_storage: 'granted', ad_user_data: 'granted' });
// Other categories (analytics_storage, ad_personalization) unchanged
```

---

## Provider Options

```tsx
<GtmProvider
  config={{
    containers: 'GTM-XXXXXX', // Required
    dataLayerName: 'dataLayer', // Optional
    host: 'https://custom.host.com', // Optional
    scriptAttributes: { nonce: '...' } // Optional: CSP
  }}
  onBeforeInit={(client) => {
    // Called before GTM loads - ideal for consent defaults
    client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
  }}
  onAfterInit={(client) => {
    // Called after GTM loads
    console.log('GTM initialized');
  }}
>
  {children}
</GtmProvider>
```

| Prop             | Type                        | Required | Description                                       |
| ---------------- | --------------------------- | -------- | ------------------------------------------------- |
| `config`         | `CreateGtmClientOptions`    | Yes      | GTM client configuration (containers, host, etc.) |
| `onBeforeInit`   | `(client: GtmClient) => void` | No    | Called before GTM initialization — use for consent defaults |
| `onAfterInit`    | `(client: GtmClient) => void` | No    | Called after GTM initialization                    |

---

## React Router Integration

```tsx
import { useLocation } from 'react-router-dom';
import { useGtmPush } from '@jwiedeman/gtm-kit-react';
import { useEffect, useRef } from 'react';

function PageTracker() {
  const location = useLocation();
  const push = useGtmPush();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname + location.search;
    if (path !== lastPath.current) {
      lastPath.current = path;
      push({ event: 'page_view', page_path: path });
    }
  }, [location, push]);

  return null;
}

// Add to your app
function App() {
  return (
    <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
      <BrowserRouter>
        <PageTracker />
        <Routes>...</Routes>
      </BrowserRouter>
    </GtmProvider>
  );
}
```

---

## Why StrictMode-Safe Matters

In React development mode with StrictMode, components mount twice. This causes most GTM libraries to fire events twice. **GTM Kit handles this automatically** - you get exactly one initialization and no duplicate events.

---

## Requirements

- React 16.8+ (hooks support)
- `@jwiedeman/gtm-kit` (peer dependency)

---

## Related Packages

- **Core**: [@jwiedeman/gtm-kit](https://www.npmjs.com/package/@jwiedeman/gtm-kit) (required)
- **Legacy React**: [@jwiedeman/gtm-kit-react-legacy](https://www.npmjs.com/package/@jwiedeman/gtm-kit-react-legacy) (for class components)
- **Next.js**: [@jwiedeman/gtm-kit-next](https://www.npmjs.com/package/@jwiedeman/gtm-kit-next)

---

## Support

**Have a question, found a bug, or need help?**

[Open an issue on GitHub](https://github.com/jwiedeman/GTM-Kit/issues) — we're actively maintaining this project and respond quickly.

---

## License

MIT
