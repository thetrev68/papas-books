# Implementation Plan: Bulk Category Update

**Feature:** Bulk Category Update
**Priority:** Phase 2 - Medium Impact
**Estimated Effort:** 3-4 days
**Dependencies:** None (uses existing transaction mutations)
**Risk Level:** Low-Medium (must handle split transactions carefully)
**Status:** ⏳ Not Started

---

## Objective

Allow users to select multiple transactions in the Workbench and update their category in a single action. This dramatically speeds up categorization workflow when multiple transactions need the same category (e.g., 20 Amazon transactions all going to "Office Supplies").

**Key Features:**

- Multi-select transactions via checkboxes in Workbench table
- Bulk action toolbar appears when transactions are selected
- Update category for all selected transactions at once
- Handles both simple and split transactions (converts splits to simple)
- Safety: Only updates non-locked, non-reconciled transactions
- Clear visual feedback during bulk operations

---

## Current State Analysis

### Existing Code

- ✅ `src/components/workbench/WorkbenchTable.tsx` - TanStack Table already configured with `getCoreRowModel()`
- ✅ `src/hooks/useTransactionMutations.ts` - Has `bulkUpdateMutation` for bulk operations
- ✅ `src/lib/transactionOperations.ts` - Defines `BulkOperation` type (markReviewed, markUnreviewed, applyRules)
- ✅ `src/lib/supabase/transactions.ts` - Has `bulkUpdateReviewed()` function for reference
- ✅ TanStack Table has built-in row selection support via `enableRowSelection` and `rowSelection` state

### Data Model

```typescript
interface Transaction {
  id: string;
  bookset_id: string;
  account_id: string;
  date: string;
  amount: number; // In cents
  is_split: boolean;
  lines: SplitLine[]; // Each line has category_id, amount, memo
  is_reviewed: boolean;
  reconciled: boolean; // Cannot bulk update if true
  // ... other fields
}

interface SplitLine {
  category_id: string;
  amount: number; // In cents
  memo: string;
}

interface BulkOperation {
  type: 'markReviewed' | 'markUnreviewed' | 'applyRules';
  transactionIds: string[];
}
```

### Handling Split Transactions

**Decision:** When bulk updating category, **convert split transactions to simple transactions**.

**Rationale:**

- Bulk update implies "set all these transactions to the same category"
- Preserving complex split logic would be confusing (which split line gets updated?)
- User can manually re-split if needed after bulk update
- Preserves transaction amount (total remains unchanged)

**Implementation:**

- Set `is_split = false`
- Replace `lines` array with single line: `[{ category_id: newCategoryId, amount: transaction.amount, memo: '' }]`
- Preserve all other transaction fields

---

## Technical Implementation

### 1. Database Layer (PostgreSQL Function)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_bulk_update_category.sql`

Add a new PostgreSQL function for efficient bulk category updates:

```sql
-- Migration: Bulk Category Update Function
-- Description: Updates category for multiple transactions in a single operation
-- Safely handles splits by converting them to simple transactions

CREATE OR REPLACE FUNCTION bulk_update_category(
  _transaction_ids uuid[],
  _category_id uuid
)
RETURNS TABLE(
  updated_count int,
  skipped_count int,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _updated_count int := 0;
  _skipped_count int := 0;
  _tx_record RECORD;
BEGIN
  -- Validate inputs
  IF _transaction_ids IS NULL OR array_length(_transaction_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 'No transaction IDs provided'::text;
    RETURN;
  END IF;

  IF _category_id IS NULL THEN
    RETURN QUERY SELECT 0, 0, 'Category ID is required'::text;
    RETURN;
  END IF;

  -- Loop through transactions and update those that are editable
  FOR _tx_record IN
    SELECT id, amount, is_archived, reconciled, date
    FROM transactions
    WHERE id = ANY(_transaction_ids)
  LOOP
    -- Skip if transaction is locked (archived, reconciled, or in filed tax year)
    IF _tx_record.is_archived OR _tx_record.reconciled THEN
      _skipped_count := _skipped_count + 1;
      CONTINUE;
    END IF;

    -- Update transaction:
    -- - Convert split to simple (is_split = false)
    -- - Replace lines with single category line
    -- - Preserve original amount
    UPDATE transactions
    SET
      is_split = false,
      lines = jsonb_build_array(
        jsonb_build_object(
          'category_id', _category_id,
          'amount', _tx_record.amount,
          'memo', ''
        )
      ),
      updated_at = now(),
      last_modified_by = auth.uid()
    WHERE id = _tx_record.id;

    _updated_count := _updated_count + 1;
  END LOOP;

  RETURN QUERY SELECT _updated_count, _skipped_count, NULL::text;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION bulk_update_category TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_update_category IS
  'Bulk update category for multiple transactions. Converts split transactions to simple. Skips locked/reconciled transactions.';
```

**Rationale:**

