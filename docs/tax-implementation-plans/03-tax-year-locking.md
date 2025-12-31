# Implementation Plan: Tax Year Locking

**Feature:** Tax Year Locking
**Priority:** Phase 2 - Data Protection
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Risk Level:** Medium (affects data modification permissions)

---

## Objective

Prevent modifications to transactions in closed tax years to ensure data integrity after taxes are filed. Once a year is locked, all transactions on or before December 31 of that year become read-only.

---

## Business Rules

### Locking Behavior

1. **Cumulative Locking:** Locking year 2024 implicitly locks all years ≤ 2024
   - Rationale: You can't file 2024 taxes with 2023 transactions still changing
   - Example: If 2024 is locked, transactions from 2023, 2022, etc. are also locked

2. **Maximum Locked Year:** System tracks the highest locked year per bookset
   - Stored in `tax_year_locks` table
   - Query optimization: `WHERE year <= max_locked_year`

3. **Unlock Behavior:** Unlocking a year unlocks ONLY that year (not subsequent years)
   - Example: Bookset has 2023 and 2024 locked
   - Unlocking 2024 → only 2024 becomes editable
   - 2023 remains locked

### Protected Operations

When a transaction date is in a locked year:

- ❌ **Cannot** edit transaction details (payee, amount, category, memo)
- ❌ **Cannot** delete transaction
- ❌ **Cannot** change transaction date (even to unlocked year)
- ❌ **Cannot** split/unsplit transaction
- ❌ **Cannot** mark as reviewed/unreviewed
- ❌ **Cannot** reconcile/unreconcile
- ✅ **Can** view transaction (read-only)
- ✅ **Can** export transaction in reports

### CSV Import Behavior

- CSV imports that include locked transactions → **reject entire batch**
- Show clear error message with list of locked dates
- User must remove locked transactions from CSV before re-import

---

## Current State Analysis

### Existing RLS Functions

✅ These already exist in [supabase/schema.sql](supabase/schema.sql):

- `user_can_read_bookset(bookset_id uuid)` - Read permission check
- `user_owns_bookset(bookset_id uuid)` - Owner permission check
- `user_can_write_bookset(bookset_id uuid)` - Write permission check

### Migration Naming Convention

Existing migrations in `supabase/migrations/`:

- `001_payee_refactor.sql`
- `002_security_hardening_rpc_functions.sql`

Next migration will be: `003_tax_year_locking.sql`

---

## Technical Implementation

### 1. Database Schema

**File:** `supabase/migrations/003_tax_year_locking.sql`

