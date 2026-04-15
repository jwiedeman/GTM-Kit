# @jwiedeman/gtm-kit

[![CI](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/jwiedeman/GTM-Kit/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/jwiedeman/GTM-Kit/graph/badge.svg?flag=core)](https://codecov.io/gh/jwiedeman/GTM-Kit)
[![npm version](https://img.shields.io/npm/v/@jwiedeman/gtm-kit.svg)](https://www.npmjs.com/package/@jwiedeman/gtm-kit)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@jwiedeman/gtm-kit)](https://bundlephobia.com/package/@jwiedeman/gtm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/@jwiedeman/gtm-kit)

**Framework-agnostic Google Tag Manager client. Zero dependencies. 3.7KB gzipped.**

The foundation of GTM Kit - works with any JavaScript project, framework, or build system.

---

## Installation

```bash
npm install @jwiedeman/gtm-kit
```

```bash
yarn add @jwiedeman/gtm-kit
```

```bash
pnpm add @jwiedeman/gtm-kit
```

---

## Quick Start

```ts
import { createGtmClient, pushEvent } from '@jwiedeman/gtm-kit';

// Create and initialize
const gtm = createGtmClient({ containers: 'GTM-XXXXXX' });
gtm.init();

// Push events
pushEvent(gtm, 'page_view', { page_path: '/' });
pushEvent(gtm, 'purchase', { value: 49.99, currency: 'USD' });
```

---

## Features

| Feature                 | Description                           |
| ----------------------- | ------------------------------------- |
| **Zero Dependencies**   | No bloat - just what you need         |
| **3.7KB Gzipped**       | Minimal impact on bundle size         |
| **Auto-Queue**          | Automatic buffering eliminates races  |
| **SSR-Safe**            | Works with server-side rendering      |
| **Consent Mode v2**     | Built-in GDPR compliance support      |
| **Multiple Containers** | Load multiple GTM containers          |
| **Custom DataLayer**    | Use custom dataLayer names            |
| **CSP Support**         | Content Security Policy nonce support |
| **TypeScript**          | Full type definitions included        |

---

## API Reference

### `createGtmClient(config)`

Creates a new GTM client instance.

```ts
const client = createGtmClient({
  containers: 'GTM-XXXXXX', // Required: ID or array of IDs
  dataLayerName: 'dataLayer', // Optional: custom name
  host: 'https://www.googletagmanager.com', // Optional: custom host
  scriptAttributes: { nonce: '...' } // Optional: for CSP
});
```

### Client Methods

```ts
client.init(); // Load GTM scripts
client.push({ event: 'custom' }); // Push to dataLayer
client.setConsentDefaults(state); // Set consent (before init)
client.updateConsent(state); // Update consent (after action)
client.teardown(); // Cleanup (for tests)
await client.whenReady(); // Wait for scripts to load
```

### Event Helpers

```ts
import { pushEvent, pushEcommerce } from '@jwiedeman/gtm-kit';

// Generic event
pushEvent(client, 'button_click', { button_id: 'cta-main' });

// Ecommerce event (GA4 format)
pushEcommerce(client, 'purchase', {
  transaction_id: 'T-12345',
  value: 120.0,
  currency: 'USD',
  items: [{ item_id: 'SKU-001', item_name: 'Blue T-Shirt', price: 40, quantity: 3 }]
});
```

### Consent Mode v2

```ts
import { consentPresets } from '@jwiedeman/gtm-kit';

// Set defaults BEFORE init (required by Google)
client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
client.init();

// Update after user consent
client.updateConsent({
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted'
});
```

**Granular Consent** - Update individual categories without affecting others:

```ts
// All granted
client.updateConsent(consentPresets.allGranted);

// All denied
client.updateConsent(consentPresets.eeaDefault);

// Mixed: analytics only, no ads
client.updateConsent(consentPresets.analyticsOnly);

// Partial update: only update specific categories
client.updateConsent({ analytics_storage: 'granted' });

// Update multiple specific categories
client.updateConsent({ ad_storage: 'granted', ad_user_data: 'granted' });
```

**Built-in Presets:**

| Preset          | ad_storage | analytics_storage | ad_user_data | ad_personalization |
| --------------- | ---------- | ----------------- | ------------ | ------------------ |
| `eeaDefault`    | denied     | denied            | denied       | denied             |
| `allGranted`    | granted    | granted           | granted      | granted            |
| `analyticsOnly` | denied     | granted           | denied       | denied             |

---

## Multiple Containers

```ts
const client = createGtmClient({
  containers: [{ id: 'GTM-MAIN' }, { id: 'GTM-ADS', queryParams: { gtm_auth: 'abc', gtm_preview: 'env-1' } }]
});
```

---

## SSR / Server-Side Rendering

```ts
import { createNoscriptMarkup } from '@jwiedeman/gtm-kit';

// Generate noscript HTML for server-side rendering
const noscriptHtml = createNoscriptMarkup('GTM-XXXXXX');
// Returns: '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX" ...></iframe></noscript>'
```

---

## Auto-Queue (Race Condition Protection)

Automatically buffer events that fire before GTM loads, then replay them in order:

```ts
import { installAutoQueue, createGtmClient } from '@jwiedeman/gtm-kit';

// Install FIRST - captures all dataLayer pushes
installAutoQueue();

// Events before GTM loads are buffered
window.dataLayer.push({ event: 'early_event' }); // Buffered!

// When GTM loads, everything replays automatically
const client = createGtmClient({ containers: 'GTM-XXXXXX' });
client.init(); // Buffer replays, GTM processes all events
```

**For earliest possible protection**, embed in your HTML `<head>`:

```ts
import { createAutoQueueScript } from '@jwiedeman/gtm-kit';

// Returns minified inline script for SSR
const script = createAutoQueueScript();
// Output: <script>{script}</script> in <head>
```

**Configuration:**

```ts
installAutoQueue({
  pollInterval: 50, // Check interval (ms)
  timeout: 30000, // Max wait time (ms)
  maxBufferSize: 1000, // Prevent memory issues
  onReplay: (count) => console.log(`Replayed ${count} events`),
  onTimeout: (count) => console.warn(`GTM slow, ${count} waiting`)
});
```

---

## DataLayer Inspector (dev-only)

A tree-shakeable dev helper that exposes `window.__gtmKit` in the browser. Import it from the separate `/inspector` subpath so production bundles stay untouched:

```ts
if (import.meta.env.DEV) {
  const { installInspector } = await import('@jwiedeman/gtm-kit/inspector');
  installInspector(client);
}
```

In DevTools:

```js
__gtmKit.dump(); // console.table of every dataLayer entry
__gtmKit.status(); // diagnostics: containers, script load times, queue size
__gtmKit.filter(/^view_/); // match events by substring or regex
const stop = __gtmKit.watch(); // stream every future push
stop(); // detach
__gtmKit.uninstall(); // remove everything
```

Pass `installInspector(client, { globalKey: 'myDebugger' })` if the default name collides with your app. The inspector is self-contained — just 1 KB gzipped, zero deps, works with any `dataLayerName`.

## Framework Adapters

While `@jwiedeman/gtm-kit` works standalone, we provide framework-specific adapters for better ergonomics:

| Framework     | Package                           | Install                                                          |
| ------------- | --------------------------------- | ---------------------------------------------------------------- |
| React (hooks) | `@jwiedeman/gtm-kit-react`        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react`        |
| React (class) | `@jwiedeman/gtm-kit-react-legacy` | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-react-legacy` |
| Vue 3         | `@jwiedeman/gtm-kit-vue`          | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-vue`          |
| Nuxt 3        | `@jwiedeman/gtm-kit-nuxt`         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-nuxt`         |
| Next.js       | `@jwiedeman/gtm-kit-next`         | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-next`         |
| Svelte        | `@jwiedeman/gtm-kit-svelte`       | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-svelte`       |
| SolidJS       | `@jwiedeman/gtm-kit-solid`        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-solid`        |
| Remix         | `@jwiedeman/gtm-kit-remix`        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-remix`        |
| Astro         | `@jwiedeman/gtm-kit-astro`        | `npm install @jwiedeman/gtm-kit @jwiedeman/gtm-kit-astro`        |

---

## Related Packages

| Framework | Package                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| React     | [@jwiedeman/gtm-kit-react](https://www.npmjs.com/package/@jwiedeman/gtm-kit-react)   |
| Vue 3     | [@jwiedeman/gtm-kit-vue](https://www.npmjs.com/package/@jwiedeman/gtm-kit-vue)       |
| Next.js   | [@jwiedeman/gtm-kit-next](https://www.npmjs.com/package/@jwiedeman/gtm-kit-next)     |
| Nuxt 3    | [@jwiedeman/gtm-kit-nuxt](https://www.npmjs.com/package/@jwiedeman/gtm-kit-nuxt)     |
| Svelte    | [@jwiedeman/gtm-kit-svelte](https://www.npmjs.com/package/@jwiedeman/gtm-kit-svelte) |
| SolidJS   | [@jwiedeman/gtm-kit-solid](https://www.npmjs.com/package/@jwiedeman/gtm-kit-solid)   |
| Remix     | [@jwiedeman/gtm-kit-remix](https://www.npmjs.com/package/@jwiedeman/gtm-kit-remix)   |
| Astro     | [@jwiedeman/gtm-kit-astro](https://www.npmjs.com/package/@jwiedeman/gtm-kit-astro)   |
| CLI       | [@jwiedeman/gtm-kit-cli](https://www.npmjs.com/package/@jwiedeman/gtm-kit-cli)       |

---

## Support

**Have a question, found a bug, or need help?**

[Open an issue on GitHub](https://github.com/jwiedeman/GTM-Kit/issues) — we're actively maintaining this project and respond quickly.

---

## License

MIT
