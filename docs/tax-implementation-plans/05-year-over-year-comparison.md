# Implementation Plan: Year-Over-Year Comparison

**Feature:** Year-Over-Year Comparison
**Priority:** Medium
**Effort:** Medium (2-3 days)

## Objective

Compare current year totals to previous year by category to analyze spending trends and variance.

## Technical Implementation

### 1. Backend/Logic (`src/lib/reports.ts`)

Create `generateYearComparisonReport`.

```typescript
// src/lib/reports.ts

export interface ComparisonRow {
  categoryId: string;
  categoryName: string;
  currentAmount: number;
  previousAmount: number;
  varianceAmount: number;
  variancePercent: number;
}

export function generateYearComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  categories: Category[]
): ComparisonRow[] {
  const currentSummary = generateCategoryReport(currentTransactions, categories);
  const previousSummary = generateCategoryReport(previousTransactions, categories);

  const prevMap = new Map(previousSummary.map((s) => [s.categoryId, s]));
  const allCategoryIds = new Set([
    ...currentSummary.map((s) => s.categoryId),
    ...previousSummary.map((s) => s.categoryId),
  ]);

  const results: ComparisonRow[] = [];

  for (const catId of allCategoryIds) {
    const cur = currentSummary.find((s) => s.categoryId === catId);
    const prev = prevMap.get(catId);

    // Get name from whichever exists
    const catName = cur?.categoryName || prev?.categoryName || 'Unknown';

    const curAmt = cur?.totalAmount || 0;
    const prevAmt = prev?.totalAmount || 0;
    const diff = curAmt - prevAmt;

    let pct = 0;
    if (prevAmt !== 0) {
      pct = (diff / Math.abs(prevAmt)) * 100;
    } else if (curAmt !== 0) {
      pct = 100; // New expense this year
    }

    results.push({
      categoryId: catId,
      categoryName: catName,
      currentAmount: curAmt,
      previousAmount: prevAmt,
      varianceAmount: diff,
      variancePercent: pct,
    });
  }

  return results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}
```

### 2. UI Updates (`src/pages/ReportsPage.tsx`)

**Logic Changes:**
We need to fetch TWO datasets.
Current `handleRunReport` only fetches one date range.

Refactor `handleRunReport` to support "Comparison Mode".

```tsx
// State
const [isComparison, setIsComparison] = useState(false);
const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1);

// Logic
const handleRunReport = async () => {
  // 1. Fetch Current Range (existing logic)
  // ... fetch result -> currentData

  // 2. If Comparison Mode:
  if (isComparison) {
    // Calculate Previous Range (e.g., Same dates but year - 1)
    const prevStart = startDate.replace(currentYear, compareYear);
    const prevEnd = endDate.replace(currentYear, compareYear);

    // Fetch Previous Data
    // ... fetch result -> prevData

    const comparison = generateYearComparison(currentData, prevData, categories);
    setComparisonData(comparison);
  }
};
```

**Display:**
Render a table with extra columns.

```tsx
<table className="...">
  <thead>
    <tr>
      <th>Category</th>
      <th>{currentYear}</th>
      <th>{compareYear}</th>
      <th>Variance $</th>
      <th>Variance %</th>
    </tr>
  </thead>
  <tbody>
    {comparisonData.map((row) => (
      <tr key={row.categoryId}>
        <td>{row.categoryName}</td>
        <td>{formatMoney(row.currentAmount)}</td>
        <td>{formatMoney(row.previousAmount)}</td>
        <td className={row.varianceAmount > 0 ? 'text-red' : 'text-green'}>
          {formatMoney(row.varianceAmount)}
        </td>
        <td>{row.variancePercent.toFixed(1)}%</td>
      </tr>
    ))}
  </tbody>
</table>
```

## Verification

1. Toggle "Compare to Previous Year".
2. Run Report.
3. Check that rows show data for both years.
4. Verify variance calculation.

## Files to Modify

- `src/lib/reports.ts`
- `src/pages/ReportsPage.tsx`
