# Phase 6: Reconciliation & Reporting

**Status:** Complete
**Dependencies:** Phase 5 (Workbench)
**Estimated Complexity:** Medium-High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-5-Workbench.md](Phase-5-Workbench.md)

---

## Overview

Phase 6 delivers two critical bookkeeping outcomes: reconciliation (data accuracy) and reporting (tax-ready summaries). The reconciliation flow must be precise, repeatable, and capable of locking historical transactions. Reporting must decompose split transactions correctly and export results in formats users can share.

**Key Principles:**

- **Cent-Perfect Accuracy:** All calculations are integer cents and must be exact.
- **Wizard-Based Workflow:** Reconciliation is a step-by-step flow with clear states.
- **Immutable History:** Finalizing a reconciliation locks associated transactions.
- **Split-Aware Aggregation:** Reports allocate split lines to their categories.
- **Exportable Outputs:** Reports must be downloadable (CSV + PDF).
- **Pure Functional Logic:** Core calculations are in isolated, testable functions.

---

## UI Implementation Constraint: "Function Over Form"

**CRITICAL REQUIREMENT:** The UI for Phase 6 must be superbasic and unstyled.

- Use native HTML elements only (`<table>`, `<button>`, `<input>`, `<ul>`).
- **No Tailwind**, no custom CSS, no component libraries (except logic helpers).
- The goal is validating reconciliation and reporting logic; visuals come in Phase 7.

---

## Conceptual Model

### Reconciliation Lifecycle

```text
1. User selects account + statement date + statement balance
   ↓
2. System loads unreconciled transactions up to statement date
   ↓
3. User checks/unchecks transactions to match statement balance
   ↓
4. System calculates deposits/withdrawals and difference
   ↓
5. If balanced, user finalizes reconciliation
   ↓
6. System locks transactions and records reconciliation snapshot
```

### Reporting Pipeline

```text
1. User selects filters (date, accounts, category)
   ↓
2. System fetches transactions in range
   ↓
3. Split transactions are decomposed into lines
   ↓
4. Totals are aggregated by category (and optional groupings)
   ↓
5. Results displayed and exported (CSV/PDF)
```

---

## Database Schema Updates

### 1. `reconciliations` Table

(Defined in Phase 1, restated here for clarity)

```sql
CREATE TABLE IF NOT EXISTS reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booksetId" uuid NOT NULL REFERENCES booksets(id),
  "accountId" uuid NOT NULL REFERENCES accounts(id),

  -- Statement Details
  "statementDate" timestamp with time zone NOT NULL,
  "statementBalance" bigint NOT NULL, -- In cents

  -- System Calculations
  "openingBalance" bigint NOT NULL, -- In cents
  "calculatedBalance" bigint NOT NULL, -- In cents
  difference bigint NOT NULL, -- In cents

  -- State
  status text CHECK (status IN ('in_progress', 'balanced', 'unbalanced')) NOT NULL,
  "finalizedAt" timestamp with time zone,

  -- The Lock
  "transactionCount" integer NOT NULL,
  "transactionIds" uuid[] NOT NULL, -- Array of locked transaction IDs

  -- Metadata
  "createdAt" timestamp with time zone DEFAULT now(),
  "createdBy" uuid REFERENCES users(id)
);
```

### 2. RPC: `finalize_reconciliation`

**File:** `supabase/schema.sql`

This function performs the atomic locking of a reconciliation period.

```sql
CREATE OR REPLACE FUNCTION finalize_reconciliation(
  _bookset_id uuid,
  _account_id uuid,
  _statement_balance bigint,
  _statement_date timestamp with time zone,
  _opening_balance bigint,
  _calculated_balance bigint,
  _transaction_ids uuid[]
) RETURNS void AS $$
DECLARE
  _difference bigint;
BEGIN
  -- Calculate difference (trust but verify)
  _difference := _statement_balance - _calculated_balance;

  -- 1. Create Reconciliation Record
  INSERT INTO reconciliations (
    "booksetId", "accountId",
    "statementBalance", "statementDate",
    "openingBalance", "calculatedBalance",
    difference, status, "finalizedAt",
    "transactionCount", "transactionIds"
  ) VALUES (
    _bookset_id, _account_id,
    _statement_balance, _statement_date,
    _opening_balance, _calculated_balance,
    _difference, 'balanced', now(),
    array_length(_transaction_ids, 1), _transaction_ids
  );

  -- 2. Mark Transactions as Reconciled
  UPDATE transactions
  SET reconciled = true, "reconciledDate" = now()
  WHERE id = ANY(_transaction_ids)
  AND "booksetId" = _bookset_id;

  -- 3. Update Account Last Reconciled State
  UPDATE accounts
  SET "lastReconciledBalance" = _statement_balance,
      "lastReconciledDate" = _statement_date
  WHERE id = _account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Notes:**

- Use bigint cents throughout to avoid floating-point errors.
- Transactions with `reconciled = true` must be read-only in the UI.

---

## Types & Interfaces

### File: `src/types/reconcile.ts`

```typescript
export interface Reconciliation {
  id: string;
  booksetId: string;
  accountId: string;
  statementDate: string; // ISO date
  statementBalance: number; // cents
  openingBalance: number; // cents
  calculatedBalance: number; // cents
  difference: number; // cents
  status: 'in_progress' | 'balanced' | 'unbalanced';
  finalizedAt?: string;
  transactionCount: number;
  transactionIds: string[];
}

