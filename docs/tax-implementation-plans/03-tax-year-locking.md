# Implementation Plan: Tax Year Locking

**Feature:** Tax Year Locking
**Priority:** High
**Effort:** Medium (3-4 days)

## Objective

Prevent modifications to transactions in "closed" tax years to ensure data integrity after taxes are filed.

## Technical Implementation

### 1. Database Schema (`supabase/schema.sql`)

Create a new table `tax_year_locks`.

```sql
-- Run in Supabase SQL Editor
CREATE TABLE public.tax_year_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  tax_year int NOT NULL, -- e.g. 2024
  locked_at timestamp with time zone DEFAULT now(),
  locked_by uuid REFERENCES public.users(id),
  UNIQUE(bookset_id, tax_year)
);

ALTER TABLE public.tax_year_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read locks" ON public.tax_year_locks FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Owners can manage locks" ON public.tax_year_locks FOR ALL USING (user_owns_bookset(bookset_id)) WITH CHECK (user_owns_bookset(bookset_id));
```

### 2. Logic & Hooks (`src/hooks/useTaxYearLocks.ts`)

Create a hook to fetch and manage locks.

```typescript
// src/hooks/useTaxYearLocks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client';

export function useTaxYearLocks(booksetId: string) {
  const queryClient = useQueryClient();

  const { data: lockedYears = [] } = useQuery({
    queryKey: ['taxYearLocks', booksetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_year_locks')
        .select('tax_year')
        .eq('bookset_id', booksetId);
      if (error) throw error;
      return data.map((r) => r.tax_year);
    },
    enabled: !!booksetId,
  });

  const lockYearMutation = useMutation({
    mutationFn: async (year: number) => {
      const { error } = await supabase
        .from('tax_year_locks')
        .insert({ bookset_id: booksetId, tax_year: year });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', booksetId] });
    },
  });

  const unlockYearMutation = useMutation({
    mutationFn: async (year: number) => {
      const { error } = await supabase
        .from('tax_year_locks')
        .delete()
        .eq('bookset_id', booksetId)
        .eq('tax_year', year);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', booksetId] });
    },
  });

  // Helper to check if a date is locked
  const isDateLocked = (dateStr: string) => {
    const year = new Date(dateStr).getFullYear();
    // If year is locked, or any future year is locked? Usually just specific years.
    // However, usually closing 2024 implies everything <= 2024 is closed.
    // Requirement says: "Archive all transactions <= Dec 31, 2024".
    // So if 2024 is locked, 2023 should probably be treated as locked too?
    // Let's implement strict Year matching first, or "Max Locked Year" logic.
    // "Once a year is 'filed', all transactions before that date become read-only."

    if (lockedYears.length === 0) return false;
    const maxLockedYear = Math.max(...lockedYears);
    return year <= maxLockedYear;
  };

  return {
    lockedYears,
    lockYear: lockYearMutation.mutate,
    unlockYear: unlockYearMutation.mutate,
    isDateLocked,
  };
}
```

### 3. Enforce Locking in Mutations (`src/hooks/useTransactionMutations.ts`)

Modify `useTransactionMutations` to check for locks before proceeding.

```typescript
// src/hooks/useTransactionMutations.ts
import { useTaxYearLocks } from './useTaxYearLocks';

export function useTransactionMutations(booksetId: string) {
  const { isDateLocked } = useTaxYearLocks(booksetId);
  // ... existing code

  const updateTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => {
      if (isDateLocked(transaction.date)) {
        throw new Error(
          `Cannot edit transaction in a locked tax year (${new Date(transaction.date).getFullYear()}).`
        );
      }
      // Also check if the NEW date is in a locked year (if changing date)

      return updateTransaction(transaction);
    },
    // ...
  });

  // Similar logic for deleteTransaction
}
```

### 4. UI Updates (`src/pages/SettingsPage.tsx`)

Add a section to manage Tax Years.

```tsx
// src/pages/SettingsPage.tsx
// Add "Tax Year Management" section
// List years 2020..CurrentYear
// Show "Lock" / "Unlock" button next to each.
```

### 5. Workbench UI (`src/components/workbench/WorkbenchTable.tsx`)

Visually indicate locked rows.

```tsx
// src/components/workbench/WorkbenchTable.tsx
// Pass `isDateLocked` function or a prop to table.

// In row render:
const isLocked = isDateLocked(row.original.date);
// If locked, disable inputs/buttons and maybe add a lock icon.
// Opacity 50% or grayed out.
```

## Verification

1. Go to Settings, Lock Tax Year 2023.
2. Go to Workbench, try to edit a transaction from 2023.
3. Expect Error Toast: "Cannot edit transaction..."
4. Try to edit a transaction from 2024 (open). Expect Success.
5. Try to create a transaction in 2023. Expect Failure.

## Files to Modify

- `src/hooks/useTransactionMutations.ts`
- `src/components/workbench/WorkbenchTable.tsx`
- `src/pages/SettingsPage.tsx`
- New: `src/hooks/useTaxYearLocks.ts`
- Database: New table `tax_year_locks`
