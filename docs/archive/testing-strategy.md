# Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for Papa's Books, including current test coverage, testing patterns, and guidelines for maintaining quality.

**Last Updated:** 2025-12-25

---

## Current Test Coverage

### Unit Tests (Vitest)

#### ✅ Business Logic - HIGH Coverage

**Import Pipeline** ([src/lib/import/](../../src/lib/import/))

- `fingerprint.test.ts` - Transaction fingerprinting (SHA-256 deduplication)
- `fuzzy-matcher.test.ts` - Payee name fuzzy matching algorithms
- `mapper.test.ts` - CSV column mapping to transaction fields
- `parser.test.ts` - CSV parsing and validation with PapaParse
- `reconciler.test.ts` - Import deduplication logic

**Financial Calculations** ([src/lib/](../../src/lib/))

- `reconciler.test.ts` - Balance calculation and reconciliation math
- `reports.test.ts` - Report generation and aggregation logic
- `splitCalculator.test.ts` - Split transaction validation and math
- `transactionOperations.test.ts` - Transaction data operations

**Rules Engine** ([src/lib/rules/](../../src/lib/rules/))

- `matcher.test.ts` - Pattern matching (contains/exact/startsWith/regex)

**Payee Management** ([src/lib/payee/](../../src/lib/payee/))

- `payeeGuesser.test.ts` - Payee suggestion algorithms

**Data Management** ([src/lib/](../../src/lib/))

- `workbenchDataManager.test.ts` - Workbench data operations

#### ✅ Validation Schemas - HIGH Coverage

**Schema Validation** ([src/lib/validation/](../../src/lib/validation/))

- `accounts.test.ts` - Account schema validation (Zod)
- `categories.test.ts` - Category schema validation (Zod)
- `import-schema.test.ts` - Import schema validation (Zod)
- `import.test.ts` - Import validation logic

#### ✅ Configuration

**Supabase Configuration** ([src/lib/supabase/](../../src/lib/supabase/))

- `config.test.ts` - Supabase client initialization

**Total Unit Test Files:** 17

---

### Integration Tests (Playwright)

#### ✅ Critical User Workflows - COMPLETE

**E2E Test Suite** ([e2e/](../../e2e/))

1. **Import Workflow** ([import-workflow.spec.ts](../../e2e/import-workflow.spec.ts))
   - CSV file upload and parsing
   - Column mapping configuration
   - Transaction preview and validation
   - Import execution with fingerprint deduplication
   - Error handling for invalid files

2. **Rule Application Workflow** ([rule-workflow.spec.ts](../../e2e/rule-workflow.spec.ts))
   - Rule creation with pattern matching
   - Automatic categorization application
   - Priority-based rule evaluation
   - Bulk rule application
   - Rule statistics tracking

3. **Workbench Editing** ([workbench-workflow.spec.ts](../../e2e/workbench-workflow.spec.ts))
   - Transaction filtering and search
   - Inline editing (payee, category, splits)
   - Keyboard navigation (arrow keys, Enter, Escape)
   - Bulk operations
   - Real-time data updates

4. **Reconciliation Workflow** ([reconciliation-workflow.spec.ts](../../e2e/reconciliation-workflow.spec.ts))
   - Opening balance entry
   - Transaction selection for reconciliation
   - Balance calculation verification
   - Statement reconciliation completion
   - Account balance updates

**Total E2E Test Files:** 4

**Supporting Infrastructure:**

- `auth.setup.ts` - Authentication setup for test sessions
- `fixtures/` - Test CSV files and sample data
- `utils/` - Shared test utilities (auth helpers, cleanup functions)

---

## Test Infrastructure

### Unit Testing Stack

