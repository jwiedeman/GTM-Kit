# Migrating from `@next/third-parties/google`

Next.js 14.1 introduced `<GoogleTagManager />` in [`@next/third-parties/google`](https://nextjs.org/docs/app/guides/third-party-libraries#google-tag-manager). It's the path of least resistance for a basic container load, but it has three hard limits:

1. **No consent mode helpers.** You push raw `['consent', 'default', {...}]` arrays and hope.
2. **No pre-init queue.** Events fired during hydration, before the GTM script loads, are lost.
3. **One container only per root.** Multi-container setups need a different approach.

Swap in `@jwiedeman/gtm-kit-next` to unlock consent presets, auto-queueing, typed GA4 events, and the DataLayer Inspector — without changing your GTM container IDs or tags.

## Step 1 — Install

```bash
pnpm remove @next/third-parties
pnpm add @jwiedeman/gtm-kit-next @jwiedeman/gtm-kit-react @jwiedeman/gtm-kit
```

## Step 2 — Replace `<GoogleTagManager />` in `layout.tsx`

**Before:**

```tsx
// app/layout.tsx
import { GoogleTagManager } from '@next/third-parties/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleTagManager gtmId="GTM-XXXXXXX" />
        {children}
      </body>
    </html>
  );
}
```

**After:**

```tsx
// app/layout.tsx
import { GtmHeadScript, GtmNoScript } from '@jwiedeman/gtm-kit-next';
import { AppProviders } from './providers';

const GTM_CONTAINERS = ['GTM-XXXXXXX'] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <GtmHeadScript containers={GTM_CONTAINERS} />
      </head>
      <body>
        <GtmNoScript containers={GTM_CONTAINERS} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

`<GtmHeadScript>` renders the same script tag as `@next/third-parties` but preserves CSP nonces if you pass `scriptAttributes={{ nonce }}`. `<GtmNoScript>` renders the `<noscript>` iframe fallback Google requires for non-JS clients.

## Step 3 — Wire up the React provider

Create `app/providers.tsx` (Client Component):

```tsx
'use client';

import { GtmProvider } from '@jwiedeman/gtm-kit-react';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <GtmProvider config={{ containers: ['GTM-XXXXXXX'] }}>{children}</GtmProvider>;
}
```

The provider attaches to the script already in the document (the `<GtmHeadScript>` you rendered in step 2) — no second request.

## Step 4 — Replace `sendGTMEvent({...})` with hooks

**Before:**

```tsx
import { sendGTMEvent } from '@next/third-parties/google';

<button onClick={() => sendGTMEvent({ event: 'buttonClicked', value: 'xyz' })}>
```

**After:**

```tsx
'use client';
import { useGtmPush } from '@jwiedeman/gtm-kit-react';

const push = useGtmPush();
<button onClick={() => push({ event: 'buttonClicked', value: 'xyz' })}>
```

## Step 5 — Track page views on route changes

`@next/third-parties` does **not** automatically fire `page_view` events on client-side route transitions — you must do it yourself. GTM Kit ships a hook:

```tsx
'use client';
import { useTrackPageViews } from '@jwiedeman/gtm-kit-next';
import { useGtmClient } from '@jwiedeman/gtm-kit-react';
import { pushEvent } from '@jwiedeman/gtm-kit';

export function GtmBridge() {
  const client = useGtmClient();
  useTrackPageViews({
    client,
    buildPayload: ({ pagePath, url, title }) => ({
      page_path: pagePath,
      page_location: url,
      page_title: title
    }),
    pushEventFn: pushEvent,
    includeSearchParams: true
  });
  return null;
}
```

Mount `<GtmBridge />` once inside your `<GtmProvider>`.

## Bonus — consent mode

`@next/third-parties` has no primitives for this. With GTM Kit, pass an `onBeforeInit` to your provider:

```tsx
<GtmProvider
  config={{ containers: ['GTM-XXXXXXX'] }}
  onBeforeInit={(client) => {
    client.setConsentDefaults(consentPresets.eeaDefault, { region: ['EEA'] });
    client.setConsentDefaults(consentPresets.allGranted);
  }}
>
```

Later, when the user interacts with your CMP:

```tsx
const { updateConsent } = useGtmConsent();
updateConsent({ analytics_storage: 'granted' });
```

## What you gain

| Capability                            | `@next/third-parties` | GTM Kit             |
| ------------------------------------- | --------------------- | ------------------- |
| Script injection in `<head>`          | ✓                     | ✓                   |
| `<noscript>` fallback                 | Not generated         | `<GtmNoScript>`     |
| Event helper                          | `sendGTMEvent`        | `useGtmPush`        |
| Route-change page views               | Manual                | `useTrackPageViews` |
| Consent Mode v2 presets               | ✗                     | ✓                   |
| Auto-queue (pre-init events buffered) | ✗                     | ✓                   |
| Multiple containers per app           | ✗                     | ✓                   |
| CSP nonce on script + iframe          | Partial               | ✓                   |
| Typed GA4 ecommerce events            | ✗                     | ✓                   |
| DevTools inspector                    | ✗                     | `window.__gtmKit`   |

## Gotchas

1. **Don't render both `<GoogleTagManager>` and `<GtmHeadScript>`** during the migration — you'll double-load the container and every event will fire twice.
2. **Keep the same `gtmId`**: all your existing tags, triggers, and variables in GTM continue working — nothing to migrate on the container side.
3. **Client Components**: Hooks (`useGtmPush`, `useGtmConsent`) must be called inside files marked `'use client'`. The `<GtmHeadScript>` / `<GtmNoScript>` components are Server Components and live in `layout.tsx` without any `'use client'` directive.
