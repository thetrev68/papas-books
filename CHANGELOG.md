# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.1.12](https://github.com/thetrev68/papas-books/compare/v0.1.11...v0.1.12) (2025-12-25)

### Features

- **audit:** implement change_history tracking for all entities (Task 3.1) ([e37c4b7](https://github.com/thetrev68/papas-books/commit/e37c4b76a71fb8d558046aba8e09112efd521f93))

## [0.1.11](https://github.com/thetrev68/papas-books/compare/v0.1.10...v0.1.11) (2025-12-25)

### Features

- **concurrency:** wire optimistic locking into UI components ([9068aea](https://github.com/thetrev68/papas-books/commit/9068aea5adab49f5ab92f5db7abce8027a92ade5))

### Bug Fixes

- **ci:** configure vitest coverage reporters for CI ([b2e3941](https://github.com/thetrev68/papas-books/commit/b2e3941ebe509ef87fae73dd2b205e7b30437252))

## [0.1.10](https://github.com/thetrev68/papas-books/compare/v0.1.9...v0.1.10) (2025-12-25)

### Documentation

- **testing:** complete Task 2.7 - testing strategy and coverage documentation ([bf41019](https://github.com/thetrev68/papas-books/commit/bf410199cf547d40d5315c0a51e2e60b68f20beb))

## [0.1.9](https://github.com/thetrev68/papas-books/compare/v0.1.8...v0.1.9) (2025-12-25)

### Features

- **concurrency:** implement optimistic locking for concurrent edit detection (Task 2.6) ([5e1e064](https://github.com/thetrev68/papas-books/commit/5e1e064ca389d6f1e6051495f06596be3f7da2be))
- **perf:** add React Query cache optimization with optimistic updates (Task 2.5) ([dcc017e](https://github.com/thetrev68/papas-books/commit/dcc017e82bd973e15dea19fa6b3049bb081cb220))

## [0.1.8](https://github.com/thetrev68/papas-books/compare/v0.1.7...v0.1.8) (2025-12-25)

### Features

- restore and wire in CSV validation and sanitization ([02973f6](https://github.com/thetrev68/papas-books/commit/02973f6d3ca5d024fa93e4fd8986d823e039daad))
- **perf:** add React Query cache optimization with optimistic updates (Task 2.5)

### Bug Fixes

- resolve lint errors and fix rule editing e2e test ([c86312e](https://github.com/thetrev68/papas-books/commit/c86312e7d8320cf6ec5a5e94ec3408165d4f0123))

### Documentation

- add comprehensive React Query cache strategy documentation

### Maintenance

- archived completed documents ([380b35a](https://github.com/thetrev68/papas-books/commit/380b35aac6c855678f50b7d900e2a04db0490e23))
- clean up unused code and configuration based on Knip analysis ([ad21805](https://github.com/thetrev68/papas-books/commit/ad21805e9cc59f862210447a3662c4c84516b738))
- remove dev-dist build artifacts from tracking and update gitignore ([db97385](https://github.com/thetrev68/papas-books/commit/db97385408c450ba4be9436c0e50518f530096b9))

## [0.1.7](https://github.com/thetrev68/papas-books/compare/v0.1.6...v0.1.7) (2025-12-25)

### Features

- add cleanup script for NULL created_by transactions ([ad69127](https://github.com/thetrev68/papas-books/commit/ad69127fef5a785ac1fb43d981bca5b11eca4f74))
- add database performance indexes (Task 2.2) ([b422efb](https://github.com/thetrev68/papas-books/commit/b422efb935971ed06b5a3ff9479c2e3020c55b3d))
- add dotenv support to performance testing scripts ([4920180](https://github.com/thetrev68/papas-books/commit/492018060b799407d1b89b24436b6df6d0a12639))
- add pagination to reports (Task 2.3) ([e494a34](https://github.com/thetrev68/papas-books/commit/e494a34532114ff26af8bef2366156ebedaa5b98))
- implement end-to-end tests for critical workflows (Task 2.1) ([3d0d9b2](https://github.com/thetrev68/papas-books/commit/3d0d9b2a3fede4933d09480f983ececaabfdb06c))
- implement large dataset performance testing (Task 2.4) ([2ddfac8](https://github.com/thetrev68/papas-books/commit/2ddfac8311844ed6ee522668d13ca93962d05e95))

### Bug Fixes

- ensure seeded transactions have proper created_by field ([f24756b](https://github.com/thetrev68/papas-books/commit/f24756b913764becc6ff4faf1a4cc3adf5cc9f27))
- resolve Playwright E2E test failures and add test utilities ([e2ddc71](https://github.com/thetrev68/papas-books/commit/e2ddc71381f76e88dfbcc629cf58d01df3f4e7f2))

### Documentation

- add standalone prompt for reports pagination fix ([ce281f6](https://github.com/thetrev68/papas-books/commit/ce281f6ebf78522890825a7ffe28a7a8cc6140ad))
- document reports pagination issue found during testing ([5ac6d0b](https://github.com/thetrev68/papas-books/commit/5ac6d0bf41efa873ec6b0ebf4909c196bfddc1d9))

## [0.1.6](https://github.com/thetrev68/papas-books/compare/v0.1.5...v0.1.6) (2025-12-24)

### Features

- add network retry logic to query client (Task 1.7) ([fc912a6](https://github.com/thetrev68/papas-books/commit/fc912a6fbfd1c50c09b6c70902f63d6436f0c55c))
- enable email verification flow (Task 1.5) ([e15e953](https://github.com/thetrev68/papas-books/commit/e15e953d029df75377857d80e7b9f7c9bc430634))
- implement CSV input validation and sanitization (Task 1.3) ([295de85](https://github.com/thetrev68/papas-books/commit/295de8528f7e3edc9d5882b9de757fee3db0a2f2))
- implement split transaction foreign key validation (Task 1.4) ([0b9baa9](https://github.com/thetrev68/papas-books/commit/0b9baa9013cf1a7cd29322dd7245c04c016bcb9c))
- **security:** implement global error boundary and comprehensive Supabase error handling ([c976ecf](https://github.com/thetrev68/papas-books/commit/c976ecf5c50dc4bbcd602f5f2e4d0977fd90919f))

## [0.1.5](https://github.com/thetrev68/papas-books/compare/v0.1.4...v0.1.5) (2025-12-24)

### Bug Fixes

- correct git staging sequence in changelog automation ([54338ee](https://github.com/thetrev68/papas-books/commit/54338eeb677923198c81fcd1c7f3d9f6608c1ba5))

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
