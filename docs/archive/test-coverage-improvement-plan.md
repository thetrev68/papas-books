# Test Coverage Improvement Plan: Reach 90% Coverage Target

## Current Status

- **Overall Coverage**: 15.39% lines, 11.37% functions
- **Target**: 90% for lines, functions, branches, statements
- **Gap**: ~75% coverage improvement needed

## Coverage Analysis

### Well-Tested Areas (Keep as-is)

- ✅ Import pipeline: 94.37% (fingerprint, mapper, parser, reconciler, fuzzy-matcher)
- ✅ Validation layer: 100% (all Zod schemas and validators)
- ✅ Split calculator: 100%
- ✅ Core business logic: reports, transactionOperations, workbenchDataManager, reconciler, errors

### Critical Gaps (0% Coverage)

1. **Supabase data layer** (1.08% overall)
   - transactions.ts, accounts.ts, categories.ts, rules.ts, payees.ts
2. **Rules engine** (47.32% overall)
   - rules/applicator.ts (0% - 232 lines, NO tests)
3. **React hooks** (0% overall)
   - useTransactionMutations, useApplyRules, useWorkbenchData, useCategories, useAccounts
4. **Context providers** (0%)
   - AuthContext.tsx (auth + bookset management)
5. **React components** (0%)
   - All 31 components, 10 pages untested

## Strategy: Comprehensive Testing Approach

Based on user preferences:

- ✅ **Comprehensive coverage** across all layers (not just fast path)
- ✅ **Exclude pure UI/config** files to focus on testable logic
- ✅ **@testing-library/react** with renderHook for React testing
- ✅ **Shared mock utilities** for consistency and reusability

Approach:

### Phase 1: Data Layer & Business Logic (Priority 1 - CRITICAL)

**Target**: 80-90% of the 75% gap
**Estimated Coverage Gain**: ~60-65%

Test the core data integrity and business logic functions that have the highest impact:

#### 1A. Supabase Data Access Layer (~15-20% gain)

**Files** (in order):

1. `src/lib/supabase/transactions.ts` - Most critical
   - Test: create, update, delete, bulk operations
   - Test: optimistic locking (version conflicts)
   - Test: split transaction handling
   - Test: fingerprint generation
   - Test: soft delete (is_archived)

2. `src/lib/supabase/accounts.ts`
   - Test: CRUD operations
   - Test: opening balance handling
   - Test: CSV mapping configuration
   - Test: optimistic locking

3. `src/lib/supabase/categories.ts`
   - Test: CRUD operations
   - Test: parent-child relationships
   - Test: hierarchy validation

4. `src/lib/supabase/rules.ts`
   - Test: CRUD operations
   - Test: keyword normalization
   - Test: priority ordering

**Testing Approach**:

- Mock Supabase client with `vi.mock('@supabase/supabase-js')`
- Test query building logic
- Test response transformation
- Test error handling (RLS violations, constraint errors)

#### 1B. Rules Engine (~5-8% gain)

**Files**:

1. `src/lib/rules/applicator.ts` - CRITICAL GAP
   - Test: apply rules to transaction batch
   - Test: category assignment hierarchy (rule → payee default → none)
   - Test: reconciliation status checks
   - Test: usage statistics updates
   - Test: concurrent updates (optimistic locking)
   - Test: error handling and retry

**Testing Approach**:

- Mock Supabase client
- Test with realistic transaction fixtures
- Verify category/payee updates applied correctly

#### 1C. Core React Hooks (~10-15% gain)

**Files** (in order):

1. `src/hooks/useTransactionMutations.ts`
   - Test: mutations trigger cache invalidation
   - Test: optimistic updates on success
   - Test: rollback on error

2. `src/hooks/useApplyRules.ts`
   - Test: batch fetching with URL limits
   - Test: query invalidation after application
   - Test: error handling

