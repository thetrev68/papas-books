# Testing Gaps & Implementation Plan

**Task:** Production Readiness Plan - Task 2.7
**Date:** 2025-12-25
**Status:** Analysis Complete

---

## Executive Summary

Papa's Books has **strong test coverage** for business logic and critical user workflows:

- ✅ **17 unit test files** covering import pipeline, calculations, rules engine, and validation
- ✅ **4 comprehensive E2E tests** covering all critical user workflows
- ✅ **CI/CD integration** running unit tests on every PR and push to main
- ✅ **Testing infrastructure** fully configured (Vitest, Playwright, coverage tools)

### Key Gaps Identified

1. **❌ Coverage reporting not integrated into CI** - Coverage generated locally but not tracked/enforced
2. **❌ E2E tests not running in CI** - Only unit tests run automatically
3. **⚠️ No React component tests** - Low priority (covered by E2E)
4. **⚠️ No performance regression testing** - No automated checks for performance degradation
5. **⚠️ Limited concurrent edit testing** - Optimistic locking exists but needs E2E validation

---

## Detailed Gap Analysis

### Gap 1: Coverage Reporting in CI ❌ HIGH PRIORITY

**Current State:**

- Coverage can be generated locally with `npm run test:coverage`
- No coverage reports uploaded to CI
- No minimum coverage thresholds enforced
- No historical tracking of coverage trends

**Impact:**

- Cannot see coverage changes in PRs
- Risk of coverage declining over time
- No visibility into untested code paths

**Recommendation:** Integrate Codecov or similar service

**Effort:** 1-2 hours

---

### Gap 2: E2E Tests Not in CI ❌ HIGH PRIORITY

**Current State:**

- 4 comprehensive Playwright E2E tests exist
- Tests run locally with `npm run test:e2e`
- Not integrated into CI workflow
- No automated regression testing for UI

**Impact:**

- UI regressions could be missed before deployment
- Manual testing required for every PR
- No confidence in deploy process

**Recommendation:** Add E2E job to CI workflow

**Effort:** 2-3 hours (including auth setup)

**Challenges:**

- Requires test user credentials in CI secrets
- Need Supabase test environment or staging DB
- Playwright browser installation in CI

---

### Gap 3: React Component Tests ⚠️ LOW PRIORITY

**Current State:**

- No React Testing Library component tests
- E2E tests provide UI coverage for critical paths
- Complex component logic tested indirectly

**Impact:**

- Slower feedback loop (E2E slower than component tests)
- Edge cases in component logic might be missed
- Harder to debug component-specific issues

**Recommendation:** Add component tests for complex components only

**Priority:** LOW (defer until after launch)

**Target Components:**

1. `WorkbenchTable` - Complex keyboard navigation, inline editing
2. `TransactionSplitEditor` - Split line calculations, validation
3. `RuleEditor` - Pattern matching validation
4. `ImportWizard` - Multi-step form state management

**Effort:** 4-6 hours for 4 components

---

### Gap 4: Performance Regression Testing ⚠️ MEDIUM PRIORITY

**Current State:**

- Performance benchmarks documented in [performance-test-results.md](./performance-test-results.md)
- No automated performance testing
- No bundle size monitoring
- No query performance regression detection

**Impact:**

- Performance regressions could slip into production
- Bundle size could grow unchecked
- Slow queries might not be detected until production

**Recommendation:** Add performance checks to CI

**Targets:**

1. **Bundle Size Limits:** Fail CI if bundle exceeds threshold
2. **Lighthouse CI:** Automated performance audits
3. **Query Performance:** Benchmark critical queries in E2E tests

**Effort:** 3-4 hours

**Example Implementation:**

```yaml
# Add to CI workflow
- name: Check bundle size
  run: |
    npm run build
    # Fail if main bundle exceeds 500KB
    MAX_SIZE=512000
    BUNDLE_SIZE=$(stat -c%s dist/assets/index-*.js)
    if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
      echo "Bundle size $BUNDLE_SIZE exceeds limit $MAX_SIZE"
      exit 1
    fi
```

---