export interface ReconciliationInput {
  accountId: string;
  statementDate: string; // YYYY-MM-DD
  statementBalance: number; // cents
}

export interface ReconciliationResult {
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  calculatedEndingBalance: number;
  difference: number;
  isBalanced: boolean;
}

export interface ReportFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  accountIds?: string[];
  categoryId?: string;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalAmount: number; // cents
  transactionCount: number;
  isIncome: boolean;
}

export interface ReportExportRow {
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
}
```

---

## Domain Logic: Pure Functions

### Module: Reconciliation Engine

**File:** `src/lib/reconciler.ts`

**Dependencies:** None

**Function: `calculateReconciliation(previousBalance, transactions, targetBalance)`**

```typescript
import { Transaction } from '../types/database';
import { ReconciliationResult } from '../types/reconcile';

export function calculateReconciliation(
  previousBalance: number,
  transactions: Transaction[],
  targetBalance: number
): ReconciliationResult {
  let deposits = 0;
  let withdrawals = 0;

  for (const tx of transactions) {
    if (tx.amount >= 0) {
      deposits += tx.amount;
    } else {
      withdrawals += tx.amount;
    }
  }

  const calculatedEndingBalance = previousBalance + deposits + withdrawals;
  const difference = targetBalance - calculatedEndingBalance;

  return {
    openingBalance: previousBalance,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    calculatedEndingBalance,
    difference,
    isBalanced: difference === 0,
  };
}
```

**Function: `sumTransactionAmountForReconcile(tx)`**

- If transaction is split, sum split lines.
- Otherwise, use `tx.amount`.

```typescript
import { Transaction } from '../types/database';

export function sumTransactionAmountForReconcile(tx: Transaction): number {
  if (tx.isSplit && tx.lines?.length) {
    return tx.lines.reduce((sum, line) => sum + line.amount, 0);
  }
  return tx.amount;
}
```

### Module: Reporting Engine

**File:** `src/lib/reports.ts`

**Function: `generateCategoryReport(transactions, categories)`**

- Decompose split transactions into lines.
- Aggregate totals by `categoryId`.

```typescript
import { Transaction, Category } from '../types/database';
import { CategorySummary } from '../types/reconcile';

export function generateCategoryReport(
  transactions: Transaction[],
  categories: Category[]
): CategorySummary[] {
  const summaryMap = new Map<string, { amount: number; count: number }>();
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  for (const tx of transactions) {
    if (tx.isSplit && tx.lines) {
      for (const line of tx.lines) {
        const current = summaryMap.get(line.categoryId) || { amount: 0, count: 0 };
        summaryMap.set(line.categoryId, {
          amount: current.amount + line.amount,
          count: current.count + 1,
        });
      }
    } else {
      const catId = tx.lines?.[0]?.categoryId || 'uncategorized';
      const current = summaryMap.get(catId) || { amount: 0, count: 0 };
      summaryMap.set(catId, {
        amount: current.amount + tx.amount,
        count: current.count + 1,
      });
    }
  }

  const results: CategorySummary[] = [];
  for (const [categoryId, data] of summaryMap.entries()) {
    const category = categoryLookup.get(categoryId);
    results.push({
      categoryId,
      categoryName: category ? category.name : 'Unknown Category',
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0,
    });
  }

  return results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}
```

**Function: `filterTransactionsForReport(transactions, filter)`**

- Date range is inclusive.
- Optional account and category filters.

```typescript
import { Transaction } from '../types/database';
import { ReportFilter } from '../types/reconcile';

export function filterTransactionsForReport(
  transactions: Transaction[],
  filter: ReportFilter
): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.date < filter.startDate || tx.date > filter.endDate) return false;
    if (filter.accountIds?.length && !filter.accountIds.includes(tx.accountId)) return false;
    if (filter.categoryId) {
      const lineCategoryId = tx.lines?.[0]?.categoryId;
      if (!lineCategoryId || lineCategoryId !== filter.categoryId) return false;
    }
    return true;
  });
}
```

**Function: `exportReportToCsv(summary)`**

```typescript
import { CategorySummary, ReportExportRow } from '../types/reconcile';

