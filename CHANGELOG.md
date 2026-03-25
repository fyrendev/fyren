# Changelog

## [0.3.0](https://github.com/fyrendev/fyren/compare/v0.2.0...v0.3.0) (2026-03-25)


### Features

* add notification event toggles to webhook form ([#48](https://github.com/fyrendev/fyren/issues/48)) ([54e01a0](https://github.com/fyrendev/fyren/commit/54e01a027fcf46a753f0aa7409842da5525d210e))
* send webhook notifications on monitor-detected status changes ([#47](https://github.com/fyrendev/fyren/issues/47)) ([4f2836f](https://github.com/fyrendev/fyren/commit/4f2836f2c5d92e7de23741031840778e1d6b2e37))


### Bug Fixes

* apply rate limiting to subscribe endpoint ([#46](https://github.com/fyrendev/fyren/issues/46)) ([9ea0aa8](https://github.com/fyrendev/fyren/commit/9ea0aa8bca39fdbe7d5414e2a2f475b642681e0d))
* clear organization cache in email provider tests ([#49](https://github.com/fyrendev/fyren/issues/49)) ([7594c18](https://github.com/fyrendev/fyren/commit/7594c18f77a75fb8576b290ac7be2f557423f076))
* Remove custom domain setting ([#44](https://github.com/fyrendev/fyren/issues/44)) ([2141f03](https://github.com/fyrendev/fyren/commit/2141f03a8a01473319ecb1a7430b1e19f02c56e1))

## [0.2.0](https://github.com/fyrendev/fyren/compare/v0.1.5...v0.2.0) (2026-03-25)


### Features

* add structured logging for worker failures and DB logger config ([#33](https://github.com/fyrendev/fyren/issues/33)) ([33b4ee2](https://github.com/fyrendev/fyren/commit/33b4ee29b6d01fd98467b3966a8f5bc7406347e2))
* add structured logging to health check checkers ([#34](https://github.com/fyrendev/fyren/issues/34)) ([d95c7f2](https://github.com/fyrendev/fyren/commit/d95c7f27d409129d99997ec4b77e4dd4c3b402e0))
* display app version in sidebar and footer ([#31](https://github.com/fyrendev/fyren/issues/31)) ([1efd00b](https://github.com/fyrendev/fyren/commit/1efd00bd7ae021b6591b01c00cd45e7eb386e965))
* expose faviconUrl in public API and use as dynamic favicon ([#36](https://github.com/fyrendev/fyren/issues/36)) ([b02491f](https://github.com/fyrendev/fyren/commit/b02491fb772f855b58d5068e880c30b3477e4ae3))
* replace timezone text input with searchable select ([#38](https://github.com/fyrendev/fyren/issues/38)) ([ffbed0d](https://github.com/fyrendev/fyren/commit/ffbed0d16d3ace7ece813c50b52fd1b682065cd4))
* **web:** replace inline alerts with sonner toasts + ConfirmDialog ([#39](https://github.com/fyrendev/fyren/issues/39)) ([3f76d6b](https://github.com/fyrendev/fyren/commit/3f76d6b205e438c688ba04eab2fbf5066da26432))


### Bug Fixes

* add inline styles to email buttons for client compatibility ([#40](https://github.com/fyrendev/fyren/issues/40)) ([087a311](https://github.com/fyrendev/fyren/commit/087a311bab1f1ef7ac032fb19109cf7a842e954e))
* allow componentId to be updated when editing a monitor ([#35](https://github.com/fyrendev/fyren/issues/35)) ([62c0c88](https://github.com/fyrendev/fyren/commit/62c0c88310e6e47250575b463fcadbeabfd08a0f))
* API security hardening ([#42](https://github.com/fyrendev/fyren/issues/42)) ([b62ec5d](https://github.com/fyrendev/fyren/commit/b62ec5dc4b5c818279f6d0470bd3b10455d4193e))
* restrict signups to invited users and redirect to signup page ([#41](https://github.com/fyrendev/fyren/issues/41)) ([17f03cc](https://github.com/fyrendev/fyren/commit/17f03ccb387aaf9c58e01288dd1793f4369d22aa))


### Code Refactoring

* remove slug field from Organization ([#37](https://github.com/fyrendev/fyren/issues/37)) ([147c5ad](https://github.com/fyrendev/fyren/commit/147c5ad3ccabfb229f32f63b5f0ac6f5a8bd00b7))

## [0.1.5](https://github.com/fyrendev/fyren/compare/v0.1.4...v0.1.5) (2026-03-05)


### Bug Fixes

* copy bun.lock into Docker builder stage ([#28](https://github.com/fyrendev/fyren/issues/28)) ([56068e9](https://github.com/fyrendev/fyren/commit/56068e9c66e189e6bc5761b7b2a2bfc9bdf85cdb))
* use runtime env var for SSR API requests in Docker ([#30](https://github.com/fyrendev/fyren/issues/30)) ([19c2e11](https://github.com/fyrendev/fyren/commit/19c2e111ff21752594163d5d884c333a9044dfdd))

## [0.1.4](https://github.com/fyrendev/fyren/compare/v0.1.3...v0.1.4) (2026-03-04)


### Bug Fixes

* make BETTER_AUTH_SECRET optional so worker can start ([#25](https://github.com/fyrendev/fyren/issues/25)) ([2b15f19](https://github.com/fyrendev/fyren/commit/2b15f1911afc4f4fb3b2f6467523fb67dae436ab))


### Code Refactoring

* split env config into base/api/worker modules ([#27](https://github.com/fyrendev/fyren/issues/27)) ([13b4e14](https://github.com/fyrendev/fyren/commit/13b4e1495578fa5a85ca0a7a76bdc0c4c76bb7d5))

## [0.1.3](https://github.com/fyrendev/fyren/compare/v0.1.2...v0.1.3) (2026-03-04)


### Bug Fixes

* release flow fix ([#23](https://github.com/fyrendev/fyren/issues/23)) ([c8cde38](https://github.com/fyrendev/fyren/commit/c8cde389b56c2c250aff4165cb76d6f10c945ce8))

## [0.1.2](https://github.com/fyrendev/fyren/compare/v0.1.1...v0.1.2) (2026-03-03)


### Bug Fixes

* update install script ([#21](https://github.com/fyrendev/fyren/issues/21)) ([acd4f08](https://github.com/fyrendev/fyren/commit/acd4f080ad019373c4f437580ebbfe82d1d3ad5c))

## [0.1.1](https://github.com/fyrendev/fyren/compare/v0.1.0...v0.1.1) (2026-03-03)


### Documentation

* add fyren.dev links to README ([22804ba](https://github.com/fyrendev/fyren/commit/22804ba8b5088267e8dbaf845d13be1b23aad3bc))