### Gap 5: Concurrent Edit E2E Tests ⚠️ MEDIUM PRIORITY

**Current State:**

- Optimistic locking implemented (Task 2.6)
- Documentation in [optimistic-locking-guide.md](./optimistic-locking-guide.md)
- Manual testing only
- No automated validation of version conflict detection

**Impact:**

- Concurrent edit conflicts might not be detected
- Cache invalidation bugs could slip through
- Version mismatch errors might surface in production

**Recommendation:** Add E2E test simulating concurrent edits

**Effort:** 2-3 hours

**Test Scenario:**

1. Open transaction in two browser contexts
2. Edit and save in first context
3. Attempt edit and save in second context (should fail with version error)
4. Verify user sees conflict message
5. Verify data integrity maintained

---

## Implementation Plan

### Phase 1: High Priority (Before Production) ⚠️

**Estimated Time:** 3-5 hours

#### Task 1.1: Add Coverage Reporting to CI

**Acceptance Criteria:**

- [ ] Coverage report uploaded to Codecov on every CI run
- [ ] Coverage badge added to README.md
- [ ] Minimum coverage threshold enforced (80% for business logic)
- [ ] Coverage diff shown in PR comments

**Files to Modify:**

- `.github/workflows/ci.yml` - Add coverage upload step

**Implementation:**

```yaml
# Add after "Run tests" step in ci.yml
- name: Generate coverage report
  run: npm run test:coverage -- --run

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/coverage-final.json
    fail_ci_if_error: false # Don't fail CI if Codecov is down
    token: ${{ secrets.CODECOV_TOKEN }}
```

**Setup Steps:**

1. Create Codecov account and link repository
2. Add `CODECOV_TOKEN` to GitHub secrets
3. Update workflow file
4. Test by pushing to feature branch

---

#### Task 1.2: Add E2E Tests to CI

**Acceptance Criteria:**

- [ ] E2E tests run automatically on every PR
- [ ] Playwright browsers installed in CI
- [ ] Test reports uploaded as artifacts on failure
- [ ] Retries configured for flaky tests

**Files to Modify:**

- `.github/workflows/ci.yml` - Add e2e-tests job

**Implementation:**

```yaml
# Add new job to .github/workflows/ci.yml
e2e-tests:
  runs-on: ubuntu-latest
  needs: build-and-test # Run after unit tests pass
  timeout-minutes: 15

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

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

**Setup Steps:**

1. Create test user in Supabase (production or staging)
2. Add `PLAYWRIGHT_EMAIL` and `PLAYWRIGHT_PASSWORD` to GitHub secrets
3. Update workflow file
4. Test by pushing to feature branch

**Considerations:**

- **Test Data Cleanup:** Ensure tests clean up after themselves
- **Idempotency:** Tests should be runnable multiple times
- **Retries:** Configure retries for flaky tests (already in playwright.config.ts)

---

### Phase 2: Medium Priority (Post-Launch Enhancements)

**Estimated Time:** 5-8 hours

#### Task 2.1: Add Bundle Size Monitoring

**Effort:** 1-2 hours

**Implementation:**

- Add bundlesize package: `npm install --save-dev bundlesize`
- Configure size limits in package.json
- Add check to CI workflow

```json
// package.json
{
  "bundlesize": [
    {
      "path": "./dist/assets/index-*.js",
      "maxSize": "500 kB"
    },
    {
      "path": "./dist/assets/vendor-*.js",
      "maxSize": "300 kB"
    }
  ]
}
```

---

#### Task 2.2: Add Concurrent Edit E2E Test

**Effort:** 2-3 hours

**Files to Create:**

- `e2e/concurrent-edit.spec.ts`

**Test Flow:**

```typescript
import { test, expect } from '@playwright/test';