export function exportReportToCsv(summary: CategorySummary[]): string {
  const rows: ReportExportRow[] = summary.map((row) => ({
    categoryName: row.categoryName,
    totalAmount: row.totalAmount,
    transactionCount: row.transactionCount,
  }));

  const header = 'Category,TotalAmount,TransactionCount';
  const lines = rows.map((r) => `${r.categoryName},${r.totalAmount},${r.transactionCount}`);
  return [header, ...lines].join('\n');
}
```

---

## Data Access Layer

### File: `src/lib/supabase/reconcile.ts`

```typescript
import { supabase } from './config';

export async function finalizeReconciliationRPC(
  booksetId: string,
  accountId: string,
  statementBalance: number,
  statementDate: string,
  openingBalance: number,
  calculatedBalance: number,
  transactionIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('finalize_reconciliation', {
    _bookset_id: booksetId,
    _account_id: accountId,
    _statement_balance: statementBalance,
    _statement_date: statementDate,
    _opening_balance: openingBalance,
    _calculated_balance: calculatedBalance,
    _transaction_ids: transactionIds,
  });

  if (error) throw error;
}
```

### File: `src/lib/supabase/reports.ts`

```typescript
import { supabase } from './config';

export async function fetchTransactionsForReport(
  booksetId: string,
  startDate: string,
  endDate: string
) {
  return supabase
    .from('transactions')
    .select('*')
    .eq('booksetId', booksetId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('isArchived', false);
}
```

---

## UI Components & Flow

### Page: `src/pages/ReconcilePage.tsx`

**State:**

- `step`: number (1, 2, 3)
- `input`: `ReconciliationInput`

**Flow:**

- Step 1: Account + statement inputs
- Step 2: Transaction selection and summary
- Step 3: Success + reset

### Component: `ReconcileSetup`

**Props:**

- `accounts`: Account[]
- `onNext(input: ReconciliationInput)`

**Fields:**

- Account dropdown
- Statement date
- Statement balance

### Component: `ReconcileWorkspace`

**Props:**

- `accountId`, `statementDate`, `statementBalance`

**Internal Logic:**

1. Fetch `account` for `openingBalance` (lastReconciledBalance).
2. Fetch `transactions` where:
   - `accountId` matches
   - `date <= statementDate`
   - `reconciled == false`
3. Use `useMemo` to compute `calculateReconciliation(...)` on selection change.
4. Highlight unchecked or unreconciled items when `difference != 0`.

### Page: `src/pages/ReportsPage.tsx`

**State Management:**

- `startDate`: string
- `endDate`: string
- `accountIds`: string[]
- `categoryId`: string | null

**Render (Unstyled HTML Controls):**

```tsx
<div>
  <h1>Reports</h1>
  <div>
    <label>
      Start Date
      <input type="date" value={startDate} onChange={...} />
    </label>
    <label>
      End Date
      <input type="date" value={endDate} onChange={...} />
    </label>
    <label>
      Account
      <select multiple value={accountIds} onChange={...}>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
    <label>
      Category
      <select value={categoryId ?? ''} onChange={...}>
        <option value="">All</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </label>
    <button onClick={handleRunReport}>Run Report</button>
  </div>

  <div>
    <button onClick={handleExportCsv}>Export CSV</button>
    <button onClick={handleExportPdf}>Export PDF</button>
  </div>

  <table>
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

---

## Success Criteria

- Reconciliation math is cent-perfect and balanced only when `difference === 0`.
- User can finalize reconciliation and transactions are locked.
- Locked transactions cannot be edited (UI prevents edits).
- Reports correctly allocate split lines to categories.
- Exports match on-screen filters and totals.
- Business logic is testable without UI.

---

## Testing Plan

### Unit Tests

**File:** `src/lib/reconciler.test.ts`

1. Perfect match (difference 0).
2. Missing transaction (difference non-zero).
3. Off by 1 cent (difference 1).
4. Split transaction sums to correct total.

**File:** `src/lib/reports.test.ts`

1. Split aggregation ($100 split to $60/$40).
2. Mixed income/expense totals.
3. Filtered report only includes matching transactions.
4. CSV export includes expected rows.

### Integration Tests

1. RPC locking:
   - Call `finalize_reconciliation` and verify transactions locked and account updated.
2. Reports export:
   - Run report, export CSV/PDF, verify filtered data only.

---

## Task Checklist

1. **Database:** Ensure `reconciliations` table and `finalize_reconciliation` RPC exist.
2. **Types:** Create `src/types/reconcile.ts`.
3. **Logic:** Implement `src/lib/reconciler.ts`.
4. **Logic:** Implement `src/lib/reports.ts` (filters + aggregation + export).
5. **API:** Implement `src/lib/supabase/reconcile.ts` and `src/lib/supabase/reports.ts`.
6. **UI:** Create `ReconcilePage.tsx` (Step 1/2/3 flow).
7. **UI:** Build `ReconcileSetup` and `ReconcileWorkspace` components.
8. **UI:** Create `ReportsPage.tsx` with filters and table.
9. **Export:** Add CSV and PDF export handlers.
10. **Test:** Add unit + integration tests for reconciliation and reporting.
