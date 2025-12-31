# Implementation Plan: Tax Form Report

**Feature:** Tax Form Report (Group by Tax Line Item)
**Priority:** Phase 1 - High Impact
**Estimated Effort:** 1-2 days
**Dependencies:** None
**Risk Level:** Low

---

## Objective

Create a report that aggregates transactions by `tax_line_item` (e.g., "Schedule C Line 7: Advertising") instead of just category. This allows users to see their expenses grouped by IRS form lines, making tax preparation significantly easier.

---

## Current State Analysis

### Existing Code

- ✅ `src/lib/reports.ts` - Has `generateCategoryReport()` and `exportReportToCsv()`
- ✅ `src/pages/ReportsPage.tsx` - Has report UI with date/account/category filters
- ✅ `src/types/database.ts` - Category type includes `tax_line_item: string | null`
- ✅ Local `formatMoney()` function in ReportsPage.tsx converts cents to dollars

### Data Model

```typescript
interface Category {
  id: string;
  bookset_id: string;
  name: string;
  tax_line_item: string | null; // ← Used for grouping
  // ... other fields
}
```

---

## Technical Implementation

### 1. Type Definitions

**File:** `src/lib/reports.ts`

Add new interface for tax line summaries:

```typescript
export interface TaxLineSummary {
  taxLineItem: string;
  totalAmount: number; // In cents
  transactionCount: number;
  isIncome: boolean;
  categoryNames: string[]; // List of categories using this tax line
}
```

**Rationale:**

- Separate interface keeps tax reports distinct from category reports
- `categoryNames` helps users understand which categories rolled up into each tax line
- Maintains consistency with `CategorySummary` structure

---

### 2. Backend Logic

**File:** `src/lib/reports.ts`

Add new report generation function:

```typescript
/**
 * Generates a tax report by grouping transactions by tax_line_item
 * Categories without tax_line_item are excluded
 */
export function generateTaxLineReport(
  transactions: Transaction[],
  categories: Category[]
): TaxLineSummary[] {
  // 1. Build lookup maps
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const taxLineMap = new Map<string, string>(); // categoryId -> tax_line_item

  categories.forEach((c) => {
    if (c.tax_line_item) {
      taxLineMap.set(c.id, c.tax_line_item);
    }
  });

  // 2. Aggregate by tax line
  const summaryMap = new Map<
    string,
    {
      amount: number;
      count: number;
      categoryIds: Set<string>;
    }
  >();

  const processLine = (catId: string, amount: number) => {
    const taxLine = taxLineMap.get(catId);
    if (!taxLine) return; // Skip categories without tax_line_item mapping

    const current = summaryMap.get(taxLine) || {
      amount: 0,
      count: 0,
      categoryIds: new Set<string>(),
    };

    summaryMap.set(taxLine, {
      amount: current.amount + amount,
      count: current.count + 1,
      categoryIds: current.categoryIds.add(catId),
    });
  };

  // 3. Process all transactions
  for (const tx of transactions) {
    if (tx.is_split && tx.lines && tx.lines.length > 0) {
      // Split transaction: process each line
      tx.lines.forEach((line) => processLine(line.category_id, line.amount));
    } else if (tx.lines && tx.lines.length > 0) {
      // Simple transaction: process first line
      const catId = tx.lines[0].category_id;
      processLine(catId, tx.amount);
    }
    // Skip transactions with no category assignment (lines array empty)
  }

  // 4. Convert to array and add category names
  return Array.from(summaryMap.entries())
    .map(([taxLine, data]) => ({
      taxLineItem: taxLine,
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0,
      categoryNames: Array.from(data.categoryIds)
        .map((id) => categoryMap.get(id)?.name || 'Unknown')
        .sort(),
    }))
    .sort((a, b) => a.taxLineItem.localeCompare(b.taxLineItem));
}
```

**Add CSV export function:**

```typescript
/**
 * Export tax line report to CSV
 */
export function exportTaxReportToCsv(summary: TaxLineSummary[]): string {
  const header = 'Tax Line Item,Total Amount,Transaction Count,Categories';
  const rows = summary.map((r) => {
    const amount = (r.totalAmount / 100).toFixed(2);
    const categories = r.categoryNames.join('; ');
    return `"${r.taxLineItem}",${amount},${r.transactionCount},"${categories}"`;
  });
  return [header, ...rows].join('\n');
}
```

---

### 3. UI Updates

**File:** `src/pages/ReportsPage.tsx`

#### 3.1 Add State Management

```typescript
// Add after existing state declarations
const [reportType, setReportType] = useState<'category' | 'taxLine'>('category');
const [taxReportData, setTaxReportData] = useState<TaxLineSummary[] | null>(null);
```

#### 3.2 Add Report Type Toggle

Insert after the filter section, before the "Run Report" button:

```tsx
{
  /* Report Type Selection */
}
<div className="grid grid-cols-1 gap-6 bg-white p-6 rounded-xl border border-neutral-200">
  <div>
    <label className="block text-sm font-bold text-neutral-700 mb-2">Group By</label>
    <div className="flex gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="reportType"
          value="category"
          checked={reportType === 'category'}
          onChange={() => setReportType('category')}
          className="w-4 h-4 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-neutral-700">Category</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="reportType"
          value="taxLine"
          checked={reportType === 'taxLine'}
          onChange={() => setReportType('taxLine')}
          className="w-4 h-4 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-neutral-700">Tax Line Item</span>
      </label>
    </div>
    {reportType === 'taxLine' && (
      <p className="text-xs text-neutral-500 mt-2">
        Only categories with tax line mappings will be included
      </p>
    )}
  </div>
</div>;
```

#### 3.3 Update Report Generation Logic

Modify the `handleRunReport` function:

```typescript
const handleRunReport = async () => {
  if (!activeBookset) return;
  setIsLoading(true);
  setError(null);
  setReportData(null);
  setTaxReportData(null); // ← Clear tax data too

  try {
    // ... existing fetch logic ...

    const filter: ReportFilter = {
      startDate,
      endDate,
      accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
      categoryId: selectedCategoryId || undefined,
    };

    const filteredTransactions = filterTransactionsForReport(allTransactions, filter);
    setTotalTransactions(filteredTransactions.length);

    // Generate appropriate report based on type
    if (reportType === 'taxLine') {
      const taxSummary = generateTaxLineReport(filteredTransactions, categories);
      setTaxReportData(taxSummary);
    } else {
      const summary = generateCategoryReport(filteredTransactions, categories);
      setReportData(summary);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to generate report');
  } finally {
    setIsLoading(false);
  }
};
```

#### 3.4 Update Export Logic

Modify the `handleExportCsv` function:

```typescript
const handleExportCsv = () => {
  let csv: string;
  let filename: string;

  if (reportType === 'taxLine') {
    if (!taxReportData) return;
    csv = exportTaxReportToCsv(taxReportData);
    filename = `tax-report-${startDate}-to-${endDate}.csv`;
  } else {
    if (!reportData) return;
    csv = exportReportToCsv(reportData);
    filename = `category-report-${startDate}-to-${endDate}.csv`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
```

#### 3.5 Update Table Rendering

Replace the results table section with conditional rendering:

```tsx
{
  /* Results Table */
}
{
  reportType === 'category' && reportData && (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Existing category table */}
      <table className="w-full">{/* ... existing category table code ... */}</table>
    </div>
  );
}

{
  reportType === 'taxLine' && taxReportData && (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-neutral-50 border-b border-neutral-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Tax Line Item
            </th>
            <th className="px-6 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Categories
            </th>
            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Transactions
            </th>
            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Total Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {taxReportData.map((row, idx) => (
            <tr key={row.taxLineItem} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
              <td className="px-6 py-4 text-sm font-medium text-neutral-900">{row.taxLineItem}</td>
              <td className="px-6 py-4 text-sm text-neutral-600">{row.categoryNames.join(', ')}</td>
              <td className="px-6 py-4 text-sm text-neutral-900 text-right">
                {row.transactionCount}
              </td>
              <td
                className={`px-6 py-4 text-sm text-right font-mono ${
                  row.isIncome ? 'text-green-600' : 'text-neutral-900'
                }`}
              >
                ${formatMoney(row.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-neutral-100 border-t-2 border-neutral-300">
          <tr>
            <td className="px-6 py-4 text-sm font-bold text-neutral-900" colSpan={2}>
              Total
            </td>
            <td className="px-6 py-4 text-sm font-bold text-neutral-900 text-right">
              {taxReportData.reduce((sum, r) => sum + r.transactionCount, 0)}
            </td>
            <td className="px-6 py-4 text-sm font-bold text-neutral-900 text-right font-mono">
              ${formatMoney(taxReportData.reduce((sum, r) => sum + r.totalAmount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

---

## Testing Plan

### Unit Tests

**File:** `src/lib/reports.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateTaxLineReport } from './reports';