test('handles concurrent transaction edits with optimistic locking', async ({ browser }) => {
  // Create two separate browser contexts (simulating two users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  // Both users navigate to same transaction
  await page1.goto('/workbench');
  await page2.goto('/workbench');

  const transactionId = await selectFirstTransaction(page1);
  await selectTransactionById(page2, transactionId);

  // User 1 edits and saves
  await editPayee(page1, 'User 1 Payee');
  await savePage1);  // This should succeed

  // User 2 edits and attempts to save (should fail with version error)
  await editPayee(page2, 'User 2 Payee');
  await save(page2);  // This should show conflict error

  // Verify error message shown
  await expect(page2.locator('text=/version conflict|data has changed/i')).toBeVisible();

  // Verify data integrity - page 1's edit should be persisted
  const savedPayee = await getPayeeName(page1, transactionId);
  expect(savedPayee).toBe('User 1 Payee');

  await context1.close();
  await context2.close();
});
```

---

#### Task 2.3: Add Lighthouse CI for Performance Audits

**Effort:** 2-3 hours

**Implementation:**

```yaml
# Add to CI workflow
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

**Configuration file:** `lighthouserc.js`

```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
      },
    },
  },
};
```

---

### Phase 3: Low Priority (Future Improvements)

**Estimated Time:** 4-6 hours

#### Task 3.1: Add Component Tests for Complex Components

**Target Components:**

1. `WorkbenchTable.test.tsx` - Keyboard navigation, inline editing
2. `TransactionSplitEditor.test.tsx` - Split calculations
3. `RuleEditor.test.tsx` - Pattern validation
4. `ImportWizard.test.tsx` - Multi-step form state

**Example:**

```typescript
// src/components/workbench/WorkbenchTable.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkbenchTable } from './WorkbenchTable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('allows editing payee inline with keyboard', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();

  render(
    <WorkbenchTable
      transactions={mockTransactions}
      onUpdate={onUpdate}
    />,
    { wrapper: createWrapper() }
  );

  // Click payee cell to enter edit mode
  const payeeCell = screen.getByText('Original Payee');
  await user.click(payeeCell);

  // Verify input is focused
  const input = screen.getByRole('textbox');
  expect(input).toHaveFocus();

  // Edit and save with Enter key
  await user.clear(input);
  await user.type(input, 'New Payee{Enter}');

  // Verify update callback called
  expect(onUpdate).toHaveBeenCalledWith({
    id: expect.any(String),
    payee: 'New Payee',
  });
});

test('cancels edit on Escape key', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();

  render(
    <WorkbenchTable
      transactions={mockTransactions}
      onUpdate={onUpdate}
    />,
    { wrapper: createWrapper() }
  );

  const payeeCell = screen.getByText('Original Payee');
  await user.click(payeeCell);

  const input = screen.getByRole('textbox');
  await user.type(input, 'Modified{Escape}');

  // Verify update NOT called
  expect(onUpdate).not.toHaveBeenCalled();

  // Verify original value restored
  expect(screen.getByText('Original Payee')).toBeInTheDocument();
});
```

---

## Testing Best Practices (Updated)

### 1. Write Tests Before Fixing Bugs

When a bug is reported:

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify test passes
4. This prevents regression

### 2. Keep Tests Fast

- **Unit tests:** Should run in milliseconds
- **E2E tests:** Should complete in <30 seconds each
- Use test doubles (mocks/stubs) for external dependencies

### 3. Test Behavior, Not Implementation

❌ **Bad:** Testing internal state

```typescript
// Don't test implementation details
expect(component.state.isLoading).toBe(true);
```

✅ **Good:** Testing user-visible behavior

```typescript
// Test what users see
expect(screen.getByText('Loading...')).toBeInTheDocument();
```

### 4. Use Descriptive Test Names

❌ **Bad:**

```typescript
it('works', () => { ... });
it('test 1', () => { ... });
```

✅ **Good:**

```typescript
it('should calculate reconciliation balance correctly with mixed deposits and withdrawals', () => { ... });
it('should show version conflict error when concurrent edit detected', () => { ... });
```

### 5. One Assertion Per Test (When Possible)

This makes it easier to identify what broke:

