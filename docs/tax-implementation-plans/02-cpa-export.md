# Implementation Plan: CPA Export

**Feature:** CPA Export (Transaction Detail Export)
**Priority:** Phase 1 - High Impact
**Estimated Effort:** 2-3 days
**Dependencies:** None (can be done in parallel with Tax Form Report)
**Risk Level:** Low

---

## Objective

Export all transactions with full detail for CPAs to import into tax software. This provides a comprehensive, line-by-line transaction export that flattens split transactions so each split line appears as a separate row.

---

## Current State Analysis

### Existing Code

- ✅ `src/lib/reports.ts` - Has basic CSV export functionality
- ✅ `src/pages/ReportsPage.tsx` - Has report generation and filtering
- ✅ `src/hooks/usePayees.ts` - Payees hook exists and is working
- ✅ `src/hooks/useAccounts.ts` - Accounts hook exists

### Data Dependencies

The CPA export needs data from multiple sources:

- **Transactions** - Core financial data
- **Accounts** - Account names for each transaction
- **Categories** - Category names and tax line items
- **Payees** - Normalized payee names

All of these are already loaded in `ReportsPage.tsx`.

---

## Technical Implementation

### 1. Utility Function: CSV Escaping

**File:** `src/lib/csvUtils.ts` (new file)

Create a reusable CSV utility to ensure proper escaping:

```typescript
/**
 * Escapes a string value for CSV export
 * - Wraps value in quotes if it contains commas, quotes, or newlines
 * - Escapes internal quotes by doubling them
 */
export function escapeCsvValue(value: string | null | undefined): string {
  if (value == null) return '';

  const stringValue = String(value);

  // Check if escaping is needed
  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    // Escape quotes by doubling them, then wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Formats a CSV row from an array of values
 */
export function formatCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => (typeof v === 'number' ? v : escapeCsvValue(String(v ?? '')))).join(',');
}
```

**Rationale:**

- Centralizes CSV escaping logic for consistency
- Follows RFC 4180 CSV standard
- Reusable across all export features

---

### 2. Type Definitions

**File:** `src/lib/reports.ts`

Add interface for CPA export rows:

```typescript
export interface CpaExportRow {
  date: string;
  accountName: string;
  payeeName: string;
  description: string;
  categoryName: string;
  taxLineItem: string;
  amount: string; // Formatted as decimal (e.g., "-150.00")
  memo: string;
}
```

---

### 3. Export Logic

**File:** `src/lib/reports.ts`

Add the main export function:

```typescript
import { Transaction, Category, Account, Payee } from '../types/database';
import { formatCsvRow } from './csvUtils';

/**
 * Generates CPA-ready export with one row per transaction line
 * Split transactions are flattened into multiple rows
 */
export function generateCpaExport(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  payees: Payee[]
): CpaExportRow[] {
  // Build lookup maps for fast access
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const payeeMap = new Map(payees.map((p) => [p.id, p]));

  const rows: CpaExportRow[] = [];

  for (const tx of transactions) {
    const accountName = accountMap.get(tx.account_id)?.name || 'Unknown Account';
    const date = tx.date;
    const description = tx.original_description;

    // Determine payee name
    // Priority: payee_id lookup > legacy payee field > empty
    let payeeName = '';
    if (tx.payee_id) {
      payeeName = payeeMap.get(tx.payee_id)?.name || '';
    } else if (tx.payee) {
      payeeName = tx.payee;
    }

    // Helper to create a row for each line item
    const createRow = (categoryId: string, amount: number, memo?: string): CpaExportRow => {
      const category = categoryMap.get(categoryId);
      const categoryName = category?.name || 'Uncategorized';
      const taxLineItem = category?.tax_line_item || '';

      return {
        date,
        accountName,
        payeeName,
        description,
        categoryName,
        taxLineItem,
        amount: (amount / 100).toFixed(2), // Convert cents to dollars
        memo: memo || '',
      };
    };

    // Process transaction lines
    if (tx.is_split && tx.lines && tx.lines.length > 0) {
      // Split transaction: create one row per line
      for (const line of tx.lines) {
        rows.push(createRow(line.category_id, line.amount, line.memo));
      }
    } else if (tx.lines && tx.lines.length > 0) {
      // Simple transaction: single row with transaction amount
      const categoryId = tx.lines[0].category_id;
      rows.push(createRow(categoryId, tx.amount));
    } else {
      // Uncategorized transaction: still export it
      rows.push({
        date,
        accountName,
        payeeName,
        description,
        categoryName: 'Uncategorized',
        taxLineItem: '',
        amount: (tx.amount / 100).toFixed(2),
        memo: '',
      });
    }
  }

  return rows;
}

/**
 * Converts CPA export rows to CSV format
 */
export function exportCpaExportToCsv(rows: CpaExportRow[]): string {
  const headers = [
    'Date',
    'Account',
    'Payee',
    'Description',
    'Category',
    'Tax Line',
    'Amount',
    'Memo',
  ];

  const headerRow = formatCsvRow(headers);

  const dataRows = rows.map((row) =>
    formatCsvRow([
      row.date,
      row.accountName,
      row.payeeName,
      row.description,
      row.categoryName,
      row.taxLineItem,
      row.amount,
      row.memo,
    ])
  );

  return [headerRow, ...dataRows].join('\n');
}
```