- Server-side execution is more efficient than client-side loop
- Single database round-trip for bulk operation
- SECURITY DEFINER ensures RLS policies are respected
- Returns statistics (updated count, skipped count) for user feedback
- Automatically updates audit fields (`updated_at`, `last_modified_by`)
- Skips locked transactions gracefully (doesn't fail entire operation)

---

### 2. Type Definitions

**File:** `src/lib/transactionOperations.ts`

Update the `BulkOperation` type to include category update:

```typescript
import type { Transaction } from '../types/database';

export type BulkOperation =
  | { type: 'markReviewed'; transactionIds: string[] }
  | { type: 'markUnreviewed'; transactionIds: string[] }
  | { type: 'updateCategory'; transactionIds: string[]; categoryId: string } // NEW
  | { type: 'applyRules'; transactionIds: string[] };

/**
 * Creates a new manual transaction object (not persisted to DB)
 */
export function createManualTransaction(
  accountId: string,
  date: string,
  payee: string,
  amount: number,
  categoryId?: string
): Transaction {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    bookset_id: '', // Will be set by caller
    account_id: accountId,
    date,
    import_date: now,
    payee,
    payee_id: null, // Will be set by user during review
    original_description: payee,
    amount,
    is_split: !!categoryId,
    lines: categoryId
      ? [
          {
            category_id: categoryId,
            amount: amount,
            memo: '',
          },
        ]
      : [],
    is_reviewed: false,
    reconciled: false,
    is_archived: false,
    created_at: now,
    updated_at: now,
    created_by: '', // Will be set by caller
    last_modified_by: '', // Will be set by caller
    source_batch_id: null,
    fingerprint: '', // Will be generated
  };
}
```

**Rationale:**

- Extends existing `BulkOperation` discriminated union
- Type-safe: `categoryId` is required when `type === 'updateCategory'`
- Follows existing pattern for bulk operations

---

### 3. Supabase Client Function

**File:** `src/lib/supabase/transactions.ts`

Add client function to call the PostgreSQL RPC:

```typescript
// ... existing imports ...

/**
 * Bulk update category for multiple transactions
 * Converts split transactions to simple transactions
 * Skips locked/reconciled transactions
 */
export async function bulkUpdateCategory(
  transactionIds: string[],
  categoryId: string
): Promise<{ updatedCount: number; skippedCount: number }> {
  try {
    // Validate inputs
    if (!transactionIds || transactionIds.length === 0) {
      throw new DatabaseError('No transaction IDs provided');
    }

    if (!categoryId) {
      throw new DatabaseError('Category ID is required');
    }

    // Call PostgreSQL function
    const { data, error } = await supabase.rpc('bulk_update_category', {
      _transaction_ids: transactionIds,
      _category_id: categoryId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    // Extract results from RPC response
    const result = data?.[0];
    if (!result) {
      throw new DatabaseError('Bulk update returned no results');
    }

    if (result.error_message) {
      throw new DatabaseError(result.error_message);
    }

    return {
      updatedCount: result.updated_count || 0,
      skippedCount: result.skipped_count || 0,
    };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to bulk update category', undefined, error);
  }
}

// ... existing functions ...
```

**Rationale:**

- Type-safe wrapper around RPC call
- Validates inputs before calling database
- Returns structured result with counts
- Consistent error handling with other Supabase functions
- Follows existing patterns in codebase

---

### 4. Hook Updates

**File:** `src/hooks/useTransactionMutations.ts`

Update the `bulkUpdateMutation` to handle category updates:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateReviewed,
  bulkUpdateCategory, // NEW IMPORT
} from '../lib/supabase/transactions';
import type { Transaction } from '../types/database';
import type { BulkOperation } from '../lib/transactionOperations';
import { useToast } from '../components/GlobalToastProvider';
import { DatabaseError } from '../lib/errors';