```typescript
// Instead of:
it('should validate transaction', () => {
  expect(tx.isValid).toBe(true);
  expect(tx.errors).toHaveLength(0);
  expect(tx.fingerprint).toBeDefined();
});

// Prefer:
describe('transaction validation', () => {
  it('should mark valid transaction as valid', () => {
    expect(tx.isValid).toBe(true);
  });

  it('should have no errors for valid transaction', () => {
    expect(tx.errors).toHaveLength(0);
  });

  it('should generate fingerprint for valid transaction', () => {
    expect(tx.fingerprint).toBeDefined();
  });
});
```

---

## Success Metrics

### Coverage Targets

| Category                  | Current | Target |
| ------------------------- | ------- | ------ |
| Business Logic            | ~95%    | 95%+   |
| Validation Schemas        | ~100%   | 100%   |
| Supabase Client Functions | ~30%    | 70%+   |
| React Components          | ~0%     | 40%+   |
| E2E Critical Paths        | 100%    | 100%   |

### CI/CD Metrics

- [ ] Unit tests run on every PR (✅ Already implemented)
- [ ] E2E tests run on every PR (🔴 To implement)
- [ ] Coverage report generated on every PR (🔴 To implement)
- [ ] Performance budgets enforced (🔴 To implement)
- [ ] Test execution time <5 minutes total (🟡 Monitor)

### Quality Metrics

- [ ] Zero known bugs in production for critical paths
- [ ] All new features include tests
- [ ] Test failures investigated within 24 hours
- [ ] Flaky tests fixed or quarantined within 1 week

---

## Comparison with Task 2.7 Requirements

### ✅ Acceptance Criteria Met

1. **✅ Test coverage report generated**
   - Can generate locally with `npm run test:coverage`
   - Shows detailed line/branch/function coverage
   - **Gap:** Not integrated into CI (Phase 1 task)

2. **✅ Documentation of what's tested vs. not tested**
   - Created [testing-strategy.md](./testing-strategy.md)
   - Documents 17 unit tests and 4 E2E tests
   - Identifies gaps and missing coverage

3. **✅ Testing guidelines for future features**
   - Best practices documented
   - Test patterns and examples provided
   - Contributing guidelines included

4. **⚠️ CI/CD integration documented**
   - Unit tests integrated (✅)
   - E2E tests not integrated (🔴)
   - Coverage reporting not integrated (🔴)

---

## Recommended Action Plan

### Immediate (Before Production Launch)

1. **Add coverage reporting to CI** (1-2 hours)
   - Provides visibility into coverage trends
   - Prevents coverage regression

2. **Add E2E tests to CI** (2-3 hours)
   - Automates regression testing
   - Increases deployment confidence

### Short-term (Within 1 Month Post-Launch)

1. **Add concurrent edit E2E test** (2-3 hours)
   - Validates optimistic locking implementation
   - Critical for multi-user scenarios

2. **Add bundle size monitoring** (1-2 hours)
   - Prevents performance degradation
   - Quick to implement, high value

### Long-term (As Needed)

1. **Add component tests for complex components** (4-6 hours)
   - Lower priority (E2E tests provide coverage)
   - Useful for faster feedback on component changes

2. **Add Lighthouse CI** (2-3 hours)
   - Automated performance audits
   - Catches performance regressions early

---

## Conclusion

Papa's Books has **excellent testing fundamentals** in place:

- ✅ Comprehensive business logic coverage
- ✅ E2E tests for all critical workflows
- ✅ Modern testing infrastructure (Vitest, Playwright)
- ✅ Unit tests integrated into CI

### Main Gaps

The primary gaps are in **CI/CD integration** rather than test coverage itself:

1. Coverage reporting not in CI (easy fix)
2. E2E tests not in CI (requires test environment setup)
3. Performance monitoring not automated (nice-to-have)

### Estimated Total Effort

- **Phase 1 (Critical):** 3-5 hours
- **Phase 2 (Important):** 5-8 hours
- **Phase 3 (Nice-to-have):** 4-6 hours

**Total:** 12-19 hours to reach production-ready testing maturity.

### Recommendation

**Proceed with Phase 1 tasks before production launch.** The existing test suite provides strong confidence in code quality, but CI integration is essential for maintaining that quality over time.
