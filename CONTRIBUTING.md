# Contributing to GTM-Kit

Thanks for picking this up. This doc covers how to get set up, what the expectations are, and how to ship a change that lands cleanly.

## TL;DR

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm run test       # unit
pnpm run e2e:test   # end-to-end (Playwright)
```

All four must pass before you open a PR.

## Repo layout

- `packages/` — published npm packages (`@jwiedeman/gtm-kit` and per-framework adapters).
- `examples/` — runnable example apps, one per framework. Each ships its own README.
- `e2e/` — Playwright specs and per-app harness servers under `e2e/apps/`.
- `docs/` — VitePress site (`pnpm run docs:dev`).
- `scripts/` — release, verification, and example-scenario scripts.
- `config/` — shared Jest / tsconfig / test base config.

## Prerequisites

- Node.js 20 (the version CI runs on).
- pnpm 8.15.4 (declared in `package.json`'s `packageManager`). If you have `corepack enable` turned on, you'll get the right version automatically.
- Chromium (installed via `pnpm run e2e:install` when running E2E tests).

## Making changes

1. **Fork and branch.** Branch off `main`. Use a descriptive name (`fix/astro-navigation`, `feat/remix-consent-mode`).
2. **Pick one package per PR where possible.** Monorepo-wide changes (tooling, CI, shared config) are fine; mixing unrelated feature work across packages is not.
3. **Write tests.** New behavior → unit test. New cross-framework behavior or UI flow → E2E spec under `e2e/tests/`.
4. **Keep the E-Commerce event standard.** Every example app tracks the same 11 GA4 events in the same order (see `CLAUDE.md`). If you're adding an example or adapter, match that standard.
5. **Follow commit conventions.** Commits are checked by commitlint against `@commitlint/config-conventional`. Examples:
   - `feat(react): add useConsentMode hook`
   - `fix(astro): emit nonce on inline script`
   - `docs(readme): clarify quickstart`
   - `chore(ci): bump playwright to 1.50`
     Commit messages drive `semantic-release` — `feat` bumps minor, `fix` bumps patch, `BREAKING CHANGE:` in the body bumps major.
6. **Update `TODO.md`.** If you close an item, move it to the Done section with the date. If you discover a new issue while working, add it under the appropriate severity.

## Code standards

- TypeScript strict mode. No `any`. Prefer type guards to `as unknown as` casts.
- Every dataLayer interaction must be error-handled — we can't assume the container script loaded.
- Clean up event listeners and subscriptions on unmount/teardown.
- Use framework-idiomatic patterns. Don't try to abstract everything into `packages/core` if the adapter layer is where the ergonomics live.
- No runtime dependencies in the published adapters unless absolutely necessary — `pnpm run verify:runtime-deps` enforces this.
- Keep bundle size in check: `pnpm run size` runs `size-limit` against `size-limit.config.cjs`.

## Running individual test suites

```bash
# Unit tests for one package
pnpm --filter @jwiedeman/gtm-kit test

# Single Playwright spec
pnpm exec playwright test -c e2e/playwright.config.ts e2e/tests/react-csr.spec.ts

# Run E2E with CI behavior locally (skips Nuxt)
CI=true pnpm run e2e:test
```

## Release process

Releases are automated via `semantic-release` on merge to `main`. **Do not** manually bump versions in `package.json` files — workspace packages are pinned at `1.0.0` as source-of-truth, and `scripts/prepare-publish.mjs` rewrites them at publish time using the computed next version.

## Opening a PR

1. Rebase on `main`.
2. Fill out the PR template — don't skip the test plan.
3. CI runs: lint, typecheck, unit tests with coverage, lightweight verification, and full E2E. All must be green.
4. Keep the PR focused. If review surfaces scope creep, split it.

## Reporting bugs / asking questions

- Bugs: use `.github/ISSUE_TEMPLATE/bug_report.md`.
- Feature requests: `.github/ISSUE_TEMPLATE/feature_request.md`.
- Questions / usage help: `.github/ISSUE_TEMPLATE/question.md`.
- Security issues: see `SECURITY.md` — do **not** file a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