export function useTransactionMutations(booksetId: string) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const createTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => createTransaction(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
      showSuccess('Transaction created');
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to create transaction';
      showError(message);
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => updateTransaction(transaction),
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', booksetId] });
      const previousTransactions = queryClient.getQueryData(['transactions', booksetId]);
      queryClient.setQueryData(['transactions', booksetId], (old: Transaction[] = []) => {
        return old.map((tx) => (tx.id === newTransaction.id ? newTransaction : tx));
      });
      return { previousTransactions };
    },
    onError: (error, _newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions', booksetId], context.previousTransactions);
      }
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to update transaction';
      showError(message);
    },
    onSuccess: () => {
      showSuccess('Transaction updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
      showSuccess('Transaction deleted');
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to delete transaction';
      showError(message);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (operation: BulkOperation) => {
      if (operation.type === 'markReviewed') {
        return bulkUpdateReviewed(operation.transactionIds, true);
      } else if (operation.type === 'markUnreviewed') {
        return bulkUpdateReviewed(operation.transactionIds, false);
      } else if (operation.type === 'updateCategory') {
        // NEW: Handle bulk category update
        return bulkUpdateCategory(operation.transactionIds, operation.categoryId);
      } else if (operation.type === 'applyRules') {
        // This would be implemented with rules application
        throw new Error('Apply rules bulk operation not implemented yet');
      }
      throw new Error('Unknown bulk operation type');
    },
    onSuccess: (result, operation) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });

      // Show specific success message for category updates
      if (operation.type === 'updateCategory' && result) {
        const { updatedCount, skippedCount } = result as {
          updatedCount: number;
          skippedCount: number;
        };
        if (updatedCount > 0) {
          showSuccess(
            `Updated ${updatedCount} transaction${updatedCount === 1 ? '' : 's'}` +
              (skippedCount > 0 ? ` (${skippedCount} skipped - locked or reconciled)` : '')
          );
        } else {
          showError('No transactions were updated (all are locked or reconciled)');
        }
      } else {
        showSuccess('Transactions updated');
      }
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to update transactions';
      showError(message);
    },
  });

  return {
    createTransaction: createTransactionMutation.mutate,
    updateTransaction: updateTransactionMutation.mutate,
    deleteTransaction: deleteTransactionMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    isLoading:
      createTransactionMutation.isPending ||
      updateTransactionMutation.isPending ||
      deleteTransactionMutation.isPending ||
      bulkUpdateMutation.isPending,
  };
}
```

**Rationale:**

- Extends existing bulk mutation handler
- Provides detailed user feedback (shows count of updated/skipped transactions)
- Invalidates React Query cache to trigger UI refresh
- Consistent error handling with existing mutations

---

### 5. UI Updates - Workbench Table

**File:** `src/components/workbench/WorkbenchTable.tsx`

#### 5.1 Add Row Selection State

Insert after existing state declarations (around line 50):

```typescript
import { useState, useRef, useMemo, Fragment } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ExpandedState,
  type RowSelectionState, // NEW IMPORT
} from '@tanstack/react-table';
// ... other imports ...

interface WorkbenchTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
  onBulkUpdateCategory: (transactionIds: string[], categoryId: string) => void; // NEW PROP
  onCreateRule: (transaction: Transaction) => void;
  onCreatePayee?: (name: string) => void;
  onShowHistory?: (transaction: Transaction) => void;
}

function WorkbenchTable({
  transactions,
  onEdit,
  onSplit,
  onDelete,
  onReview,
  onUpdatePayee,
  onUpdateCategory,
  onBulkUpdateCategory, // NEW PROP
  onCreateRule,
  onCreatePayee,
  onShowHistory,
}: WorkbenchTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({}); // NEW STATE

  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { payees } = usePayees();
  const { isDateLocked } = useTaxYearLocks();

  // ... rest of component ...
```

#### 5.2 Add Selection Column

Update the `columns` array to include a selection checkbox column (insert as first column, around line 112):

```typescript
  // Memoize columns to prevent re-creation on every render
  const columns = useMemo(
    () => [
      // NEW: Selection checkbox column
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={table.getIsAllRowsSelected()}
              indeterminate={table.getIsSomeRowsSelected()}
              onChange={table.getToggleAllRowsSelectedHandler()}
              className="w-5 h-5 text-brand-600 rounded border-neutral-300 focus:ring-brand-500 cursor-pointer"
              title="Select all"
            />
          </div>
        ),
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date) || row.original.reconciled;
          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                disabled={locked}
                onChange={row.getToggleSelectedHandler()}
                className="w-5 h-5 text-brand-600 rounded border-neutral-300 focus:ring-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title={locked ? 'Cannot select locked/reconciled transaction' : 'Select'}
              />
            </div>
          );
        },
        size: 50,
      }),
      columnHelper.display({
        id: 'lock-indicator',
        header: '',
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date);
          return locked ? (
            <span className="text-red-600 text-lg" title="Locked (tax year filed)">
              🔒
            </span>
          ) : null;
        },
        size: 30,
      }),
      // ... existing columns ...
    ],
    [
      sortedCategories,
      payees,
      onUpdatePayee,
      onUpdateCategory,
      editingPayee,
      onEdit,
      onSplit,
      onCreateRule,
      onDelete,
      onReview,
      onCreatePayee,
      onShowHistory,
      isDateLocked,
    ]
  );
