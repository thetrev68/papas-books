# Phase 5: The Workbench (Transaction Management & Splits)

**Status:** Completed ✅
**Completion Date:** December 22, 2025
**Dependencies:** Phase 4 (Rules Engine)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-4-Rules-Engine.md](Phase-4-Rules-Engine.md)

---

## Overview

Phase 5 delivers the core user interface for transaction management. This is where users spend most of their time reviewing, categorizing, and editing transactions. The workbench must handle 2,000+ transactions efficiently while providing Excel-like editing capabilities, supporting complex split transactions, and maintaining consistent payee names through a lookup system.

**Key Principles:**

- **Performance First:** Virtualization and optimized rendering for large datasets
- **Keyboard-First:** Excel-like navigation and editing shortcuts
- **Split Transaction Support:** Handle 1 transaction → N categories with validation
- **Payee Normalization:** Maintain consistent payee names across imports
- **Business Logic Separation:** All calculations in `/src/lib/`, UI only renders
- **Minimal Styling:** Native HTML inputs, no CSS frameworks in this phase
- **TanStack Table Integration:** Use TanStack Table for advanced data grid features

---

## Data Structure: Split Transactions

### Core Transaction Schema (Enhanced)

```typescript
// src/types/database.ts (Enhancement)
export interface Transaction {
  id: string;
  booksetId: string;
  accountId: string;

  // Core data
  date: string; // ISO 8601
  payee: string; // User-editable
  originalDescription: string; // Immutable
  amount: number; // Total amount in cents (positive = income, negative = expense)

  // Split transaction support
  isSplit: boolean;
  lines: SplitLine[]; // Array of category allocations

  // Workflow state
  isReviewed: boolean;
  reconciled: boolean;

  // Metadata
  sourceBatchId: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitLine {
  categoryId: string;
  amount: number; // In cents (can be positive or negative)
  memo?: string; // Optional note for this line
}
```

### Why This Structure

- `isSplit: boolean` - Quick filter for UI rendering
- `lines: SplitLine[]` - Flexible array supports any number of splits
- `amount` on parent is total, `amount` on lines are allocations
- Must satisfy: `sum(lines.map(l => l.amount)) === parent.amount`
- Amounts can be positive (income) or negative (expenses) - both are valid

---

## Business Logic Layer

### Module 1: Split Transaction Calculator

**File:** `src/lib/splitCalculator.ts`

**Purpose:** Pure functions for split transaction math and validation.

```typescript
/**
 * Validates that split amounts sum to parent amount
 * Handles floating point precision issues
 */
export function validateSplitTransaction(transaction: Transaction): ValidationResult {
  if (!transaction.isSplit) {
    return { isValid: true, errors: [] };
  }

  const total = transaction.lines.reduce((sum, line) => sum + line.amount, 0);
  const difference = total - transaction.amount;

  // Allow small floating point errors (less than 1 cent)
  if (Math.abs(difference) > 1) {
    return {
      isValid: false,
      errors: [`Split amounts don't sum to total. Difference: $${(difference / 100).toFixed(2)}`],
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Calculates remainder for split transaction UI
 */
export function calculateSplitRemainder(transaction: Transaction): number {
  if (!transaction.isSplit) return 0;

  const allocated = transaction.lines.reduce((sum, line) => sum + line.amount, 0);
  return transaction.amount - allocated;
}

/**
 * Creates default split transaction from single category
 */
export function createSplitFromSingle(transaction: Transaction, categoryId: string): Transaction {
  return {
    ...transaction,
    isSplit: true,
    lines: [{ categoryId, amount: transaction.amount, memo: '' }],
  };
}

/**
 * Validates split line amount (can be positive or negative)
 */
