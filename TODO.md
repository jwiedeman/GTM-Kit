# GTM-Kit TODO

Canonical task tracker for this repo. **Never delete items — move them between sections.** Keep statuses honest. When you finish something, move it to "Done" with a date.

## In Progress

_(nothing right now)_

## Todo — Critical

- **Wire Codecov upload** — `CODECOV_TOKEN` secret is not set in GitHub repo settings, so `codecov/codecov-action@v6` in `.github/workflows/ci.yml` silently skips. This is why the README badge reads "unknown." See _Codecov setup_ below.

## Todo — Should-fix

- **`packages/next` should split server vs client entries** — The package mixes Server Components (`GtmHeadScript`, `GtmNoScript`) with client APIs (`useTrackPageViews`, `GtmErrorBoundary`) in a single bundled entry. A proper `./client` subpath export would let consumers and tooling distinguish them. Current friction: `examples/next-app/next.config.mjs` aliases the package to its src dir, so any split has to keep working under that alias too. Skipped in this round; the previous broken `'use client'` banner has been removed.

## Todo — Nice-to-have

- **Enrich example-app READMEs** — most are 22-37 line stubs; `examples/nuxt-app/README.md` (238 lines) is the template to match.
- **Nuxt CI coverage** — Nuxt is skipped in CI due to `oxc-parser` native binding. Revisit with newer Nuxt versions; currently gated via `CI=true` in `e2e/playwright.config.ts:12` and `--filter '!@gtm-kit/example-nuxt-app'` in `.github/workflows/*.yml`.

## Done

- **2026-04-15** — **E2E now 98/98, zero flakes.** Root cause: every framework-example test file calls `spawnSync('pnpm', ['--filter', ..., 'build'])` in `beforeAll`, writing into a single shared `examples/<app>/dist` (or `build`) directory. With Playwright `fullyParallel: true` + `workers: 2` on CI, two workers would occasionally both pick up the same framework's tests and race each other's builds — producing transient "Failed to build" errors on svelte, nuxt, and (previously fixed) astro. Applied `test.describe.configure({ mode: 'serial' })` to all eight framework example specs. Tests within a describe now pin to a single worker, while distinct frameworks still run in parallel across workers.
- **2026-04-15** — Round 3, adoption investments:
  - **DataLayer Inspector** (`@jwiedeman/gtm-kit/inspector` subpath). Ships a `window.__gtmKit` helper with `dump()`, `status()`, `watch()`, `filter()`, `uninstall()`. Tree-shakeable — 1.03 KB gzipped, zero dependencies, not pulled in by main entry. 11 unit tests; wired as a dev-only async chunk in `examples/react-strict-mode/src/main.tsx`. Size-limit budget enforced in CI at 2 KB.
  - **Competitor migration guides** under `docs/how-to/migrations/`: `from-react-gtm-module.md`, `from-next-third-parties.md`, `from-vue-gtm.md` — each with concrete before/after snippets, feature-comparison tables, and gotchas. Cross-linked from the existing `docs/how-to/migration.md`.
  - Root README and `packages/core/README.md` both gained a Inspector section; main README's DX table now advertises it.
  - Added `"@jwiedeman/gtm-kit/inspector"` path alias to `tsconfig.base.json` so example apps resolve the subpath during development builds (mirrors the published-package alias pattern).
- **2026-04-15** — Round 2 cleanup:
  - Reset `packages/astro/package.json` version `1.3.1` → `1.0.0` (semantic-release writes the real version at publish time; matches every other workspace package).
  - Swapped deprecated `page.waitForSelector` for `locator.waitFor` in `e2e/tests/checkout-flow.spec.ts:128` (also removed the duplicated locator declaration).
  - Wired `eslint-config-next` in `examples/next-app/.eslintrc.json`; `next lint` now reports clean.
  - Removed unused `normalizeContainer` re-export in `packages/next/src/internal/container-helpers.ts` (silenced an esbuild warning).
  - Removed the dead `'use client'` banner from `packages/next/tsup.config.ts` — esbuild stripped it during bundling so it was a no-op that produced two warnings on every build.
  - Hardened consent-defaults timing in `examples/react-strict-mode` and `examples/fullstack-web`: moved `setConsentDefaults` from a child `useEffect` into `GtmProvider`'s `onBeforeInit` hook (mirrors the next-app fix from earlier in the day; defends against the same throw if Suspense is ever introduced between provider and consumer).
- **2026-04-15** — Greened the E2E badge. Four root causes:
  1. **Astro race** — `fullyParallel: true` + `workers: 2` split astro-app's 7 tests across 2 workers; each ran `pnpm --filter astro-app build` into the same `dist/`, racing `renderers.mjs`. Fixed via `test.describe.configure({ mode: 'serial' })` in `e2e/tests/astro-app.spec.ts`.
  2. **next-app `body > noscript` missing** — React 18 strips `<noscript>` from the DOM after hydration in App Router. Switched to verifying noscript in the SSR HTML response (`page.request.get`).
  3. **next-app dataLayer empty** — `gtm-bridge.tsx` called `setConsentDefaults` from a `useEffect` AFTER `GtmProvider` had already auto-init'd the client; the security-hardening commit (e1140d3) made this throw. Moved consent-defaults call into `GtmProvider`'s `onBeforeInit` hook.
  4. **ssr-csp `toHaveAttribute('nonce', '')`** — Chromium hides the `nonce` content attribute under CSP (returns `null`, not `""`); the IDL `.nonce` property is preserved. Removed the broken attribute assertion; the bootstrap-driven `data-gtm-nonce-prop` body attr already verifies the IDL prop is intact.
- **2026-04-14** — Created this file. CLAUDE.md had mandated `/TODO.md` but it didn't exist.
- **2026-04-14** — Added `LICENSE` at repo root (package.json declared MIT with no file backing it).
- **2026-04-14** — Added `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/pull_request_template.md`.

## Codecov setup

Owner action required (can't be done from a PR):

1. Go to <https://codecov.io>, sign in with GitHub, add `jwiedeman/GTM-Kit`.
2. Copy the upload token from the Codecov project settings.
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `CODECOV_TOKEN`
   - Value: _(paste the token)_
4. Re-run the latest CI workflow (or push a commit). The badge will flip from "unknown" to the coverage percentage after the first successful upload from `main`.

The upload step at `.github/workflows/ci.yml:66-83` is already correctly wired and gated on the secret being present, so no workflow changes are needed.