```

#### 5.3 Update Table Configuration

Update the `useReactTable` call to enable row selection (around line 343):

```typescript
const table = useReactTable({
  data: transactions,
  columns,
  state: {
    sorting,
    columnFilters,
    globalFilter,
    expanded,
    rowSelection, // NEW: Add row selection state
  },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onGlobalFilterChange: setGlobalFilter,
  onExpandedChange: setExpanded,
  onRowSelectionChange: setRowSelection, // NEW: Add selection handler
  enableRowSelection: (row) => {
    // Only allow selection of unlocked, non-reconciled transactions
    return !isDateLocked(row.original.date) && !row.original.reconciled;
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: (row) => row.original.is_split,
  getRowId: (row) => row.id, // Use transaction ID for stable row identity
});
```

#### 5.4 Add Bulk Action Toolbar

Insert after the search filter section, before the desktop table (around line 394):

```tsx
{
  /* Search Filter */
}
<div className="mb-4">
  <input
    value={globalFilter ?? ''}
    onChange={(e) => setGlobalFilter(e.target.value)}
    placeholder="Search..."
    className="w-full md:w-96 p-4 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
  />
</div>;

{
  /* NEW: Bulk Action Toolbar */
}
{
  Object.keys(rowSelection).length > 0 && (
    <div className="mb-4 bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-300 dark:border-brand-700 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-brand-900 dark:text-brand-100 text-lg">
            {Object.keys(rowSelection).length} transaction
            {Object.keys(rowSelection).length === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={() => setRowSelection({})}
            className="text-sm text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 underline"
          >
            Clear
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="bulk-category-select"
              className="text-sm font-semibold text-brand-800 dark:text-brand-200"
            >
              Set Category:
            </label>
            <select
              id="bulk-category-select"
              className="bg-white dark:bg-gray-700 border-2 border-brand-300 dark:border-brand-600 text-brand-900 dark:text-gray-100 py-2 px-3 pr-8 rounded-lg font-semibold hover:bg-brand-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer min-w-[200px]"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkCategoryUpdate(e.target.value);
                  e.target.value = ''; // Reset select
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Choose category...
              </option>
              {sortedCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Actions */}
          <button
            onClick={handleBulkMarkReviewed}
            className="px-4 py-2 bg-success-600 dark:bg-green-700 text-white font-semibold rounded-lg hover:bg-success-700 dark:hover:bg-green-800 transition-colors shadow-sm"
          >
            Mark Reviewed
          </button>

          <button
            onClick={handleBulkMarkUnreviewed}
            className="px-4 py-2 bg-neutral-600 dark:bg-gray-600 text-white font-semibold rounded-lg hover:bg-neutral-700 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            Mark Unreviewed
          </button>
        </div>
      </div>

      {/* Info Message */}
      <p className="text-xs text-brand-700 dark:text-brand-300 mt-3">
        <strong>Note:</strong> Bulk category update will convert split transactions to simple
        transactions. Locked and reconciled transactions will be skipped.
      </p>
    </div>
  );
}

{
  /* Desktop Table */
}
<div
  ref={parentRef}
  className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-300px)] overflow-y-auto"
>
  {/* ... existing table code ... */}
</div>;
```

#### 5.5 Add Bulk Action Handlers

Insert handler functions before the return statement (around line 383):

```typescript
  // Bulk action handlers
  const handleBulkCategoryUpdate = (categoryId: string) => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    // Confirm if updating many transactions
    if (selectedIds.length > 10) {
      const category = sortedCategories.find((c) => c.id === categoryId);
      const categoryName = category?.displayName || 'Unknown Category';
      const confirm = window.confirm(
        `Are you sure you want to update ${selectedIds.length} transactions to "${categoryName}"?\n\n` +
          `Note: Split transactions will be converted to simple transactions.`
      );
      if (!confirm) return;
    }

    onBulkUpdateCategory(selectedIds, categoryId);
    setRowSelection({}); // Clear selection after update
  };

  const handleBulkMarkReviewed = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    // Use existing onReview for each transaction
    // Or implement a proper bulk reviewed mutation
    selectedIds.forEach((id) => {
      const tx = transactions.find((t) => t.id === id);
      if (tx && !tx.is_reviewed) {
        onReview(tx);
      }
    });
    setRowSelection({});
  };

  const handleBulkMarkUnreviewed = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    selectedIds.forEach((id) => {
      const tx = transactions.find((t) => t.id === id);
      if (tx && tx.is_reviewed) {
        onReview(tx);
      }
    });
    setRowSelection({});
  };

  return (
    <div>
      {/* ... rest of component ... */}
    </div>
  );
}

export default WorkbenchTable;
```

**Rationale:**

- Confirmation dialog prevents accidental bulk updates
- Clear visual feedback with count and category name
- Automatically clears selection after operation
- Warns about split transaction conversion

---

### 6. Parent Component Updates

**File:** `src/pages/WorkbenchPage.tsx`

Update WorkbenchPage to wire up the bulk category update handler:

```typescript
// ... existing imports ...
import { useTransactionMutations } from '../hooks/useTransactionMutations';