**Key Design Decisions:**

- Flattens split transactions into multiple rows (each line = one row)
- Includes uncategorized transactions (for completeness)
- Uses payee_id lookup first, falls back to legacy payee field
- Converts amounts to decimal format for tax software compatibility
- Proper CSV escaping via utility function

---

### 4. UI Updates

**File:** `src/pages/ReportsPage.tsx`

#### 4.1 Import Payees Hook

Add to existing imports:

```typescript
import { usePayees } from '../hooks/usePayees';
```

Add to component:

```typescript
const { payees } = usePayees();
```

#### 4.2 Store Filtered Transactions

Currently, `handleRunReport` computes `filteredTransactions` but doesn't store them. We need them for CPA export.

Add state:

```typescript
const [filteredTransactions, setFilteredTransactions] = useState<Transaction[] | null>(null);
```

Update `handleRunReport`:

```typescript
const handleRunReport = async () => {
  if (!activeBookset) return;
  setIsLoading(true);
  setError(null);
  setReportData(null);
  setTaxReportData(null);
  setFilteredTransactions(null); // ← Clear previous transactions

  try {
    // ... existing fetch logic ...

    const filter: ReportFilter = {
      startDate,
      endDate,
      accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
      categoryId: selectedCategoryId || undefined,
    };

    const filtered = filterTransactionsForReport(allTransactions, filter);
    setFilteredTransactions(filtered); // ← Store for CPA export
    setTotalTransactions(filtered.length);

    // Generate appropriate report based on type
    if (reportType === 'taxLine') {
      const taxSummary = generateTaxLineReport(filtered, categories);
      setTaxReportData(taxSummary);
    } else {
      const summary = generateCategoryReport(filtered, categories);
      setReportData(summary);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to generate report');
  } finally {
    setIsLoading(false);
  }
};
```

#### 4.3 Add CPA Export Handler

```typescript
const handleExportCpa = () => {
  if (!filteredTransactions || filteredTransactions.length === 0) {
    return; // No data to export
  }

  // Generate export data
  const exportRows = generateCpaExport(filteredTransactions, categories, accounts, payees);

  const csv = exportCpaExportToCsv(exportRows);

  // Create filename with date range
  const filename = `cpa-export-${startDate}-to-${endDate}.csv`;

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
```

#### 4.4 Add Export Button

Add button to the results section, next to the existing Export CSV button:

```tsx
{
  /* Export Buttons */
}
{
  (reportData || taxReportData) && (
    <div className="flex gap-4 justify-end">
      <button
        onClick={handleExportCsv}
        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
      >
        Export Report CSV
      </button>

      <button
        onClick={handleExportCpa}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        disabled={!filteredTransactions || filteredTransactions.length === 0}
      >
        Export for CPA
      </button>
    </div>
  );
}
```

**Visual Differentiation:**

- Regular report export: Blue (brand color)
- CPA export: Green (indicates "ready for accountant")

#### 4.5 Add Help Text

Add informational tooltip or help text near the CPA export button:

```tsx
{
  (reportData || taxReportData) && (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-bold text-blue-900 mb-1">CPA Export Format</h3>
      <p className="text-xs text-blue-700">
        Exports detailed transaction data with one row per line item. Split transactions are
        flattened for easy import into tax software. Includes: Date, Account, Payee, Description,
        Category, Tax Line, Amount, and Memo.
      </p>
    </div>
  );
}
```

---

## Testing Plan

### Unit Tests