```sql
-- ============================================================================
-- Migration 003: Tax Year Locking
-- ============================================================================
-- Adds tax_year_locks table to prevent modifications to closed tax years
-- ============================================================================

-- Create tax year locks table
CREATE TABLE IF NOT EXISTS public.tax_year_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  tax_year int NOT NULL,
  locked_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_by uuid REFERENCES public.users(id) NOT NULL,
  UNIQUE(bookset_id, tax_year)
);

-- Enable RLS
ALTER TABLE public.tax_year_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read locks for their booksets"
  ON public.tax_year_locks
  FOR SELECT
  USING (user_can_read_bookset(bookset_id));

CREATE POLICY "Owners can manage locks"
  ON public.tax_year_locks
  FOR ALL
  USING (user_owns_bookset(bookset_id))
  WITH CHECK (user_owns_bookset(bookset_id));

-- Index for fast lookups
CREATE INDEX idx_tax_year_locks_bookset
  ON public.tax_year_locks(bookset_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

/**
 * Gets the maximum locked year for a bookset
 * Returns NULL if no years are locked
 */
CREATE OR REPLACE FUNCTION get_max_locked_year(p_bookset_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_year int;
BEGIN
  SELECT MAX(tax_year)
  INTO max_year
  FROM tax_year_locks
  WHERE bookset_id = p_bookset_id;

  RETURN max_year;
END;
$$;

/**
 * Checks if a transaction date is in a locked year
 * A year is considered locked if it's <= the maximum locked year
 */
CREATE OR REPLACE FUNCTION is_date_locked(
  p_bookset_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_locked_year int;
  transaction_year int;
BEGIN
  -- Get max locked year for this bookset
  max_locked_year := get_max_locked_year(p_bookset_id);

  -- If no years are locked, date is not locked
  IF max_locked_year IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Extract year from date
  transaction_year := EXTRACT(YEAR FROM p_date);

  -- Date is locked if its year is <= max locked year
  RETURN transaction_year <= max_locked_year;
END;
$$;

/**
 * Lock a specific tax year
 * Validates that the year hasn't been locked yet
 */
CREATE OR REPLACE FUNCTION lock_tax_year(
  p_bookset_id uuid,
  p_year int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify user owns bookset
  IF NOT user_owns_bookset(p_bookset_id) THEN
    RAISE EXCEPTION 'Only bookset owners can lock tax years';
  END IF;

  -- Insert lock record
  INSERT INTO tax_year_locks (bookset_id, tax_year, locked_by)
  VALUES (p_bookset_id, p_year, auth.uid())
  ON CONFLICT (bookset_id, tax_year) DO NOTHING;
END;
$$;

/**
 * Unlock a specific tax year
 */
CREATE OR REPLACE FUNCTION unlock_tax_year(
  p_bookset_id uuid,
  p_year int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify user owns bookset
  IF NOT user_owns_bookset(p_bookset_id) THEN
    RAISE EXCEPTION 'Only bookset owners can unlock tax years';
  END IF;

  -- Delete lock record
  DELETE FROM tax_year_locks
  WHERE bookset_id = p_bookset_id
    AND tax_year = p_year;
END;
$$;

-- ============================================================================
-- Transaction Protection Trigger
-- ============================================================================

/**
 * Prevents updates/deletes to transactions in locked years
 */
CREATE OR REPLACE FUNCTION prevent_locked_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_locked boolean;
BEGIN
  -- For DELETE operations, check OLD record
  IF TG_OP = 'DELETE' THEN
    is_locked := is_date_locked(OLD.bookset_id, OLD.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot delete transaction in locked tax year %',
        EXTRACT(YEAR FROM OLD.date::date);
    END IF;
    RETURN OLD;
  END IF;

  -- For UPDATE operations, check both OLD and NEW
  IF TG_OP = 'UPDATE' THEN
    -- Check if old date is locked
    is_locked := is_date_locked(OLD.bookset_id, OLD.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot modify transaction in locked tax year %',
        EXTRACT(YEAR FROM OLD.date::date);
    END IF;

    -- Check if new date would move it into a locked year
    is_locked := is_date_locked(NEW.bookset_id, NEW.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot change transaction date to locked tax year %',
        EXTRACT(YEAR FROM NEW.date::date);
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT operations are not blocked
  RETURN NEW;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS enforce_tax_year_locks ON public.transactions;
CREATE TRIGGER enforce_tax_year_locks
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_transaction_changes();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_max_locked_year TO authenticated;
GRANT EXECUTE ON FUNCTION is_date_locked TO authenticated;
GRANT EXECUTE ON FUNCTION lock_tax_year TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_tax_year TO authenticated;
```

**Rollback SQL:**

```sql
-- Rollback migration 003
DROP TRIGGER IF EXISTS enforce_tax_year_locks ON public.transactions;
DROP FUNCTION IF EXISTS prevent_locked_transaction_changes();
DROP FUNCTION IF EXISTS lock_tax_year(uuid, int);
DROP FUNCTION IF EXISTS unlock_tax_year(uuid, int);
DROP FUNCTION IF EXISTS is_date_locked(uuid, date);
DROP FUNCTION IF EXISTS get_max_locked_year(uuid);
DROP TABLE IF EXISTS public.tax_year_locks CASCADE;
```

---

### 2. TypeScript Type Definitions

**File:** `src/types/database.ts`

Add new type:

```typescript
export interface TaxYearLock {
  id: string;
  bookset_id: string;
  tax_year: number;
  locked_at: string;
  locked_by: string;
}
```

---

### 3. Supabase Client Functions

**File:** `src/lib/supabase/taxYearLocks.ts` (new file)