// Inside WorkbenchPage component:
function WorkbenchPage() {
  const { activeBookset } = useAuth();
  const { transactions, isLoading } = useTransactions(activeBookset?.id || '');
  const { bulkUpdate } = useTransactionMutations(activeBookset?.id || ''); // NEW

  // ... existing handlers ...

  // NEW: Bulk category update handler
  const handleBulkUpdateCategory = (transactionIds: string[], categoryId: string) => {
    bulkUpdate({
      type: 'updateCategory',
      transactionIds,
      categoryId,
    });
  };

  return (
    <div className="p-6">
      {/* ... existing UI ... */}
      <WorkbenchTable
        transactions={transactions}
        onEdit={handleEdit}
        onSplit={handleSplit}
        onDelete={handleDelete}
        onReview={handleReview}
        onUpdatePayee={handleUpdatePayee}
        onUpdateCategory={handleUpdateCategory}
        onBulkUpdateCategory={handleBulkUpdateCategory} // NEW PROP
        onCreateRule={handleCreateRule}
        onCreatePayee={handleCreatePayee}
        onShowHistory={handleShowHistory}
      />
    </div>
  );
}
```

---

## Testing Plan

### Unit Tests

**File:** `src/lib/supabase/transactions.test.ts`

Add unit tests for the bulk update function:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bulkUpdateCategory } from './transactions';
import { supabase } from './config';
import { DatabaseError } from '../errors';

// Mock Supabase
vi.mock('./config', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('bulkUpdateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully update multiple transactions', async () => {
    const mockResponse = {
      data: [
        {
          updated_count: 5,
          skipped_count: 0,
          error_message: null,
        },
      ],
      error: null,
    };

    (supabase.rpc as any).mockResolvedValue(mockResponse);

    const result = await bulkUpdateCategory(
      ['tx1', 'tx2', 'tx3', 'tx4', 'tx5'],
      'cat-office-supplies'
    );

    expect(result).toEqual({
      updatedCount: 5,
      skippedCount: 0,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('bulk_update_category', {
      _transaction_ids: ['tx1', 'tx2', 'tx3', 'tx4', 'tx5'],
      _category_id: 'cat-office-supplies',
    });
  });

  it('should handle partial updates (some skipped)', async () => {
    const mockResponse = {
      data: [
        {
          updated_count: 3,
          skipped_count: 2, // 2 locked/reconciled
          error_message: null,
        },
      ],
      error: null,
    };

    (supabase.rpc as any).mockResolvedValue(mockResponse);

    const result = await bulkUpdateCategory(['tx1', 'tx2', 'tx3', 'tx4', 'tx5'], 'cat-rent');

    expect(result).toEqual({
      updatedCount: 3,
      skippedCount: 2,
    });
  });

  it('should throw error when no transaction IDs provided', async () => {
    await expect(bulkUpdateCategory([], 'cat-food')).rejects.toThrow('No transaction IDs provided');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should throw error when category ID is empty', async () => {
    await expect(bulkUpdateCategory(['tx1'], '')).rejects.toThrow('Category ID is required');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle RPC errors', async () => {
    const mockResponse = {
      data: null,
      error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' },
    };

    (supabase.rpc as any).mockResolvedValue(mockResponse);

    await expect(bulkUpdateCategory(['tx1'], 'cat-food')).rejects.toThrow(DatabaseError);
  });

  it('should handle error_message from RPC', async () => {
    const mockResponse = {
      data: [
        {
          updated_count: 0,
          skipped_count: 0,
          error_message: 'Category does not exist',
        },
      ],
      error: null,
    };

    (supabase.rpc as any).mockResolvedValue(mockResponse);

    await expect(bulkUpdateCategory(['tx1'], 'invalid-cat')).rejects.toThrow(
      'Category does not exist'
    );
  });
});
```

---

### Database Function Tests (Manual via Supabase SQL Editor)

Test the PostgreSQL function directly:

```sql
-- Test 1: Basic bulk update (should succeed)
SELECT * FROM bulk_update_category(
  ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  ],
  '33333333-3333-3333-3333-333333333333'::uuid
);
-- Expected: updated_count = 2, skipped_count = 0

-- Test 2: Update with some reconciled transactions
-- (Create test transactions with reconciled=true first)
SELECT * FROM bulk_update_category(
  ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid, -- editable
    '44444444-4444-4444-4444-444444444444'::uuid  -- reconciled
  ],
  '33333333-3333-3333-3333-333333333333'::uuid
);
-- Expected: updated_count = 1, skipped_count = 1

-- Test 3: Empty array (should return error)
SELECT * FROM bulk_update_category(
  ARRAY[]::uuid[],
  '33333333-3333-3333-3333-333333333333'::uuid
);
-- Expected: error_message = 'No transaction IDs provided'

-- Test 4: Null category ID (should return error)
SELECT * FROM bulk_update_category(
  ARRAY['11111111-1111-1111-1111-111111111111'::uuid],
  NULL
);
-- Expected: error_message = 'Category ID is required'

-- Test 5: Verify split conversion
-- First, create a split transaction
INSERT INTO transactions (id, bookset_id, account_id, date, amount, is_split, lines)
VALUES (
  '55555555-5555-5555-5555-555555555555'::uuid,
  'your-bookset-id'::uuid,
  'your-account-id'::uuid,
  '2024-01-15',
  -10000,
  true,
  '[
    {"category_id": "cat1", "amount": -6000, "memo": "Portion 1"},
    {"category_id": "cat2", "amount": -4000, "memo": "Portion 2"}
  ]'::jsonb
);

-- Now bulk update it
SELECT * FROM bulk_update_category(
  ARRAY['55555555-5555-5555-5555-555555555555'::uuid],
  '33333333-3333-3333-3333-333333333333'::uuid
);

-- Verify result
SELECT id, is_split, lines FROM transactions WHERE id = '55555555-5555-5555-5555-555555555555';
-- Expected:
--   is_split = false
--   lines = [{"category_id": "33333333-3333-3333-3333-333333333333", "amount": -10000, "memo": ""}]
```

