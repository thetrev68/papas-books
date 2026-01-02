# Implementation Plan: Column Filtering for Workbench and Settings Tables

## Overview

This plan outlines how to add column-specific filtering to the Workbench table and all Settings tables (Accounts, Categories, Payees, Tax Year Locks, Access Grants, and Rules). The implementation will leverage TanStack Table's built-in column filtering APIs and create reusable filter UI components for different data types.

## User Requirements

- Click on column headers to reveal filter controls appropriate to the data type
- **Account column**: Multi-select dropdown with all available accounts
- **Date column**: Date range picker (from/to)
- **Payee column**: Searchable multi-select dropdown
- **Category column**: Multi-select dropdown (hierarchical categories)
- **Amount column**: Number range inputs (min/max)
- **Boolean columns** (Reviewed, Reconciled): Tri-state toggle (All/Yes/No)
- **Clear filter buttons**: Individual and "Clear All"
- **Mobile-friendly**: Filter panel/drawer for small screens

## Current State Analysis

### Existing Infrastructure

**WorkbenchTable.tsx (lines 52, 119-120):**

- ✅ Already has `columnFilters` state: `const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);`
- ✅ Already configured: `onColumnFiltersChange: setColumnFilters`
- ✅ Already enabled: `getFilteredRowModel: getFilteredRowModel()`
- ✅ Currently only uses `globalFilter` for search (line 53, 156-160)
- ✅ Uses TanStack Table v8.21.3 with full filtering support

**PayeesTab.tsx (lines 26-27, 196-205):**

- ✅ Has `globalFilter` state with search input
- ✅ Uses TanStack Table with `getFilteredRowModel()` enabled
- ✅ Has sorting but no column-specific filters

**Settings Tables (AccountsTab, CategoriesTab, RulesTab, AccessTab, TaxYearLocksTab):**

- ❌ Do NOT use TanStack Table - use simple HTML tables
- ❌ No filtering infrastructure at all
- 📋 Will require TanStack Table migration OR custom filtering logic

### Tables to Update

1. **Workbench Table** - Transaction data (Date, Account, Payee, Description, Category, Amount, Reviewed, Reconciled)
2. **Accounts Tab** - Name, Type, Opening Balance, Opening Date, Status
3. **Categories Tab** - Name, Parent Category, Tax Deductible, Tax Line Item, Sort Order
4. **Payees Tab** - Name, Default Category (already has TanStack Table)
5. **Rules Tab** - Priority, Keyword, Match Type, Target Category, Suggested Payee, Enabled, Use Count
6. **Access Grants Tab** - User, Role, Granted At, Granted By, Status
7. **Tax Year Locks Tab** - Tax Year, Status, Locked By, Locked At

## Architecture Decisions

### 1. Reusable Filter Component Library

Create a library of reusable filter components in `src/components/filters/`:

```text
src/components/filters/
├── ColumnFilterButton.tsx          # Button in column header to toggle filter
├── FilterPopover.tsx                # Popover container for filter controls
├── filters/
│   ├── TextFilter.tsx               # Text input with debouncing
│   ├── NumberRangeFilter.tsx        # Min/max number inputs
│   ├── DateRangeFilter.tsx          # Start/end date pickers
│   ├── MultiSelectFilter.tsx        # Checkbox list for multiple selection
│   ├── BooleanFilter.tsx            # Tri-state: All/True/False
│   └── EnumFilter.tsx               # Radio buttons or select for enums
├── FilterChips.tsx                  # Active filter chips with clear buttons
└── MobileFilterPanel.tsx            # Mobile drawer for all filters
```

**Rationale:**

- Reusable across all tables with TanStack Table
- Testable in isolation
- Consistent UI/UX across all filter types
- Follows component composition pattern

### 2. TanStack Table Integration Strategy

**For WorkbenchTable and PayeesTab (already using TanStack Table):**

- Use TanStack Table's built-in column filtering
- Define custom `filterFn` for each column type
- Leverage existing `columnFilters` state

**For Settings Tables (NOT using TanStack Table):**

- **Recommended**: Migrate to TanStack Table for consistency and feature parity
- **Alternative**: Implement custom client-side filtering (more work, less maintainable)

**Rationale:**

- TanStack Table provides battle-tested filtering APIs
- Consistent implementation across all tables
- Future-proof for additional features (grouping, pivoting, etc.)

### 3. Filter UI Pattern

**Desktop (≥768px):**

- Filter button icon in column header
- Click to open popover with filter controls
- Popover positioned below header
- Active filter indicator (badge or filled icon)
- FilterChips row below table showing all active filters

**Mobile (<768px):**