describe('generateTaxLineReport', () => {
  it('should group transactions by tax_line_item', () => {
    const categories = [
      { id: 'cat1', name: 'Advertising', tax_line_item: 'Schedule C Line 8' },
      { id: 'cat2', name: 'Office Supplies', tax_line_item: 'Schedule C Line 18' },
      { id: 'cat3', name: 'Uncategorized', tax_line_item: null },
    ];

    const transactions = [
      {
        id: '1',
        amount: -5000,
        is_split: false,
        lines: [{ category_id: 'cat1', amount: -5000 }],
      },
      {
        id: '2',
        amount: -3000,
        is_split: false,
        lines: [{ category_id: 'cat1', amount: -3000 }],
      },
      {
        id: '3',
        amount: -2000,
        is_split: false,
        lines: [{ category_id: 'cat2', amount: -2000 }],
      },
      {
        id: '4',
        amount: -1000,
        is_split: false,
        lines: [{ category_id: 'cat3', amount: -1000 }],
      },
    ];

    const result = generateTaxLineReport(transactions, categories);

    expect(result).toHaveLength(2); // Only cat1 and cat2 have tax lines
    expect(result[0]).toMatchObject({
      taxLineItem: 'Schedule C Line 18',
      totalAmount: -2000,
      transactionCount: 1,
    });
    expect(result[1]).toMatchObject({
      taxLineItem: 'Schedule C Line 8',
      totalAmount: -8000,
      transactionCount: 2,
    });
  });

  it('should handle split transactions', () => {
    const categories = [
      { id: 'cat1', name: 'Advertising', tax_line_item: 'Schedule C Line 8' },
      { id: 'cat2', name: 'Meals', tax_line_item: 'Schedule C Line 24b' },
    ];

    const transactions = [
      {
        id: '1',
        amount: -10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: -6000 },
          { category_id: 'cat2', amount: -4000 },
        ],
      },
    ];

    const result = generateTaxLineReport(transactions, categories);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.taxLineItem === 'Schedule C Line 8')).toMatchObject({
      totalAmount: -6000,
      transactionCount: 1,
    });
    expect(result.find((r) => r.taxLineItem === 'Schedule C Line 24b')).toMatchObject({
      totalAmount: -4000,
      transactionCount: 1,
    });
  });
});
```

### Manual Testing Checklist

1. **Setup Test Data**
   - [ ] Create 3-5 categories with `tax_line_item` values
   - [ ] Create 2-3 categories with `null` tax_line_item
   - [ ] Import or create 20+ transactions using these categories
   - [ ] Include at least 2 split transactions

2. **Basic Functionality**
   - [ ] Navigate to Reports page
   - [ ] Select "Tax Line Item" radio button
   - [ ] Click "Run Report"
   - [ ] Verify only categories with tax_line_item appear in results
   - [ ] Verify amounts are correct and formatted properly
   - [ ] Verify transaction counts are accurate

3. **Category Grouping**
   - [ ] Verify multiple categories with same tax_line_item are grouped together
   - [ ] Verify "Categories" column shows all category names

4. **Split Transaction Handling**
   - [ ] Verify split transactions are counted correctly
   - [ ] Verify amounts from split lines are aggregated properly

5. **Export**
   - [ ] Click "Export CSV"
   - [ ] Open CSV file
   - [ ] Verify headers are correct
   - [ ] Verify all rows exported
   - [ ] Verify amounts formatted as decimals (e.g., "150.00" not "15000")
   - [ ] Verify filename includes date range

6. **Toggle Between Report Types**
   - [ ] Run Category report
   - [ ] Switch to Tax Line report
   - [ ] Verify data updates correctly
   - [ ] Switch back to Category report
   - [ ] Verify original data displayed

7. **Edge Cases**
   - [ ] Run report with no transactions → verify graceful empty state
   - [ ] Run report when NO categories have tax_line_item → verify empty message
   - [ ] Filter by single account → verify tax report respects filter
   - [ ] Change date range → verify tax report updates

---

## Files Modified

### New Files

- `src/lib/reports.test.ts` (new unit tests)

### Modified Files

- `src/lib/reports.ts`
  - Add `TaxLineSummary` interface
  - Add `generateTaxLineReport()` function
  - Add `exportTaxReportToCsv()` function
- `src/pages/ReportsPage.tsx`
  - Add state: `reportType`, `taxReportData`
  - Add UI: radio buttons for report type selection
  - Update `handleRunReport()` to generate tax report
  - Update `handleExportCsv()` to export tax report
  - Add conditional table rendering for tax report

---

## Rollback Plan

If issues arise:

1. **Code Rollback:** All changes are in existing files, use git revert
2. **No Database Changes:** No migrations required, safe to rollback
3. **No Breaking Changes:** Existing category report functionality unchanged

---

## Post-Implementation Tasks

1. **Documentation**
   - [ ] Update user guide with tax report instructions
   - [ ] Add screenshots of tax report UI
   - [ ] Document recommended tax_line_item naming conventions

2. **Data Quality**
   - [ ] Review existing categories and add tax_line_item mappings
   - [ ] Create standard tax line reference document (Schedule C lines, etc.)

3. **Future Enhancements**
   - Consider adding tax form breakdown (Schedule C vs Schedule A, etc.)
   - Add year-end tax summary with totals by form
   - Add validation to prevent duplicate tax_line_item assignments

---

## Success Criteria

- ✅ User can toggle between Category and Tax Line reports
- ✅ Tax line report excludes categories without tax_line_item
- ✅ Multiple categories with same tax_line_item are grouped correctly
- ✅ Split transactions are handled properly
- ✅ Export generates correct CSV with proper formatting
- ✅ All existing category report functionality remains unchanged
- ✅ Unit tests achieve >90% coverage of new functions