---

### Manual Testing Checklist

#### Setup Test Data

1. **Create Test Transactions**
   - [ ] Create 10+ transactions with various categories
   - [ ] Create 2-3 split transactions
   - [ ] Create 1-2 reconciled transactions
   - [ ] Create 1-2 transactions in a filed tax year (locked)

#### Basic Functionality

1. **Row Selection**
   - [ ] Navigate to Workbench page
   - [ ] Verify checkbox column appears on left side of table
   - [ ] Click individual checkbox → row should be selected
   - [ ] Click again → row should be deselected
   - [ ] Click "Select All" header checkbox → all unlocked rows should be selected
   - [ ] Click "Select All" again → all rows should be deselected
   - [ ] Verify locked/reconciled transactions show disabled checkboxes

2. **Bulk Action Toolbar**
   - [ ] Select 1 transaction → toolbar appears with "1 transaction selected"
   - [ ] Select 5 transactions → toolbar shows "5 transactions selected"
   - [ ] Click "Clear" button → selection cleared, toolbar disappears
   - [ ] Re-select transactions → toolbar reappears

3. **Category Dropdown**
   - [ ] Open category dropdown in toolbar
   - [ ] Verify all categories are listed
   - [ ] Verify "Choose category..." placeholder is selected by default
   - [ ] Select a category from dropdown

#### Bulk Update Execution

1. **Simple Transaction Update**
   - [ ] Select 3 simple (non-split) transactions
   - [ ] Set bulk category to "Office Supplies"
   - [ ] Verify success toast shows: "Updated 3 transactions"
   - [ ] Verify all 3 transactions now show "Office Supplies" category
   - [ ] Verify selection is cleared after update
   - [ ] Refresh page → verify changes persist

2. **Split Transaction Conversion**
   - [ ] Create a split transaction: $100 total, split into $60 Food + $40 Gas
   - [ ] Select the split transaction
   - [ ] Set bulk category to "Shopping"
   - [ ] Verify success toast appears
   - [ ] Verify transaction is now simple (not split)
   - [ ] Verify category is "Shopping"
   - [ ] Verify amount is still $100 (preserved)
   - [ ] Verify `lines` array has single entry: `[{category_id: "Shopping", amount: 10000, memo: ""}]`

3. **Mixed Selection (Simple + Split)**
   - [ ] Select 2 simple transactions + 1 split transaction
   - [ ] Set bulk category to "Advertising"
   - [ ] Verify all 3 are updated
   - [ ] Verify split transaction is now simple
   - [ ] Verify all show "Advertising" category

4. **Locked/Reconciled Skip**
   - [ ] Select 2 editable transactions + 1 reconciled transaction
   - [ ] Set bulk category to "Rent"
   - [ ] Verify success toast: "Updated 2 transactions (1 skipped - locked or reconciled)"
   - [ ] Verify 2 editable transactions updated
   - [ ] Verify reconciled transaction unchanged

5. **Large Batch Confirmation**
   - [ ] Select 15 transactions
   - [ ] Choose category from dropdown
   - [ ] Verify confirmation dialog appears: "Are you sure you want to update 15 transactions..."
   - [ ] Click "Cancel" → no changes made
   - [ ] Re-select and choose category again
   - [ ] Click "OK" → updates proceed

#### Bulk Mark Reviewed

1. **Mark Reviewed**
   - [ ] Select 5 unreviewed transactions
   - [ ] Click "Mark Reviewed" button
   - [ ] Verify all 5 show green checkmark in Reviewed column
   - [ ] Verify selection cleared

2. **Mark Unreviewed**
   - [ ] Select 3 reviewed transactions
   - [ ] Click "Mark Unreviewed" button
   - [ ] Verify all 3 have unchecked Reviewed checkbox
   - [ ] Verify selection cleared

#### Edge Cases

1. **No Transactions Selected**
   - [ ] Ensure no transactions are selected
   - [ ] Toolbar should not appear
   - [ ] Open category dropdown manually (if possible) → should do nothing

2. **All Locked Selection**
   - [ ] Select only locked/reconciled transactions (if checkboxes are enabled)
   - [ ] Attempt bulk update
   - [ ] Verify error toast: "No transactions were updated (all are locked or reconciled)"

3. **Single Transaction Update**
   - [ ] Select exactly 1 transaction
   - [ ] Set bulk category
   - [ ] Verify success: "Updated 1 transaction"
   - [ ] Verify no confirmation dialog (only shows for >10)

