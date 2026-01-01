# Papa's Books - Remaining Improvements

This document lists improvements identified during the pre-launch code review.
These are organized by priority and can be addressed incrementally after launch.

## High Priority

### 1. Modal Focus Trap & Keyboard Dismiss ✅ COMPLETED

**File:** `src/components/ui/Modal.tsx`

The modal component lacks:

- Focus trap (focus should stay within modal)
- Focus restoration on close
- Escape key handler to dismiss

**Fix:** Install `focus-trap-react` or implement manual focus management:

```tsx
import FocusTrap from 'focus-trap-react';

// Wrap modal content in FocusTrap
<FocusTrap>
  <div role="dialog" aria-modal="true">
    {/* modal content */}
  </div>
</FocusTrap>;
```

**Status:** Implemented manual focus management without external dependencies:

- Added focus trap using Tab key event handler
- Implemented focus restoration on close
- Added Escape key handler to dismiss modal
- Modal now focuses on mount and restores focus to previously focused element on unmount

### 2. Transaction Pagination

**File:** `src/lib/supabase/transactions.ts` (lines 9-25)

`fetchTransactions()` loads ALL transactions without limit. For large booksets,
this causes slow loads and memory issues.

**Fix:** Implement cursor-based pagination:

```typescript
export async function fetchTransactions(
  booksetId: string,
  options?: { limit?: number; offset?: number }
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('bookset_id', booksetId)
    .eq('is_archived', false) // Also add this filter
    .order('date', { ascending: false });

  if (options?.limit) {
    query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
  }

  const { data, error } = await query;
  // ...
}
```

### 3. RLS Policy - Prevent Moving Transactions Between Booksets

**File:** `supabase/schema.sql` (lines 499-502)

The UPDATE policy doesn't verify `bookset_id` remains unchanged.

**Fix:** Update the policy:

```sql
CREATE POLICY "Editors can update unreconciled transactions"
  ON public.transactions FOR UPDATE
  USING (user_can_write_bookset(bookset_id) AND reconciled = false)
  WITH CHECK (
    user_can_write_bookset(bookset_id)
    AND reconciled = false
    AND bookset_id = (SELECT t.bookset_id FROM transactions t WHERE t.id = transactions.id)
  );
```

### 4. Import Batch Atomicity

**File:** `src/lib/supabase/import.ts` (lines 95-156)

If transaction insertion fails after batch creation, orphaned batch records remain.

**Fix:** Create an RPC function that handles both operations atomically:

```sql
CREATE OR REPLACE FUNCTION commit_import_batch(
  p_bookset_id uuid,
  p_account_id uuid,
  p_transactions jsonb
) RETURNS jsonb AS $$
DECLARE
  v_batch_id uuid;
  v_count int;
BEGIN
  -- Create batch
  INSERT INTO import_batches (bookset_id, account_id, ...)
  VALUES (p_bookset_id, p_account_id, ...)
  RETURNING id INTO v_batch_id;

  -- Insert transactions
  INSERT INTO transactions (...)
  SELECT ... FROM jsonb_to_recordset(p_transactions);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('batchId', v_batch_id, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. ReDoS Protection in Rules Engine

**File:** `src/lib/rules/matcher.ts` (lines 40-48)

User-supplied regex patterns are executed directly. Malicious patterns could
cause denial of service.

**Fix Options:**

1. Use `re2` library (Google's safe regex engine)
2. Add timeout wrapper around regex execution
3. Limit regex pattern complexity (no nested quantifiers)

```typescript
import RE2 from 're2';

function safeRegexMatch(pattern: string, text: string): boolean {
  try {
    const regex = new RE2(pattern, 'i');
    return regex.test(text);
  } catch {
    return false; // Invalid regex
  }
}
```

## Medium Priority

### 6. Extract Duplicated Category Sorting Logic

**Files:**

- `src/components/workbench/WorkbenchTable.tsx` (lines 67-104)
- `src/components/workbench/SplitModal.tsx` (lines 21-57)
- `src/pages/ReportsPage.tsx` (lines 33-69)

**Fix:** Create shared utility:

```typescript
// src/lib/categoryUtils.ts
export interface CategoryWithDisplayName extends Category {
  displayName: string;
}

export function getSortedCategories(categories: Category[]): CategoryWithDisplayName[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const getRoot = (cat: Category): Category => {
    // ... existing logic
  };

  const getFullName = (cat: Category): string => {
    // ... existing logic
  };

  return [...categories]
    .sort((a, b) => {
      // ... existing logic
    })
    .map((cat) => ({
      ...cat,
      displayName: getFullName(cat),
    }));
}