- Filter icon button in toolbar (with badge showing active count)
- Opens bottom drawer with all filters
- Each filter section expandable/collapsible
- "Apply Filters" button
- FilterChips still shown above table

**Rationale:**

- Desktop: Contextual, header-based filters (Excel/Google Sheets pattern)
- Mobile: Consolidated filter panel (better for small screens)
- Existing pattern: WorkbenchTable already detects mobile (lines 61-68)

### 4. Filter State Management

**Phase 1 (MVP):** Session-only (filters reset on page refresh)

**Phase 2 (Enhancement):** Persist to localStorage per table

**Phase 3 (Advanced):** Save filter presets to database in user preferences

**Rationale:**

- Start simple, add persistence incrementally
- localStorage sufficient for most use cases
- Database presets enable advanced workflows (saved searches, team sharing)

## Detailed Implementation Steps

### Phase 1: Core Filter Infrastructure (Workbench Only)

#### Step 1.1: Create Reusable Filter Components

**File: `src/components/filters/ColumnFilterButton.tsx`**

```typescript
interface ColumnFilterButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  filterCount?: number;
}
```

- Small icon button (filter funnel icon)
- Shows badge with filter count if active
- Accessible: `aria-label="Filter by [column name]"`
- Props: `isActive`, `onClick`, `label`, `filterCount`

**File: `src/components/filters/FilterPopover.tsx`**

```typescript
interface FilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  anchorEl: RefObject<HTMLElement>;
}
```

- Positioned absolutely below column header
- Click outside to close (useEffect with document listener)
- Escape key to close
- `role="dialog"`, `aria-labelledby` for accessibility
- Z-index above table, below modals

**File: `src/components/filters/filters/TextFilter.tsx`**

```typescript
interface TextFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

- Text input with debouncing (300ms)
- Clear button (X icon)
- Auto-focus on mount
- Enter key applies filter (closes popover)

**File: `src/components/filters/filters/DateRangeFilter.tsx`**

```typescript
interface DateRangeFilterProps {
  value: { from?: string; to?: string };
  onChange: (value: { from?: string; to?: string }) => void;
}
```

- Two date inputs: "From" and "To"
- Use native `<input type="date">` for browser compatibility
- Validation: "from" must be before "to"
- "Clear" button to reset both dates

**File: `src/components/filters/filters/MultiSelectFilter.tsx`**

```typescript
interface MultiSelectFilterProps {
  options: Array<{ id: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  searchable?: boolean;
}
```

- Checkbox list with labels
- Optional search input at top (filters options)
- "Select All" / "Clear All" buttons
- Max height with scroll (300px)
- Virtual scrolling if > 100 items (use TanStack Virtual)

**File: `src/components/filters/filters/NumberRangeFilter.tsx`**

```typescript
interface NumberRangeFilterProps {
  value: { min?: number; max?: number };
  onChange: (value: { min?: number; max?: number }) => void;
  isCurrency?: boolean;
  label?: { min: string; max: string };
}
```

- Two number inputs: "Min" and "Max"
- If `isCurrency`, display as dollars but store as cents
- Validation: min < max
- Debounced input (500ms)

**File: `src/components/filters/filters/BooleanFilter.tsx`**

```typescript
interface BooleanFilterProps {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  labels?: { true: string; false: string };
}
```

- Three radio buttons: "All", "Yes" (true), "No" (false)
- Custom labels (e.g., "Reviewed" / "Not Reviewed")
- Default labels: "All", "Yes", "No"

**File: `src/components/filters/filters/EnumFilter.tsx`**

```typescript
interface EnumFilterProps {
  options: Array<{ value: string; label: string }>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}
```

- Radio buttons for each enum value
- "All" option (undefined value)
- Used for match_type, account type, role, etc.

**File: `src/components/filters/FilterChips.tsx`**

```typescript
interface FilterChipsProps {
  filters: ColumnFiltersState;
  onRemove: (columnId: string) => void;
  onClearAll: () => void;
  getColumnLabel: (columnId: string) => string;
  getFilterLabel: (columnId: string, value: unknown) => string;
}
```

- Displays active filters as chips/badges
- Each chip: "[Column]: [Value]" with X button
- "Clear All Filters" button if multiple filters
- Horizontal scrollable on mobile

**File: `src/components/filters/MobileFilterPanel.tsx`**

```typescript
interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Array<{
    id: string;
    label: string;
    FilterComponent: React.ComponentType;
  }>;
}
```

- Bottom drawer (slides up from bottom)
- Each column's filter in expandable section
- "Apply Filters" and "Clear All" buttons at bottom
- Backdrop overlay
- Smooth transition animations

#### Step 1.2: Define Custom Filter Functions

**File: `src/lib/filters/columnFilters.ts`**

Create custom filter functions for TanStack Table:

```typescript
import type { FilterFn } from '@tanstack/react-table';
import type { Transaction } from '../types/database';