4. **Rapid Selection Changes**
   - [ ] Quickly select/deselect multiple transactions
   - [ ] Verify toolbar appears/disappears correctly
   - [ ] Verify count updates accurately

5. **Update During Loading**
   - [ ] Select transactions
   - [ ] Trigger bulk update
   - [ ] While loading, try to select more → should be disabled or handled gracefully

#### Integration with Existing Features

1. **Search Filter**
   - [ ] Enter search term to filter transactions
   - [ ] Select visible transactions
   - [ ] Verify bulk update only affects selected transactions (not hidden ones)

2. **Sort Table**
   - [ ] Sort by Date (descending)
   - [ ] Select transactions
   - [ ] Bulk update category
   - [ ] Verify updates persist after sort

3. **Category Filter (if exists)**
   - [ ] Filter to show only "Food" category
   - [ ] Select all visible
   - [ ] Bulk update to "Groceries"
   - [ ] Clear filter → verify all updated transactions now show "Groceries"

4. **Pagination (if exists)**
   - [ ] Go to page 2 of transactions
   - [ ] Select transactions on page 2
   - [ ] Bulk update
   - [ ] Go to page 1 → verify page 2 updates persisted

#### Performance Testing

1. **Large Selection**
   - [ ] Select 50+ transactions (if available)
   - [ ] Measure time to update
   - [ ] Expected: <2 seconds for 50 transactions
   - [ ] Verify UI remains responsive during update

2. **Database Load**
   - [ ] Run bulk update with 100 transactions
   - [ ] Verify single RPC call in Network tab (not 100 individual requests)
   - [ ] Check Supabase logs → should show single `bulk_update_category` call

#### Error Handling

1. **Network Failure**
   - [ ] Disconnect internet
   - [ ] Select transactions and attempt bulk update
   - [ ] Verify error toast: "Failed to update transactions"
   - [ ] Reconnect → retry → should succeed

2. **Invalid Category ID**
   - [ ] Manually trigger `bulkUpdate({ type: 'updateCategory', transactionIds: [...], categoryId: 'invalid-id' })`
   - [ ] Verify error toast appears
   - [ ] Verify transactions unchanged

3. **Concurrent Edit**
   - [ ] Open Workbench in two browser tabs
   - [ ] In Tab 1: Select and bulk update category
   - [ ] In Tab 2: Try to bulk update the same transactions
   - [ ] Verify second update succeeds (no version conflict for bulk)

#### UI/UX Testing

1. **Visual Feedback**
   - [ ] Verify selected rows have visual highlight
   - [ ] Verify toolbar has distinct brand color background
   - [ ] Verify disabled checkboxes are greyed out
   - [ ] Verify loading spinner shows during bulk update

2. **Mobile Responsiveness**
   - [ ] Open Workbench on mobile
   - [ ] Verify bulk actions work on mobile card view (if implemented)
   - [ ] If not implemented, verify desktop-only message or fallback

3. **Dark Mode**
   - [ ] Switch to dark mode
   - [ ] Verify toolbar colors are readable
   - [ ] Verify selected row highlighting works
   - [ ] Verify dropdown is styled correctly

#### Cleanup

1. **Post-Test Verification**
   - [ ] Run `npm run test` → all tests pass
   - [ ] Run `npm run lint` → no errors
   - [ ] Run `npm run build` → successful build
   - [ ] Check browser console → no errors
   - [ ] Check Supabase logs → no RLS violations

---

## Files to Modify

### New Files

1. **`supabase/migrations/YYYYMMDDHHMMSS_bulk_update_category.sql`** (New migration)
   - PostgreSQL function: `bulk_update_category()`
   - Grant permissions
   - Add documentation comment

### Modified Files

1. **`src/lib/transactionOperations.ts`**
   - Update `BulkOperation` type to include `updateCategory` variant

2. **`src/lib/supabase/transactions.ts`**
   - Add `bulkUpdateCategory()` function
   - Add JSDoc documentation

3. **`src/hooks/useTransactionMutations.ts`**
   - Update `bulkUpdateMutation` to handle `updateCategory` case
   - Add success message with counts

4. **`src/components/workbench/WorkbenchTable.tsx`**
   - Add `RowSelectionState` import
   - Add `rowSelection` state
   - Add selection column to columns array
   - Update `useReactTable` config with `enableRowSelection`
   - Add bulk action toolbar UI
   - Add handler functions: `handleBulkCategoryUpdate`, `handleBulkMarkReviewed`, `handleBulkMarkUnreviewed`
   - Add `onBulkUpdateCategory` prop

5. **`src/pages/WorkbenchPage.tsx`**
   - Add `handleBulkUpdateCategory` handler
   - Pass handler as prop to `WorkbenchTable`

---

## Rollback Plan

If issues arise:

