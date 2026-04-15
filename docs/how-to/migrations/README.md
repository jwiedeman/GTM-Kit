# Migrating from other GTM libraries

Concrete, step-by-step guides for swapping the most common alternatives with GTM Kit. Every guide preserves your GTM container IDs and tags — you're only replacing the client-side JavaScript wrapper.

| From                         | Guide                                                        | Why switch                                                    |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `react-gtm-module`           | [`from-react-gtm-module.md`](./from-react-gtm-module.md)     | SSR support, Consent Mode v2, TypeScript, StrictMode          |
| `@next/third-parties/google` | [`from-next-third-parties.md`](./from-next-third-parties.md) | Auto-queue, consent, route-change page views, multi-container |
| `@gtm-support/vue-gtm`       | [`from-vue-gtm.md`](./from-vue-gtm.md)                       | Consent Mode v2, typed events, multi-container                |

Coming from something else? Most wrappers expose only two primitives: `init(containerId)` and `push(event)`. Map them to:

- `init` → `createGtmClient({ containers }).init()` (or a framework adapter's provider)
- `push` → `client.push(value)` or `pushEvent(client, name, payload)`

If you hit a snag, open an issue with your current library name and a code snippet — the migration docs are maintained based on real questions.
