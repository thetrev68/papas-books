# Phase 6: Reconciliation & Reporting

**Status:** Planned
**Dependencies:** Phase 5 (Workbench)
**Estimated Complexity:** Medium-High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-5-Workbench.md](Phase-5-Workbench.md)

---

## Overview

Phase 6 addresses the two critical outputs of a bookkeeping system: verifying data accuracy (Reconciliation) and summarizing financial health (Reporting).

**Reconciliation** creates a "lock" on historical data. By comparing the system's records against external bank statements, we ensure accuracy. Once reconciled, transactions are locked to prevent accidental editing.

**Reporting** aggregates transaction data into usable insights. Crucially, it must accurately handle the **split transactions** created in Phase 5, ensuring that a single transaction split across "Groceries" and "Household" contributes correctly to both category totals in reports.

**Key Principles:**

- **Cent-Perfect Accuracy:** All calculations must be exact.
- **Wizard-Based Workflow:** Simplify the reconciliation process into clear steps.
- **Immutable History:** Finalizing a reconciliation locks the associated transactions.
- **Split-Aware Aggregation:** Reports must decompose split transactions into their constituent parts.
- **Pure Functional Logic:** Calculation engines must be strictly separated from UI for testing.

---

## UI Implementation Constraint: "Function Over Form"

**CRITICAL REQUIREMENT:** The UI for Phase 6 must be **superbasic and unstyled**.

- Use native HTML elements only (`<table>`, `<button>`, `<input>`, `<ul>`).
- **NO Tailwind classes**, NO custom CSS, and NO component libraries (unless specifically for logic, like TanStack Table).
- The goal is to verify the reconciliation math and reporting logic, not to create a finished user experience.
- Aesthetic polish is strictly reserved for Phase 7.

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

**File:** `supabase/schema.sql` (Add this function)

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
  -- Calculate difference just to be safe (trust but verify)
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
  -- Only update transactions that match IDs and belong to bookset (security)
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

---

## Types & Interfaces

### File: `src/types/reconcile.ts`

```typescript
export interface Reconciliation {
  id: string;
  booksetId: string;
  accountId: string;
  statementDate: string; // ISO Date
  statementBalance: number; // cents
  openingBalance: number; // cents
  calculatedBalance: number; // cents
  difference: number; // cents
  status: 'in_progress' | 'balanced' | 'unbalanced';
  finalizedAt?: string;
  transactionCount: number;
  transactionIds: string[];
}

export interface ReconciliationResult {
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  calculatedEndingBalance: number;
  difference: number;
  isBalanced: boolean;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalAmount: number; // In cents
  transactionCount: number;
  isIncome: boolean; // Based on category type or sign
  children?: CategorySummary[];
}

export interface ReportFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  accountIds?: string[];
}
```

---

## Domain Logic: Pure Functions

### Module: Reconciliation Engine

**File:** `src/lib/reconciler.ts`

```typescript
import { Transaction } from '../types/database';
import { ReconciliationResult } from '../types/reconcile';

/**
 * Calculates the current reconciliation state.
 *
 * @param previousBalance - The starting balance (from last reconciliation or 0)
 * @param transactions - List of transactions currently selected by the user
 * @param targetBalance - The user-entered ending balance from their statement
 */
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

  // Exact integer math (cents)
  const calculatedEndingBalance = previousBalance + deposits + withdrawals;
  const difference = targetBalance - calculatedEndingBalance;

  return {
    openingBalance: previousBalance,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    calculatedEndingBalance,
    difference,
    // Must be exactly zero. No floating point tolerance needed for integers.
    isBalanced: difference === 0,
  };
}
```

### Module: Reporting Engine

**File:** `src/lib/reports.ts`

```typescript
import { Transaction } from '../types/database';
import { Category } from '../types/database';
import { CategorySummary } from '../types/reconcile';

/**
 * Generates a flat summary of categories based on transactions.
 * CRITICAL: Decomposes split transactions into their lines.
 */
export function generateCategoryReport(
  transactions: Transaction[],
  categories: Category[]
): CategorySummary[] {
  const summaryMap = new Map<string, { amount: number; count: number }>();

  // 1. Aggregation Phase
  for (const tx of transactions) {
    if (tx.isSplit && tx.lines) {
      // Handle Split Lines
      for (const line of tx.lines) {
        const catId = line.categoryId;
        const current = summaryMap.get(catId) || { amount: 0, count: 0 };
        summaryMap.set(catId, {
          amount: current.amount + line.amount,
          count: current.count + 1,
          // Note: count increases per split line, which is technically correct for "activity"
        });
      }
    } else {
      // Handle Single Transaction
      // Fallback: If no lines array, use legacy/root category (though Phase 5 standardized lines)
      const catId = tx.lines?.[0]?.categoryId || 'uncategorized';
      const current = summaryMap.get(catId) || { amount: 0, count: 0 };
      summaryMap.set(catId, {
        amount: current.amount + tx.amount,
        count: current.count + 1,
      });
    }
  }

  // 2. Mapping Phase (IDs to Names)
  const results: CategorySummary[] = [];

  // Create a lookup for category names
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  for (const [catId, data] of summaryMap.entries()) {
    const category = categoryLookup.get(catId);
    results.push({
      categoryId: catId,
      categoryName: category ? category.name : 'Unknown Category',
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0, // Simple heuristic, better to use category type if available
    });
  }

  // 3. Sort by Name
  return results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
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

---

## UI Components & Flow

### Page: `src/pages/ReconcilePage.tsx`

**State Management:**

- `step`: number (1, 2, 3)
- `accountId`: string | null
- `statementDate`: string
- `statementBalance`: number (cents)
- `selectedTransactionIds`: `Set<string>`

**Render:**

```tsx
<div className="reconcile-page">
  <h1>Reconciliation</h1>

  {step === 1 && (
    <ReconcileSetup
      accounts={accounts}
      onNext={(data) => {
        setAccountId(data.accountId);
        setStatementDate(data.date);
        setStatementBalance(data.balance);
        setStep(2);
      }}
    />
  )}

  {step === 2 && (
    <ReconcileWorkspace
      accountId={accountId}
      statementDate={statementDate}
      statementBalance={statementBalance}
      onBack={() => setStep(1)}
      onFinish={() => setStep(3)}
    />
  )}

  {step === 3 && <ReconcileSuccess onReset={() => window.location.reload()} />}