```typescript
import { supabase } from './config';
import type { TaxYearLock } from '../../types/database';

/**
 * Fetches all locked years for a bookset
 */
export async function fetchTaxYearLocks(booksetId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('tax_year_locks')
    .select('tax_year')
    .eq('bookset_id', booksetId)
    .order('tax_year', { ascending: true });

  if (error) throw error;
  return data?.map((r) => r.tax_year) || [];
}

/**
 * Locks a specific tax year
 */
export async function lockTaxYear(booksetId: string, year: number): Promise<void> {
  const { error } = await supabase.rpc('lock_tax_year', {
    p_bookset_id: booksetId,
    p_year: year,
  });

  if (error) throw error;
}

/**
 * Unlocks a specific tax year
 */
export async function unlockTaxYear(booksetId: string, year: number): Promise<void> {
  const { error } = await supabase.rpc('unlock_tax_year', {
    p_bookset_id: booksetId,
    p_year: year,
  });

  if (error) throw error;
}

/**
 * Gets the maximum locked year for a bookset
 */
export async function getMaxLockedYear(booksetId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_max_locked_year', {
    p_bookset_id: booksetId,
  });

  if (error) throw error;
  return data;
}

/**
 * Checks if a specific date is in a locked year
 */
export async function isDateLocked(booksetId: string, date: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_date_locked', {
    p_bookset_id: booksetId,
    p_date: date,
  });

  if (error) throw error;
  return data || false;
}
```

---

### 4. React Hook

**File:** `src/hooks/useTaxYearLocks.ts` (new file)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchTaxYearLocks,
  lockTaxYear,
  unlockTaxYear,
  getMaxLockedYear,
} from '../lib/supabase/taxYearLocks';
import { useToast } from '../components/GlobalToastProvider';

export function useTaxYearLocks() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  // Fetch locked years
  const { data: lockedYears = [], isLoading } = useQuery({
    queryKey: ['taxYearLocks', activeBookset?.id],
    queryFn: () => fetchTaxYearLocks(activeBookset!.id),
    enabled: !!activeBookset,
  });

  // Get max locked year
  const maxLockedYear = lockedYears.length > 0 ? Math.max(...lockedYears) : null;

  // Helper function: is a specific date locked?
  const isDateLocked = (dateStr: string): boolean => {
    if (!maxLockedYear) return false;
    const year = new Date(dateStr).getFullYear();
    return year <= maxLockedYear;
  };

  // Lock year mutation
  const lockYearMutation = useMutation({
    mutationFn: (year: number) => {
      if (!activeBookset) throw new Error('No active bookset');
      return lockTaxYear(activeBookset.id, year);
    },
    onSuccess: (_, year) => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', activeBookset?.id] });
      showSuccess(`Tax year ${year} has been locked`);
    },
    onError: (error: Error) => {
      showError(`Failed to lock tax year: ${error.message}`);
    },
  });

  // Unlock year mutation
  const unlockYearMutation = useMutation({
    mutationFn: (year: number) => {
      if (!activeBookset) throw new Error('No active bookset');
      return unlockTaxYear(activeBookset.id, year);
    },
    onSuccess: (_, year) => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', activeBookset?.id] });
      showSuccess(`Tax year ${year} has been unlocked`);
    },
    onError: (error: Error) => {
      showError(`Failed to unlock tax year: ${error.message}`);
    },
  });

  return {
    lockedYears,
    maxLockedYear,
    isLoading,
    isDateLocked,
    lockYear: lockYearMutation.mutate,
    unlockYear: unlockYearMutation.mutate,
    isLocking: lockYearMutation.isPending,
    isUnlocking: unlockYearMutation.isPending,
  };
}
```

---

### 5. UI: Settings Page

**File:** `src/pages/SettingsPage.tsx`

Add new section for Tax Year Management:

```tsx
import { useTaxYearLocks } from '../hooks/useTaxYearLocks';
import { useState } from 'react';

// Inside component:
const { lockedYears, maxLockedYear, isDateLocked, lockYear, unlockYear, isLocking, isUnlocking } =
  useTaxYearLocks();

const [showLockConfirm, setShowLockConfirm] = useState<number | null>(null);
const [showUnlockConfirm, setShowUnlockConfirm] = useState<number | null>(null);

// Generate list of years (current year back to 2020)
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

const handleLockYear = (year: number) => {
  lockYear(year);
  setShowLockConfirm(null);
};

const handleUnlockYear = (year: number) => {
  unlockYear(year);
  setShowUnlockConfirm(null);
};