// Date range filter
export const dateRangeFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  const { from, to } = filterValue as { from?: string; to?: string };
  if (!from && !to) return true;

  const cellValue = row.getValue<string>(columnId);
  const date = new Date(cellValue);

  if (from && date < new Date(from)) return false;
  if (to && date > new Date(to)) return false;
  return true;
};

// Multi-select filter (for account, category, payee)
export const multiSelectFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  const selectedIds = filterValue as string[];
  if (!selectedIds || selectedIds.length === 0) return true;

  const cellValue = row.getValue<string>(columnId);
  return selectedIds.includes(cellValue);
};

// Number range filter (for amounts)
export const numberRangeFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  const { min, max } = filterValue as { min?: number; max?: number };
  if (min === undefined && max === undefined) return true;

  const cellValue = row.getValue<number>(columnId);

  if (min !== undefined && cellValue < min) return false;
  if (max !== undefined && cellValue > max) return false;
  return true;
};

// Boolean tri-state filter
export const booleanFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  if (filterValue === undefined) return true; // "All"
  const cellValue = row.getValue<boolean>(columnId);
  return cellValue === filterValue;
};

// Text contains filter (case-insensitive)
export const textContainsFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  const searchValue = ((filterValue as string) || '').toLowerCase();
  if (!searchValue) return true;

  const cellValue = (row.getValue<string>(columnId) || '').toLowerCase();
  return cellValue.includes(searchValue);
};

// Category filter (handles split transactions)
export const categoryFilter: FilterFn<Transaction> = (row, columnId, filterValue) => {
  const selectedCategoryIds = filterValue as string[];
  if (!selectedCategoryIds || selectedCategoryIds.length === 0) return true;

  const transaction = row.original;

  // For split transactions, check all lines
  if (transaction.is_split) {
    return transaction.lines.some((line) => selectedCategoryIds.includes(line.category_id));
  }

  // For simple transactions, check first line
  const categoryId = transaction.lines[0]?.category_id;
  return categoryId && selectedCategoryIds.includes(categoryId);
};
```

**Rationale:**

- Custom filter functions handle complex data types
- Reusable across all TanStack Tables
- Type-safe with TypeScript generics
- Handles edge cases (undefined, null, empty arrays)

#### Step 1.3: Create Column Header Component

**File: `src/components/workbench/ColumnHeader.tsx`**

```typescript
interface ColumnHeaderProps<T> {
  column: Column<T>;
  label: string;
  FilterComponent?: React.ComponentType<{
    value: unknown;
    onChange: (value: unknown) => void;
  }>;
}
```

- Renders column label
- Sort indicator (🔼/🔽) if sorted
- Filter button if FilterComponent provided
- Active filter indicator (badge or colored icon)
- Click label to sort, click filter icon to open popover
- Manages popover open/close state

**Rationale:**

- Consolidates column header logic
- Reusable across all tables
- Separates concerns (header vs filter UI)

#### Step 1.4: Update WorkbenchColumns.tsx

**File: `src/components/workbench/WorkbenchColumns.tsx`**

For each column, add `filterFn` and update header to use `ColumnHeader`:

```typescript
// Example: Date column
columnHelper.accessor('date', {
  header: ({ column }) => (
    <ColumnHeader
      column={column}
      label="Date"
      FilterComponent={(props) => (
        <DateRangeFilter
          value={props.value as { from?: string; to?: string } || {}}
          onChange={props.onChange}
        />
      )}
    />
  ),
  filterFn: dateRangeFilter,
  cell: (info) => {
    const date = new Date(info.getValue());
    return date.toLocaleDateString();
  },
})

// Example: Account column
columnHelper.accessor('account_id', {
  header: ({ column }) => (
    <ColumnHeader
      column={column}
      label="Account"
      FilterComponent={(props) => (
        <MultiSelectFilter
          options={accounts.map(a => ({ id: a.id, label: a.name }))}
          value={props.value as string[] || []}
          onChange={props.onChange}
        />
      )}
    />
  ),
  filterFn: multiSelectFilter,
  cell: (info) => getAccountName(info.getValue()),
})