export function validateSplitLineAmount(amount: number): FieldValidation {
  if (isNaN(amount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }
  if (!Number.isInteger(amount)) {
    return { isValid: false, error: 'Amount must be in cents (no decimals)' };
  }
  return { isValid: true };
}
```

### Module 2: Workbench Data Manager

**File:** `src/lib/workbenchDataManager.ts`

**Purpose:** Manage workbench state and filtering.

```typescript
export interface WorkbenchFilter {
  accountId?: string;
  isReviewed?: boolean;
  dateRange?: { start: string; end: string };
  search?: string;
}

/**
 * Filters transactions based on workbench criteria
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: WorkbenchFilter
): Transaction[] {
  return transactions.filter((tx) => {
    // Account filter
    if (filter.accountId && tx.accountId !== filter.accountId) return false;

    // Reviewed filter
    if (filter.isReviewed !== undefined && tx.isReviewed !== filter.isReviewed) return false;

    // Date range filter
    if (filter.dateRange) {
      const txDate = new Date(tx.date);
      const start = new Date(filter.dateRange.start);
      const end = new Date(filter.dateRange.end);
      if (txDate < start || txDate > end) return false;
    }

    // Search filter (payee or description)
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesPayee = tx.payee.toLowerCase().includes(searchLower);
      const matchesDesc = tx.originalDescription.toLowerCase().includes(searchLower);
      if (!matchesPayee && !matchesDesc) return false;
    }

    return true;
  });
}

/**
 * Sorts transactions for workbench display
 */
export function sortTransactions(
  transactions: Transaction[],
  sortBy: 'date' | 'amount' | 'payee' = 'date',
  order: 'asc' | 'desc' = 'desc'
): Transaction[] {
  return [...transactions].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === 'amount') {
      comparison = a.amount - b.amount;
    } else if (sortBy === 'payee') {
      comparison = a.payee.localeCompare(b.payee);
    }

    return order === 'asc' ? comparison : -comparison;
  });
}
```

### Module 3: Transaction Operations

**File:** `src/lib/transactionOperations.ts`

**Purpose:** Handle transaction creation, deletion, and bulk operations.

```typescript
/**
 * Creates a new manual transaction
 */