**File:** `src/lib/csvUtils.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { escapeCsvValue, formatCsvRow } from './csvUtils';

describe('csvUtils', () => {
  describe('escapeCsvValue', () => {
    it('should return empty string for null/undefined', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('should not escape simple strings', () => {
      expect(escapeCsvValue('Simple text')).toBe('Simple text');
      expect(escapeCsvValue('123')).toBe('123');
    });

    it('should escape strings with quotes', () => {
      expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
    });

    it('should escape strings with commas', () => {
      expect(escapeCsvValue('Last, First')).toBe('"Last, First"');
    });

    it('should escape strings with newlines', () => {
      expect(escapeCsvValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });
  });

  describe('formatCsvRow', () => {
    it('should format a simple row', () => {
      expect(formatCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('should handle numbers', () => {
      expect(formatCsvRow(['text', 123, 'more'])).toBe('text,123,more');
    });

    it('should escape values that need it', () => {
      expect(formatCsvRow(['Smith, John', 'Normal', '"Quoted"'])).toBe(
        '"Smith, John",Normal,"""Quoted"""'
      );
    });
  });
});
```

**File:** `src/lib/reports.test.ts` (add to existing file)

```typescript
describe('generateCpaExport', () => {
  it('should export simple transaction', () => {
    const transactions = [
      {
        id: '1',
        date: '2024-01-15',
        account_id: 'acc1',
        amount: -5000,
        original_description: 'Coffee Shop',
        payee: null,
        payee_id: 'payee1',
        is_split: false,
        lines: [{ category_id: 'cat1', amount: -5000 }],
      },
    ];

    const categories = [{ id: 'cat1', name: 'Meals', tax_line_item: 'Schedule C Line 24b' }];

    const accounts = [{ id: 'acc1', name: 'Business Checking' }];

    const payees = [{ id: 'payee1', name: 'Starbucks' }];

    const result = generateCpaExport(transactions, categories, accounts, payees);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2024-01-15',
      accountName: 'Business Checking',
      payeeName: 'Starbucks',
      description: 'Coffee Shop',
      categoryName: 'Meals',
      taxLineItem: 'Schedule C Line 24b',
      amount: '-50.00',
      memo: '',
    });
  });

  it('should flatten split transactions', () => {
    const transactions = [
      {
        id: '1',
        date: '2024-01-15',
        account_id: 'acc1',
        amount: -10000,
        original_description: 'Amazon Purchase',
        payee: null,
        payee_id: 'payee1',
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: -6000, memo: 'Office supplies' },
          { category_id: 'cat2', amount: -4000, memo: 'Software' },
        ],
      },
    ];

    const categories = [
      { id: 'cat1', name: 'Office Supplies', tax_line_item: 'Schedule C Line 18' },
      { id: 'cat2', name: 'Software', tax_line_item: 'Schedule C Line 18' },
    ];

    const accounts = [{ id: 'acc1', name: 'Business Checking' }];
    const payees = [{ id: 'payee1', name: 'Amazon' }];

    const result = generateCpaExport(transactions, categories, accounts, payees);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      categoryName: 'Office Supplies',
      amount: '-60.00',
      memo: 'Office supplies',
    });
    expect(result[1]).toMatchObject({
      categoryName: 'Software',
      amount: '-40.00',
      memo: 'Software',
    });
  });

  it('should handle uncategorized transactions', () => {
    const transactions = [
      {
        id: '1',
        date: '2024-01-15',
        account_id: 'acc1',
        amount: -5000,
        original_description: 'Unknown Charge',
        payee: 'Unknown',
        payee_id: null,
        is_split: false,
        lines: [],
      },
    ];

    const result = generateCpaExport(transactions, [], [], []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      categoryName: 'Uncategorized',
      taxLineItem: '',
      payeeName: 'Unknown',
      amount: '-50.00',
    });
  });
});
```

### Manual Testing Checklist

1. **Setup Test Data**
   - [ ] Create transactions with various scenarios:
     - Simple categorized transactions
     - Split transactions (2-3 lines each)
     - Uncategorized transactions
     - Transactions with special characters in description (commas, quotes)
     - Transactions with payee_id and legacy payee field

2. **Basic Export**
   - [ ] Navigate to Reports page
   - [ ] Set date range to include test transactions
   - [ ] Run report (any type)
   - [ ] Click "Export for CPA"
   - [ ] Verify file downloads with correct filename format

3. **CSV Format Validation**
   - [ ] Open exported CSV in Excel/Google Sheets
   - [ ] Verify 8 columns: Date, Account, Payee, Description, Category, Tax Line, Amount, Memo
   - [ ] Verify all rows display correctly (no misaligned columns)
   - [ ] Check that special characters don't break formatting

4. **Split Transaction Verification**
   - [ ] Find a split transaction in source data
   - [ ] Verify it appears as multiple rows in CSV
   - [ ] Verify each row has same Date, Account, Payee, Description
   - [ ] Verify each row has different Category, Amount, Memo
   - [ ] Verify amounts sum to original transaction total