// Example: Reviewed column
columnHelper.accessor('is_reviewed', {
  header: ({ column }) => (
    <ColumnHeader
      column={column}
      label="Reviewed"
      FilterComponent={(props) => (
        <BooleanFilter
          value={props.value as boolean | undefined}
          onChange={props.onChange}
          labels={{ true: 'Reviewed', false: 'Not Reviewed' }}
        />
      )}
    />
  ),
  filterFn: booleanFilter,
  cell: (info) => (info.getValue() ? '✓' : ''),
})

// Example: Amount column
columnHelper.accessor('amount', {
  header: ({ column }) => (
    <ColumnHeader
      column={column}
      label="Amount"
      FilterComponent={(props) => (
        <NumberRangeFilter
          value={props.value as { min?: number; max?: number } || {}}
          onChange={props.onChange}
          isCurrency={true}
          label={{ min: 'Min', max: 'Max' }}
        />
      )}
    />
  ),
  filterFn: numberRangeFilter,
  cell: (info) => {
    const amount = info.getValue();
    return (amount / 100).toFixed(2);
  },
})
```

**Columns to add filters:**

1. `date` - DateRangeFilter
2. `account_id` - MultiSelectFilter (accounts)
3. `payee` - MultiSelectFilter (payees) or TextFilter
4. `original_description` - TextFilter
5. Category (computed) - MultiSelectFilter (categories) with categoryFilter
6. `amount` - NumberRangeFilter
7. `is_reviewed` - BooleanFilter
8. `reconciled` - BooleanFilter (from database schema)

#### Step 1.5: Add FilterChips to WorkbenchTable

**File: `src/components/workbench/WorkbenchTable.tsx`**

After the global search input (around line 160), add FilterChips:

```typescript
{/* Active Filters Display */}
{columnFilters.length > 0 && (
  <div className="mb-4">
    <FilterChips
      filters={columnFilters}
      onRemove={(columnId) => {
        setColumnFilters(prev => prev.filter(f => f.id !== columnId));
      }}
      onClearAll={() => setColumnFilters([])}
      getColumnLabel={(columnId) => {
        const labelMap: Record<string, string> = {
          date: 'Date',
          account_id: 'Account',
          payee: 'Payee',
          original_description: 'Description',
          category: 'Category',
          amount: 'Amount',
          is_reviewed: 'Reviewed',
          reconciled: 'Reconciled',
        };
        return labelMap[columnId] || columnId;
      }}
      getFilterLabel={(columnId, value) => {
        // Format filter value for display
        if (columnId === 'date') {
          const { from, to } = value as { from?: string; to?: string };
          if (from && to) return `${from} to ${to}`;
          if (from) return `After ${from}`;
          if (to) return `Before ${to}`;
        }
        if (columnId === 'account_id') {
          const ids = value as string[];
          if (ids.length === 1) {
            const account = accounts.find(a => a.id === ids[0]);
            return account?.name || ids[0];
          }
          return `${ids.length} accounts`;
        }
        if (columnId === 'amount') {
          const { min, max } = value as { min?: number; max?: number };
          if (min !== undefined && max !== undefined) {
            return `$${(min / 100).toFixed(2)} - $${(max / 100).toFixed(2)}`;
          }
          if (min !== undefined) return `≥ $${(min / 100).toFixed(2)}`;
          if (max !== undefined) return `≤ $${(max / 100).toFixed(2)}`;
        }
        if (columnId === 'is_reviewed' || columnId === 'reconciled') {
          return value === true ? 'Yes' : 'No';
        }
        return String(value);
      }}
    />
  </div>
)}
```

#### Step 1.6: Add Mobile Filter Panel

**File: `src/components/workbench/WorkbenchTable.tsx`**

Add filter button to toolbar (mobile only):

```typescript
{/* Mobile Filter Button */}
{isMobile && (
  <button
    onClick={() => setMobileFiltersOpen(true)}
    className="relative p-2 bg-brand-500 text-white rounded-lg"
    aria-label={`Filters${columnFilters.length > 0 ? ` (${columnFilters.length} active)` : ''}`}
  >
    <FilterIcon />
    {columnFilters.length > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
        {columnFilters.length}
      </span>
    )}
  </button>
)}

{/* Mobile Filter Panel */}
<MobileFilterPanel
  isOpen={mobileFiltersOpen}
  onClose={() => setMobileFiltersOpen(false)}
  columns={[
    {
      id: 'date',
      label: 'Date',
      FilterComponent: () => (
        <DateRangeFilter
          value={table.getColumn('date')?.getFilterValue() as any || {}}
          onChange={(value) => table.getColumn('date')?.setFilterValue(value)}
        />
      ),
    },
    // ... other columns
  ]}