</div>
```

### Component: `ReconcileWorkspace`

**Location:** `src/components/reconcile/ReconcileWorkspace.tsx`

**Props:**

- `accountId`: string
- `statementDate`: string
- `statementBalance`: number

**Internal Logic:**

1. Fetch `account` to get `openingBalance` (lastReconciledBalance).
2. Fetch `transactions` where `accountId` matches AND `date <= statementDate` AND `reconciled == false`.
3. Use `useMemo` to call `calculateReconciliation(...)` whenever selection changes.

**Layout (Unstyled HTML Table):**

```tsx
<div>
  <div style={{ border: '1px solid black', padding: '10px' }}>
    <h3>Summary</h3>
    <p>Opening Balance: {formatCurrency(result.openingBalance)}</p>
    <p>+ Deposits: {formatCurrency(result.totalDeposits)}</p>
    <p>- Withdrawals: {formatCurrency(result.totalWithdrawals)}</p>
    <hr />
    <p>Calculated Ending: {formatCurrency(result.calculatedEndingBalance)}</p>
    <p>Target Ending: {formatCurrency(props.statementBalance)}</p>
    <h2 style={{ color: result.isBalanced ? 'green' : 'red' }}>
      Difference: {formatCurrency(result.difference)}
    </h2>
    <button disabled={!result.isBalanced} onClick={handleFinalize}>
      Finish Reconciliation
    </button>
  </div>

  <table>
    <thead>
      <tr>
        <th>Select</th>
        <th>Date</th>
        <th>Payee</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {transactions.map((tx) => (
        <tr key={tx.id}>
          <td>
            <input
              type="checkbox"
              checked={selectedIds.has(tx.id)}
              onChange={() => toggleId(tx.id)}
            />
          </td>
          <td>{tx.date}</td>
          <td>{tx.payee}</td>
          <td>{formatCurrency(tx.amount)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Testing Plan

### Unit Tests

**File:** `src/lib/reconciler.test.ts`

1. **Perfect Match:**
   - Input: Opening 1000, 1 Deposit of 500, Target 1500.
   - Expect: Diff 0, isBalanced true.
2. **Missing Transaction:**
   - Input: Opening 1000, Target 1500, No transactions selected.
   - Expect: Diff 500, isBalanced false.
3. **Wrong Amount:**
   - Input: Target 1500, Calculated 1499.
   - Expect: Diff 1, isBalanced false.

**File:** `src/lib/reports.test.ts`

1. **Split Aggregation:**
   - Create 1 transaction: $100 total. Split: $60 Food, $40 Home.
   - Run `generateCategoryReport`.
   - Expect: Result array has "Food" ($60) and "Home" ($40). Total $100.
2. **Mixed Types:**
   - 1 Income ($1000), 1 Expense (-$200).
   - Expect: Correct totals in respective categories.

### Integration Tests

1. **RPC Locking:**
   - Call `finalize_reconciliation`.
   - Verify in DB that `transactions` table has `reconciled = true` for the IDs.
   - Verify `accounts` table `lastReconciledBalance` updated.
   - Verify `reconciliations` table has a new row.

---

## Task Checklist

1. [ ] **Database:** Run SQL to create `reconciliations` table (if missing) and `finalize_reconciliation` function.
2. [ ] **Types:** Create `src/types/reconcile.ts`.
3. [ ] **Logic:** Implement `src/lib/reconciler.ts` (Math).
4. [ ] **Logic:** Implement `src/lib/reports.ts` (Split aggregation).
5. [ ] **API:** Implement `src/lib/supabase/reconcile.ts`.
6. [ ] **UI:** Create `ReconcilePage.tsx` with Step 1/2/3 state.
7. [ ] **UI:** Create `ReconcileWorkspace.tsx` with selection logic.
8. [ ] **UI:** Create `ReportsPage.tsx` (simple date picker + table dump).
9. [ ] **Test:** Write and pass unit tests for math and reporting.
