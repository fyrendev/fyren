# Changelog

## [0.1.0](https://github.com/fyrendev/fyren/compare/v0.0.1...v0.1.0) (2026-03-03)


### Features

* add comprehensive theme customization for status pages ([d186f1c](https://github.com/fyrendev/fyren/commit/d186f1c444debcbd46d88c97f9f0df67bb348e86))
* add Coolify-specific docker compose configuration ([90d0b46](https://github.com/fyrendev/fyren/commit/90d0b46b08dcc4d5d87f4f077f6b6f87c4df3449))
* add dev:all script to run all services ([361b44c](https://github.com/fyrendev/fyren/commit/361b44c37de82dd12c5e49c12802ac9792e47bd6))
* add E2E test infrastructure using Playwright ([873c51a](https://github.com/fyrendev/fyren/commit/873c51a6d04b41849ae5479bbd795fa6fa9d6a5e))
* add embeddable status widget and integrations page ([#14](https://github.com/fyrendev/fyren/issues/14)) ([7853e99](https://github.com/fyrendev/fyren/commit/7853e990baa3f64eebabd56975449dbf0600741f))
* add frontend-configurable logging settings ([#3](https://github.com/fyrendev/fyren/issues/3)) ([46e91d9](https://github.com/fyrendev/fyren/commit/46e91d9ce7a379b0c978a1602ae9f47492e1c823))
* add GitHub Actions workflow for Docker image publishing ([504815a](https://github.com/fyrendev/fyren/commit/504815a6dd02dca474cf55c85e9f7745eaa4127f))
* add NATS connection checker for monitor uptime ([#8](https://github.com/fyrendev/fyren/issues/8)) ([7384b0e](https://github.com/fyrendev/fyren/commit/7384b0e93d6d6b14c7098f2c66f4fe6f2c0764b0))
* add separate Dockerfile for worker process ([ccd3c33](https://github.com/fyrendev/fyren/commit/ccd3c336af5aae335aaea95589c4d056a6ed1c55))
* add separate test database for E2E and integration tests ([d88cdf4](https://github.com/fyrendev/fyren/commit/d88cdf431c332f1a62ca9ecae8c70b32b736ed8a))
* add subscriber groups for company-based notification filtering ([8c0a60f](https://github.com/fyrendev/fyren/commit/8c0a60f404d7875a55dbe8ab650c1312fe022ff0))
* add test infrastructure for API ([4fff836](https://github.com/fyrendev/fyren/commit/4fff836f94b90b58f459ee9bc4596208498c32ac))
* add worker container and automatic migrations for production ([685d598](https://github.com/fyrendev/fyren/commit/685d598261422e7b5f61298ec747838c4cf64bad))
* change to single-tenant routing with setup wizard ([fcad20b](https://github.com/fyrendev/fyren/commit/fcad20b81f274e7684a873ebe56bc4c4c6803607))
* change to single-tenant routing with setup wizard ([008b008](https://github.com/fyrendev/fyren/commit/008b008cdf4098fee41e745e0e6c03318ce96aa5))
* implement email provider configuration and testing functionality ([b8832b8](https://github.com/fyrendev/fyren/commit/b8832b83ffe8c4e16fc0080167541c495e729472))
* implement Phase 4 public status page ([b4991c5](https://github.com/fyrendev/fyren/commit/b4991c56a7524431f71031ac2adc19b3d0f2e90f))
* implement Phase 5 incident management ([a0d6d45](https://github.com/fyrendev/fyren/commit/a0d6d458454da6f180b59bff709f40a989ee4c7d))
* implement Phase 6 maintenance windows ([a5b6902](https://github.com/fyrendev/fyren/commit/a5b6902ee397c8707c780818e65aa87fbdb693d7))
* implement Phase 7 notifications ([aa0cd74](https://github.com/fyrendev/fyren/commit/aa0cd74627704d9620032974b8c4438e82ef8027))
* implement Phase 8 admin dashboard ([b2a51db](https://github.com/fyrendev/fyren/commit/b2a51dbf794ed65eb8c83a7a3573a37cf2159764))
* implement Phase 9 - polish and launch prep ([dbdcdc3](https://github.com/fyrendev/fyren/commit/dbdcdc3903a45fd1273906eaf324299796230102))
* send invite email when creating team member invite ([#17](https://github.com/fyrendev/fyren/issues/17)) ([293c502](https://github.com/fyrendev/fyren/commit/293c50294f7d22af2b7c3a28eded76f0878d0917))


### Bug Fixes

* add cross-subdomain cookie support for Better Auth ([9ad2953](https://github.com/fyrendev/fyren/commit/9ad2953b297709ab77007030482f90f15fda51cf))
* add explicit Traefik service bindings and fix router priorities ([fc2e2c6](https://github.com/fyrendev/fyren/commit/fc2e2c672026248d07597759bd1b87b18805c1f8))
* add logging for failed API requests in errorResponse ([ca843c3](https://github.com/fyrendev/fyren/commit/ca843c33a80d9bf5541bf597b22519fde0e5cb49))
* add migration for color fields and update E2E tests ([5055e50](https://github.com/fyrendev/fyren/commit/5055e5035fda8f2327a62b18038130f7fe9287dc))
* add timestamp cast to SQL date comparisons in uptime history endpoint ([#4](https://github.com/fyrendev/fyren/issues/4)) ([7dd2ba8](https://github.com/fyrendev/fyren/commit/7dd2ba88efef8ce77c972b9470c954ee6286be6d))
* cleanup ([1a1c446](https://github.com/fyrendev/fyren/commit/1a1c446222f11a76a350780adef2df35629812c1))
* correct APP_URL port to 3000 in .env.example ([2c339f3](https://github.com/fyrendev/fyren/commit/2c339f3b5de6edaff79b002dbe3ab1a7db9c53c5))
* correct migration path for development environment ([98d5255](https://github.com/fyrendev/fyren/commit/98d525585d3b01eda9b4012955fee5682b79fd58))
* correct organization API routes and settings page layout ([b68e633](https://github.com/fyrendev/fyren/commit/b68e63341ac9c5b58760b63d2e339daeab0a62c8))
* correct team API routes and BullMQ job IDs ([c9683a6](https://github.com/fyrendev/fyren/commit/c9683a61f653897c4964e1c430a20ec2146a5717))
* disable Redis persistence to test fresh start ([d3d6bef](https://github.com/fyrendev/fyren/commit/d3d6bef8dded6d999ddf75a916fda127ad533634))
* handle __Secure- prefixed BetterAuth session cookies ([#13](https://github.com/fyrendev/fyren/issues/13)) ([07bbc9e](https://github.com/fyrendev/fyren/commit/07bbc9e4b085fdf185dea89de583aa343a10742c))
* hardcode domain in Traefik labels for Coolify ([1694499](https://github.com/fyrendev/fyren/commit/1694499a257cef4fa2a530477acda18c545f2c3c))
* improve Redis auth in Coolify compose ([9e9504a](https://github.com/fyrendev/fyren/commit/9e9504a313275c861f66d9a21ad8ded45d5e690f))
* improve subscriber email flow and protect test database ([#15](https://github.com/fyrendev/fyren/issues/15)) ([f21045d](https://github.com/fyrendev/fyren/commit/f21045db95b3b0d13d2cc4ab25174c717511bb43))
* increase Traefik router priorities to override Coolify auto-generated routers ([00c97ad](https://github.com/fyrendev/fyren/commit/00c97ade0acea1e25863921337299ea45f3612d9))
* mark status pages as dynamic to prevent static generation ([06abf84](https://github.com/fyrendev/fyren/commit/06abf842ae41ae1127a072031bdd600b80a31871))
* move docker-compose.prod.yml to root for Coolify compatibility ([1382525](https://github.com/fyrendev/fyren/commit/138252526a3698d232ee92cf8b4345d65236c374))
* only enable cross-subdomain cookies when COOKIE_DOMAIN is set ([c1f942f](https://github.com/fyrendev/fyren/commit/c1f942f57ad8084a7c322569a055589ee6549508))
* prevent subscribe button overflow on mobile ([f11ce30](https://github.com/fyrendev/fyren/commit/f11ce30ff9b1171fbefcf4c2a77c73d0624bdaa5))
* rename postgres service to avoid hostname conflict ([15eb6b5](https://github.com/fyrendev/fyren/commit/15eb6b58eee6c1444f8b340b414add1dac826147))
* rename Redis service to avoid conflict with coolify-redis ([b271185](https://github.com/fyrendev/fyren/commit/b2711857eaef28499b3931fecf25f10c084faa93))
* resolve auth redirect loop and CORS issues ([62d2d61](https://github.com/fyrendev/fyren/commit/62d2d61e66de9d596c936cc75f47714de2a055dc))
* resolve E2E test failures and improve stability ([0c3e043](https://github.com/fyrendev/fyren/commit/0c3e04363b6f96615356e01e05d3be41e2479934))
* resolve TypeScript strict mode errors and add monitor toggle ([6a995bf](https://github.com/fyrendev/fyren/commit/6a995bf7213ddff7d531c1c806473b930d9586a7))
* restore Redis persistence now that auth is working ([a103249](https://github.com/fyrendev/fyren/commit/a103249d9ea38b1a29c29905fa66c25f9a8fec7a))
* run only API tests in CI test job ([123c400](https://github.com/fyrendev/fyren/commit/123c400e810d1213471967822fee77ab9ec94b62))
* simplify Traefik config with default service port and HTTP router ([dd51219](https://github.com/fyrendev/fyren/commit/dd51219a15ae8a54f1cc2c7d411b759c886c14f2))
* status indicator type mismatch and date serialization bugs ([2659b74](https://github.com/fyrendev/fyren/commit/2659b74f379fc3fe59660a0b146edd3af855d01e))
* subscribe without org linkback ([de23286](https://github.com/fyrendev/fyren/commit/de232863a2973813a20524038fab2895e4aed43a))
* update "View Status Page" link to use org slug ([6b7dba2](https://github.com/fyrendev/fyren/commit/6b7dba2e521d81b4793e8c9c4abfc7a49a8e47aa))
* update API_URL environment variable access in next.config.js ([dd4b90a](https://github.com/fyrendev/fyren/commit/dd4b90ac75547dbf6a9744504f97b36dce9ff8c9))
* update APP_URL environment variable handling for CORS ([d44f496](https://github.com/fyrendev/fyren/commit/d44f496d1e555b6a03144aaed29bb1c1fd7d414e))
* update docker-compose.yml to use correct Dockerfiles ([f396d74](https://github.com/fyrendev/fyren/commit/f396d740a217ce31ea661754bb95fd95f5b31fb2))
* update Dockerfiles for Bun 1.3 and monorepo compatibility ([3338704](https://github.com/fyrendev/fyren/commit/3338704929fc6e923fa0ad5824857f71fecd56e2))
* update Dockerfiles for Bun 1.3 and monorepo compatibility ([368a744](https://github.com/fyrendev/fyren/commit/368a744ddc95455f5fee1b533cd7be436452574e))
* update health check URL in Dockerfile to use 0.0.0.0 instead of localhost ([bc1ed6a](https://github.com/fyrendev/fyren/commit/bc1ed6a252e85c11818517e96c136f08c2098faf))
* update subscription links to remove organization slug ([f03be3d](https://github.com/fyrendev/fyren/commit/f03be3d9308055d3f8d5b82e15aa1addbe9772b9))
* update to API_URL environment variable ([1fc4c9f](https://github.com/fyrendev/fyren/commit/1fc4c9f0c29357fed02855901a1f2bf0aad6b571))
* use Docker Compose interpolation for Redis password ([d6b9acb](https://github.com/fyrendev/fyren/commit/d6b9acbc8a17d19b6beda6fb2cb558fe36d0cdb3))
* use Drizzle gte/lt operators for date comparisons in uptime history ([#5](https://github.com/fyrendev/fyren/issues/5)) ([6098eb1](https://github.com/fyrendev/fyren/commit/6098eb1f5f98cdb83a7d54a2c96f7b80409357d7))
* use shell form for Redis command to properly expand env var ([31f9720](https://github.com/fyrendev/fyren/commit/31f9720b64372634802583850ecee55228ee5575))
* use very high priority (10000) for Traefik routers to override Coolify ([a95f709](https://github.com/fyrendev/fyren/commit/a95f70944db839b023711345746bc695115ce867))
* web Dockerfile uses npm to avoid Bun symlink issues ([b8672e7](https://github.com/fyrendev/fyren/commit/b8672e7e3e116b122520e53925e50874efbd4d87))


### Performance Improvements

* reduce API Docker image from 832MB to 111MB ([68b76f3](https://github.com/fyrendev/fyren/commit/68b76f3861a539fcbf0bd13e27eaa04a50e68002))


### Code Refactoring

* **auth:** simplify auth middleware by removing legacy API key-only code ([189441f](https://github.com/fyrendev/fyren/commit/189441f0813c259ebb8cf709525b42389c04adeb))
* clean up imports and error handling in auth middleware and user routes ([9d6e9b3](https://github.com/fyrendev/fyren/commit/9d6e9b3ba96c12ef55cf60043c2ca663e4893579))
* extract WebhookType to shared package ([3add33f](https://github.com/fyrendev/fyren/commit/3add33f0119418eb1d7a729163750468f7fb7ded))
* move docker-compose.yml to root for consistency ([657b4f3](https://github.com/fyrendev/fyren/commit/657b4f3c1f5994ba878cc817be5ae3435abbf7c3))
* remove custom Traefik labels, let Coolify handle routing ([84d3467](https://github.com/fyrendev/fyren/commit/84d3467ada20f45c813fbbb5abdaf56c3299b197))
* remove multi-organization abstraction for single-tenant mode ([#18](https://github.com/fyrendev/fyren/issues/18)) ([f5fe7e7](https://github.com/fyrendev/fyren/commit/f5fe7e70faeeebb076c6528323d4c551ebc3939a))
* remove NEXT_PUBLIC_API_URL references across the application ([#7](https://github.com/fyrendev/fyren/issues/7)) ([1959e01](https://github.com/fyrendev/fyren/commit/1959e018743fed9a0e3d4b50ddae10b722893aeb))
* remove org ID route params for single-tenant mode ([#16](https://github.com/fyrendev/fyren/issues/16)) ([d4243e7](https://github.com/fyrendev/fyren/commit/d4243e77317971a8a110b91401bd0e9a0f636bdf))
* remove slug parameter from public API routes ([2fc5109](https://github.com/fyrendev/fyren/commit/2fc5109269c74b67233b50cfc8df99753f884b63))
* remove slug-based org route for single-tenant mode ([c5418a3](https://github.com/fyrendev/fyren/commit/c5418a3ff7fd2015f8b2397451c8b7119e3386ff))
* replace console.log with structured logger throughout API ([#6](https://github.com/fyrendev/fyren/issues/6)) ([b42c545](https://github.com/fyrendev/fyren/commit/b42c5451ab86b07a4bf8e0ef46c753a161c60a6f))
* replace raw SQL count queries with Drizzle ORM count function ([11429ad](https://github.com/fyrendev/fyren/commit/11429ad981b8fad688ba08f615198503622d913b))
* use turbo prune for web Dockerfile ([6270bb0](https://github.com/fyrendev/fyren/commit/6270bb0c6499551d90a010ea8cff27e501b7ecbf))


### Documentation

* add Coolify deployment notes for database/Redis URLs ([e8962e0](https://github.com/fyrendev/fyren/commit/e8962e003f25be84895c20ec9c11f1474c288719))
* add Coolify deployment notes for database/Redis URLs ([b8e5799](https://github.com/fyrendev/fyren/commit/b8e57990931f0054ce5a610d7fe0b0583f677e65))
* add ELv2 licensing to README and LICENSE files ([3a13f68](https://github.com/fyrendev/fyren/commit/3a13f68b4d223b2f4cde09ce9cfd2d95e5d7e331))
* update docker-compose.prod.yml path references ([f0bfa4e](https://github.com/fyrendev/fyren/commit/f0bfa4e2ca2076c2affd7ec45d226c833041eea6))
* update health check URLs and improve command table formatting in README.md ([49197b4](https://github.com/fyrendev/fyren/commit/49197b48188ed3df824e9153df90d3a6d1966aa4))
* update tech stack and frontend section in fyren.md ([762f4f6](https://github.com/fyrendev/fyren/commit/762f4f683c08ace13c5006b86c2a9b9b34df6b3d))