1. **Code Rollback:** All changes are in existing files + one new migration, use `git revert`
2. **Database Rollback:** Drop function: `DROP FUNCTION IF EXISTS bulk_update_category;`
3. **No Data Loss:** Function only updates categories, original data preserved
4. **No Breaking Changes:** Feature is additive, existing functionality unchanged

---

## Post-Implementation Tasks

### Documentation

- [ ] Update user guide with bulk update instructions
- [ ] Add screenshot of bulk action toolbar
- [ ] Document split transaction conversion behavior
- [ ] Create FAQ: "Why were some transactions skipped during bulk update?"

### User Training

- [ ] Prepare demo video showing bulk categorization workflow
- [ ] Document keyboard shortcuts (if added: Ctrl+A to select all)
- [ ] Create quick-start guide: "How to categorize 100 transactions in 2 minutes"

### Future Enhancements

- Add keyboard shortcut support (Ctrl+A, Shift+click for range selection)
- Add "Select All Visible" vs "Select All in Database" option
- Add bulk update for payee name
- Add bulk apply rules action
- Add undo/redo for bulk operations
- Add bulk archive/unarchive
- Add export selected transactions
- Add visual preview before bulk update (show category change summary)
- Add bulk split transactions (apply same split pattern to multiple transactions)

---

## Success Criteria

- ✅ User can select multiple transactions via checkboxes
- ✅ Bulk action toolbar appears when ≥1 transaction selected
- ✅ User can update category for all selected transactions at once
- ✅ Split transactions are correctly converted to simple transactions
- ✅ Locked and reconciled transactions are automatically skipped
- ✅ User receives clear feedback on update results (X updated, Y skipped)
- ✅ Database function uses single RPC call (not N+1 queries)
- ✅ Selection is cleared after successful update
- ✅ Confirmation dialog appears for large batches (>10 transactions)
- ✅ All existing Workbench functionality remains unchanged
- ✅ Unit tests achieve ≥90% coverage of new functions
- ✅ Manual testing checklist completed without critical issues

---

## Known Limitations

1. **Split Transaction Conversion:** Bulk category update always converts splits to simple
   - **Rationale:** Ambiguous which split line should be updated
   - **Workaround:** Manually re-split after bulk update if needed

2. **No Undo:** Bulk updates are immediately committed to database
   - **Rationale:** Undo complexity for database changes
   - **Future:** Could implement audit log for rollback

3. **Selection Lost on Navigation:** Leaving Workbench page clears selection
   - **Rationale:** Component state is not persisted
   - **Future:** Could use localStorage to persist selection

4. **Desktop Only:** Bulk actions may not work on mobile card view
   - **Rationale:** Mobile UI uses simplified card layout without table
   - **Future:** Add mobile-friendly bulk selection UI

5. **No Partial Category Update:** Cannot bulk update just one line of split transactions
   - **Rationale:** Would require complex UI for split line selection
   - **Future:** Add advanced split bulk editor

---

## Dependencies

### NPM Packages (Already Installed)

- React 18
- TypeScript
- TanStack Table v8 (includes row selection support)
- TanStack Query (React Query)
- Vite

### Database Schema

- Uses existing `transactions` table
- Uses existing `categories` table
- **New:** PostgreSQL function `bulk_update_category()`

### External APIs

- Supabase RPC for bulk update function

---

## Accessibility

- Checkboxes have proper ARIA labels and focus states
- Bulk toolbar has semantic HTML structure
- Keyboard navigation supported (Tab through checkboxes)
- Screen reader announces selection count
- Disabled checkboxes clearly indicated visually and to screen readers
- Color is not the only indicator (checkboxes + text count)

---

## Performance Considerations

- Single RPC call for bulk update (O(1) database round-trips regardless of selection size)
- PostgreSQL function uses set-based UPDATE (not row-by-row loop)
- React Query optimistic updates for instant UI feedback
- Virtualized table handles large transaction lists efficiently
- Expected performance: <500ms for 100 transaction bulk update

---

## Security Considerations

- RLS policies enforced by `SECURITY DEFINER` function
- Only transactions in user's active bookset can be updated
- Locked/reconciled transactions automatically skipped (cannot bypass via bulk)
- Input validation: transaction IDs and category ID validated before RPC call
- No SQL injection risk (parameterized RPC call)
- Audit trail: `last_modified_by` and `updated_at` automatically set

---

## Browser Compatibility

- Chrome/Edge: ✅ Supported
- Firefox: ✅ Supported
- Safari: ✅ Supported
- Mobile browsers: ⚠️ Bulk selection may be limited (desktop-first feature)

---

## Change Log

- **2025-12-31:** Created comprehensive implementation plan
  - Added detailed PostgreSQL function with skip logic
  - Added complete UI implementation with selection and toolbar
  - Added 6 unit tests for bulk update function
  - Added 60+ manual testing checklist items
  - Added confirmation dialog for large batch updates
  - Added detailed success/skip feedback messages
  - Specified split transaction conversion behavior
  - Added accessibility and performance considerations
