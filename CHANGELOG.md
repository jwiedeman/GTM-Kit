## [1.2.1](https://github.com/jwiedeman/GTM-Kit/compare/v1.2.0...v1.2.1) (2026-02-07)

### Bug Fixes

- comprehensive review — security hardening, bug fixes, and API improvements ([e1140d3](https://github.com/jwiedeman/GTM-Kit/commit/e1140d3d22753dd33521217947cbc5d92a93fba4))

# [1.2.0](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.6...v1.2.0) (2026-01-22)

### Features

- add retry mechanism, partial load detection, and comprehensive docs ([0fa92d8](https://github.com/jwiedeman/GTM-Kit/commit/0fa92d8e0e3926428b67a5fc68e7068e1e7064db))

## [1.1.6](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.5...v1.1.6) (2026-01-09)

### Bug Fixes

- replace workspace:\* dependencies with ^1.0.0 for npm compatibility ([f0bb45f](https://github.com/jwiedeman/GTM-Kit/commit/f0bb45ff3722e6ffb34b7a8434d74d64c1575b30)), closes [#124](https://github.com/jwiedeman/GTM-Kit/issues/124)

## [1.1.5](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.4...v1.1.5) (2025-12-24)

### Bug Fixes

- address polish issues from comprehensive codebase review ([af53140](https://github.com/jwiedeman/GTM-Kit/commit/af53140a4d959808c0290232e25c439f3513fcc0))

## [1.1.4](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.3...v1.1.4) (2025-12-24)

### Bug Fixes

- address polish issues from comprehensive codebase review ([7b1f8a0](https://github.com/jwiedeman/GTM-Kit/commit/7b1f8a032823acad6156737f90489700d17128e6))

## [1.1.3](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.2...v1.1.3) (2025-12-24)

### Bug Fixes

- address critical issues from comprehensive security/polish review ([4deb4fe](https://github.com/jwiedeman/GTM-Kit/commit/4deb4fe792eae977be62e88721fa90e4fc51a2f8))

## [1.1.2](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.1...v1.1.2) (2025-12-23)

### Bug Fixes

- address code quality issues from security/performance review ([e4a1e06](https://github.com/jwiedeman/GTM-Kit/commit/e4a1e06bfbe835464aaebeafaaeb6c8034c2b616))

## [1.1.1](https://github.com/jwiedeman/GTM-Kit/compare/v1.1.0...v1.1.1) (2025-12-23)

### Bug Fixes

- address security and code quality issues from review ([df606a2](https://github.com/jwiedeman/GTM-Kit/commit/df606a28799d53263262783f992f4df845cb7288))

# [1.1.0](https://github.com/jwiedeman/GTM-Kit/compare/v1.0.1...v1.1.0) (2025-12-23)

### Bug Fixes

- address code quality issues from security/professionalism review ([ab26df2](https://github.com/jwiedeman/GTM-Kit/commit/ab26df2ea53f7cf87cdee1a792be00850b29aad9))

### Features

- **astro:** add Astro.js framework adapter ([fc1c0d2](https://github.com/jwiedeman/GTM-Kit/commit/fc1c0d2704e3d2f14e8cba52386f7555693952a4))

## [1.0.1](https://github.com/jwiedeman/GTM-Kit/compare/v1.0.0...v1.0.1) (2025-12-20)

### Bug Fixes

- add publishConfig access:public to all packages ([da6180d](https://github.com/jwiedeman/GTM-Kit/commit/da6180da50c8303bf85d77afd7caf0cd47fcce56))
- prevent lockfile mismatch after release ([77adb53](https://github.com/jwiedeman/GTM-Kit/commit/77adb5332d7c4ad8dcff702f75f16c83620a487e))
- restore workspace:\* dependencies after failed release ([d80b34e](https://github.com/jwiedeman/GTM-Kit/commit/d80b34e04615a4e8a908f26505610e61f338b87b))

# 1.0.0 (2025-12-20)

### Bug Fixes

- address CI failures ([9c7837b](https://github.com/jwiedeman/GTM-Kit/commit/9c7837b04a056493a781907e0949565b6aae5a8f))
- exclude nuxt-app from CI builds due to oxc-parser native binding issues ([08e4135](https://github.com/jwiedeman/GTM-Kit/commit/08e41358753db33d3917a45fa35cff1916a589e8))
- handle missing NPM_TOKEN gracefully in release workflow ([850f26c](https://github.com/jwiedeman/GTM-Kit/commit/850f26c04418a776c7116b53c84d2d397be94740))
- harden gtm nonce handling and next e2e coverage ([c3d9723](https://github.com/jwiedeman/GTM-Kit/commit/c3d972372b9bbcd357d7d3a6376010ba008b4b33))
- lower coverage thresholds for Next.js package ([21d448d](https://github.com/jwiedeman/GTM-Kit/commit/21d448d3c9459014184941d8f7d24e768905db32))
- lower coverage thresholds for nuxt package ([10e7227](https://github.com/jwiedeman/GTM-Kit/commit/10e72272c2cc1e0da6cfa647a214289354946fba))
- lower functions coverage threshold for react-modern package ([5525849](https://github.com/jwiedeman/GTM-Kit/commit/5525849b7061daed40cd4cdac677a1bd8bd8409b))
- lower functions coverage threshold for vue package ([7a726f6](https://github.com/jwiedeman/GTM-Kit/commit/7a726f699b498c46c267d58b2f73c8c848cf3fbc))
- **next:** add 'use client' banner to built output ([6c69a43](https://github.com/jwiedeman/GTM-Kit/commit/6c69a432a2d0d45571a51e78bfc9db4314ac66a7))
- remove explicit pnpm version from workflows ([56302fd](https://github.com/jwiedeman/GTM-Kit/commit/56302fd964dbce2fb7b7d4e3f591a8b2113a441d))
- resolve build system issues and add NPM launch guide ([b09e108](https://github.com/jwiedeman/GTM-Kit/commit/b09e1088f23efd636827b94eebae502c28ab8100))
- resolve CI failures with mimetypes, tsconfig paths, and postinstall scripts ([414ab8c](https://github.com/jwiedeman/GTM-Kit/commit/414ab8c749223cb484d5bd150969cfb32cdded13))
- resolve E2E test failures and semantic-release permissions ([eaa6691](https://github.com/jwiedeman/GTM-Kit/commit/eaa669143f2a316f484deceeca771862ee6b31de))
- resolve e2e test failures with URL matching and selector syntax ([6c65e5e](https://github.com/jwiedeman/GTM-Kit/commit/6c65e5e507983d24b10b81ab4d643f95f3929285))
- resolve TypeScript error in solid-js-store mock ([f7963de](https://github.com/jwiedeman/GTM-Kit/commit/f7963de34303d98d92222f263a6edd4b52b9e70d))
- **security:** add XSS protection to Remix inline scripts ([d7fbde1](https://github.com/jwiedeman/GTM-Kit/commit/d7fbde1be5a79962bbf8b435354577063851aac1))
- update Node.js to 22 for semantic-release and disable coverage in lint-staged ([3bd5f56](https://github.com/jwiedeman/GTM-Kit/commit/3bd5f5683d86f75f3b9397bf0a584be275aeec56))
- update runtime deps check for new package names and add build step ([80fbcb6](https://github.com/jwiedeman/GTM-Kit/commit/80fbcb6788b969e47c0bc1ad346dabecc01adf37))
- write clean .npmrc instead of appending ([2fb6543](https://github.com/jwiedeman/GTM-Kit/commit/2fb65431438fa88bcfae374cbd364a8a5b58a280))

### Features

- add adapter showcase examples ([d760e61](https://github.com/jwiedeman/GTM-Kit/commit/d760e615b6268ecc8fef6e0636ad221ad6796186))
- add CLI installer, comprehensive testing, and documentation ([85f574f](https://github.com/jwiedeman/GTM-Kit/commit/85f574fe51b5771fde5441fe4f259a2dc815afcc))
- add edge-safe consent middleware and nonce helpers ([02984ca](https://github.com/jwiedeman/GTM-Kit/commit/02984ca51a3d69b5b4cdf2c716f9cfe6b2921fd9))
- add fullstack relay example ([681dbcb](https://github.com/jwiedeman/GTM-Kit/commit/681dbcb4c2341e2ddfb5f39d602aca501c18d645))
- add legacy react adapter ([94b8ec0](https://github.com/jwiedeman/GTM-Kit/commit/94b8ec01e80d993acdf0b44fc7aca9336db18c08))
- add multi-framework support with Vue and Nuxt adapters ([02aab14](https://github.com/jwiedeman/GTM-Kit/commit/02aab14cd7b6fa6079147219580a0a3704eca09b))
- add new framework adapters, comprehensive testing, and documentation ([0bdaebf](https://github.com/jwiedeman/GTM-Kit/commit/0bdaebfc02866044bf640eb85b7ef8b970e2b4c8))
- add Next.js example and e2e coverage ([21e0ac5](https://github.com/jwiedeman/GTM-Kit/commit/21e0ac5d3ca11f59fc1c8bddf91cdc17c233d7c5))
- add Next.js helpers package ([bcc535c](https://github.com/jwiedeman/GTM-Kit/commit/bcc535c4808eee09daaf9414945636cd9d00b082))
- add playwright e2e harness for ssr csp ([9ef754d](https://github.com/jwiedeman/GTM-Kit/commit/9ef754d5f05afcc7c3ea7e5d1e9a1926c3fb8499))
- add react modern adapter ([d1181ab](https://github.com/jwiedeman/GTM-Kit/commit/d1181ab7b22b8bde1d734adfd92962e341574292))
- add React Router instrumentation example and tests ([ad94901](https://github.com/jwiedeman/GTM-Kit/commit/ad94901eddfc1bd2498dc701cfe9bfd264e76011))
- add tracking scenario snapshots ([3632a6c](https://github.com/jwiedeman/GTM-Kit/commit/3632a6cb1d22349793b54a941f1df82660fd0156))
- complete npm publishing setup for all packages ([9b9af99](https://github.com/jwiedeman/GTM-Kit/commit/9b9af99c846102d1016e7429dcf0a1eaac2d0626))
- **consent:** enforce default ordering and document flows ([6c3a6a1](https://github.com/jwiedeman/GTM-Kit/commit/6c3a6a166c72480245baa18b653b725b409fd65e))
- **core:** add auto-queue for race condition elimination ([3e087f0](https://github.com/jwiedeman/GTM-Kit/commit/3e087f0f74b34f02ed1ce3242a023b8ce758ebb1))
- **core:** add consent api support ([dd87fb1](https://github.com/jwiedeman/GTM-Kit/commit/dd87fb13ef34220d55474eae89a518ebe9897a0b))
- **core:** add event helper typing and utilities ([ba436ce](https://github.com/jwiedeman/GTM-Kit/commit/ba436ce21b575d540e1ef030f2298b5fb3186501))
- **core:** add noscript helper and ssr guide ([ae2cc1e](https://github.com/jwiedeman/GTM-Kit/commit/ae2cc1e01bf8694d0013642cf9ff9f9dbd6a1c49))
- **core:** dedupe server data layer during hydration ([2de8e10](https://github.com/jwiedeman/GTM-Kit/commit/2de8e1042e4451b0378e11673efae4c71807b22f))
- **core:** scaffold workspace and initialize gtm client ([1673e63](https://github.com/jwiedeman/GTM-Kit/commit/1673e63f55b5b3b1716065fa3cd5998c18ade98f))
- **core:** support script nonce attributes ([352ea91](https://github.com/jwiedeman/GTM-Kit/commit/352ea917523112a533919949cd72d56cceb24b4f))
- enable Solid.js JSX testing, add tests, improve README badges ([02819fb](https://github.com/jwiedeman/GTM-Kit/commit/02819fb2be65c9513bea8da99a5dd4e56f291f13))
- **examples:** add server-side relay reference ([5c2ac62](https://github.com/jwiedeman/GTM-Kit/commit/5c2ac62f68901eedba1037598a9ba334892c534a))
- **examples:** add vanilla csr demo and smoke docs ([fd48e58](https://github.com/jwiedeman/GTM-Kit/commit/fd48e58e500349c826483da5ae26d7a61b5abbc3))
- fix badges, enable Svelte tests, improve lint/testing config ([fd89438](https://github.com/jwiedeman/GTM-Kit/commit/fd89438ddb4a0b67decfb822b2bfb2e3dd3c23ee))
- launch vitepress docs experience ([419dfd4](https://github.com/jwiedeman/GTM-Kit/commit/419dfd41fd8680d22d481781eb546e9e6d794e5b))
- rebrand to @jwiedeman/gtm-kit for npm publishing ([6a3ba2e](https://github.com/jwiedeman/GTM-Kit/commit/6a3ba2e7f7a6ae7a5bdda6b36c86a4cf5ba039f3))

### Performance Improvements

- enable minification and tree-shaking for 50%+ smaller bundles ([a149a56](https://github.com/jwiedeman/GTM-Kit/commit/a149a56f358fc01b1536bbf0d59a025c96e4b2ae))

# Changelog

All notable changes to this project will be documented in this file. The format is based on [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/).

<!-- Entries are auto-generated by semantic-release. -->