export function createManualTransaction(
  accountId: string,
  date: string,
  payee: string,
  amount: number,
  categoryId?: string
): Transaction {
  const lines = categoryId ? [{ categoryId, amount, memo: '' }] : [];

  return {
    id: crypto.randomUUID(),
    booksetId: '', // Will be set by caller
    accountId,
    date,
    payee,
    originalDescription: payee, // For manual transactions
    amount,
    isSplit: !!categoryId && lines.length === 1,
    lines,
    isReviewed: false,
    reconciled: false,
    sourceBatchId: null,
    fingerprint: '', // Will be generated
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deletes a transaction (soft delete via isArchived flag)
 */
export function deleteTransaction(transactionId: string): Promise<void> {
  // Implementation in supabase/transactions.ts
}

/**
 * Bulk operations on transactions
 */
export interface BulkOperation {
  type: 'markReviewed' | 'markUnreviewed' | 'applyRules';
  transactionIds: string[];
}

export function performBulkOperation(operation: BulkOperation): Promise<void> {
  // Implementation in supabase/transactions.ts
}
```

---

## TanStack Table Integration

### File: `src/components/workbench/WorkbenchTable.tsx`

**Purpose:** Advanced data grid with sorting, filtering, pagination, and virtualization.

#### Displayed Columns

The workbench will show the following columns:

1. **Date** - Transaction date (sortable)
2. **Payee** - User-editable payee name (inline editable)
3. **Description** - Original bank description (read-only, for reference)
4. **Amount** - Transaction amount (sortable, numeric formatting)
5. **Category** - Current category assignment (shows "Split" for split transactions)
6. **Account** - Which account the transaction belongs to
7. **Reviewed** - Checkbox for isReviewed status
8. **Actions** - Edit, Split, Delete, Create Rule buttons

#### Split Transaction Display

**Approach:** Single row per transaction, with expandable split details.

- **Normal transactions**: Show single category in Category column
- **Split transactions**: Show "Split" in Category column with expand/collapse arrow
- **When expanded**: Show sub-rows for each split line (category, amount, memo)
- **Visual indication**: Split transactions have different background color or border

**Implementation:**

```typescript
// Use TanStack Table's expand functionality
columnHelper.display({
  id: 'category',
  header: 'Category',
  cell: ({ row }) => {
    if (row.original.isSplit) {
      return (
        <div>
          <button onClick={row.getToggleExpandedHandler()}>
            {row.getIsExpanded() ? '▼' : '▶'} Split ({row.original.lines.length} categories)
          </button>
        </div>
      );
    } else {
      const categoryName = getCategoryName(row.original.lines[0]?.categoryId);
      return <span>{categoryName}</span>;
    }
  },
}),

// Add sub-rows for split details
table.getExpandedRowModel().rows.map(row => {
  if (row.original.isSplit && row.getIsExpanded()) {
    return row.original.lines.map((line, index) => (
      <tr key={`${row.id}-split-${index}`} className="split-line">
        <td></td> {/* Empty date cell */}
        <td></td> {/* Empty payee cell */}
        <td>{getCategoryName(line.categoryId)}</td>
        <td>${(line.amount / 100).toFixed(2)}</td>
        <td>{line.memo || ''}</td>
        <td></td> {/* Empty actions cell */}
      </tr>
    ));
  }
  return null;
})
```

**Why this approach:**

- Keeps single transaction per row (cleaner UI)
- Expandable details show split breakdown
- Maintains table structure and sorting
- Clear visual hierarchy (parent + child rows)

#### Payee Field and Normalization

**Problem:** Banks don't provide clean payee names - only raw descriptions.

**Solution:** Payee lookup and normalization system.

##### Payee Lookup Table

**New Database Table:** `payees`

```typescript
interface Payee {
  id: string;
  booksetId: string;
  name: string; // Clean, normalized name (e.g., "Starbucks")
  aliases: string[]; // Array of raw descriptions that map to this payee
  categoryId?: string; // Default category for this payee
  createdAt: string;
  updatedAt: string;
}
```

##### Payee Guessing on Import

**Integration with Rules Engine:**

1. **During import** (Phase 3): After parsing, before rules application
2. **Payee extraction**: Use fuzzy matching against existing payees
3. **Rule enhancement**: Rules can suggest payee in addition to category

**Payee Guessing Algorithm:**

```typescript
// src/lib/payee/payeeGuesser.ts
export function guessPayee(description: string, existingPayees: Payee[]): PayeeGuess {
  // 1. Exact match against aliases
  for (const payee of existingPayees) {
    if (payee.aliases.some((alias) => alias.toLowerCase() === description.toLowerCase())) {
      return { payee, confidence: 100 };
    }
  }

  // 2. Fuzzy match against payee names
  const words = description.toLowerCase().split(/\s+/);
  for (const payee of existingPayees) {
    const payeeWords = payee.name.toLowerCase().split(/\s+/);
    const commonWords = words.filter((word) => payeeWords.includes(word));

    if (commonWords.length >= Math.min(words.length, payeeWords.length) * 0.8) {
      return { payee, confidence: 80 };
    }
  }

  // 3. Extract merchant name using heuristics
  const merchantName = extractMerchantName(description);
  if (merchantName) {
    return {
      payee: null,
      suggestedName: merchantName,
      confidence: 60,
    };
  }

  return { payee: null, confidence: 0 };
}

function extractMerchantName(description: string): string | null {
  // Remove common prefixes/suffixes
  let clean = description
    .replace(/^(POS|DEBIT|CHECK|ATM|ONLINE|WEB)\s+/i, '')
    .replace(/\s+(PURCHASE|PAYMENT|WITHDRAWAL|DEPOSIT)$/i, '')
    .trim();

  // Take first 2-3 words as merchant name
  const words = clean.split(/\s+/).slice(0, 3);
  return words.join(' ');
}
```

##### Payee Management UI

**Settings Tab:** Payees management

- List all payees with aliases
- Add/edit/delete payees
- Merge payees (combine duplicates)
- Set default categories per payee

**Import Integration:**

- During import preview, show guessed payee with confidence
- Allow user to override or create new payee
- Auto-create payees from successful guesses

**Rule Enhancement:**

Rules can now suggest both category AND payee:

```typescript
interface Rule {
  // ... existing fields
  suggestedPayee?: string; // Normalize payee name
}
```

**Why this system:**

- Maintains consistent payee names across imports
- Learns from user corrections over time
- Integrates with rules for automatic payee normalization
- Provides better reporting and categorization

**Database Schema Addition:**

```sql
-- Add to supabase/schema.sql
CREATE TABLE payees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booksetId uuid NOT NULL REFERENCES booksets(id) ON DELETE CASCADE,
  name text NOT NULL,
  aliases text[] DEFAULT '{}',
  categoryId uuid REFERENCES categories(id) ON DELETE SET NULL,
  createdAt timestamp with time zone DEFAULT now(),
  updatedAt timestamp with time zone DEFAULT now(),
  createdBy uuid REFERENCES users(id),
  lastModifiedBy uuid REFERENCES users(id)
);

-- RLS Policies
ALTER TABLE payees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read payees from accessible booksets"
  ON payees FOR SELECT
  USING (user_can_read_bookset(booksetId));

CREATE POLICY "Editors can manage payees"
  ON payees FOR ALL
  USING (user_can_write_bookset(booksetId));

-- Indexes
CREATE INDEX idx_payees_bookset ON payees(booksetId);
CREATE INDEX idx_payees_aliases ON payees USING gin(aliases);
```

**Payee CRUD Operations:**

```typescript
// src/lib/supabase/payees.ts
export async function fetchPayees(booksetId: string): Promise<Payee[]> {
  const { data, error } = await supabase
    .from('payees')
    .select('*')
    .eq('booksetId', booksetId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createPayee(payee: InsertPayee): Promise<Payee> {
  const { data, error } = await supabase.from('payees').insert(payee).select().single();

  if (error) throw error;
  return data;
}

export async function updatePayeeAliases(payeeId: string, newAlias: string): Promise<void> {
  // Add new alias to existing payee
  const { error } = await supabase.rpc('add_payee_alias', {
    payee_id: payeeId,
    new_alias: newAlias,
  });

  if (error) throw error;
}
```

**PostgreSQL Function for Alias Management:**

```sql
CREATE OR REPLACE FUNCTION add_payee_alias(payee_id uuid, new_alias text)
RETURNS void AS $$
BEGIN
  UPDATE payees
  SET aliases = array_append(aliases, new_alias)
  WHERE id = payee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

```typescript
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

const columnHelper = createColumnHelper<Transaction>();

const columns = [
  columnHelper.accessor('date', {
    header: 'Date',
    cell: info => new Date(info.getValue()).toLocaleDateString(),
    sortingFn: 'datetime',
  }),
  columnHelper.accessor('payee', {
    header: 'Payee',
    cell: info => info.getValue() || 'Unknown',
  }),
  columnHelper.accessor('originalDescription', {
    header: 'Description',
    cell: info => (
      <span title={info.getValue()} className="truncate">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: info => {
      const amount = info.getValue();
      const sign = amount >= 0 ? '+' : '';
      return (
        <span className={amount >= 0 ? 'text-green-600' : 'text-red-600'}>
          {sign}${(Math.abs(amount) / 100).toFixed(2)}
        </span>
      );
    },
    sortingFn: 'basic',
  }),
  columnHelper.display({
    id: 'category',
    header: 'Category',
    cell: ({ row }) => {
      if (row.original.isSplit) {
        return (
          <div>
            <button onClick={row.getToggleExpandedHandler()}>
              {row.getIsExpanded() ? '▼' : '▶'} Split ({row.original.lines.length})
            </button>
          </div>
        );
      } else {
        const categoryName = getCategoryName(row.original.lines[0]?.categoryId);
        return <span>{categoryName}</span>;
      }
    },
  }),
  columnHelper.accessor('accountId', {
    header: 'Account',
    cell: info => getAccountName(info.getValue()),
  }),
  columnHelper.accessor('isReviewed', {
    header: 'Reviewed',
    cell: info => (
      <input
        type="checkbox"
        checked={info.getValue()}
        onChange={() => toggleReviewed(info.row.original)}
      />
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => onEdit(row.original)}>Edit</button>
        <button onClick={() => onSplit(row.original)}>Split</button>
        <button onClick={() => onDelete(row.original)}>Delete</button>
        <CreateRuleFromTransactionButton transaction={row.original} />
      </div>
    ),
  }),
];

function WorkbenchTable({ transactions, onEdit, onSplit, onDelete, onReview }) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includes',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  });

  // Virtualization for performance
  const parentRef = useRef();
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <div>
      {/* Filters */}
      <div>
        <input
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search all columns..."
        />
      </div>

      {/* Table */}
      <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className="flex items-center gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const row = table.getRowModel().rows[virtualRow.index];
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Why TanStack Table:**

- Built-in sorting, filtering, pagination
- Virtualization support for large datasets
- Flexible column definitions
- Excellent TypeScript support
- Performance optimized for 2000+ rows

---

## React Query Integration

### Hook: `useWorkbenchData`

**File:** `src/hooks/useWorkbenchData.ts`

**Purpose:** Fetch and manage workbench transactions with filtering.

```typescript
export interface WorkbenchState {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  filter: WorkbenchFilter;
  setFilter: (filter: Partial<WorkbenchFilter>) => void;
  sort: { by: string; order: 'asc' | 'desc' };
  setSort: (by: string, order: 'asc' | 'desc') => void;
}

export function useWorkbenchData(booksetId: string): WorkbenchState {
  const [filter, setFilter] = useState<WorkbenchFilter>({ isReviewed: false });
  const [sort, setSort] = useState({ by: 'date', order: 'desc' as const });

  const {
    data: allTransactions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transactions', booksetId],
    queryFn: () => fetchTransactions(booksetId),
  });

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    let result = filterTransactions(allTransactions, filter);
    result = sortTransactions(result, sort.by as any, sort.order);

    return result;
  }, [allTransactions, filter, sort]);

  return {
    transactions: filteredTransactions,
    isLoading,
    error,
    filter,
    setFilter: (newFilter) => setFilter((prev) => ({ ...prev, ...newFilter })),
    sort,
    setSort,
  };
}
```

### Hook: `useTransactionMutations`

**File:** `src/hooks/useTransactionMutations.ts`

**Purpose:** Handle transaction updates with optimistic updates.

```typescript
export function useTransactionMutations() {
  const queryClient = useQueryClient();

  const createTransaction = useMutation({
    mutationFn: (transaction: Transaction) => createTransactionInDB(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: (transaction: Transaction) => updateTransactionInDB(transaction),
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const previousTransactions = queryClient.getQueryData(['transactions']);
      queryClient.setQueryData(['transactions'], (old: Transaction[] = []) => {
        return old.map((tx) => (tx.id === newTransaction.id ? newTransaction : tx));
      });
      return { previousTransactions };
    },
    onError: (err, newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (transactionId: string) => deleteTransactionInDB(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: (operation: BulkOperation) => performBulkOperationInDB(operation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return {
    createTransaction: createTransaction.mutate,
    updateTransaction: updateTransaction.mutate,
    deleteTransaction: deleteTransaction.mutate,
    bulkUpdate: bulkUpdate.mutate,
    isLoading:
      createTransaction.isLoading ||
      updateTransaction.isLoading ||
      deleteTransaction.isLoading ||
      bulkUpdate.isLoading,
  };
}
```

---

## UI Components

### Component 1: Workbench Page

**File:** `src/pages/WorkbenchPage.tsx`

**Structure:**

```text
<WorkbenchPage>
  ├── <WorkbenchFilters> (account, reviewed, date range, search)
  ├── <WorkbenchTable> (TanStack Table with virtualization)
  ├── <SplitModal> (when editing splits)
  ├── <CreateTransactionModal> (manual entry)
  └── <BulkActions> (mark reviewed, apply rules, delete)
```

**Key Features:**

- Default filter: `isReviewed = false` (show unreviewed transactions)
- Account selector to filter by specific account
- Date range picker for time-based filtering
- Global search box
- Sort controls (date, amount, payee)
- Bulk action buttons
- "Create Transaction" button for manual entry

### Component 2: Create Transaction Modal

**File:** `src/components/workbench/CreateTransactionModal.tsx`

**Purpose:** Allow users to manually create transactions.

```typescript
function CreateTransactionModal({ accountId, onSave, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: '',
    amount: 0,
    categoryId: '',
    isSplit: false
  });

  const [splitLines, setSplitLines] = useState([]);

  const handleSave = () => {
    const transaction = createManualTransaction(
      accountId,
      formData.date,
      formData.payee,
      Math.round(formData.amount * 100), // Convert to cents
      formData.categoryId
    );

    onSave(transaction);
  };

  return (
    <div className="modal">
      <h3>Create Transaction</h3>

      <div>
        <label>Date:</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
        />
      </div>

      <div>
        <label>Payee:</label>
        <input
          type="text"
          value={formData.payee}
          onChange={(e) => setFormData({...formData, payee: e.target.value})}
        />
      </div>

      <div>
        <label>Amount:</label>
        <input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.isSplit}
            onChange={(e) => setFormData({...formData, isSplit: e.target.checked})}
          />
          Split Transaction
        </label>
      </div>

      {formData.isSplit ? (
        <SplitModal
          transaction={{...createManualTransaction(accountId, formData.date, formData.payee, Math.round(formData.amount * 100)), isSplit: true, lines: splitLines}}
          onSave={(tx) => {
            onSave(tx);
            onClose();
          }}
          onClose={onClose}
        />
      ) : (
        <div>
          <label>Category:</label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
          >
            <option>Select Category</option>
            {/* Options from useCategories */}
          </select>
        </div>
      )}

      <div>
        <button onClick={handleSave}>Create</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
```

### Component 3: Inline Editing

**File:** `src/components/workbench/InlineEditCell.tsx`

**Purpose:** Excel-like inline editing for payee field.

```typescript
function InlineEditCell({ value, onSave, onCancel, isEditing }) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(editValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return <span onClick={() => {}}>{value}</span>;
}
```

### Component 4: Split Transaction Modal

**File:** `src/components/workbench/SplitModal.tsx`

**Purpose:** Handle complex split transaction editing.

```typescript
function SplitModal({ transaction, onSave, onClose }) {
  const [lines, setLines] = useState(transaction.lines || []);
  const [newLine, setNewLine] = useState({ categoryId: '', amount: 0, memo: '' });

  const remainder = calculateSplitRemainder({ ...transaction, lines });
  const isValid = Math.abs(remainder) <= 1;

  const addLine = () => {
    if (newLine.categoryId && newLine.amount !== 0) {
      setLines([...lines, { ...newLine, amount: Math.round(newLine.amount * 100) }]); // Convert to cents
      setNewLine({ categoryId: '', amount: 0, memo: '' });
    }
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (isValid) {
      onSave({ ...transaction, isSplit: true, lines });
    }
  };

  return (
    <div className="modal">
      <h3>Split Transaction</h3>
      <p>Total Amount: ${(transaction.amount / 100).toFixed(2)}</p>

      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>Memo</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td>{line.categoryId}</td>
              <td>${(line.amount / 100).toFixed(2)}</td>
              <td>{line.memo}</td>
              <td><button onClick={() => removeLine(index)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={newLine.amount}
          onChange={(e) => setNewLine({...newLine, amount: parseFloat(e.target.value) || 0})}
        />
        <select value={newLine.categoryId} onChange={(e) => setNewLine({...newLine, categoryId: e.target.value})}>
          <option>Select Category</option>
          {/* Options from useCategories */}
        </select>
        <input type="text" placeholder="Memo" value={newLine.memo} onChange={(e) => setNewLine({...newLine, memo: e.target.value})} />
        <button onClick={addLine}>Add Line</button>
      </div>

      <div style={{ color: isValid ? 'green' : 'red' }}>
        Remainder: ${(remainder / 100).toFixed(2)}
      </div>

      <button onClick={handleSave} disabled={!isValid}>Save Split</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}
```

---

## Keyboard Navigation

### Component: KeyboardHandler

**File:** `src/components/workbench/KeyboardHandler.tsx`

**Purpose:** Implement Excel-like keyboard shortcuts.

```typescript
function useKeyboardNavigation({
  transactions,
  selectedRow,
  setSelectedRow,
  onEdit,
  onSplit,
  onDelete,
  onReview,
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!transactions.length) return;

      // J/K navigation
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(selectedRow + 1, transactions.length - 1);
        setSelectedRow(newIndex);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(selectedRow - 1, 0);
        setSelectedRow(newIndex);
      }

      // Space to toggle review
      if (e.key === ' ') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        onReview(tx);
      }

      // Enter to edit
      if (e.key === 'Enter') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        onEdit(tx);
      }

      // Ctrl+S to split
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        onSplit(tx);
      }

      // Ctrl+D to delete
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        if (confirm('Delete this transaction?')) {
          onDelete(tx.id);
        }
      }

      // Ctrl+N to create new
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        // Trigger create transaction modal
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transactions, selectedRow, setSelectedRow, onEdit, onSplit, onDelete, onReview]);
}
```

---

## Data Access Layer

### File: `src/lib/supabase/transactions.ts`

**New Functions:**

```typescript
/**
 * Fetch transactions for workbench (with filtering)
 */
