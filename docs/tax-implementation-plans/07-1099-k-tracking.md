# Implementation Plan: 1099-K Income Tracking

**Feature:** 1099-K Income Tracking
**Priority:** Nice to Have
**Effort:** Low (1-2 days)

## Objective

Track payment processor income (Stripe, PayPal, Square) separately from bank deposits to reconcile against 1099-K forms received at year-end.

## Technical Implementation

### 1. Database Schema (`supabase/schema.sql`)

Modify `accounts` table constraint to allow `PaymentProcessor`.

```sql
-- Migration
ALTER TABLE public.accounts DROP CONSTRAINT accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('Asset', 'Liability', 'PaymentProcessor'));
```

Update TypeScript types (`src/types/database.ts`).

```typescript
export interface Account {
  // ...
  type: 'Asset' | 'Liability' | 'PaymentProcessor';
  // ...
}
```

### 2. UI Updates (`src/components/settings/AccountSettings.tsx`)

Update the "Add Account" or "Edit Account" modal to allow selecting "Payment Processor" as a type.

### 3. Reporting (`src/lib/reports.ts`)

Add a specific report or section for 1099-K Reconciliation.
This basically just filters for transactions where `account.type === 'PaymentProcessor'` AND `amount > 0` (Income).

**New Function:**

```typescript
export function generate1099KReport(
  transactions: Transaction[],
  accounts: Account[]
): { accountName: string; totalIncome: number }[] {
  const processorAccounts = new Set(
    accounts.filter((a) => a.type === 'PaymentProcessor').map((a) => a.id)
  );

  const totals = new Map<string, number>();

  for (const tx of transactions) {
    if (processorAccounts.has(tx.account_id) && tx.amount > 0) {
      // It's income in a processor account
      const current = totals.get(tx.account_id) || 0;
      totals.set(tx.account_id, current + tx.amount);
    }
  }

  return Array.from(totals.entries()).map(([accId, total]) => {
    const acc = accounts.find((a) => a.id === accId);
    return {
      accountName: acc?.name || 'Unknown',
      totalIncome: total,
    };
  });
}
```

## Verification

1. Create an account "Stripe" with type "Payment Processor".
2. Import transactions into Stripe account.
3. Run 1099-K Report.
4. Verify total matches sum of positive transactions in that account.

## Files to Modify

- `src/types/database.ts`
- `supabase/migrations/xxxx_account_type_enum.sql`
- `src/components/settings/AccountSettings.tsx` (assumed path)
- `src/pages/ReportsPage.tsx`