3. `src/hooks/useWorkbenchData.ts`
   - Test: data aggregation logic
   - Test: query key construction
   - Test: filtering/sorting

4. `src/hooks/useAccounts.ts`, `useCategories.ts`, `useRules.ts`, `usePayees.ts`
   - Test: mutation success paths
   - Test: cache invalidation

**Testing Approach**:

- Use `@testing-library/react-hooks` or `renderHook` from `@testing-library/react`
- Mock React Query client
- Mock Supabase functions
- Verify cache invalidation calls

#### 1D. AuthContext (~3-5% gain)

**File**: `src/context/AuthContext.tsx`

**Tests**:

- User authentication flow
- Bookset switching with permission updates
- Retry logic with exponential backoff
- Session expiration handling
- Error recovery

**Testing Approach**:

- Render provider with mock Supabase auth
- Test state transitions
- Verify RLS enforcement during bookset switches

### Phase 2: Targeted Component Testing (Priority 2 - HIGH)

**Target**: 10-15% of remaining gap
**Estimated Coverage Gain**: ~8-12%

Focus on components with significant business logic (not pure presentation):

#### High-Value Component Tests

1. `src/components/workbench/CreateTransactionModal.tsx`
   - Form validation (amount, date, description)
   - Split transaction creation
   - Category/payee selection

2. `src/components/workbench/SplitModal.tsx`
   - Split line editing
   - Amount validation (must sum to total)
   - Category assignment

3. `src/components/import/MappingForm.tsx`
   - CSV column mapping
   - Field validation
   - Bank profile selection

4. `src/components/settings/RuleFormModal.tsx`
   - Pattern validation (regex, keywords)
   - Priority assignment
   - Match type selection

**Testing Approach**:

- Use `@testing-library/react` with `userEvent`
- Mock Supabase hooks
- Test user interactions and form submissions
- Verify validation error display

### Phase 3: Import Coverage Polishing (Priority 3 - MEDIUM)

**Target**: 5-10% of remaining gap
**Estimated Coverage Gain**: ~3-5%

Fill remaining gaps in well-tested areas:

1. `src/lib/import/mapper.ts` - Increase from 94% to 100%
   - Test edge cases: lines 169, 179, 189
   - Test amount mode switching edge cases

2. `src/lib/import/bank-profiles.ts` - Increase from 0% to 90%
   - Test each bank profile definition
   - Verify field mappings are valid

3. `src/lib/rules/matcher.ts` - Increase from 94% to 100%
   - Test regex error handling (lines 51, 84-85)

### Phase 4: Strategic Coverage for Remaining Files (Optional)

**Target**: Fill in gaps to hit 90%
**Estimated Coverage Gain**: Variable

If still below 90% after Phases 1-3, add minimal tests for:

- Remaining hooks (useOptimisticLocking, useImportSession)
- Remaining Supabase files (reconcile.ts, import.ts, access.ts, reports.ts)
- Page components (ImportPage.tsx, LoginPage.tsx)

**Testing Approach**:

- Smoke tests: verify renders without crashing
- Happy path tests only
- Mock all dependencies

## Step 0: Update vitest.config.ts Coverage Exclusions

Add exclusions for pure UI/config files without business logic:

```typescript
coverage: {
  exclude: [
    // ... existing excludes ...
    'src/components/ui/**',           // Pure presentation components
    'src/components/auth/ThemeToggle.tsx',
    'src/components/auth/PWAInstallPrompt.tsx',
    'src/components/common/GlobalToastProvider.tsx',
    'src/components/ErrorBoundary.tsx',
    'src/lib/queryClient.ts',         // Configuration only
    'src/lib/pwa.ts',                 // Browser API wrapper
    'src/context/ThemeContext.tsx',   // Simple state toggle
    'src/components/RootRedirect.tsx', // Simple routing
    'src/components/ProtectedRoute.tsx', // Auth wrapper
  ],
}
```

## Implementation Checklist