export async function fetchTransactions(booksetId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('booksetId', booksetId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new transaction
 */
export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...transaction,
      fingerprint: await generateFingerprint(
        transaction.date,
        transaction.amount,
        transaction.payee
      ),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a single transaction
 */
export async function updateTransaction(transaction: Transaction): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      payee: transaction.payee,
      isReviewed: transaction.isReviewed,
      isSplit: transaction.isSplit,
      lines: transaction.lines,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', transaction.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a transaction (soft delete)
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ isArchived: true, updatedAt: new Date().toISOString() })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Bulk update reviewed status
 */
export async function bulkUpdateReviewed(
  transactionIds: string[],
  isReviewed: boolean
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ isReviewed, updatedAt: new Date().toISOString() })
    .in('id', transactionIds);

  if (error) throw error;
}

/**
 * Bulk delete transactions
 */
export async function bulkDeleteTransactions(transactionIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ isArchived: true, updatedAt: new Date().toISOString() })
    .in('id', transactionIds);

  if (error) throw error;
}
```

---

## Testing Requirements

### Unit Tests

#### Test: Split Calculator

**File:** `src/lib/splitCalculator.test.ts`

```typescript
describe('splitCalculator', () => {
  test('validates split amounts sum correctly', () => {
    const tx = {
      amount: 10000, // $100.00
      isSplit: true,
      lines: [
        { categoryId: 'cat1', amount: 6000, memo: '' },
        { categoryId: 'cat2', amount: 4000, memo: '' },
      ],
    };

    const result = validateSplitTransaction(tx);
    expect(result.isValid).toBe(true);
  });

  test('detects split amount mismatch', () => {
    const tx = {
      amount: 10000,
      isSplit: true,
      lines: [
        { categoryId: 'cat1', amount: 6000, memo: '' },
        { categoryId: 'cat2', amount: 3000, memo: '' }, // Missing $10
      ],
    };

    const result = validateSplitTransaction(tx);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Difference: $10.00');
  });

  test('validates split line amounts can be negative', () => {
    const result = validateSplitLineAmount(-5000); // -$50.00
    expect(result.isValid).toBe(true);
  });

  test('validates split line amounts can be positive', () => {
    const result = validateSplitLineAmount(5000); // $50.00
    expect(result.isValid).toBe(true);
  });
});
```

#### Test: Transaction Operations

**File:** `src/lib/transactionOperations.test.ts`

```typescript
describe('transactionOperations', () => {
  test('creates manual transaction correctly', () => {
    const tx = createManualTransaction('acc1', '2024-01-01', 'Test Payee', 5000, 'cat1');

    expect(tx.accountId).toBe('acc1');
    expect(tx.payee).toBe('Test Payee');
    expect(tx.amount).toBe(5000);
    expect(tx.isSplit).toBe(true);
    expect(tx.lines).toHaveLength(1);
    expect(tx.lines[0].categoryId).toBe('cat1');
  });
});
```

### Integration Tests

#### Test: Workbench End-to-End

**Scenario:**

1. User loads workbench with 1000 transactions
2. Filters to unreviewed transactions (should show ~500)
3. Uses keyboard navigation (J/K) to move through rows
4. Edits payee field with Enter key
5. Creates split transaction with Ctrl+S
6. Validates split math prevents save until balanced
7. Saves split transaction
8. Creates new manual transaction with Ctrl+N
9. Deletes transaction with Ctrl+D
10. Bulk marks multiple transactions as reviewed
11. Verifies all changes appear in database

**Assertions:**

- Grid renders without performance issues
- Keyboard navigation works smoothly
- Inline editing saves correctly
- Split validation prevents unbalanced transactions
- Manual transaction creation works
- Delete operations work correctly
- Bulk operations work correctly
- Database reflects all changes

### Manual Testing Checklist

- [ ] Load workbench with 2000+ transactions (performance test)
- [ ] Verify all columns display: Date, Payee, Description, Amount, Category, Account, Reviewed, Actions
- [ ] Filter by account, reviewed status, date range, and search
- [ ] Use J/K keys to navigate rows
- [ ] Press Enter to edit payee field
- [ ] Press Space to toggle reviewed status
- [ ] Press Ctrl+S to split transaction
- [ ] Press Ctrl+D to delete transaction
- [ ] Press Ctrl+N to create new transaction
- [ ] Create split transaction and verify expandable display shows sub-categories
- [ ] Add multiple split lines with different categories (positive and negative amounts)
- [ ] Verify remainder calculation updates in real-time
- [ ] Attempt to save unbalanced split (should be blocked)
- [ ] Save balanced split transaction
- [ ] Verify split transaction displays correctly in grid with expand/collapse
- [ ] Bulk select and mark multiple transactions as reviewed
- [ ] Bulk delete multiple transactions
- [ ] Apply rules to selected transactions
- [ ] Import CSV and verify payee guessing with confidence scores
- [ ] Create/edit payees in Settings and verify lookup works
- [ ] Test payee normalization through rules
- [ ] Check browser console for errors
- [ ] Test with slow network (loading states)
- [ ] Test with offline scenario (error handling)
- [ ] Verify TanStack Table features work (sorting, filtering, pagination)

---

## Success Criteria

**Phase 5 is complete when:**

1. ✅ Workbench grid renders 2,000+ transactions without lag using TanStack Table
2. ✅ Displayed columns: Date, Payee, Description, Amount, Category, Account, Reviewed, Actions
3. ✅ Split transactions show as expandable rows with sub-details for each category allocation
4. ✅ Users can filter transactions by account, reviewed status, date range, and search
5. ✅ Keyboard navigation (J/K, Enter, Space, Ctrl+S, Ctrl+D, Ctrl+N) works as specified
6. ✅ Inline editing allows payee field modification
7. ✅ Split transaction creation and editing works with validation
8. ✅ Split math validation prevents unbalanced transactions (both positive and negative amounts valid)
9. ✅ Users can create new manual transactions
10. ✅ Users can delete individual and bulk transactions
11. ✅ Payee lookup system maintains consistent payee names across imports
12. ✅ Payee guessing works during import with confidence scoring
13. ✅ Rules can suggest both category and payee normalization
14. ✅ All business logic is in separate testable modules
15. ✅ React Query handles data fetching and optimistic updates
16. ✅ TanStack Table provides advanced grid features
17. ✅ All unit tests pass (`npm run test`)
18. ✅ Integration tests pass
19. ✅ Manual testing checklist passes
20. ✅ Build runs without errors (`npm run build`)
21. ✅ App deployed to Vercel successfully

---

## Notes for LLM-Assisted Development

### UI Components are Bare HTML

**Important:** All UI components in this phase should use native HTML elements only:

- `<input>`, `<select>`, `<button>`, `<table>`, `<div>`
- No CSS frameworks (Tailwind, Bootstrap, etc.)
- No complex styling - focus on functionality
- Inline styles only for basic visibility (e.g., error colors)
- The visual design system will be implemented in Phase 7

### When implementing TanStack Table

- Use the virtualization features for performance
- Implement proper column definitions with sorting
- Handle global and column-specific filtering
- Use React Query for data fetching integration
- Keep table styling minimal (native HTML table)

### When implementing split transactions

- Amounts can be positive (income) or negative (expenses) - both are valid
- Always validate `sum(lines) === parent.amount` before saving
- Handle floating point precision (allow < 1 cent difference)
- Provide clear visual feedback for remainder calculation
- Prevent saving when remainder is non-zero

### When implementing transaction operations

- Manual transactions should have `sourceBatchId: null` (not from import)
- Use soft delete (`isArchived: true`) instead of hard delete
- Implement bulk operations for efficiency
- Handle both individual and bulk operations

### When implementing payee system

- Create payees table with proper RLS policies
- Implement fuzzy matching for payee guessing during import
- Allow rules to suggest payee normalization
- Provide UI for managing payees and their aliases
- Integrate payee lookup with transaction editing

### When implementing split transaction display

- Use TanStack Table's expand functionality for hierarchical display
- Parent row shows summary, expanded rows show split details
- Maintain proper indentation and visual hierarchy
- Handle both positive and negative split amounts correctly

### Performance considerations

- Use TanStack Table's virtualization for large datasets
- Memoize expensive calculations with `useMemo`
- Debounce search input to prevent excessive filtering
- Implement pagination if virtualization isn't sufficient
- Monitor bundle size and optimize imports

### Error handling

- Handle network errors gracefully
- Provide user-friendly error messages
- Implement retry logic for failed operations
- Log errors for debugging

---

## Next Phase Preview

**Phase 6** will implement:

- Reconciliation wizard with balance calculation
- Report generation with category summaries
- Export functionality (CSV, PDF)
- Advanced filtering and date range selection
- Integration with workbench for reconciliation workflow

The workbench from Phase 5 will serve as the foundation for reconciliation and reporting features.
