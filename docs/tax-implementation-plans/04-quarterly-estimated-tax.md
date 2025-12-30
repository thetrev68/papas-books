# Implementation Plan: Quarterly Estimated Tax Summary

**Feature:** Quarterly Estimated Tax Summary
**Priority:** Medium
**Effort:** Low-Medium (2-3 days)

## Objective

Provide a breakdown of income and expenses by quarter (Q1, Q2, Q3, Q4) to assist users in calculating estimated tax payments.

## Technical Implementation

### 1. Backend/Logic (`src/lib/reports.ts`)

Create `generateQuarterlyReport`.

```typescript
// src/lib/reports.ts

export interface QuarterlySummary {
  quarter: number; // 1, 2, 3, 4
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  estimatedTax: number; // calculated based on a rate (e.g. 30%)
}

export function generateQuarterlyReport(
  transactions: Transaction[],
  year: number,
  taxRate: number = 0.3
): QuarterlySummary[] {
  const quarters = {
    1: { income: 0, expenses: 0 },
    2: { income: 0, expenses: 0 },
    3: { income: 0, expenses: 0 },
    4: { income: 0, expenses: 0 },
  };

  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== year) continue;

    const month = d.getMonth(); // 0-11
    const q = Math.floor(month / 3) + 1;

    // Determine if income or expense based on amount sign
    // Positive = Income, Negative = Expense (in this system usually?)
    // VERIFY: In Transaction type, amount is integer cents.
    // Usually + is Deposit (Income), - is Withdrawal (Expense).

    if (tx.amount > 0) {
      quarters[q].income += tx.amount;
    } else {
      quarters[q].expenses += Math.abs(tx.amount);
    }
  }

  return [1, 2, 3, 4].map((q) => ({
    quarter: q,
    year,
    totalIncome: quarters[q].income,
    totalExpenses: quarters[q].expenses,
    netIncome: quarters[q].income - quarters[q].expenses,
    estimatedTax: (quarters[q].income - quarters[q].expenses) * taxRate,
  }));
}
```

### 2. UI Updates (`src/pages/ReportsPage.tsx`)

**New Report Type Selector:**
Add logic to select "Quarterly Summary" as a report type.

```tsx
// State
const [reportView, setReportView] = useState<'category' | 'quarterly'>('category');
const [quarterlyData, setQuarterlyData] = useState<QuarterlySummary[]>([]);
const [estimatedTaxRate, setEstimatedTaxRate] = useState(0.3); // 30% default

// In handleRunReport
if (reportView === 'quarterly') {
  // Ensure we fetch the whole year selected by startDate/endDate or just force fetch for the Year of startDate
  const year = new Date(startDate).getFullYear();
  const summary = generateQuarterlyReport(allTransactions, year, estimatedTaxRate);
  setQuarterlyData(summary);
}
```

**Display:**
Render a card grid or table for the 4 quarters.

```tsx
{
  reportView === 'quarterly' && (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {quarterlyData.map((q) => (
        <div key={q.quarter} className="p-4 bg-white rounded shadow border">
          <h3 className="font-bold text-lg mb-2">
            Q{q.quarter} {q.year}
          </h3>
          <div className="flex justify-between">
            <span>Income:</span>
            <span className="text-success-700">{formatMoney(q.totalIncome)}</span>
          </div>
          <div className="flex justify-between">
            <span>Expenses:</span>
            <span className="text-danger-700">{formatMoney(q.totalExpenses)}</span>
          </div>
          <div className="border-t my-2 pt-2 font-bold flex justify-between">
            <span>Net:</span>
            <span>{formatMoney(q.netIncome)}</span>
          </div>
          <div className="bg-neutral-100 p-2 rounded mt-2 text-center">
            <div className="text-xs text-neutral-500 uppercase">
              Est. Tax ({estimatedTaxRate * 100}%)
            </div>
            <div className="font-bold text-brand-700">
              {formatMoney(q.estimatedTax > 0 ? q.estimatedTax : 0)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Verification

1. Set date range to cover a full year (e.g., 2024-01-01 to 2024-12-31).
2. Run "Quarterly Summary".
3. Check math manually for one quarter.
4. Change tax rate and verify recalculation.

## Files to Modify

- `src/lib/reports.ts`
- `src/pages/ReportsPage.tsx`