// Add to JSX:
{
  /* Tax Year Management Section */
}
<section className="bg-white rounded-xl border border-neutral-200 p-6">
  <h2 className="text-xl font-bold text-neutral-900 mb-4">Tax Year Locking</h2>

  <p className="text-sm text-neutral-600 mb-4">
    Lock completed tax years to prevent accidental modifications. Locking a year also locks all
    previous years.
  </p>

  <div className="space-y-2">
    {years.map((year) => {
      const isLocked = lockedYears.includes(year);
      const isImplicitlyLocked = maxLockedYear && year < maxLockedYear && !isLocked;

      return (
        <div key={year} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="font-bold text-neutral-900">{year}</span>
            {isLocked && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                Locked
              </span>
            )}
            {isImplicitlyLocked && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                Locked (by {maxLockedYear})
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {isLocked && (
              <button
                onClick={() => setShowUnlockConfirm(year)}
                disabled={isUnlocking}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Unlock
              </button>
            )}
            {!isLocked && !isImplicitlyLocked && (
              <button
                onClick={() => setShowLockConfirm(year)}
                disabled={isLocking}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Lock
              </button>
            )}
          </div>
        </div>
      );
    })}
  </div>

  {/* Lock Confirmation Modal */}
  {showLockConfirm && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md">
        <h3 className="text-lg font-bold text-neutral-900 mb-2">
          Lock Tax Year {showLockConfirm}?
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          This will prevent all modifications to transactions in {showLockConfirm} and earlier
          years. You can unlock it later if needed.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowLockConfirm(null)}
            className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => handleLockYear(showLockConfirm)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Lock Year
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Unlock Confirmation Modal */}
  {showUnlockConfirm && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md">
        <h3 className="text-lg font-bold text-neutral-900 mb-2">
          Unlock Tax Year {showUnlockConfirm}?
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          This will allow modifications to transactions in {showUnlockConfirm}. This does NOT unlock
          earlier years.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowUnlockConfirm(null)}
            className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => handleUnlockYear(showUnlockConfirm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Unlock Year
          </button>
        </div>
      </div>
    </div>
  )}
</section>;
```

---

### 6. UI: Workbench Locked Transaction Indicators

**File:** `src/components/workbench/WorkbenchTable.tsx`

Add visual indicators for locked transactions:

```tsx
import { useTaxYearLocks } from '../../hooks/useTaxYearLocks';

// In component:
const { isDateLocked } = useTaxYearLocks();

// In row rendering:
const locked = isDateLocked(row.original.date);

// Add to row className:
className={locked ? 'bg-red-50 opacity-60' : ''}

// Disable edit inputs/buttons when locked:
disabled={locked}

// Add lock icon column (optional):
{
  id: 'lock-indicator',
  header: '',
  cell: ({ row }) => {
    const locked = isDateLocked(row.original.date);
    return locked ? (
      <span className="text-red-600" title="Locked (tax year filed)">
        🔒
      </span>
    ) : null;
  },
  size: 30,
}
```

---

### 7. CSV Import Protection

**File:** `src/lib/import/reconciler.ts` or wherever CSV import is handled

Add check before processing import:

```typescript
import { isDateLocked } from '../supabase/taxYearLocks';

// Before processing CSV transactions:
export async function validateImportDates(
  booksetId: string,
  transactions: { date: string }[]
): Promise<{ valid: boolean; lockedDates: string[] }> {
  const lockedDates: string[] = [];

  for (const tx of transactions) {
    const locked = await isDateLocked(booksetId, tx.date);
    if (locked) {
      lockedDates.push(tx.date);
    }
  }

  return {
    valid: lockedDates.length === 0,
    lockedDates,
  };
}
```

Update import flow to check before proceeding:

```typescript
const validation = await validateImportDates(booksetId, parsedTransactions);

if (!validation.valid) {
  throw new Error(
    `Cannot import transactions in locked tax years. ` +
      `Found ${validation.lockedDates.length} locked transaction(s). ` +
      `Remove transactions from these years and try again.`
  );
}
```

---

## Testing Plan

### Unit Tests

**File:** `src/hooks/useTaxYearLocks.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTaxYearLocks } from './useTaxYearLocks';