/>
```

---

### Phase 2: Extend to Settings Tables

#### Step 2.1: Migrate Settings Tables to TanStack Table

**Priority order:**

1. **PayeesTab** - Already uses TanStack Table (easiest)
2. **RulesTab** - Most columns, most benefit from filtering
3. **CategoriesTab** - Moderate complexity
4. **AccountsTab** - Simple table
5. **AccessTab** - Simple table
6. **TaxYearLocksTab** - May not need full table migration

#### Step 2.2: PayeesTab Filters

**File: `src/components/settings/PayeesTab.tsx`**

Already has TanStack Table. Add filters:

1. Replace `globalFilter` with column-specific filters OR keep both
2. Add `columnFilters` state
3. Update column definitions with ColumnHeader and FilterComponents
4. Add FilterChips

**Columns to filter:**

- `name` - TextFilter
- `default_category_id` - MultiSelectFilter (categories)

#### Step 2.3: RulesTab Migration

**Create: `src/components/settings/RulesColumns.tsx`**

Define columns with filters:

```typescript
export function useRulesColumns() {
  const columns = [
    columnHelper.accessor('priority', {
      header: ({ column }) => (
        <ColumnHeader
          column={column}
          label="Priority"
          FilterComponent={(props) => (
            <NumberRangeFilter
              value={props.value as any || {}}
              onChange={props.onChange}
              label={{ min: 'Min', max: 'Max' }}
            />
          )}
        />
      ),
      filterFn: numberRangeFilter,
    }),
    columnHelper.accessor('keyword', {
      header: ({ column }) => (
        <ColumnHeader
          column={column}
          label="Keyword"
          FilterComponent={(props) => (
            <TextFilter
              value={props.value as string || ''}
              onChange={props.onChange}
            />
          )}
        />
      ),
      filterFn: textContainsFilter,
    }),
    // ... more columns
  ];
  return columns;
}
```

**Update: `src/components/settings/RulesTab.tsx`**

Replace HTML table with TanStack Table implementation.

#### Step 2.4: Other Settings Tables

Follow same pattern for:

- CategoriesTab
- AccountsTab
- AccessTab

---

### Phase 3: Performance Optimizations

#### Step 3.1: Memoization

**Critical memoizations:**

```typescript
// In filter components
export const TextFilter = memo(function TextFilter(props) { ... });
export const DateRangeFilter = memo(function DateRangeFilter(props) { ... });

// In column definitions
const columns = useMemo(() => [...], [dependencies]);
```

#### Step 3.2: Debouncing

**TextFilter (300ms):**

```typescript
const [localValue, setLocalValue] = useState(value);

useEffect(() => {
  const timer = setTimeout(() => {
    onChange(localValue);
  }, 300);
  return () => clearTimeout(timer);
}, [localValue, onChange]);
```

**NumberRangeFilter (500ms):**

Similar debouncing for min/max inputs.

#### Step 3.3: Virtual Scrolling in MultiSelectFilter

For filter options > 100 items:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// In MultiSelectFilter
const virtualizer = useVirtualizer({
  count: filteredOptions.length,
  getScrollElement: () => listRef.current,
  estimateSize: () => 32,
});
```

---

## Mobile UX Strategy

### Desktop (≥768px)

- Filters in column headers (click filter icon to expand popover)
- FilterChips displayed below table toolbar
- Inline, contextual filtering
- Sort by clicking column label, filter by clicking filter icon

### Mobile (<768px)

- Filter icon button in toolbar (with badge showing active count)
- Opens bottom drawer with all filters
- Each filter section collapsible/expandable
- "Apply Filters" button at bottom
- FilterChips still shown above table (horizontally scrollable)

**Example mobile workflow:**

1. User clicks Filter icon (badge shows "2")
2. Bottom drawer slides up
3. Drawer shows:
   - Date Range (expanded) - From/To inputs
   - Account (collapsed) - Click to expand
   - Payee (collapsed)
   - Category (collapsed)
   - Amount (collapsed)
   - Reviewed (collapsed)
   - Reconciled (collapsed)
4. User changes filters
5. User clicks "Apply Filters"
6. Drawer closes, table updates, FilterChips show active filters

---

## Filter Persistence Strategy

### Phase 1: Session Only (MVP)

- Filters reset on page refresh
- Simplest implementation
- No dependencies

### Phase 2: localStorage

**File: `src/hooks/usePersistedFilters.ts`**

```typescript
import { useState, useEffect } from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';

export function usePersistedFilters(tableKey: string) {
  const storageKey = `filters_${tableKey}`;

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnFilters));
    } catch (error) {
      console.error('Failed to persist filters:', error);
    }
  }, [columnFilters, storageKey]);

  return [columnFilters, setColumnFilters] as const;
}
```

**Usage in WorkbenchTable:**