// Hook version
export function useSortedCategories(): CategoryWithDisplayName[] {
  const { categories } = useCategories();
  return useMemo(() => getSortedCategories(categories), [categories]);
}
```

### 7. Split Large Components

**Files:**

- `src/components/workbench/WorkbenchTable.tsx` (729 lines)
- `src/pages/ReportsPage.tsx` (1024 lines)

**Fix:** Extract into smaller, focused components:

WorkbenchTable:

- `WorkbenchColumns.tsx` - Column definitions
- `WorkbenchToolbar.tsx` - Bulk action toolbar
- `WorkbenchMobileCard.tsx` - Mobile card view

ReportsPage:

- `CategoryReportView.tsx`
- `TaxLineReportView.tsx`
- `QuarterlyReportView.tsx`
- `YearComparisonReportView.tsx`

### 8. Random ID Generation Fix

**File:** `src/components/workbench/PayeeSelectCell.tsx` (line 27)

```typescript
// Bad: New ID on every render
const listId = `payees-list-${Math.random().toString(36).substr(2, 9)}`;

// Good: Stable ID with React 18's useId hook
const listId = useId();
```

### 9. Vite Chunk Splitting

**File:** `vite.config.ts`

Add manual chunks to reduce initial bundle size:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual'],
        'vendor-supabase': ['@supabase/supabase-js'],
      }
    }
  }
}
```

### 10. Mobile Navigation - Include Settings

**File:** `src/components/AppLayout.tsx` (line 279)

```typescript
// Current: Only shows first 5 links, excluding Settings
{navLinks.slice(0, 5).map((link) => {

// Fix: Include all links or add "More" menu
{navLinks.map((link) => {
```

### 11. Tax Year Lock Error Handling

**File:** `src/lib/supabase/taxYearLocks.ts`

Functions throw raw Supabase errors. Wrap with `handleSupabaseError()`:

```typescript
export async function lockTaxYear(booksetId: string, year: number): Promise<void> {
  const { error } = await supabase.rpc('lock_tax_year', {
    p_bookset_id: booksetId,
    p_year: year,
  });

  if (error) throw handleSupabaseError(error);
}
```

### 12. Missing 404 Route

**File:** `src/main.tsx` (lines 51-68)

Add catch-all route:

```tsx
<Route path="*" element={<NotFoundPage />} />
```

### 13. Move DevTools to devDependencies

**File:** `package.json`

Move `@tanstack/react-query-devtools` from `dependencies` to `devDependencies`.

### 14. AuthContext Value Memoization

**File:** `src/context/AuthContext.tsx` (lines 300-313)

```typescript
// Current: Object recreated every render
value={{
  ...authState,
  signUp,
  // ...
}}

// Fix: Memoize the value
const value = useMemo(() => ({
  ...authState,
  signUp,
  signIn,
  signOut,
  resetPassword,
  switchBookset,
  retryAuth,
  canEdit,
  canAdmin,
  loading,
}), [authState, canEdit, canAdmin, loading]);
```

### 15. Magic Numbers to Constants

Create `src/lib/constants.ts`:

```typescript
export const AUTH_TIMEOUT_MS = 8000;
export const AUTH_RETRY_DELAY_MS = 500;
export const TOAST_DURATION_ERROR_MS = 5000;
export const TOAST_DURATION_SUCCESS_MS = 3000;
export const TOAST_DURATION_WARNING_MS = 4000;
export const SUPABASE_BATCH_SIZE = 100;
```

## Low Priority

### 16. Form Input Accessibility

**Files:**

- `src/components/workbench/SplitModal.tsx` (lines 134-162)
- `src/components/reconcile/ReconcileSetup.tsx`
- `src/components/settings/AccountFormModal.tsx`

Add `aria-describedby` for error messages and `aria-label` for inputs without
visible labels.

### 17. Component-Level Tests

Add `.test.tsx` files for React components:

- `WorkbenchTable.test.tsx`
- `Modal.test.tsx`
- `GlobalToastProvider.test.tsx`

### 18. JSONB Type Safety

**File:** `src/types/database.ts`

Replace `unknown` types with proper interfaces:

```typescript
// Instead of:
csv_mapping?: Record<string, unknown>;

// Use:
csv_mapping?: CsvMapping;
```

### 19. Route-Level Code Splitting

**File:** `src/main.tsx`

Use `React.lazy()` for page components:

```typescript
const WorkbenchPage = React.lazy(() => import('./pages/WorkbenchPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));

// Wrap routes in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Route path="workbench" element={<WorkbenchPage />} />
</Suspense>
```

### 20. Database Constraints

**File:** `supabase/schema.sql`

Add UNIQUE constraints to prevent duplicate names:

```sql
ALTER TABLE categories ADD CONSTRAINT unique_category_name_per_bookset
  UNIQUE (bookset_id, name);

ALTER TABLE payees ADD CONSTRAINT unique_payee_name_per_bookset
  UNIQUE (bookset_id, name);
```

### 21. CI Security Audit

**File:** `.github/workflows/ci.yml`

Add npm audit step:

```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

### 22. Dependabot Configuration

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
```

## Notes

- Priority levels are suggestions; adjust based on your timeline and user impact
- High priority items address security, performance, or data integrity concerns
- Medium priority items improve maintainability and developer experience
- Low priority items are nice-to-have improvements