describe('useTaxYearLocks', () => {
  it('should correctly identify locked dates', async () => {
    // Mock locked years: 2023
    const { result } = renderHook(() => useTaxYearLocks());

    await waitFor(() => expect(result.current.lockedYears).toEqual([2023]));

    expect(result.current.isDateLocked('2023-06-15')).toBe(true);
    expect(result.current.isDateLocked('2022-12-31')).toBe(true);
    expect(result.current.isDateLocked('2024-01-01')).toBe(false);
  });
});
```

### Integration Tests

Test database triggers directly via Supabase SQL Editor:

```sql
-- Setup: Lock 2023
SELECT lock_tax_year('your-bookset-id', 2023);

-- Test 1: Try to update a 2023 transaction (should fail)
UPDATE transactions
SET amount = -5000
WHERE date = '2023-06-15' AND bookset_id = 'your-bookset-id';
-- Expected: ERROR: Cannot modify transaction in locked tax year 2023

-- Test 2: Try to delete a 2023 transaction (should fail)
DELETE FROM transactions
WHERE date = '2023-06-15' AND bookset_id = 'your-bookset-id';
-- Expected: ERROR: Cannot delete transaction in locked tax year 2023

-- Test 3: Insert a 2023 transaction (should succeed)
-- Locking doesn't prevent new transactions, only modifications

-- Cleanup
SELECT unlock_tax_year('your-bookset-id', 2023);
```

### Manual Testing Checklist

1. **Lock/Unlock Basic Operations**
   - [ ] Go to Settings → Tax Year Management
   - [ ] Lock year 2023 → verify success toast
   - [ ] Verify 2023 shows "Locked" badge
   - [ ] Verify 2022 and earlier show "Locked (by 2023)" badge
   - [ ] Unlock 2023 → verify success toast
   - [ ] Verify 2023 unlocked, 2022 unlocked

2. **Workbench Protection**
   - [ ] Lock year 2023
   - [ ] Go to Workbench
   - [ ] Find transaction from 2023
   - [ ] Try to edit payee → verify disabled
   - [ ] Try to change category → verify disabled
   - [ ] Try to split transaction → verify disabled
   - [ ] Verify row has visual indicator (red background, lock icon)

3. **Delete Protection**
   - [ ] Try to delete 2023 transaction
   - [ ] Verify error toast: "Cannot delete transaction in locked tax year 2023"

4. **CSV Import Protection**
   - [ ] Lock year 2023
   - [ ] Prepare CSV with 2023 transactions
   - [ ] Try to import
   - [ ] Verify error message lists locked dates
   - [ ] Remove 2023 transactions from CSV
   - [ ] Re-import → verify success

5. **Edge Cases**
   - [ ] Lock current year → verify works
   - [ ] Try to lock year twice → verify no error (idempotent)
   - [ ] Lock 2024, then 2023 → verify both locked
   - [ ] Unlock 2024 → verify 2023 still locked

---

## Files Modified

### New Files

- `supabase/migrations/003_tax_year_locking.sql` - Database schema and triggers
- `src/lib/supabase/taxYearLocks.ts` - Supabase client functions
- `src/hooks/useTaxYearLocks.ts` - React hook
- `src/hooks/useTaxYearLocks.test.ts` - Unit tests

### Modified Files

- `src/types/database.ts` - Add `TaxYearLock` interface
- `src/pages/SettingsPage.tsx` - Add Tax Year Management section
- `src/components/workbench/WorkbenchTable.tsx` - Add locked transaction indicators
- `src/lib/import/reconciler.ts` - Add CSV import validation

---

## Rollback Plan

1. **Remove Migration:** Run rollback SQL (provided in migration file)
2. **Remove UI:** Comment out Tax Year Management section in Settings
3. **Remove Hook:** Delete `useTaxYearLocks.ts`
4. **No Data Loss:** Unlocking all years restores full functionality

---

## Success Criteria

- ✅ Owners can lock/unlock tax years from Settings page
- ✅ Locked transactions cannot be edited, deleted, or modified
- ✅ Locked transactions display visual indicators in Workbench
- ✅ CSV imports with locked dates are rejected with clear error message
- ✅ Locking year N implicitly locks all years ≤ N
- ✅ Unlocking only affects the specific year
- ✅ Database triggers enforce protection at SQL level
- ✅ All operations provide clear user feedback (toasts, error messages)
