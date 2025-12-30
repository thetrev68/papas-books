# Implementation Plan: CPA Export

**Feature:** CPA Export (Transaction Detail Export)
**Priority:** High
**Effort:** Medium (2-3 days)

## Objective

Export all transactions with full detail for the CPA to import into their tax software. This flattens split transactions so every line item is a row.

## Technical Implementation

### 1. Export Logic (`src/lib/reports.ts`)

Create a new function `exportTransactionsToCsv` (or `generateCpaExport`).

**Fields Required:**

- Date
- Payee Name (from relation)
- Original Description
- Amount (Decimal)
- Category Name
- Tax Line Item
- Account Name
- Memo/Notes (from split line or transaction)

**Implementation:**

```typescript
// src/lib/reports.ts

import { Transaction, Category, Payee, Account } from '../types/database';

export function generateCpaExportCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  payees: Payee[]
): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const payeeMap = new Map(payees.map((p) => [p.id, p]));

  const headers = [
    'Date',
    'Account',
    'Payee',
    'Description',
    'Category',
    'Tax Line',
    'Amount',
    'Memo',
  ].join(',');

  const rows: string[] = [];

  for (const tx of transactions) {
    const accountName = accountMap.get(tx.account_id)?.name || 'Unknown Account';
    const payeeName = tx.payee_id ? payeeMap.get(tx.payee_id)?.name : tx.payee || '';
    const date = tx.date;
    const desc = tx.original_description.replace(/"/g, '""'); // Escape quotes

    // Helper to format line
    const addRow = (catId: string, amount: number, memo?: string) => {
      const cat = categoryMap.get(catId);
      const catName = cat ? cat.name : 'Uncategorized';
      const taxLine = cat?.tax_line_item || '';
      const amountDecimal = (amount / 100).toFixed(2);

      rows.push(
        `"${date}","${accountName}","${payeeName}","${desc}","${catName}","${taxLine}",${amountDecimal},"${memo || ''}"`
      );
    };

    if (tx.is_split && tx.lines) {
      tx.lines.forEach((line) => {
        addRow(line.category_id, line.amount, line.memo);
      });
    } else {
      const catId = tx.lines?.[0]?.category_id || '';
      addRow(catId, tx.amount);
    }
  }

  return [headers, ...rows].join('\n');
}
```

### 2. UI Updates (`src/pages/ReportsPage.tsx`)

**Add "Export for CPA" Button:**
Place this button near the existing export buttons.

```tsx
// src/pages/ReportsPage.tsx

// Need to fetch payees if not already available in context hooks
// const { payees } = usePayees(); // Ensure this hook is used

const handleExportCpa = () => {
  // We need the raw transactions list used for the report
  // Make sure 'filteredTransactions' (from logic in handleRunReport) is accessible or re-derived.
  // Ideally, store the filtered list in state `filteredTransactions` alongside `reportData`.

  if (!filteredTransactions) return;

  const csv = generateCpaExportCsv(filteredTransactions, categories, accounts, payees);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cpa-export-${startDate}-to-${endDate}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Render
<button onClick={handleExportCpa} className="px-4 py-2 bg-brand-600 text-white ...">
  Export for CPA
</button>;
```

**Data Availability:**
Ensure `filteredTransactions` is stored in state. Currently `ReportsPage.tsx` calculates it inside `handleRunReport` but only stores `reportData` (summary).
Refactor `ReportsPage.tsx`:

```typescript
const [rawTransactions, setRawTransactions] = useState<Transaction[] | null>(null);

// Inside handleRunReport:
const filteredTransactions = filterTransactionsForReport(allTransactions, filter);
setRawTransactions(filteredTransactions); // Store this
```

## Verification

1. Select a date range with split transactions.
2. Click "Export for CPA".
3. Open CSV.
4. Verify split transactions appear as multiple rows.
5. Verify columns align correctly.
6. Verify `tax_line_item` is populated.

## Files to Modify

- `src/lib/reports.ts`
- `src/pages/ReportsPage.tsx`