- **Test Runner:** [Vitest](https://vitest.dev/) v4.0.16
- **Environment:** jsdom (browser-like environment)
- **Assertion Library:** Built-in Vitest matchers
- **Coverage Tool:** v8 (native V8 JavaScript code coverage)

**Configuration:** [vitest.config.ts](../../vitest.config.ts)

```typescript
{
  globals: true,
  environment: 'jsdom',
  exclude: ['e2e/**', 'node_modules/**'],
  env: {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  }
}
```

### E2E Testing Stack

- **Test Runner:** [Playwright](https://playwright.dev/) v1.57.0
- **Browser:** Chromium (Desktop Chrome)
- **Mode:** Headed with screenshots on failure
- **Authentication:** Persistent session via `.auth/state.json`

**Configuration:** [playwright.config.ts](../../playwright.config.ts)

```typescript
{
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
}
```

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests (watch mode)
npm run test

# Run all unit tests once (CI mode)
npm run test -- --run

# Run with interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run specific test file
npm run test -- src/lib/import/fingerprint.test.ts

# Run tests matching a pattern
npm run test -- --grep "fingerprint"
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with interactive UI (step through tests)
npm run test:e2e:ui

# View test report
npm run test:e2e:report

# Run specific test file
npm run test:e2e -- import-workflow.spec.ts

# Run in headed mode (watch browser)
npm run test:e2e -- --headed
```

### Full Test Suite

```bash
# Run linting, unit tests, and build
npm run lint && npm run test -- --run && npm run build

# Full CI simulation
npm run lint && npm run format:check && npm run test -- --run && npm run build
```

---

## CI/CD Integration

### Current CI Workflow

**File:** [.github/workflows/ci.yml](../../.github/workflows/ci.yml)

**Triggers:**

- Push to `main` branch
- Pull requests targeting `main`

**Pipeline Steps:**

1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies (`npm ci`)
4. Run linter (`npm run lint`)
5. Check code formatting (`npm run format:check`)
6. **Run unit tests** (`npm run test -- --run`)
7. Build project (`npm run build`)

**Status:** ✅ Unit tests integrated into CI

---

## Testing Gaps & Recommendations

### ⚠️ Missing: Coverage Reporting in CI

**Current State:** Coverage is generated locally but not tracked in CI

**Recommendation:**

- Add coverage report upload to CI workflow
- Integrate with Codecov or similar service
- Set minimum coverage thresholds (e.g., 80% for business logic)

**Implementation:**

```yaml
# Add to .github/workflows/ci.yml after unit tests
- name: Generate coverage report
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/coverage-final.json
    fail_ci_if_error: true
```

### ⚠️ Missing: E2E Tests in CI

**Current State:** E2E tests run locally but not in CI

**Recommendation:**

- Create separate E2E job in CI workflow
- Run against deployed preview environment or local server
- Upload Playwright test reports as artifacts

**Implementation:**

```yaml
# Add new job to .github/workflows/ci.yml
e2e-tests:
  runs-on: ubuntu-latest
  needs: build-and-test
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        PLAYWRIGHT_EMAIL: ${{ secrets.PLAYWRIGHT_EMAIL }}
        PLAYWRIGHT_PASSWORD: ${{ secrets.PLAYWRIGHT_PASSWORD }}
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### ⚠️ Missing: Component Tests (React Testing Library)

**Current State:** No React component unit tests

**Priority:** LOW (E2E tests provide UI coverage)

**Recommendation:**

- Add component tests for complex components with business logic
- Focus on:
  - `WorkbenchTable` - Row editing, keyboard navigation
  - `TransactionSplitEditor` - Split line calculations
  - `RuleEditor` - Pattern validation
  - `ImportWizard` - Multi-step form validation

**Example:**

```typescript
// src/components/workbench/WorkbenchTable.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkbenchTable } from './WorkbenchTable';

test('allows editing payee inline', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();

  render(<WorkbenchTable transactions={mockData} onUpdate={onUpdate} />);

  const payeeCell = screen.getByText('Original Payee');
  await user.click(payeeCell);

  const input = screen.getByRole('textbox');
  await user.clear(input);
  await user.type(input, 'New Payee{Enter}');

  expect(onUpdate).toHaveBeenCalledWith({
    id: 'tx-1',
    payee: 'New Payee'
  });
});
```

### ✅ Covered: Database RLS Policies

**Testing Approach:** Manual testing with multiple user accounts

**See:** [supabase-security-checklist.md](./supabase-security-checklist.md) for RLS testing procedures

### ⚠️ Missing: Performance Testing Documentation

**Current State:** Performance results documented but no ongoing testing

**See:** [performance-test-results.md](./performance-test-results.md)

**Recommendation:**

- Add performance benchmarks to CI (e.g., bundle size limits)
- Create performance test suite for large datasets
- Monitor query performance in production

### ⚠️ Missing: Concurrent Edit Testing

**Current State:** Optimistic locking implemented, manual testing only

**See:** [optimistic-locking-guide.md](./optimistic-locking-guide.md)

**Recommendation:**

- Add E2E tests simulating concurrent edits
- Test version conflict detection and resolution
- Verify cache invalidation with React Query

---

## Testing Patterns & Guidelines

### Unit Testing Best Practices

#### 1. Test File Naming

```text
src/lib/fingerprint.ts      → src/lib/fingerprint.test.ts
src/components/Button.tsx   → src/components/Button.test.tsx
```

#### 2. Test Structure (AAA Pattern)

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  describe('functionName', () => {
    it('should handle specific scenario', () => {
      // Arrange - Set up test data
      const input = createTestData();

      // Act - Execute function under test
      const result = functionName(input);

      // Assert - Verify expectations
      expect(result).toBe(expectedValue);
    });
  });
});
```

#### 3. Mock Data Creation

```typescript
// Create factory functions for consistent test data
const mockTransaction = (overrides?: Partial<Transaction>): Transaction => ({
  id: 'test-id',
  bookset_id: 'test-bookset',
  account_id: 'test-account',
  date: '2024-01-01',
  amount: 10000,
  payee: 'Test Payee',
  // ... all required fields
  ...overrides, // Allow overriding specific fields
});
```

#### 4. Testing Async Functions

```typescript
import { describe, it, expect } from 'vitest';

