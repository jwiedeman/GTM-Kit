# Migrate from existing GTM implementations

Use this checklist when replacing hand-rolled GTM snippets or third-party wrappers with
React GTM Kit.

> **Swapping a specific library?** See the step-by-step guides:
>
> - [From `react-gtm-module`](./migrations/from-react-gtm-module.md)
> - [From `@next/third-parties/google`](./migrations/from-next-third-parties.md)
> - [From `@gtm-support/vue-gtm`](./migrations/from-vue-gtm.md)

## Audit your current setup

1. Inventory every place GTM initializes. Remove duplicate snippets to avoid multiple
   container loads.
2. Document custom data layer names. React GTM Kit defaults to `dataLayer`, but you can
   reuse an existing name through the `dataLayerName` option.
3. Identify consent integrations and whether they already expose Consent Mode signals.

## Map existing pushes

- Translate inline `dataLayer.push({...})` calls into the `pushEvent` helper or the React
  adapter hooks.
- For ecommerce flows, align event names and parameters with your existing GTM tags to
  prevent regressions.
- If you previously used synchronous script tags, replace them with the asynchronous
  loader provided by the core package.

## Rollout strategy

1. Ship the new library behind a feature flag or staged rollout to monitor metrics.
2. Enable the logger in development environments to confirm initialization happens once
   per page load.
3. Capture before/after data to validate parity in your analytics tools.

## Decommission legacy code

- Remove inline GTM snippets from templates.
- Delete unused utility wrappers once the new adapters cover all entry points.
- Update runbooks and documentation to reference React GTM Kit APIs instead of legacy
  scripts.
