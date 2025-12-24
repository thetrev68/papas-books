# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.1.4](https://github.com/thetrev68/papas-books/compare/v0.1.3...v0.1.4) (2025-12-24)

### Bug Fixes

- ensure changelog fixes are staged for release commit ([fd9130a](https://github.com/thetrev68/papas-books/commit/fd9130a63436f2aa998620520c065d4284a29b06))

## 0.1.3 (2025-12-24)

### Features

- Complete Phase 5 - Workbench with split transactions and payee normalization ([1a74155](https://github.com/thetrev68/papas-books/commit/1a74155c5ae61a008523a77d716b939bc1f9fcbd))
- Complete Phase 5 testing and final fixes ([68f0a3d](https://github.com/thetrev68/papas-books/commit/68f0a3d4d341c933437a35a2b423c7e479f29a63))
- create 'full reset' script to clear database and start fresh. fix seed_category scripts (snake case columns) ([62d68e4](https://github.com/thetrev68/papas-books/commit/62d68e419a3888a1b7e7c9081ea7979ac2790a67))
- Finalize Workbench functionality and fix virtualization stability ([f5ac6ad](https://github.com/thetrev68/papas-books/commit/f5ac6ad7a1e466d3ad66888758c3edc8f5965fcb))
- fix bookset selector visibility and add account selection validation to import ([33d2dcb](https://github.com/thetrev68/papas-books/commit/33d2dcb83e7c2e6cffa8abe208c92483333fc5bb))
- implement Phase 1 Foundation and Authentication with Supabase ([4c3545d](https://github.com/thetrev68/papas-books/commit/4c3545da5dd9e70e594bb323266201de73faa3f8))
- implement Phase 2 - Account & Category Management ([2d31b65](https://github.com/thetrev68/papas-books/commit/2d31b6585ce7bcfdb9cb0cf4b9bea4161dae8e3e))
- implement Phase 3 CSV import core library ([18650ef](https://github.com/thetrev68/papas-books/commit/18650eff81281b1c45ae5b6be1d4165b8c5d4209))
- implement Phase 3 import UI and integration layer ([7519c96](https://github.com/thetrev68/papas-books/commit/7519c96959cf60fe6637f815986e326f764ae9a6))
- Implement Phase 4 - Rules Engine (Auto-Categorization) ([f8cb061](https://github.com/thetrev68/papas-books/commit/f8cb06172bc75c3b854d55184c56b1bae52c3854))
- implement PWA infrastructure with offline support and installability ([d0f2a5e](https://github.com/thetrev68/papas-books/commit/d0f2a5ec71b890c77c049d5cf30ce2f64d646396))
- Implement Rules Engine (Phase 4) ([a9f6b19](https://github.com/thetrev68/papas-books/commit/a9f6b1983e81e44ab7060d2405eca1ba6bc68ca9))
- **phase6:** implement reconciliation and reporting ([12995ab](https://github.com/thetrev68/papas-books/commit/12995ab9bb5df2f7813037577f4ca6390aaa3627))
- **phase8:** implement advanced features (collaboration, audit, undo, advanced rules) ([a112663](https://github.com/thetrev68/papas-books/commit/a1126630bc20bd9e7f1c72924ad9ce35e3063c3d))

### Bug Fixes

- Add mock Supabase env vars to Vitest config ([bf160ea](https://github.com/thetrev68/papas-books/commit/bf160ea39e99a1bef2db2360600477a06a50cc31))
- add ON DELETE CASCADE to foreign keys to allow user deletion ([d0552c3](https://github.com/thetrev68/papas-books/commit/d0552c3fd0e97b56f5aa2f7977066fe287816e7d))
- add retry logic to fetchUserData to handle db trigger race condition ([2f840df](https://github.com/thetrev68/papas-books/commit/2f840dfc2d37af2374e679b70f21169978aecdc7))
- automate markdownlint compliance for changelog generation ([8c2bf68](https://github.com/thetrev68/papas-books/commit/8c2bf6864221c9dbae1893f0e00e808567f29af0))
- improve auth UX, add delete confirmations, and user repair utility ([455fe8c](https://github.com/thetrev68/papas-books/commit/455fe8cd73a888be315cd66120b9c6dc11a3aeba))
- map camelCase to snake_case for database column names ([0feb948](https://github.com/thetrev68/papas-books/commit/0feb948a3f507fa59b0a8a42551c08a684c32733))
- remove unused imports to resolve Vercel build errors ([98929f4](https://github.com/thetrev68/papas-books/commit/98929f46a8530fdcba9d54a85dc8d2b8b24b07f6))
- Resolve build errors ([f247e30](https://github.com/thetrev68/papas-books/commit/f247e307034d0ff502c6c10622ff0381f9480f77))
- resolve db error on signup by using gen_random_uuid and setting search_path ([2532e3c](https://github.com/thetrev68/papas-books/commit/2532e3c2e5a7d30a37c473f599cdc337a42d3271))
- resolve SQL errors in Supabase schema ([bbd9a9e](https://github.com/thetrev68/papas-books/commit/bbd9a9e5633ad96a6465444ef3feb8fb2970eeb6))
- use snake_case consistently throughout TypeScript code ([40eaeaf](https://github.com/thetrev68/papas-books/commit/40eaeafe31bb0253ba7780989f88c9e16b6ce2c1))

### Documentation

- complete detailed planning for Phase 6, 7, and 8 ([b3fcb4a](https://github.com/thetrev68/papas-books/commit/b3fcb4a22af0673b47df5dadabd9478c2bbc5ea5))
- mark phase 1 as complete and add comprehensive README ([5ac2f0b](https://github.com/thetrev68/papas-books/commit/5ac2f0bc0a58e01b0e138f637ba5cfb0623c7c1b))

### Maintenance

- add drop statements to schema.sql for easy reset ([3ac4b68](https://github.com/thetrev68/papas-books/commit/3ac4b688373087e709e1ebe093a5da630ec76873))
- add favicons ([36fd433](https://github.com/thetrev68/papas-books/commit/36fd433c598d95a84093f01e52887d2f24e6cac6))
- clean up unused code and resolve knip warnings ([8088339](https://github.com/thetrev68/papas-books/commit/808833962bcac68e6ff6fd00e687a07b28e4e75d))
- commit pending changes (automated) ([aecfafa](https://github.com/thetrev68/papas-books/commit/aecfafabd748e5b5659b507893bde70eb205464a))
- eslint and prettier auto-fixes ([b618361](https://github.com/thetrev68/papas-books/commit/b618361897dce7769b8106f83e530387dcdd17fa))
- fix eslint configuration and linting errors ([2b5f3f3](https://github.com/thetrev68/papas-books/commit/2b5f3f38fc7a87ae7c1ca7e63b50839b35d281b0))
- initialize claude code, evaluate status ([3899f76](https://github.com/thetrev68/papas-books/commit/3899f76d372b231a322010c9ddb9ebc2f4e0ae53))
- initialize project files and docs ([53ff65d](https://github.com/thetrev68/papas-books/commit/53ff65dff00e2da39591af30c8203aea29741a3b))
- install and configure knip ([b9ecea7](https://github.com/thetrev68/papas-books/commit/b9ecea77d82ebeb92289fc304819100d5fd7c88d))
- integrate markdownlint and fix documentation linting errors ([20b4c52](https://github.com/thetrev68/papas-books/commit/20b4c52daca691909e3e73fd4d7e1963244694fd))
- lint and prettier auto-fixes ([64c7bc0](https://github.com/thetrev68/papas-books/commit/64c7bc03e2fce1fa11e0120f77d38d52e127b2fe))
- markdown lint cleanup ([395fc7f](https://github.com/thetrev68/papas-books/commit/395fc7f1f025b017ab08dc20f2a9c79729d982bb))
- Phase 6 to 8 Documentation Expansion and correction ([afa3fb4](https://github.com/thetrev68/papas-books/commit/afa3fb4502a827084ba6e7f88a8dcaacffa775f6))
- Phase 7 prep ([fb382dc](https://github.com/thetrev68/papas-books/commit/fb382dc5b91afa1ea832f6467cc5d68805813418))
- prep for phase 3 import transactions ([e43cdb6](https://github.com/thetrev68/papas-books/commit/e43cdb63801abba0f518189f3c79245f403b0c38))
- prettier autofix run ([cfdf8a1](https://github.com/thetrev68/papas-books/commit/cfdf8a14c12eb1f3f7fe0166957b43e766b5dd49))
- remove dead code and simplify knip configuration ([84d7c79](https://github.com/thetrev68/papas-books/commit/84d7c79508f63b613451f3462d118f6a46da0801))
- remove deprecated husky setup lines ([2567ae0](https://github.com/thetrev68/papas-books/commit/2567ae0c786184f335eacfaa0f21f07519deed4a))
- setup CI/CD pipeline and Phase 2 documentation ([8a2d5df](https://github.com/thetrev68/papas-books/commit/8a2d5dfb1f57c97c1af72241d53a154e6d17403d))

## 0.1.2 (2025-12-24)

### Features

- Complete Phase 5 - Workbench with split transactions and payee normalization ([1a74155](https://github.com/thetrev68/papas-books/commit/1a74155c5ae61a008523a77d716b939bc1f9fcbd))
- Complete Phase 5 testing and final fixes ([68f0a3d](https://github.com/thetrev68/papas-books/commit/68f0a3d4d341c933437a35a2b423c7e479f29a63))
- create 'full reset' script to clear database and start fresh. fix seed_category scripts (snake case columns) ([62d68e4](https://github.com/thetrev68/papas-books/commit/62d68e419a3888a1b7e7c9081ea7979ac2790a67))
- Finalize Workbench functionality and fix virtualization stability ([f5ac6ad](https://github.com/thetrev68/papas-books/commit/f5ac6ad7a1e466d3ad66888758c3edc8f5965fcb))
- fix bookset selector visibility and add account selection validation to import ([33d2dcb](https://github.com/thetrev68/papas-books/commit/33d2dcb83e7c2e6cffa8abe208c92483333fc5bb))
- implement Phase 1 Foundation and Authentication with Supabase ([4c3545d](https://github.com/thetrev68/papas-books/commit/4c3545da5dd9e70e594bb323266201de73faa3f8))
- implement Phase 2 - Account & Category Management ([2d31b65](https://github.com/thetrev68/papas-books/commit/2d31b6585ce7bcfdb9cb0cf4b9bea4161dae8e3e))
- implement Phase 3 CSV import core library ([18650ef](https://github.com/thetrev68/papas-books/commit/18650eff81281b1c45ae5b6be1d4165b8c5d4209))
- implement Phase 3 import UI and integration layer ([7519c96](https://github.com/thetrev68/papas-books/commit/7519c96959cf60fe6637f815986e326f764ae9a6))
- Implement Phase 4 - Rules Engine (Auto-Categorization) ([f8cb061](https://github.com/thetrev68/papas-books/commit/f8cb06172bc75c3b854d55184c56b1bae52c3854))
- implement PWA infrastructure with offline support and installability ([d0f2a5e](https://github.com/thetrev68/papas-books/commit/d0f2a5ec71b890c77c049d5cf30ce2f64d646396))
- Implement Rules Engine (Phase 4) ([a9f6b19](https://github.com/thetrev68/papas-books/commit/a9f6b1983e81e44ab7060d2405eca1ba6bc68ca9))
- **phase6:** implement reconciliation and reporting ([12995ab](https://github.com/thetrev68/papas-books/commit/12995ab9bb5df2f7813037577f4ca6390aaa3627))
- **phase8:** implement advanced features (collaboration, audit, undo, advanced rules) ([a112663](https://github.com/thetrev68/papas-books/commit/a1126630bc20bd9e7f1c72924ad9ce35e3063c3d))

### Bug Fixes

- Add mock Supabase env vars to Vitest config ([bf160ea](https://github.com/thetrev68/papas-books/commit/bf160ea39e99a1bef2db2360600477a06a50cc31))
- add ON DELETE CASCADE to foreign keys to allow user deletion ([d0552c3](https://github.com/thetrev68/papas-books/commit/d0552c3fd0e97b56f5aa2f7977066fe287816e7d))
- add retry logic to fetchUserData to handle db trigger race condition ([2f840df](https://github.com/thetrev68/papas-books/commit/2f840dfc2d37af2374e679b70f21169978aecdc7))
- improve auth UX, add delete confirmations, and user repair utility ([455fe8c](https://github.com/thetrev68/papas-books/commit/455fe8cd73a888be315cd66120b9c6dc11a3aeba))
- map camelCase to snake_case for database column names ([0feb948](https://github.com/thetrev68/papas-books/commit/0feb948a3f507fa59b0a8a42551c08a684c32733))
- remove unused imports to resolve Vercel build errors ([98929f4](https://github.com/thetrev68/papas-books/commit/98929f46a8530fdcba9d54a85dc8d2b8b24b07f6))
- Resolve build errors ([f247e30](https://github.com/thetrev68/papas-books/commit/f247e307034d0ff502c6c10622ff0381f9480f77))
- resolve db error on signup by using gen_random_uuid and setting search_path ([2532e3c](https://github.com/thetrev68/papas-books/commit/2532e3c2e5a7d30a37c473f599cdc337a42d3271))
- resolve SQL errors in Supabase schema ([bbd9a9e](https://github.com/thetrev68/papas-books/commit/bbd9a9e5633ad96a6465444ef3feb8fb2970eeb6))
- use snake_case consistently throughout TypeScript code ([40eaeaf](https://github.com/thetrev68/papas-books/commit/40eaeafe31bb0253ba7780989f88c9e16b6ce2c1))

### Documentation

- complete detailed planning for Phase 6, 7, and 8 ([b3fcb4a](https://github.com/thetrev68/papas-books/commit/b3fcb4a22af0673b47df5dadabd9478c2bbc5ea5))
- mark phase 1 as complete and add comprehensive README ([5ac2f0b](https://github.com/thetrev68/papas-books/commit/5ac2f0bc0a58e01b0e138f637ba5cfb0623c7c1b))

### Maintenance

- add drop statements to schema.sql for easy reset ([3ac4b68](https://github.com/thetrev68/papas-books/commit/3ac4b688373087e709e1ebe093a5da630ec76873))
- add favicons ([36fd433](https://github.com/thetrev68/papas-books/commit/36fd433c598d95a84093f01e52887d2f24e6cac6))
- clean up unused code and resolve knip warnings ([8088339](https://github.com/thetrev68/papas-books/commit/808833962bcac68e6ff6fd00e687a07b28e4e75d))
- commit pending changes (automated) ([aecfafa](https://github.com/thetrev68/papas-books/commit/aecfafabd748e5b5659b507893bde70eb205464a))
- eslint and prettier auto-fixes ([b618361](https://github.com/thetrev68/papas-books/commit/b618361897dce7769b8106f83e530387dcdd17fa))
- fix eslint configuration and linting errors ([2b5f3f3](https://github.com/thetrev68/papas-books/commit/2b5f3f38fc7a87ae7c1ca7e63b50839b35d281b0))
- initialize claude code, evaluate status ([3899f76](https://github.com/thetrev68/papas-books/commit/3899f76d372b231a322010c9ddb9ebc2f4e0ae53))
- initialize project files and docs ([53ff65d](https://github.com/thetrev68/papas-books/commit/53ff65dff00e2da39591af30c8203aea29741a3b))
- install and configure knip ([b9ecea7](https://github.com/thetrev68/papas-books/commit/b9ecea77d82ebeb92289fc304819100d5fd7c88d))
- integrate markdownlint and fix documentation linting errors ([20b4c52](https://github.com/thetrev68/papas-books/commit/20b4c52daca691909e3e73fd4d7e1963244694fd))
- lint and prettier auto-fixes ([64c7bc0](https://github.com/thetrev68/papas-books/commit/64c7bc03e2fce1fa11e0120f77d38d52e127b2fe))
- markdown lint cleanup ([395fc7f](https://github.com/thetrev68/papas-books/commit/395fc7f1f025b017ab08dc20f2a9c79729d982bb))
- Phase 6 to 8 Documentation Expansion and correction ([afa3fb4](https://github.com/thetrev68/papas-books/commit/afa3fb4502a827084ba6e7f88a8dcaacffa775f6))
- Phase 7 prep ([fb382dc](https://github.com/thetrev68/papas-books/commit/fb382dc5b91afa1ea832f6467cc5d68805813418))
- prep for phase 3 import transactions ([e43cdb6](https://github.com/thetrev68/papas-books/commit/e43cdb63801abba0f518189f3c79245f403b0c38))
- prettier autofix run ([cfdf8a1](https://github.com/thetrev68/papas-books/commit/cfdf8a14c12eb1f3f7fe0166957b43e766b5dd49))
- remove dead code and simplify knip configuration ([84d7c79](https://github.com/thetrev68/papas-books/commit/84d7c79508f63b613451f3462d118f6a46da0801))
- remove deprecated husky setup lines ([2567ae0](https://github.com/thetrev68/papas-books/commit/2567ae0c786184f335eacfaa0f21f07519deed4a))
- setup CI/CD pipeline and Phase 2 documentation ([8a2d5df](https://github.com/thetrev68/papas-books/commit/8a2d5dfb1f57c97c1af72241d53a154e6d17403d))

## 0.1.1 (2025-12-24)

### Features

- Complete Phase 5 - Workbench with split transactions and payee normalization ([1a74155](https://github.com/thetrev68/papas-books/commit/1a74155c5ae61a008523a77d716b939bc1f9fcbd))
- Complete Phase 5 testing and final fixes ([68f0a3d](https://github.com/thetrev68/papas-books/commit/68f0a3d4d341c933437a35a2b423c7e479f29a63))
- create 'full reset' script to clear database and start fresh. fix seed_category scripts (snake case columns) ([62d68e4](https://github.com/thetrev68/papas-books/commit/62d68e419a3888a1b7e7c9081ea7979ac2790a67))
- Finalize Workbench functionality and fix virtualization stability ([f5ac6ad](https://github.com/thetrev68/papas-books/commit/f5ac6ad7a1e466d3ad66888758c3edc8f5965fcb))
- fix bookset selector visibility and add account selection validation to import ([33d2dcb](https://github.com/thetrev68/papas-books/commit/33d2dcb83e7c2e6cffa8abe208c92483333fc5bb))
- implement Phase 1 Foundation and Authentication with Supabase ([4c3545d](https://github.com/thetrev68/papas-books/commit/4c3545da5dd9e70e594bb323266201de73faa3f8))
- implement Phase 2 - Account & Category Management ([2d31b65](https://github.com/thetrev68/papas-books/commit/2d31b6585ce7bcfdb9cb0cf4b9bea4161dae8e3e))
- implement Phase 3 CSV import core library ([18650ef](https://github.com/thetrev68/papas-books/commit/18650eff81281b1c45ae5b6be1d4165b8c5d4209))
- implement Phase 3 import UI and integration layer ([7519c96](https://github.com/thetrev68/papas-books/commit/7519c96959cf60fe6637f815986e326f764ae9a6))
- Implement Phase 4 - Rules Engine (Auto-Categorization) ([f8cb061](https://github.com/thetrev68/papas-books/commit/f8cb06172bc75c3b854d55184c56b1bae52c3854))
- implement PWA infrastructure with offline support and installability ([d0f2a5e](https://github.com/thetrev68/papas-books/commit/d0f2a5ec71b890c77c049d5cf30ce2f64d646396))
- Implement Rules Engine (Phase 4) ([a9f6b19](https://github.com/thetrev68/papas-books/commit/a9f6b1983e81e44ab7060d2405eca1ba6bc68ca9))
- **phase6:** implement reconciliation and reporting ([12995ab](https://github.com/thetrev68/papas-books/commit/12995ab9bb5df2f7813037577f4ca6390aaa3627))
- **phase8:** implement advanced features (collaboration, audit, undo, advanced rules) ([a112663](https://github.com/thetrev68/papas-books/commit/a1126630bc20bd9e7f1c72924ad9ce35e3063c3d))

### Bug Fixes

- Add mock Supabase env vars to Vitest config ([bf160ea](https://github.com/thetrev68/papas-books/commit/bf160ea39e99a1bef2db2360600477a06a50cc31))
- add ON DELETE CASCADE to foreign keys to allow user deletion ([d0552c3](https://github.com/thetrev68/papas-books/commit/d0552c3fd0e97b56f5aa2f7977066fe287816e7d))
- add retry logic to fetchUserData to handle db trigger race condition ([2f840df](https://github.com/thetrev68/papas-books/commit/2f840dfc2d37af2374e679b70f21169978aecdc7))
- improve auth UX, add delete confirmations, and user repair utility ([455fe8c](https://github.com/thetrev68/papas-books/commit/455fe8cd73a888be315cd66120b9c6dc11a3aeba))
- map camelCase to snake_case for database column names ([0feb948](https://github.com/thetrev68/papas-books/commit/0feb948a3f507fa59b0a8a42551c08a684c32733))
- remove unused imports to resolve Vercel build errors ([98929f4](https://github.com/thetrev68/papas-books/commit/98929f46a8530fdcba9d54a85dc8d2b8b24b07f6))
- Resolve build errors ([f247e30](https://github.com/thetrev68/papas-books/commit/f247e307034d0ff502c6c10622ff0381f9480f77))
- resolve db error on signup by using gen_random_uuid and setting search_path ([2532e3c](https://github.com/thetrev68/papas-books/commit/2532e3c2e5a7d30a37c473f599cdc337a42d3271))
- resolve SQL errors in Supabase schema ([bbd9a9e](https://github.com/thetrev68/papas-books/commit/bbd9a9e5633ad96a6465444ef3feb8fb2970eeb6))
- use snake_case consistently throughout TypeScript code ([40eaeaf](https://github.com/thetrev68/papas-books/commit/40eaeafe31bb0253ba7780989f88c9e16b6ce2c1))

### Documentation

- complete detailed planning for Phase 6, 7, and 8 ([b3fcb4a](https://github.com/thetrev68/papas-books/commit/b3fcb4a22af0673b47df5dadabd9478c2bbc5ea5))
- mark phase 1 as complete and add comprehensive README ([5ac2f0b](https://github.com/thetrev68/papas-books/commit/5ac2f0bc0a58e01b0e138f637ba5cfb0623c7c1b))

### Maintenance

- add drop statements to schema.sql for easy reset ([3ac4b68](https://github.com/thetrev68/papas-books/commit/3ac4b688373087e709e1ebe093a5da630ec76873))
- add favicons ([36fd433](https://github.com/thetrev68/papas-books/commit/36fd433c598d95a84093f01e52887d2f24e6cac6))
- clean up unused code and resolve knip warnings ([8088339](https://github.com/thetrev68/papas-books/commit/808833962bcac68e6ff6fd00e687a07b28e4e75d))
- commit pending changes (automated) ([aecfafa](https://github.com/thetrev68/papas-books/commit/aecfafabd748e5b5659b507893bde70eb205464a))
- eslint and prettier auto-fixes ([b618361](https://github.com/thetrev68/papas-books/commit/b618361897dce7769b8106f83e530387dcdd17fa))
- fix eslint configuration and linting errors ([2b5f3f3](https://github.com/thetrev68/papas-books/commit/2b5f3f38fc7a87ae7c1ca7e63b50839b35d281b0))
- initialize claude code, evaluate status ([3899f76](https://github.com/thetrev68/papas-books/commit/3899f76d372b231a322010c9ddb9ebc2f4e0ae53))
- initialize project files and docs ([53ff65d](https://github.com/thetrev68/papas-books/commit/53ff65dff00e2da39591af30c8203aea29741a3b))
- install and configure knip ([b9ecea7](https://github.com/thetrev68/papas-books/commit/b9ecea77d82ebeb92289fc304819100d5fd7c88d))
- integrate markdownlint and fix documentation linting errors ([20b4c52](https://github.com/thetrev68/papas-books/commit/20b4c52daca691909e3e73fd4d7e1963244694fd))
- lint and prettier auto-fixes ([64c7bc0](https://github.com/thetrev68/papas-books/commit/64c7bc03e2fce1fa11e0120f77d38d52e127b2fe))
- Phase 6 to 8 Documentation Expansion and correction ([afa3fb4](https://github.com/thetrev68/papas-books/commit/afa3fb4502a827084ba6e7f88a8dcaacffa775f6))
- Phase 7 prep ([fb382dc](https://github.com/thetrev68/papas-books/commit/fb382dc5b91afa1ea832f6467cc5d68805813418))
- prep for phase 3 import transactions ([e43cdb6](https://github.com/thetrev68/papas-books/commit/e43cdb63801abba0f518189f3c79245f403b0c38))
- prettier autofix run ([cfdf8a1](https://github.com/thetrev68/papas-books/commit/cfdf8a14c12eb1f3f7fe0166957b43e766b5dd49))
- remove dead code and simplify knip configuration ([84d7c79](https://github.com/thetrev68/papas-books/commit/84d7c79508f63b613451f3462d118f6a46da0801))
- remove deprecated husky setup lines ([2567ae0](https://github.com/thetrev68/papas-books/commit/2567ae0c786184f335eacfaa0f21f07519deed4a))
- setup CI/CD pipeline and Phase 2 documentation ([8a2d5df](https://github.com/thetrev68/papas-books/commit/8a2d5dfb1f57c97c1af72241d53a154e6d17403d))
