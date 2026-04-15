# Migrating from `vue-gtm` / `@gtm-support/vue-gtm`

[`@gtm-support/vue-gtm`](https://www.npmjs.com/package/@gtm-support/vue-gtm) is the de-facto GTM plugin for Vue 3. It's well maintained, but it lacks Consent Mode v2 helpers, has weaker TypeScript coverage on event payloads, and tangles init with Vue Router. This guide swaps it for `@jwiedeman/gtm-kit-vue` while preserving every existing tag in your GTM container.

## Step 1 — Install

```bash
pnpm remove @gtm-support/vue-gtm
pnpm add @jwiedeman/gtm-kit-vue @jwiedeman/gtm-kit
```

## Step 2 — Replace `createGtm()` with the GTM Kit plugin

**Before:**

```ts
// src/main.ts
import { createApp } from 'vue';
import { createGtm } from '@gtm-support/vue-gtm';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(router);
app.use(
  createGtm({
    id: 'GTM-XXXXXXX',
    defer: false,
    enabled: true,
    debug: false,
    vueRouter: router,
    trackOnNextTick: false
  })
);
app.mount('#app');
```

**After:**

```ts
// src/main.ts
import { createApp } from 'vue';
import { GtmPlugin } from '@jwiedeman/gtm-kit-vue';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(router);
app.use(GtmPlugin, { containers: 'GTM-XXXXXXX' });

// Auto-track page views on route change. `vue-gtm` did this internally via the
// `vueRouter` option; GTM Kit keeps it explicit so it's easy to customize.
router.afterEach((to) => {
  app.config.globalProperties.$gtm.push({
    event: 'page_view',
    page_path: to.fullPath,
    page_location: window.location.href,
    page_title: document.title
  });
});

app.mount('#app');
```

### What happened to each `vue-gtm` option?

| `@gtm-support/vue-gtm` | GTM Kit equivalent                                               |
| ---------------------- | ---------------------------------------------------------------- |
| `id`                   | `containers` (string, array, or rich objects)                    |
| `enabled: false`       | Don't call `app.use(GtmPlugin)` — the plugin is opt-in           |
| `debug: true`          | `debug: true` (same flag, formatted console output)              |
| `vueRouter: router`    | Explicit `router.afterEach` (see above) — keeps it transparent   |
| `trackOnNextTick`      | Wrap the push in `nextTick()` yourself if you need the new title |
| `queryParams`          | `containers: [{ id, queryParams }]`                              |
| `ignoredViews`         | Add `if (ignoredRoutes.includes(to.name)) return;` in the guard  |

## Step 3 — Replace `useGtm()` with composables

**Before:**

```vue
<script setup>
import { useGtm } from '@gtm-support/vue-gtm';

const gtm = useGtm();

function onAddToCart(sku: string) {
  gtm?.trackEvent({
    event: 'add_to_cart',
    item_id: sku
  });
}
</script>
```

**After:**

```vue
<script setup lang="ts">
import { useGtmPush } from '@jwiedeman/gtm-kit-vue';

const push = useGtmPush();

function onAddToCart(sku: string) {
  push({ event: 'add_to_cart', item_id: sku });
}
</script>
```

For typed GA4 ecommerce events:

```vue
<script setup lang="ts">
import { useGtmClient } from '@jwiedeman/gtm-kit-vue';
import { pushEcommerce } from '@jwiedeman/gtm-kit';

const client = useGtmClient();

function onPurchase() {
  pushEcommerce(client, 'purchase', {
    transaction_id: 'T-1234',
    value: 99.99,
    currency: 'USD',
    items: [{ item_id: 'SKU-001', item_name: 'Blue T-Shirt', price: 29.99, quantity: 1 }]
  });
}
</script>
```

## Step 4 — Add Consent Mode v2

`@gtm-support/vue-gtm` doesn't have first-class consent primitives. With GTM Kit:

```ts
// src/main.ts
import { consentPresets } from '@jwiedeman/gtm-kit';

app.use(GtmPlugin, {
  containers: 'GTM-XXXXXXX',
  router,
  onBeforeInit: (client) => {
    client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
    client.setConsentDefaults(consentPresets.allGranted); // rest of world
  }
});
```

Anywhere in your app, after the user accepts:

```vue
<script setup lang="ts">
import { useGtmConsent } from '@jwiedeman/gtm-kit-vue';

const { updateConsent } = useGtmConsent();

function accept() {
  updateConsent({ analytics_storage: 'granted', ad_storage: 'granted' });
}
</script>
```

## Gotchas

1. **`enabled: false` for tests**: Don't pass `GtmPlugin` in test setup. Export your provider separately so test utilities can mount components without a live GTM client.
2. **`trackOnNextTick`**: `vue-gtm` needed this to wait for `document.title` to update on navigation. GTM Kit defers the page-view push to the next microtask after the router's `afterEach`, so the correct title is always captured. No flag needed.
3. **`dataLayerName`**: If you used `dataLayerName: 'myLayer'` with `vue-gtm`, pass the same option to `GtmPlugin` — your existing tags still reference that array.
4. **Nuxt users**: Don't use this package directly. Use `@jwiedeman/gtm-kit-nuxt` module instead — it handles SSR correctly and registers itself as a Nuxt module.

## Verify

Install the DataLayer Inspector in dev:

```ts
if (import.meta.env.DEV) {
  const { installInspector } = await import('@jwiedeman/gtm-kit/inspector');
  // in a component or a plugin callback:
  installInspector(client);
}
```

Then `__gtmKit.dump()` in DevTools should show your existing tag triggers unchanged.