```typescript
// Replace:
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

// With:
const [columnFilters, setColumnFilters] = usePersistedFilters('workbench');
```

**Table keys:**

- `workbench` - Workbench transactions
- `settings_accounts` - Accounts tab
- `settings_categories` - Categories tab
- `settings_payees` - Payees tab
- `settings_rules` - Rules tab
- `settings_access` - Access grants tab
- `settings_tax_years` - Tax year locks tab

### Phase 3: Database Preferences

**Future enhancement:**

- Add `filter_presets` JSONB column to `users` table
- Save named filter presets (e.g., "Unreviewed This Month", "Large Expenses")
- Dropdown to select preset
- Share presets across team (via bookset)

---

## Testing Strategy

### Unit Tests

**Filter Components:**

- `src/components/filters/filters/TextFilter.test.tsx`
  - Renders input
  - Debounces input changes
  - Clear button clears value
  - Enter key triggers onChange

- `src/components/filters/filters/DateRangeFilter.test.tsx`
  - Validates from < to
  - Clear button resets both dates
  - Handles invalid dates

- `src/components/filters/filters/MultiSelectFilter.test.tsx`
  - Select all / clear all
  - Search filters options
  - Virtual scrolling with 1000 items

- `src/components/filters/filters/NumberRangeFilter.test.tsx`
  - Min < max validation
  - Currency formatting (cents to dollars)
  - Debouncing

- `src/components/filters/filters/BooleanFilter.test.tsx`
  - Tri-state toggle (all/true/false)
  - Custom labels

**Filter Functions:**

- `src/lib/filters/columnFilters.test.ts`
  - `dateRangeFilter` with various ranges
  - `multiSelectFilter` with empty/single/multiple selections
  - `numberRangeFilter` with min/max/both/neither
  - `booleanFilter` with true/false/undefined
  - `categoryFilter` with split transactions
  - `textContainsFilter` case-insensitive

**Integration:**

- `src/components/workbench/WorkbenchTable.test.tsx`
  - Apply filter, verify filtered rows
  - Remove filter chip
  - Clear all filters
  - Multiple filters (AND logic)

### E2E Tests

**File: `e2e/workbench-filters.spec.ts`**

```typescript
test('filter transactions by date range', async ({ page }) => {
  await page.goto('/workbench');

  // Click date filter button
  await page.click('[aria-label="Filter by Date"]');

  // Enter date range
  await page.fill('input[name="from"]', '2024-01-01');
  await page.fill('input[name="to"]', '2024-01-31');

  // Verify filter chip appears
  await expect(page.locator('text=Date: 2024-01-01 to 2024-01-31')).toBeVisible();

  // Verify filtered results
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  // Remove filter
  await page.click('[aria-label="Remove Date filter"]');

  // Verify filter chip removed
  await expect(page.locator('text=Date: 2024-01-01 to 2024-01-31')).not.toBeVisible();
});

test('filter transactions by multiple criteria', async ({ page }) => {
  // Apply account filter
  // Apply reviewed filter
  // Verify AND logic (both filters applied)
});

test('mobile filter panel', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  // Click filter button
  await page.click('[aria-label^="Filters"]');

  // Verify drawer opens
  await expect(page.locator('role=dialog')).toBeVisible();

  // Apply filter
  // Click "Apply Filters"
  // Verify drawer closes
});
```

---

## Accessibility Considerations

### ARIA Labels

```typescript
// Filter button
<button aria-label="Filter by Date" />

// Filter popover
<div role="dialog" aria-labelledby="date-filter-title">
  <h3 id="date-filter-title">Filter by Date</h3>
  {/* Filter controls */}
</div>

// Active filter badge
<span aria-label="2 active filters">2</span>

// Filter chip
<div role="listitem" aria-label="Date filter: 2024-01-01 to 2024-01-31">
  <span>Date: 2024-01-01 to 2024-01-31</span>
  <button aria-label="Remove Date filter">×</button>
</div>
```

### Keyboard Navigation

- **Tab**: Navigate between filter buttons
- **Enter/Space**: Open filter popover
- **Escape**: Close filter popover
- **Tab (in popover)**: Navigate filter controls
- **Enter (in text input)**: Apply filter and close popover

### Screen Reader Support

```typescript
// Announce filter changes
const announceFilter = (columnLabel: string, resultCount: number) => {
  const announcement = `Filtered by ${columnLabel}, showing ${resultCount} results`;
  // Use aria-live region
};
```

**Live regions:**

```typescript
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {filterAnnouncement}
</div>
```

---

## Implementation Phases & Sequence

### Phase 1: Core Infrastructure (Workbench Only)