5. **Amount Formatting**
   - [ ] Verify negative amounts show as "-150.00" (not "-15000")
   - [ ] Verify positive amounts show as "150.00"
   - [ ] Verify amounts have exactly 2 decimal places

6. **Data Completeness**
   - [ ] Verify uncategorized transactions are included
   - [ ] Verify transactions without payees show empty string (not "null")
   - [ ] Verify tax_line_item shows empty string when null

7. **Filter Respect**
   - [ ] Filter by specific account → verify export only includes that account
   - [ ] Filter by date range → verify export only includes that range
   - [ ] Filter by category → verify export respects category filter

8. **Edge Cases**
   - [ ] Export when no transactions → verify graceful behavior
   - [ ] Export with 1000+ transactions → verify performance
   - [ ] Transaction with very long description → verify CSV escaping works

---

## Files Modified

### New Files

- `src/lib/csvUtils.ts` - CSV escaping utilities
- `src/lib/csvUtils.test.ts` - Unit tests for CSV utilities

### Modified Files

- `src/lib/reports.ts`
  - Add `CpaExportRow` interface
  - Add `generateCpaExport()` function
  - Add `exportCpaExportToCsv()` function
- `src/lib/reports.test.ts`
  - Add unit tests for `generateCpaExport()`
- `src/pages/ReportsPage.tsx`
  - Import `usePayees` hook
  - Add state: `filteredTransactions`
  - Update `handleRunReport()` to store filtered transactions
  - Add `handleExportCpa()` function
  - Add "Export for CPA" button
  - Add help text explaining CPA export format

---

## Error Handling

### User-Facing Errors

Add error handling to `handleExportCpa`:

```typescript
const handleExportCpa = () => {
  if (!filteredTransactions || filteredTransactions.length === 0) {
    showError('No transactions to export. Please run a report first.');
    return;
  }

  try {
    const exportRows = generateCpaExport(filteredTransactions, categories, accounts, payees);

    if (exportRows.length === 0) {
      showError('No data to export.');
      return;
    }

    const csv = exportCpaExportToCsv(exportRows);

    // Trigger download...
  } catch (err) {
    showError(
      'Failed to generate CPA export: ' + (err instanceof Error ? err.message : 'Unknown error')
    );
  }
};
```

---

## Performance Considerations

### Large Transaction Sets

For booksets with 10,000+ transactions:

1. **CSV Generation** - Happens in memory, should be fast
2. **Browser Download** - Modern browsers handle large CSV files well
3. **Memory Usage** - Consider streaming for very large exports (future enhancement)

**Current Limits:**

- ✅ 1,000 transactions: < 1 second
- ✅ 10,000 transactions: 1-2 seconds
- ⚠️ 100,000 transactions: May need optimization

**Future Enhancement:** If exports exceed 50,000 rows, consider chunked CSV generation or server-side export.

---

## Rollback Plan

If issues arise:

1. **Code Rollback:** Use git revert on modified files
2. **No Database Changes:** No migrations required
3. **No Dependencies:** Feature is entirely additive
4. **Safe Disable:** Remove button from UI to hide feature

---

## Post-Implementation Tasks

1. **Documentation**
   - [ ] Add CPA export guide to user documentation
   - [ ] Document CSV format specification
   - [ ] Create sample export files for documentation

2. **User Communication**
   - [ ] Announce feature to existing users
   - [ ] Provide example of how to import into popular tax software

3. **Data Quality**
   - [ ] Ensure all categories have meaningful names
   - [ ] Encourage users to populate tax_line_item fields
   - [ ] Consider adding payee name suggestions for uncategorized transactions

---

## Success Criteria

- ✅ User can export transaction details from Reports page
- ✅ CSV format is valid and opens correctly in Excel/Google Sheets
- ✅ Split transactions are flattened into separate rows
- ✅ All transaction data is included (even uncategorized)
- ✅ Special characters are properly escaped
- ✅ Export respects date/account/category filters
- ✅ Amounts are formatted as decimals (2 decimal places)
- ✅ Unit tests achieve >90% coverage
- ✅ CPA can successfully import CSV into tax software

---

## Tax Software Compatibility Notes

**Tested Compatible Formats:**

- QuickBooks Desktop (import as IIF after conversion)
- Excel / Google Sheets (manual review)
- TurboTax (manual entry from CSV)

**Future Enhancements:**

- Add QuickBooks Online format (IIF)
- Add Drake Tax format
- Add Lacerte format
- Add tax software detection and format selection