describe('async operations', () => {
  it('should handle async fingerprint generation', async () => {
    const fingerprint = await generateFingerprint('2024-01-01', 10000, 'Target');

    expect(fingerprint).toHaveLength(64);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

#### 5. Testing Error Handling

```typescript
it('should throw error for invalid input', () => {
  expect(() => {
    validateAmount(-100);
  }).toThrow('Amount must be positive');
});
```

### E2E Testing Best Practices

#### 1. Page Object Pattern

```typescript
// e2e/utils/pages/ImportPage.ts
export class ImportPage {
  constructor(private page: Page) {}

  async selectAccount(accountName: string) {
    await this.page.getByRole('main').getByRole('combobox').selectOption(accountName);
  }

  async uploadCSV(filename: string) {
    const filePath = path.join(__dirname, '../../fixtures', filename);
    await this.page.setInputFiles('input[type="file"]', filePath);
  }
}

// Use in tests
test('import workflow', async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.selectAccount('Checking');
  await importPage.uploadCSV('sample-transactions.csv');
});
```

#### 2. Data Cleanup

```typescript
import { test } from '@playwright/test';
import { cleanupAllTransactions } from './utils/cleanup';

test.afterEach(async ({ page }) => {
  // Clean up test data after each test
  await cleanupAllTransactions(page);
});
```

#### 3. Wait for Network Idle

```typescript
// Wait for Supabase queries to complete
await page.waitForLoadState('networkidle');

// Or wait for specific element
await page.locator('text=Import Complete').waitFor({ timeout: 10000 });
```

#### 4. Screenshots and Debugging

```typescript
// Take screenshot for debugging
await page.screenshot({ path: 'debug.png', fullPage: true });

// Enable Playwright inspector
// Run: npm run test:e2e -- --debug
```

### Database Testing Patterns

#### Testing with Supabase

```typescript
// Mock Supabase client for unit tests
import { vi } from 'vitest';

vi.mock('../lib/supabase/config', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: mockData, error: null })),
      })),
    })),
  },
}));
```

#### Testing RLS Policies (Manual)

See [supabase-security-checklist.md](./supabase-security-checklist.md) for detailed RLS testing procedures.

---

## Test Coverage Goals

### Current Coverage (Actual - as of 2025-12-25)

**Overall Unit Test Coverage:**

- **Lines:** 96% (329/342)
- **Functions:** 96% (65/68)
- **Branches:** 91% (238/261)
- **Statements:** 96% (329/342)

**Test Suite Stats:**

- **Total Tests:** 158 tests
- **Test Files:** 17 unit test files
- **Status:** ✅ All tests passing
- **Execution Time:** ~3.8 seconds

**Coverage by Module:**

| Module             | Lines   | Functions | Branches | Status       |
| ------------------ | ------- | --------- | -------- | ------------ |
| Import Pipeline    | 94-100% | 88-100%   | 88-100%  | ✅ Excellent |
| Fingerprint        | 100%    | 100%      | N/A      | ✅ Perfect   |
| Fuzzy Matcher      | 100%    | 100%      | 100%     | ✅ Perfect   |
| Reconciler         | 100%    | 100%      | 100%     | ✅ Perfect   |
| Split Calculator   | 100%    | 100%      | 86%      | ✅ Excellent |
| Rules Engine       | 95%     | 100%      | 96%      | ✅ Excellent |
| Reports            | 95%     | 100%      | 77%      | ⚠️ Good      |
| Validation Schemas | 100%    | 100%      | 100%     | ✅ Perfect   |
| Transaction Ops    | 100%    | 100%      | 100%     | ✅ Perfect   |
| Workbench Manager  | 100%    | 100%      | 97%      | ✅ Excellent |
| Payee Guesser      | 90%     | 100%      | 75%      | ⚠️ Good      |
| Supabase Config    | 80%     | N/A       | 75%      | ⚠️ Fair      |

**Uncovered Code Paths (9 total):**

1. **payeeGuesser.ts** - 2 lines, 2 branches (error handling edge cases)
2. **parser.ts** - 2 lines, 2 functions (async error callbacks)
3. **reports.ts** - 2 lines, 5 branches (date filtering edge cases)
4. **rules/matcher.ts** - 3 lines, 2 branches (regex error handling)
5. **mapper.ts** - 3 lines, 1 function, 9 branches (CSV parsing edge cases)
6. **config.ts** - 1 line, 1 branch (environment variable fallback)
7. **splitCalculator.ts** - 2 branches (validation edge cases)
8. **workbenchDataManager.ts** - 1 branch (filter logic edge case)

### Target Coverage

- **Business Logic:** ✅ **96%** (exceeds 95% target)
- **Validation Schemas:** ✅ **100%** (meets target)
- **Supabase Client Functions:** ⚠️ **80%** (below 90% target, add error scenarios)
- **React Components:** **0%** (E2E coverage sufficient, component tests low priority)
- **E2E Critical Paths:** ✅ **100%** (4 workflows fully covered)

---

## Manual Testing Requirements

### Pre-Release Checklist

- [ ] **Multi-User Access**
  - Create bookset with owner user
  - Grant editor access to second user
  - Grant viewer access to third user
  - Verify permissions (edit/view restrictions)

- [ ] **Email Verification Flow**
  - Sign up new user
  - Verify email confirmation sent
  - Complete email verification
  - Ensure user profile created

- [ ] **Large Dataset Performance**
  - Import 10,000+ transactions
  - Test workbench scrolling/filtering
  - Verify query performance (<2s)
  - Check React Query caching

- [ ] **Concurrent Edits**
  - Open same transaction in two browser tabs
  - Edit in first tab, save
  - Edit in second tab, attempt save
  - Verify version conflict detection

- [ ] **RLS Policy Enforcement**
  - Follow [supabase-security-checklist.md](./supabase-security-checklist.md)
  - Test all CRUD operations with different users
  - Verify data isolation between booksets

### Browser Compatibility Testing

**Target Browsers:**

- Chrome/Edge (Chromium) - Latest 2 versions
- Firefox - Latest 2 versions
- Safari - Latest 2 versions (macOS/iOS)

**Test Critical Paths:**

- CSV import workflow
- Transaction editing in workbench
- Reconciliation process
- Report generation

---

## Contributing Tests

### Adding a New Unit Test

1. Create test file next to source file:

   ```text
   src/lib/myFeature.ts  →  src/lib/myFeature.test.ts
   ```

2. Use descriptive test names:

   ```typescript
   it('should calculate tax deduction for business expenses', () => {
     // Test implementation
   });
   ```

3. Test happy path and edge cases:

   ```typescript
   describe('calculateTax', () => {
     it('should calculate tax for positive income', () => { ... });
     it('should handle zero income', () => { ... });
     it('should handle negative amounts (losses)', () => { ... });
     it('should throw error for invalid tax rate', () => { ... });
   });
   ```

4. Run tests before committing:

   ```bash
   npm run test -- --run
   ```

### Adding a New E2E Test

1. Create spec file in `e2e/`:

   ```text
   e2e/my-feature-workflow.spec.ts
   ```

2. Use test fixtures for sample data:

   ```typescript
   const csvPath = path.join(__dirname, 'fixtures', 'sample-data.csv');
   ```

3. Add cleanup to prevent test pollution:

   ```typescript
   test.afterEach(async ({ page }) => {
     await cleanup(page);
   });
   ```

4. Run E2E tests locally before committing:

   ```bash
   npm run test:e2e
   ```

---

## Troubleshooting

### Common Issues

#### Tests Pass Locally But Fail in CI

- **Check Node version:** CI uses Node 20.x
- **Environment variables:** Ensure all env vars set in CI secrets
- **Timing issues:** Add explicit waits for async operations
- **File paths:** Use `path.join()` for cross-platform compatibility

#### Playwright Tests Timeout

- **Increase timeout:** Add `{ timeout: 30000 }` to `waitFor()` calls
- **Network issues:** Check Supabase connection
- **Authentication:** Verify `PLAYWRIGHT_EMAIL` and `PLAYWRIGHT_PASSWORD` set

#### Coverage Report Empty

- **Check exclude patterns:** Ensure source files not excluded in config
- **Run with coverage flag:** `npm run test:coverage`
- **Check imports:** Ensure test files import functions under test

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Changelog

### 2025-12-25

- Initial testing strategy documentation created
- Documented 17 unit test files and 4 E2E test files
- Identified gaps: CI coverage reporting, E2E in CI, component tests
- Defined testing patterns and guidelines