**Week 1:**

- Day 1-2: Build reusable filter components (TextFilter, DateRangeFilter, etc.)
- Day 3: Create custom filter functions (columnFilters.ts)
- Day 4-5: Build ColumnHeader component with popover

**Week 2:**

- Day 1-2: Update WorkbenchColumns with filters for all columns
- Day 3: Add FilterChips component
- Day 4: Add MobileFilterPanel
- Day 5: Testing and refinement

### Phase 2: Settings Tables

**Week 3:**

- Day 1: PayeesTab filters (already has TanStack Table)
- Day 2-3: RulesTab migration + filters
- Day 4: CategoriesTab migration + filters
- Day 5: AccountsTab migration + filters

**Week 4:**

- Day 1: AccessTab migration + filters
- Day 2: TaxYearLocksTab (custom filtering if needed)
- Day 3-4: Testing all settings tables
- Day 5: Bug fixes and polish

### Phase 3: Enhancements

**Week 5:**

- Day 1-2: Filter persistence (usePersistedFilters hook)
- Day 2-3: Performance optimizations (memoization, debouncing)
- Day 3-4: Accessibility audit and fixes
- Day 4-5: E2E tests for filtering

### Phase 4: Polish

**Week 6:**

- Day 1: Loading indicators for large filters
- Day 2: Filter animations and transitions
- Day 3: Documentation updates (CLAUDE.md)
- Day 4-5: Final testing and QA

### Total Estimated Time: 6 weeks

---

## Trade-offs & Considerations

### TanStack Table Migration for Settings Tables

**Pros:**

- Consistent filtering/sorting API
- Built-in performance optimizations
- Virtual scrolling support
- Reduces custom code

**Cons:**

- More upfront work
- Slightly more complex
- May be overkill for simple tables

**Decision**: Migrate all tables except Tax Year Locks for consistency and long-term maintainability.

### Filter UI: Popovers vs Inline

**Popovers (Recommended):**

- Cleaner table header
- Scales with many columns
- Familiar pattern (Excel, Google Sheets)

**Inline:**

- Always visible
- No click required
- Takes up more space

**Decision**: Use popovers for desktop, drawer for mobile.

### Filter Operators (AND vs OR)

#### Current Plan: AND logic between columns

- Date=Jan AND Account=Checking AND Reviewed=false
- MultiSelectFilter already supports OR within column (Account=Checking OR Savings)

**Future Enhancement:**

- Advanced filter builder with AND/OR groups
- Save complex filters as presets

---

## Risk Assessment

### Low Risk

- Filtering is client-side (no database changes)
- Uses TanStack Table's battle-tested APIs
- Filter components are isolated and testable
- Can be rolled out incrementally (Workbench first, then Settings)

### Medium Risk

- **Performance with large datasets**: Filtering 10,000+ transactions
  - **Mitigation**: TanStack Table's getFilteredRowModel is optimized; virtual scrolling already in place

- **Mobile UX complexity**: Bottom drawer with many filters
  - **Mitigation**: Collapsible sections, search in MultiSelectFilter

- **Filter state persistence**: localStorage quota limits
  - **Mitigation**: Store only filter state (small), not data; clear old entries

### Minimal Risk

- **Browser compatibility**: Native date input not supported in old browsers
  - **Mitigation**: Graceful degradation, consider date picker library if needed

- **Accessibility**: Complex filter UI may be challenging for screen readers
  - **Mitigation**: Comprehensive ARIA labels, keyboard navigation, testing with screen readers

---

## Success Metrics

### Functional

- ✅ All 8 tables have working column filters
- ✅ Filter UI is responsive (desktop + mobile)
- ✅ Filters respect data types (date ranges, multi-select, etc.)
- ✅ FilterChips display active filters clearly
- ✅ Clear individual and "Clear All" filters work

### Performance

- ✅ Filtering 10,000 transactions completes in <500ms
- ✅ Text filter debouncing prevents excessive re-renders
- ✅ Virtual scrolling in MultiSelectFilter with 1000+ options

### Accessibility

- ✅ All filter controls keyboard accessible
- ✅ Screen readers announce filter changes
- ✅ WCAG 2.1 AA compliant

### User Experience

- ✅ Filter UI is discoverable (clear visual indicators)
- ✅ Filter controls are intuitive (no user confusion)
- ✅ Mobile filter panel is easy to use
- ✅ Filters persist between sessions (localStorage)

---

## Critical Files for Implementation

