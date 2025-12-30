# Implementation Plan: Tax Form Report

**Feature:** Tax Form Report (Group by Tax Line Item)
**Priority:** High
**Effort:** Low (1-2 days)

## Objective

Create a report that aggregates transactions by `tax_line_item` (e.g., "Schedule C: Advertising") instead of just category. This allows users to see their expenses grouped by IRS form lines.

## Technical Implementation

### 1. Backend/Logic (`src/lib/reports.ts`)

Modify or extend the reporting logic to support grouping by `tax_line_item`.

**New Interface:**
Define a new summary interface if `CategorySummary` is insufficient, but `CategorySummary` might work if we map `categoryId` to the Tax Line Item name or ID. However, it's better to be explicit.

```typescript
// Add to src/lib/reports.ts
export interface TaxLineSummary {
  taxLineItem: string;
  totalAmount: number;
  transactionCount: number;
  isIncome: boolean; // Derived from totalAmount > 0
}
```

**New Function:**
Create `generateTaxLineReport` in `src/lib/reports.ts`.

```typescript
// src/lib/reports.ts

export function generateTaxLineReport(
  transactions: Transaction[],
  categories: Category[]
): TaxLineSummary[] {
  // 1. Create a map of categoryId -> tax_line_item
  const taxLineMap = new Map<string, string>();
  categories.forEach((c) => {
    if (c.tax_line_item) {
      taxLineMap.set(c.id, c.tax_line_item);
    }
  });

  const summaryMap = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    // Helper to process a line (from split or root)
    const processLine = (catId: string, amount: number) => {
      const taxLine = taxLineMap.get(catId);
      if (!taxLine) return; // Skip if no tax line mapping

      const current = summaryMap.get(taxLine) || { amount: 0, count: 0 };
      summaryMap.set(taxLine, {
        amount: current.amount + amount,
        count: current.count + 1,
      });
    };

    if (tx.is_split && tx.lines) {
      tx.lines.forEach((line) => processLine(line.category_id, line.amount));
    } else {
      const catId = tx.lines?.[0]?.category_id;
      if (catId) processLine(catId, tx.amount);
    }
  }

  // Convert map to array
  return Array.from(summaryMap.entries())
    .map(([taxLine, data]) => ({
      taxLineItem: taxLine,
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0,
    }))
    .sort((a, b) => a.taxLineItem.localeCompare(b.taxLineItem));
}
```

### 2. UI Updates (`src/pages/ReportsPage.tsx`)

**State Management:**
Add state to toggle between "Category" and "Tax Line" views.

```typescript
// src/pages/ReportsPage.tsx inside component
const [reportType, setReportType] = useState<'category' | 'taxLine'>('category');
const [taxReportData, setTaxReportData] = useState<TaxLineSummary[] | null>(null);
```

**UI Controls:**
Add a toggle button or dropdown next to the "Run Report" button or in the filters section.

```tsx
// Inside the filters grid or above the Run Report button
<div className="flex gap-4 items-center">
  <span className="font-bold text-neutral-600">Group By:</span>
  <label className="flex items-center gap-2">
    <input
      type="radio"
      checked={reportType === 'category'}
      onChange={() => setReportType('category')}
    />{' '}
    Category
  </label>
  <label className="flex items-center gap-2">
    <input
      type="radio"
      checked={reportType === 'taxLine'}
      onChange={() => setReportType('taxLine')}
    />{' '}
    Tax Line Item
  </label>
</div>
```

**Run Report Logic:**
Update `handleRunReport` to generate the correct report based on `reportType`.

```typescript
// Inside handleRunReport
const summary = generateCategoryReport(filteredTransactions, categories);
setReportData(summary);

if (reportType === 'taxLine') {
  const taxSummary = generateTaxLineReport(filteredTransactions, categories);
  setTaxReportData(taxSummary); // You might want to use a unified state variable 'reportData' with a union type if possible, or separate them.
} else {
  setReportData(summary);
  setTaxReportData(null);
}
```

**Render Logic:**
Conditionally render the table headers and rows based on `reportType`.

```tsx
{reportType === 'category' ? (
  // Existing Category Table
) : (
  <table className="...">
    <thead>
      <tr>
        <th>Tax Line Item</th>
        <th>Tx Count</th>
        <th>Total Amount</th>
      </tr>
    </thead>
    <tbody>
       {taxReportData?.map(row => (
         <tr key={row.taxLineItem}>
           <td>{row.taxLineItem}</td>
           <td>{row.transactionCount}</td>
           <td>{formatMoney(row.totalAmount)}</td>
         </tr>
       ))}
    </tbody>
  </table>
)}
```

### 3. Export Logic (`src/lib/reports.ts`)

Add support for exporting the Tax Line report to CSV.

```typescript
export function exportTaxReportToCsv(summary: TaxLineSummary[]): string {
  const header = 'Tax Line Item,Total Amount,Transaction Count';
  const rows = summary.map(
    (r) => `"${r.taxLineItem}",${(r.totalAmount / 100).toFixed(2)},${r.transactionCount}`
  );
  return [header, ...rows].join('\n');
}
```

Update `handleExportCsv` in `ReportsPage.tsx` to call the correct function.

## Verification

1. Assign `tax_line_item` to a few categories in the database or UI (if editable).
2. Create transactions using those categories.
3. Run the report with "Tax Line Item" selected.
4. Verify sums match the sum of transactions in those categories.
5. Verify unassigned categories are excluded (or grouped under "Unassigned" if desired, though requirements say "Filter out categories where tax_line_item is null").

## Files to Modify

- `src/lib/reports.ts`
- `src/pages/ReportsPage.tsx`
