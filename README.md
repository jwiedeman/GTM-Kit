# GTM Kit

**The simplest way to add Google Tag Manager to any JavaScript app.**

Works with React, Vue, Next.js, Nuxt, Svelte, SolidJS, Remix, Astro, or vanilla JavaScript. Pick what you need, ignore the rest.

<!-- Badges: Build & Quality -->

[![CI](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml)
[![E2E](https://github.com/jwiedeman/GTM-Kit/actions/workflows/e2e.yml/badge.svg)](https://github.com/jwiedeman/GTM-Kit/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/jwiedeman/GTM-Kit/graph/badge.svg)](https://codecov.io/gh/jwiedeman/GTM-Kit)
![Tests](https://img.shields.io/badge/tests-963_passed-brightgreen?logo=jest&logoColor=white)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<!-- Badges: Package Status -->

![core](https://img.shields.io/badge/core-5.3KB-brightgreen?logo=javascript&logoColor=white)
![react](https://img.shields.io/badge/react-6.0KB-61DAFB?logo=react&logoColor=white)
![vue](https://img.shields.io/badge/vue-5.9KB-4FC08D?logo=vuedotjs&logoColor=white)
![next](https://img.shields.io/badge/next-7.2KB-000000?logo=nextdotjs&logoColor=white)
![nuxt](https://img.shields.io/badge/nuxt-6.1KB-00DC82?logo=nuxtdotjs&logoColor=white)

<!-- Badges: More Frameworks -->

![svelte](https://img.shields.io/badge/svelte-5.9KB-FF3E00?logo=svelte&logoColor=white)
![solid](https://img.shields.io/badge/solid-6.0KB-2C4F7C?logo=solid&logoColor=white)
![remix](https://img.shields.io/badge/remix-7.0KB-000000?logo=remix&logoColor=white)
![astro](https://img.shields.io/badge/astro-6.3KB-FF5D01?logo=astro&logoColor=white)

<!-- Badges: npm -->

[![npm version](https://img.shields.io/npm/v/@jwiedeman/gtm-kit.svg)](https://www.npmjs.com/package/@jwiedeman/gtm-kit)
[![npm downloads](https://img.shields.io/npm/dm/@jwiedeman/gtm-kit.svg)](https://www.npmjs.com/package/@jwiedeman/gtm-kit)

<!-- Badges: Meta -->

![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features at a Glance

Everything you need for production GTM implementations, out of the box:

### Core Capabilities

| Feature                 | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Auto-Queue**          | Buffers events fired before GTM loads, replays them in order. Zero race conditions. |
| **Consent Mode v2**     | Granular GDPR compliance with presets for all-granted, all-denied, or mixed states. |
| **StrictMode-Safe**     | No double-fires in React development mode. Handled automatically.                   |
| **SSR/SSG Ready**       | Works with Next.js, Nuxt, Remix, SvelteKit - no hydration mismatches.               |
| **Multiple Containers** | Load multiple GTM containers with independent configs.                              |
| **CSP Nonce Support**   | Content Security Policy compatible with nonce injection.                            |
| **Zero Dependencies**   | Core is 5.3KB gzipped. No bloat.                                                    |

### Consent Mode v2 (GDPR)

| Feature              | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| **Granular Updates** | Update individual consent categories without affecting others.         |
| **Partial Updates**  | Only send what changed - `{ analytics_storage: 'granted' }` works.     |
| **Built-in Presets** | `eeaDefault` (all denied), `allGranted`, `analyticsOnly` ready to use. |
| **Region Scoping**   | Apply different defaults per region (EEA, US-CA, etc.).                |
| **waitForUpdate**    | Hold tags until explicit consent arrives.                              |
| **CMP Integration**  | Bridge any consent platform with typed helpers.                        |

### Auto-Queue (Race Condition Elimination)

| Feature                 | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| **Automatic Buffering** | Captures dataLayer pushes before GTM loads.            |
| **Order Preservation**  | Events replay in exact order they were pushed.         |
| **GTM Detection**       | Auto-detects when GTM.js loads via `gtm.js` event.     |
| **Inline Script**       | Minimal `<head>` script for earliest possible capture. |
| **Configurable**        | Poll interval, timeout, max buffer size, callbacks.    |
| **Self-Cleaning**       | Removes interceptor after replay - zero overhead.      |

### Developer Experience

| Feature                 | Description                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **TypeScript Native**   | Full type definitions, autocomplete, compile-time safety.                                             |
| **Framework Adapters**  | React hooks, Vue composables, Next.js components, Nuxt module.                                        |
| **CLI Scaffolding**     | `npx @jwiedeman/gtm-kit-cli init` auto-detects framework.                                             |
| **Ecommerce Helpers**   | Typed GA4 ecommerce events (purchase, add_to_cart, etc.).                                             |
| **Custom DataLayer**    | Use any dataLayer name, not just `window.dataLayer`.                                                  |
| **Debug Logging**       | Optional verbose logging for development.                                                             |
| **DataLayer Inspector** | `window.__gtmKit` console helpers — dump, watch, filter events live. Zero-cost tree-shakeable opt-in. |

### Framework-Specific Features

| Framework   | Unique Features                                         |
| ----------- | ------------------------------------------------------- |
| **React**   | Hooks API, StrictMode handling, Context-based state     |
| **Vue**     | Composables, Plugin system, Vue Router integration      |
| **Next.js** | Server Components, App Router, `useTrackPageViews` hook |
| **Nuxt**    | Native module, auto page tracking, runtime config       |
| **Svelte**  | Stores, SvelteKit SSR support                           |
| **SolidJS** | Primitives, signals integration                         |
| **Remix**   | Loader integration, streaming SSR                       |
| **Astro**   | View Transitions support, component-based integration   |

---

## Why GTM Kit?

| Problem                               | GTM Kit Solution                  |
| ------------------------------------- | --------------------------------- |
| "GTM fires twice in React StrictMode" | We handle it. Zero double-fires.  |
| "How do I do Consent Mode v2?"        | One-liner with built-in presets.  |
| "I need multiple GTM containers"      | Pass an array. Done.              |
| "It breaks SSR"                       | Nope. SSR-safe by default.        |
| "The bundle is huge"                  | Core is 5.3KB gzipped. Zero deps. |

---

## Installation

### The Lazy Way (Recommended)

Just run this command. It auto-detects your framework and sets everything up:

```bash
npx @jwiedeman/gtm-kit-cli init
```

Done. Seriously, that's it.

---

### Manual Installation

If you prefer to install manually, copy-paste the command for your framework:

| Framework         | Command                                                          |
| ----------------- | ---------------------------------------------------------------- |
| **React**         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react`        |
| **Vue 3**         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-vue`          |
| **Next.js**       | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-next`         |
| **Nuxt 3**        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-nuxt`         |
| **Svelte**        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-svelte`       |
| **SolidJS**       | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-solid`        |
| **Remix**         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-remix`        |
| **Astro**         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-astro`        |
| **Vanilla**       | `npm install @jwiedeman/gtm-kit`                                 |
| **React (class)** | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react-legacy` |

<details>
<summary><strong>Using yarn, pnpm, or bun?</strong></summary>

```bash
# Yarn
yarn add @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react

# pnpm
pnpm add @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react

# Bun
bun add @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react
```

</details>

<details>
<summary><strong>Installing from GitHub (for pre-release or bleeding edge)</strong></summary>

If you want to test unreleased features or use a specific branch/commit:

```bash
# Latest from main branch
npm install github:jwiedeman/GTM-Kit

# Specific version tag
npm install github:jwiedeman/GTM-Kit#v0.1.0

# Specific commit
npm install github:jwiedeman/GTM-Kit#abc1234
```

**Note:** Framework packages (react, vue, etc.) are bundled in the monorepo. For GitHub installs, import from the packages directory or use the npm-published packages for the best experience.

</details>

---

## Quick Start (5 minutes)

### React

```tsx
// Step 1: Wrap your app (usually in index.tsx or App.tsx)
import { GtmProvider } from '@jwiedeman/gtm-kit-react';

function App() {
  return (
    <GtmProvider config={{ containers: 'GTM-XXXXXX' }}>
      <YourApp />
    </GtmProvider>
  );
}
```

```tsx
// Step 2: Push events from any component
import { useGtmPush } from '@jwiedeman/gtm-kit-react';

function BuyButton() {
  const push = useGtmPush();

  const handleClick = () => {
    push({ event: 'purchase', value: 49.99 });
  };

  return <button onClick={handleClick}>Buy Now</button>;
}
```

**That's it.** GTM is now running.

---

### Vue 3

```ts
// Step 1: Add plugin (main.ts)
import { createApp } from 'vue';
import { GtmPlugin } from '@jwiedeman/gtm-kit-vue';
import App from './App.vue';

createApp(App).use(GtmPlugin, { containers: 'GTM-XXXXXX' }).mount('#app');
```

```vue
<!-- Step 2: Push events from any component -->
<script setup>
import { useGtm } from '@jwiedeman/gtm-kit-vue';

const { push } = useGtm();

function handleClick() {
  push({ event: 'purchase', value: 49.99 });
}
</script>

<template>
  <button @click="handleClick">Buy Now</button>
</template>
```

---

### Next.js (App Router)

```tsx
// Step 1: Add to layout (app/layout.tsx)
import { GtmHeadScript, GtmNoScript } from '@jwiedeman/gtm-kit-next';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <GtmHeadScript containers="GTM-XXXXXX" />
      </head>
      <body>
        <GtmNoScript containers="GTM-XXXXXX" />
        {children}
      </body>
    </html>
  );
}
```

```tsx
// Step 2: Create a client provider (app/providers/gtm.tsx)
'use client';
import { createGtmClient } from '@jwiedeman/gtm-kit';
import { useTrackPageViews } from '@jwiedeman/gtm-kit-next';

const client = createGtmClient({ containers: 'GTM-XXXXXX' });
client.init();

export function GtmProvider({ children }) {
  useTrackPageViews({ client }); // Auto-tracks route changes
  return children;
}
```

```tsx
// Step 3: Push events
import { pushEvent } from '@jwiedeman/gtm-kit';

// Use the same client instance
pushEvent(client, 'purchase', { value: 49.99 });
```

---

### Nuxt 3

```ts
// Step 1: Create plugin (plugins/gtm.client.ts)
import { GtmPlugin } from '@jwiedeman/gtm-kit-nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(GtmPlugin, { containers: 'GTM-XXXXXX' });
});
```

```vue
<!-- Step 2: Push events from any component -->
<script setup>
import { useGtm } from '@jwiedeman/gtm-kit-vue';

const { push } = useGtm();
push({ event: 'page_view' });
</script>
```

---

### Vanilla JavaScript

```ts
import { createGtmClient, pushEvent } from '@jwiedeman/gtm-kit';

// Step 1: Create and initialize
const gtm = createGtmClient({ containers: 'GTM-XXXXXX' });
gtm.init();

// Step 2: Push events
pushEvent(gtm, 'page_view', { page_path: '/' });
pushEvent(gtm, 'purchase', { value: 49.99, currency: 'USD' });
```

Works with Vite, Webpack, esbuild, plain `<script>` tags—anything.

---

## Consent Mode v2 (GDPR)

Required for EU compliance. GTM Kit makes it easy:

```tsx
// React example
import { GtmProvider, useGtmConsent } from '@jwiedeman/gtm-kit-react';
import { consentPresets } from '@jwiedeman/gtm-kit';

// Set defaults BEFORE GTM loads (required by Google)
<GtmProvider
  config={{ containers: 'GTM-XXXXXX' }}
  onBeforeInit={(client) => {
    // Deny everything by default for EU users
    client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
  }}
>
  <App />
</GtmProvider>;

// In your cookie banner
function CookieBanner() {
  const { updateConsent } = useGtmConsent();

  const acceptAll = () => {
    updateConsent({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
  };

  const rejectAll = () => {
    updateConsent({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  };

  return (
    <div>
      <button onClick={acceptAll}>Accept All</button>
      <button onClick={rejectAll}>Reject All</button>
    </div>
  );
}
```

**Built-in presets:**

- `consentPresets.eeaDefault` — All denied (GDPR default)
- `consentPresets.allGranted` — All granted
- `consentPresets.analyticsOnly` — Analytics only, no ads

---

## Ecommerce Events (GA4)

```ts
import { pushEcommerce } from '@jwiedeman/gtm-kit';

// Purchase
pushEcommerce(client, 'purchase', {
  transaction_id: 'T-12345',
  value: 120.0,
  currency: 'USD',
  items: [{ item_id: 'SKU-001', item_name: 'Blue T-Shirt', price: 40, quantity: 3 }]
});

// Add to cart
pushEcommerce(client, 'add_to_cart', {
  value: 40.0,
  currency: 'USD',
  items: [{ item_id: 'SKU-001', item_name: 'Blue T-Shirt', price: 40, quantity: 1 }]
});
```

---

## DataLayer Inspector

Debug GTM integrations from the browser console. Import the inspector only in development — it's a separate entry point, so production bundles stay lean.

```ts
// Vite / Next / any bundler with DEV flag
if (import.meta.env.DEV) {
  const { installInspector } = await import('@jwiedeman/gtm-kit/inspector');
  installInspector(client);
}
```

Then, in DevTools:

```js
__gtmKit.dump(); // console.table every dataLayer entry
__gtmKit.status(); // init/ready state, script load times, queue size
__gtmKit.filter(/^view_/); // only events matching a pattern
const stop = __gtmKit.watch(); // stream every future push as it happens
stop(); // detach
__gtmKit.uninstall(); // remove everything
```

Rename the global with `installInspector(client, { globalKey: 'myDebugger' })` if `__gtmKit` clashes with your app. Works with any custom `dataLayerName`.

---

## Common Use Cases

### Multiple GTM Containers

```ts
const client = createGtmClient({
  containers: [{ id: 'GTM-MAIN' }, { id: 'GTM-ADS', queryParams: { gtm_auth: 'abc', gtm_preview: 'env-1' } }]
});
```

### Custom Data Layer Name

```ts
const client = createGtmClient({
  containers: 'GTM-XXXXXX',
  dataLayerName: 'myDataLayer' // Instead of default 'dataLayer'
});
```

### CSP (Content Security Policy) Nonce

```tsx
// Next.js
<GtmHeadScript containers="GTM-XXXXXX" scriptAttributes={{ nonce: serverNonce }} />
```

### Track Page Views (React Router)

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
```

### Track Page Views (Vue Router)

```ts
import { useGtm } from '@jwiedeman/gtm-kit-vue';
import { watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const { push } = useGtm();

watch(
  () => route.fullPath,
  (path) => {
    push({ event: 'page_view', page_path: path });
  }
);
```

---

## API Reference

### Core Client

```ts
import { createGtmClient, pushEvent, pushEcommerce } from '@jwiedeman/gtm-kit';

const client = createGtmClient({
  containers: 'GTM-XXXXXX', // Required: ID or array of IDs
  dataLayerName: 'dataLayer', // Optional: custom name
  host: 'https://www.googletagmanager.com', // Optional: custom host
  scriptAttributes: { nonce: '...' } // Optional: for CSP
});

client.init(); // Start GTM
client.push({ event: 'custom' }); // Push to dataLayer
client.setConsentDefaults(state); // Set consent (before init)
client.updateConsent(state); // Update consent (after user action)
client.teardown(); // Cleanup (for tests)
await client.whenReady(); // Wait for scripts to load
```

### React Hooks

```ts
import {
  useGtm, // Full context { client, push, ... }
  useGtmPush, // Just the push() function
  useGtmConsent, // { setConsentDefaults, updateConsent }
  useGtmClient, // Raw client instance
  useGtmReady // whenReady() function
} from '@jwiedeman/gtm-kit-react';
```

### Vue Composables

```ts
import {
  useGtm, // Full API { client, push, updateConsent, ... }
  useGtmPush, // Just push()
  useGtmConsent // Consent methods
} from '@jwiedeman/gtm-kit-vue';
```

### Next.js Helpers

```ts
import {
  GtmHeadScript, // Server component for <head>
  GtmNoScript, // Server component for noscript fallback
  useTrackPageViews // Auto page tracking hook
} from '@jwiedeman/gtm-kit-next';
```

---

## Package Sizes

| Package                           | Size (gzip) | Use Case               |
| --------------------------------- | ----------- | ---------------------- |
| `@jwiedeman/gtm-kit`              | 5.3 KB      | Required for all       |
| `@jwiedeman/gtm-kit-react`        | 6.0 KB      | React 16.8+            |
| `@jwiedeman/gtm-kit-react-legacy` | 5.7 KB      | React class components |
| `@jwiedeman/gtm-kit-vue`          | 5.9 KB      | Vue 3                  |
| `@jwiedeman/gtm-kit-next`         | 7.2 KB      | Next.js 13+            |
| `@jwiedeman/gtm-kit-nuxt`         | 6.1 KB      | Nuxt 3                 |
| `@jwiedeman/gtm-kit-svelte`       | 5.9 KB      | Svelte 4+              |
| `@jwiedeman/gtm-kit-solid`        | 6.0 KB      | SolidJS 1+             |
| `@jwiedeman/gtm-kit-remix`        | 7.0 KB      | Remix 2+               |
| `@jwiedeman/gtm-kit-astro`        | 6.3 KB      | Astro 3+               |

---

## Troubleshooting

### Quick Diagnostic

**Is GTM loading at all?** Open your browser console and type `dataLayer`. You should see an array.

- **Empty or undefined?** Check your container ID and ensure the provider is wrapping your app
- **Has events?** GTM is working! Check your container configuration in GTM

---

### Troubleshooting Decision Tree

```
Something's not working...
│
├─ "Module not found" error
│   └─ Run: rm -rf node_modules package-lock.json && npm install
│
├─ GTM fires twice (React)
│   └─ This is normal in StrictMode. GTM Kit handles it.
│      Still seeing issues? Ensure only ONE provider at the root.
│
├─ Events not showing in GTM debugger
│   ├─ 1. Type `dataLayer` in console - are events there?
│   │   ├─ Yes → Problem is in GTM, not the library
│   │   └─ No → Check container ID format (GTM-XXXXXX)
│   ├─ 2. Is your container published?
│   │   └─ Preview mode events won't show in analytics
│   └─ 3. Check for ad blockers
│
├─ Consent Mode not working
│   └─ Consent MUST be set BEFORE init:
│      onBeforeInit={(client) => client.setConsentDefaults(...)}
│
├─ TypeScript errors
│   └─ Run: npm i -D @types/react @types/react-dom
│
├─ SSR hydration mismatch
│   └─ Use the framework-specific adapter (Next, Nuxt, Remix)
│
└─ Still stuck?
    └─ Open an issue: github.com/jwiedeman/GTM-Kit/issues
```

---

### Common Issues & Fixes

<details>
<summary><strong>GTM fires twice</strong></summary>

This usually means StrictMode is enabled (React dev mode). **GTM Kit handles this automatically.** If you're still seeing issues:

```tsx
// Verify you're using the provider correctly
<GtmProvider config={{ containers: 'GTM-XXXXXX' }}>{/* Your app - only ONE provider at the root */}</GtmProvider>
```

</details>

<details>
<summary><strong>Events not showing in GTM debugger</strong></summary>

1. Check your container ID (GTM-XXXXXX format)
2. Open browser console, type `dataLayer` - you should see your events
3. Make sure GTM container is published (not just in preview)
4. Disable ad blockers (they often block GTM)
</details>

<details>
<summary><strong>Consent Mode isn't working</strong></summary>

Consent defaults **MUST** be set before `init()`:

```tsx
// ✅ Correct - use onBeforeInit
<GtmProvider
  config={{ containers: 'GTM-XXXXXX' }}
  onBeforeInit={(client) => {
    client.setConsentDefaults(consentPresets.eeaDefault);
  }}
>

// ❌ Wrong - too late, GTM already initialized
useEffect(() => {
  client.setConsentDefaults(...); // This won't work
}, []);
```

</details>

<details>
<summary><strong>Type errors with TypeScript</strong></summary>

Make sure you have the correct types:

```bash
npm install --save-dev @types/react @types/react-dom
```

</details>

<details>
<summary><strong>Module not found</strong></summary>

```bash
# Clear your node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

</details>

<details>
<summary><strong>SSR/Hydration issues</strong></summary>

Use the correct adapter for your framework:

- **Next.js**: Use `@jwiedeman/gtm-kit-next` with `GtmHeadScript` and `GtmNoScript`
- **Nuxt**: Use `@jwiedeman/gtm-kit-nuxt` with `.client.ts` plugin
- **Remix**: Use `@jwiedeman/gtm-kit-remix` with `GtmScripts`
- **SvelteKit**: Wrap GTM in `browser` check

</details>

---

## Debugging & Diagnostics

GTM Kit includes built-in debugging tools to help troubleshoot tracking issues.

### Enable Debug Mode

```ts
const client = createGtmClient({
  containers: 'GTM-XXXXXX',
  debug: true // Enables verbose logging
});
```

When enabled, debug mode logs:

- Client initialization and configuration
- All dataLayer pushes with payload details
- Consent command processing
- Script load timing and status
- Event queue state changes

### Get Diagnostics

Programmatically inspect GTM Kit's internal state:

```ts
const diagnostics = client.getDiagnostics();

console.log(diagnostics);
// {
//   initialized: true,
//   ready: true,
//   dataLayerName: 'dataLayer',
//   dataLayerSize: 12,
//   queueSize: 0,
//   consentCommandsDelivered: 2,
//   containers: ['GTM-XXXXXX'],
//   scriptStates: [{ containerId: 'GTM-XXXXXX', status: 'loaded', loadTimeMs: 234 }],
//   uptimeMs: 45000,
//   debugMode: true
// }
```

### DataLayer Mutation Tracing

When `debug: true`, GTM Kit automatically wraps the dataLayer with a Proxy that logs all mutations:

```
[gtm-kit] dataLayer.push: { event: "page_view", page_path: "/" }
[gtm-kit] dataLayer[5] = { event: "purchase", value: 99.99 }
```

This helps identify:

- Events pushed by your code vs. GTM's internal events
- Unexpected mutations from third-party scripts
- Order of events during complex flows

### Event Queue Visualization

In debug mode, the event queue state is logged when events are queued before GTM loads:

```
[Queue Visualization] Event queued
  Queue length: 3
  Entries:
    1. page_view
    2. consent:default
    3. add_to_cart [ecommerce]
```

### React: Check Initialization Status

```tsx
import { useGtmInitialized, useGtmError } from '@jwiedeman/gtm-kit-react';

function DebugPanel() {
  const initialized = useGtmInitialized();
  const { hasError, errorMessage, failedScripts } = useGtmError();

  return (
    <div>
      <p>GTM Initialized: {initialized ? 'Yes' : 'No'}</p>
      {hasError && <p>Error: {errorMessage}</p>}
    </div>
  );
}
```

---

## Framework Support Matrix

| Framework     | Package                           | Status    | Min Version | Tests                                                                   | Coverage                                                        | Size                                                   |
| ------------- | --------------------------------- | --------- | ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Vanilla JS    | `@jwiedeman/gtm-kit`              | ✅ Stable | ES2018+     | ![588 tests](https://img.shields.io/badge/tests-588_passed-brightgreen) | ![96%](https://img.shields.io/badge/coverage-96%25-brightgreen) | ![5.3KB](https://img.shields.io/badge/gzip-5.3KB-blue) |
| React (hooks) | `@jwiedeman/gtm-kit-react`        | ✅ Stable | 16.8+       | ![51 tests](https://img.shields.io/badge/tests-51_passed-brightgreen)   | ![90%](https://img.shields.io/badge/coverage-90%25-green)       | ![6.0KB](https://img.shields.io/badge/gzip-6.0KB-blue) |
| React (class) | `@jwiedeman/gtm-kit-react-legacy` | ✅ Stable | 16.0+       | ![4 tests](https://img.shields.io/badge/tests-4_passed-brightgreen)     | ![98%](https://img.shields.io/badge/coverage-98%25-brightgreen) | ![5.7KB](https://img.shields.io/badge/gzip-5.7KB-blue) |
| Next.js       | `@jwiedeman/gtm-kit-next`         | ✅ Stable | 13+         | ![14 tests](https://img.shields.io/badge/tests-14_passed-brightgreen)   | ![86%](https://img.shields.io/badge/coverage-86%25-green)       | ![7.2KB](https://img.shields.io/badge/gzip-7.2KB-blue) |
| Vue 3         | `@jwiedeman/gtm-kit-vue`          | ✅ Stable | 3.0+        | ![45 tests](https://img.shields.io/badge/tests-45_passed-brightgreen)   | ![99%](https://img.shields.io/badge/coverage-99%25-brightgreen) | ![5.9KB](https://img.shields.io/badge/gzip-5.9KB-blue) |
| Nuxt 3        | `@jwiedeman/gtm-kit-nuxt`         | ✅ Stable | 3.0+        | ![12 tests](https://img.shields.io/badge/tests-12_passed-brightgreen)   | ![82%](https://img.shields.io/badge/coverage-82%25-green)       | ![6.1KB](https://img.shields.io/badge/gzip-6.1KB-blue) |
| Svelte        | `@jwiedeman/gtm-kit-svelte`       | ✅ Stable | 4.0+        | ![17 tests](https://img.shields.io/badge/tests-17_passed-brightgreen)   | ![83%](https://img.shields.io/badge/coverage-83%25-green)       | ![5.9KB](https://img.shields.io/badge/gzip-5.9KB-blue) |
| SolidJS       | `@jwiedeman/gtm-kit-solid`        | ✅ Stable | 1.0+        | ![21 tests](https://img.shields.io/badge/tests-21_passed-brightgreen)   | ![96%](https://img.shields.io/badge/coverage-96%25-brightgreen) | ![6.0KB](https://img.shields.io/badge/gzip-6.0KB-blue) |
| Remix         | `@jwiedeman/gtm-kit-remix`        | ✅ Stable | 2.0+        | ![35 tests](https://img.shields.io/badge/tests-35_passed-brightgreen)   | ![92%](https://img.shields.io/badge/coverage-92%25-brightgreen) | ![7.0KB](https://img.shields.io/badge/gzip-7.0KB-blue) |
| Astro         | `@jwiedeman/gtm-kit-astro`        | ✅ Stable | 3.0+        | ![57 tests](https://img.shields.io/badge/tests-57_passed-brightgreen)   | ![86%](https://img.shields.io/badge/coverage-86%25-green)       | ![6.3KB](https://img.shields.io/badge/gzip-6.3KB-blue) |
| CLI           | `@jwiedeman/gtm-kit-cli`          | ✅ Stable | Node 18+    | ![119 tests](https://img.shields.io/badge/tests-119_passed-brightgreen) | ![94%](https://img.shields.io/badge/coverage-94%25-brightgreen) | ![0KB](https://img.shields.io/badge/runtime-0KB-blue)  |

**Total: 963 tests across 11 packages**

---

## Examples

Working example apps for each framework:

```bash
git clone https://github.com/jwiedeman/GTM-Kit.git
cd GTM-Kit

# Install dependencies
pnpm install

# Run any example
pnpm --filter vanilla-csr dev
pnpm --filter react-strict-mode dev
pnpm --filter vue-app dev
pnpm --filter next-app dev
pnpm --filter nuxt-app dev
```

---

## Contributing

```bash
# Setup
pnpm install

# Run all tests
pnpm test

# Run E2E tests
pnpm e2e:test

# Build all packages
pnpm build

# Lint
pnpm lint
```

See [CONTRIBUTING.md](./docs/governance/contributing.md) for more details.

---

## License

MIT — use it however you want.