- **src/components/filters/** - New directory for all filter components; centralizes reusable filter UI
- **src/lib/filters/columnFilters.ts** - Custom filter functions for TanStack Table; defines filtering logic for each data type
- **src/components/workbench/WorkbenchColumns.tsx** - Column definitions; add filterFn and ColumnHeader to each column
- **src/components/workbench/WorkbenchTable.tsx** - Main table component; already has columnFilters state, add FilterChips and MobileFilterPanel
- **src/components/workbench/ColumnHeader.tsx** - New component; handles column label, sort indicator, and filter button
- **src/components/settings/PayeesTab.tsx** - First settings table to add filters (already uses TanStack Table)
- **src/components/settings/RulesTab.tsx** - Migrate to TanStack Table and add filters (most complex settings table)
- **src/hooks/usePersistedFilters.ts** - New hook for localStorage persistence; reusable across all tables
- **src/types/database.ts** - Type definitions; reference for filter value types

---

## Alternative Approaches Considered

### 1. Use existing TanStack Table faceted filters examples

- **Considered**: Copy from TanStack Table docs examples
- **Rejected**: Examples are minimal, not production-ready; would still need custom UI components

### 2. Use a UI library (Material-UI, Ant Design)

- **Considered**: Pre-built filter components
- **Rejected**: Heavy dependencies; inconsistent with existing design system; less control

### 3. Backend filtering via database queries

- **Considered**: Send filter params to Supabase, filter via SQL
- **Rejected**: Adds latency; complicates state management; client-side filtering sufficient for current dataset sizes

### 4. Filter toolbar instead of column headers

- **Considered**: All filters in a toolbar above table
- **Rejected**: Less contextual; doesn't scale well with many columns; hybrid approach (headers for desktop, drawer for mobile) is better

---

## Appendix: Filter Type Reference

| Column Type                             | Filter Component  | Filter Function    | Example                          |
| --------------------------------------- | ----------------- | ------------------ | -------------------------------- |
| Date                                    | DateRangeFilter   | dateRangeFilter    | From: 2024-01-01, To: 2024-12-31 |
| Foreign Key (Account, Category, Payee)  | MultiSelectFilter | multiSelectFilter  | Checking, Savings                |
| Text (Description, Name)                | TextFilter        | textContainsFilter | "coffee"                         |
| Number (Amount, Priority, Use Count)    | NumberRangeFilter | numberRangeFilter  | Min: $10, Max: $100              |
| Boolean (Reviewed, Reconciled, Enabled) | BooleanFilter     | booleanFilter      | All / Yes / No                   |
| Enum (Match Type, Role, Account Type)   | EnumFilter        | Custom             | Contains / Exact / Starts With   |

---

## Documentation Updates

After implementation, update `CLAUDE.md`:

### New Section: Column Filtering

````markdown
### Column Filtering

**Location**: `src/components/filters/`, `src/lib/filters/`

The application supports column-specific filtering across all tables:

- **Filter UI**: Click column header filter icon to open filter controls
- **Filter Types**: Text, date range, multi-select, number range, boolean, enum
- **Filter Logic**: AND logic between columns, OR logic within MultiSelectFilter
- **Filter Persistence**: Filters persist to localStorage per table
- **Mobile**: Filter drawer with all filter controls

**Key Components**:

- `ColumnHeader.tsx`: Column header with sort and filter controls
- `FilterChips.tsx`: Active filter display with remove buttons
- `MobileFilterPanel.tsx`: Mobile filter drawer
- `filters/`: Reusable filter components (TextFilter, DateRangeFilter, etc.)

**Custom Filter Functions** (`src/lib/filters/columnFilters.ts`):

- `dateRangeFilter`: Filters dates within range
- `multiSelectFilter`: Filters by selected values
- `numberRangeFilter`: Filters numbers within min/max
- `booleanFilter`: Tri-state boolean filter
- `textContainsFilter`: Case-insensitive text search
- `categoryFilter`: Handles split transactions

**Usage**:

```typescript
const [columnFilters, setColumnFilters] = usePersistedFilters('workbench');

// In column definition
columnHelper.accessor('date', {
  header: ({ column }) => (
    <ColumnHeader
      column={column}
      label="Date"
      FilterComponent={DateRangeFilter}
    />
  ),
  filterFn: dateRangeFilter,
});
```
````

---

## Next Steps

After reviewing this plan, the recommended approach is:

1. **Approve plan** and create implementation timeline
2. **Phase 1**: Build core filter infrastructure for Workbench (2 weeks)
3. **Phase 2**: Extend to Settings tables (2 weeks)
4. **Phase 3**: Add enhancements (persistence, optimization) (1 week)
5. **Phase 4**: Polish and testing (1 week)

Total timeline: **6 weeks**

Would you like to proceed with implementation?