### Phase 1: Data Layer & Business Logic (CRITICAL)

- [ ] Test `src/lib/supabase/transactions.ts`
- [ ] Test `src/lib/supabase/accounts.ts`
- [ ] Test `src/lib/supabase/categories.ts`
- [ ] Test `src/lib/supabase/rules.ts`
- [ ] Test `src/lib/rules/applicator.ts`
- [ ] Test `src/hooks/useTransactionMutations.ts`
- [ ] Test `src/hooks/useApplyRules.ts`
- [ ] Test `src/hooks/useWorkbenchData.ts`
- [ ] Test `src/hooks/useAccounts.ts`
- [ ] Test `src/hooks/useCategories.ts`
- [ ] Test `src/context/AuthContext.tsx`

### Phase 2: High-Value Components (HIGH)

- [ ] Test `src/components/workbench/CreateTransactionModal.tsx`
- [ ] Test `src/components/workbench/SplitModal.tsx`
- [ ] Test `src/components/import/MappingForm.tsx`
- [ ] Test `src/components/settings/RuleFormModal.tsx`

### Phase 3: Coverage Polishing (MEDIUM)

- [ ] Complete `src/lib/import/mapper.ts` (94% → 100%)
- [ ] Test `src/lib/import/bank-profiles.ts` (0% → 90%)
- [ ] Complete `src/lib/rules/matcher.ts` (94% → 100%)

### Phase 4: Strategic Additions (if needed)

- [ ] Test remaining hooks as needed
- [ ] Test remaining Supabase files as needed
- [ ] Add smoke tests for page components as needed

## Testing Utilities to Create

### 1. Mock Supabase Client Factory

**File**: `src/test-utils/mockSupabase.ts`

Create reusable mock for Supabase client:

```typescript
export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    // ... chainable query methods
  })),
  auth: {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
});
```

### 2. React Query Test Wrapper

**File**: `src/test-utils/queryWrapper.tsx`

Wrapper for testing hooks with React Query:

```typescript
export const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

### 3. Transaction Fixtures

**File**: `src/test-utils/fixtures.ts`

Reusable test data:

```typescript
export const mockTransaction = (overrides = {}) => ({
  id: 'test-id',
  bookset_id: 'bookset-1',
  account_id: 'account-1',
  date: '2024-01-15',
  amount: 5000,
  description: 'Test Transaction',
  // ... all required fields
  ...overrides,
});
```

## Expected Outcomes

### Coverage Targets by Phase

- **After Phase 1**: ~75-80% overall coverage
- **After Phase 2**: ~85-90% overall coverage
- **After Phase 3**: ~90-92% overall coverage
- **After Phase 4**: 90%+ guaranteed

### Prioritization Rationale

1. **Data integrity first**: Supabase layer affects all operations
2. **Business logic second**: Rules engine is core functionality
3. **State management third**: Hooks coordinate everything
4. **UI last**: Components are wrappers around tested logic

### Risk Mitigation

- Testing data layer prevents data corruption bugs
- Testing rules engine ensures categorization accuracy
- Testing hooks prevents cache inconsistencies
- Testing components ensures user-facing features work

## Notes

- **Don't aim for 100%**: 90% is the threshold; focus on high-value coverage
- **Mock aggressively**: Don't require actual Supabase connection for unit tests
- **Reuse patterns**: Create test utilities early to speed up later tests
- **Test behavior, not implementation**: Focus on public APIs and outcomes
- **Skip pure UI**: Modal/dialog wrappers don't need comprehensive tests
- **Leverage existing E2E**: Playwright tests already cover critical workflows

## Success Criteria

✅ 90%+ coverage for:

- Lines
- Functions
- Branches
- Statements

✅ All critical data integrity paths tested:

- Transaction mutations
- Rules application
- Split calculations (already done)
- Duplicate detection (already done)

✅ All hooks tested for cache invalidation correctness

✅ Core business logic components tested
