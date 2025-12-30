# Implementation Plan: Bulk Category Update

**Feature:** Bulk Category Update
**Priority:** Medium
**Effort:** Medium (3-4 days)

## Objective

Allow users to select multiple transactions in the workbench and update their category (or payee) in a single action.

## Technical Implementation

### 1. Mutation Logic (`src/hooks/useTransactionMutations.ts`)

Extend `BulkOperation` interface and update mutation handler.

```typescript
// src/lib/transactionOperations.ts (or wherever BulkOperation is defined)
export type BulkOperation =
  | { type: 'markReviewed'; transactionIds: string[] }
  | { type: 'markUnreviewed'; transactionIds: string[] }
  | { type: 'updateCategory'; transactionIds: string[]; categoryId: string } // NEW
  | { type: 'applyRules'; transactionIds: string[] };

// src/hooks/useTransactionMutations.ts
// Update bulkUpdateMutation
const bulkUpdateMutation = useMutation({
  mutationFn: (operation: BulkOperation) => {
    if (operation.type === 'updateCategory') {
      // We need a supabase RPC or a loop here.
      // Ideally a new RPC `bulk_update_transaction_category` for performance.
      // Or client-side loop using updateTransaction (slow).
      // Let's assume we add a client-side loop for now or simple Supabase update.

      return supabase
        .from('transactions')
        .update({
          // We need to update the lines JSONB for category_id... complex if split!
          // For simple transactions (not split), we update lines: [{category_id: ...}]
          // But 'lines' is JSONB.
          // Ideally we only support bulk update for NON-SPLIT transactions or we overwrite splits?
          // Safest: Overwrite. Set is_split = false, lines = [{category_id: ...}]

          lines: [
            {
              category_id: operation.categoryId,
              amount: 0 /* amount is ignored in structure but needed? No, lines structure needs validation */,
            },
          ],
          // Wait, lines need 'amount'. We can't easily update JSONB 'category_id' inside array without knowing the amount to preserve it.
          // We must fetch, modify, update OR use a clever PostgreSQL function.
        })
        .in('id', operation.transactionIds);

      // BETTER APPROACH: specific RPC
      // return bulkUpdateCategory(operation.transactionIds, operation.categoryId);
    }
    // ...
  },
});
```

**Recommended RPC (`supabase/migrations/bulk_update_rpc.sql`):**

```sql
CREATE OR REPLACE FUNCTION bulk_update_category(
  _transaction_ids uuid[],
  _category_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update non-archived, editable transactions
  UPDATE transactions
  SET
    -- Reset splits to single line with new category, preserving total amount
    is_split = false,
    lines = jsonb_build_array(
      jsonb_build_object(
        'category_id', _category_id,
        'amount', amount, -- Preserve original amount
        'memo', ''
      )
    ),
    updated_at = now(),
    last_modified_by = auth.uid()
  WHERE id = ANY(_transaction_ids)
  AND is_archived = false
  AND reconciled = false; -- Prevent editing reconciled
END;
$$;
```

### 2. UI Updates (`src/components/workbench/WorkbenchTable.tsx`)

**Enable Row Selection:**
TanStack Table `useReactTable` already has `rowSelection` state support.

```typescript
// State
const [rowSelection, setRowSelection] = useState({});

// Table Config
const table = useReactTable({
  // ...
  state: {
    // ...
    rowSelection,
  },
  enableRowSelection: true, // Enable it
  onRowSelectionChange: setRowSelection,
});

// Add Selection Column (First Column)
const columns = [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className="w-5 h-5"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="w-5 h-5"
      />
    ),
  },
  ...existingColumns
];
```

**Bulk Action Toolbar:**
Render a toolbar above the table when `Object.keys(rowSelection).length > 0`.

```tsx
// Above <table ...>
{
  Object.keys(rowSelection).length > 0 && (
    <div className="bg-brand-50 p-4 rounded-xl flex items-center justify-between mb-4 border border-brand-200">
      <span className="font-bold text-brand-800">{Object.keys(rowSelection).length} selected</span>
      <div className="flex gap-2">
        <select className="..." onChange={(e) => handleBulkCategory(e.target.value)}>
          <option>Change Category...</option>
          {categories.map((c) => (
            <option value={c.id}>{c.name}</option>
          ))}
        </select>

        <button onClick={handleBulkMarkReviewed} className="...">
          Mark Reviewed
        </button>
      </div>
    </div>
  );
}
```

**Handler:**

```typescript
const handleBulkCategory = (catId: string) => {
  const ids = Object.keys(rowSelection);
  bulkUpdate({ type: 'updateCategory', transactionIds: ids, categoryId: catId });
  setRowSelection({}); // Clear selection
};
```

## Verification

1. Select 3 transactions in Workbench.
2. Use Bulk Toolbar to set category to "Office Supplies".
3. Refresh or check updates.
4. Verify all 3 have new category and `is_split` is false.
5. Verify amounts are preserved.

## Files to Modify

- `src/components/workbench/WorkbenchTable.tsx`
- `src/hooks/useTransactionMutations.ts`
- `supabase/migrations/xxxx_bulk_update_rpc.sql` (New migration)
