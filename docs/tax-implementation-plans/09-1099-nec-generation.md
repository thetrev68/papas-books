# Implementation Plan: 1099-NEC Generation

**Feature:** 1099-NEC Generation
**Priority:** Nice to Have
**Effort:** Medium (3-4 days)

## Objective

Identify contractors paid >$600/year to generate 1099-NEC filing data.

## Technical Implementation

### 1. Logic (`src/lib/reports.ts`)

We need to filter Payees, not just categories.
Usually, users tag specific categories as "Contract Labor" or specific Payees as "1099 Eligible".

**Approach:**

1. Allow flagging a `Category` as "1099 Eligible" (e.g. "Contractor Services").
2. Or simply run a report on specific selected categories.
3. Aggregate total payments by `Payee`.

**Function:** `generateContractorReport`

```typescript
// src/lib/reports.ts

export interface ContractorSummary {
  payeeId: string;
  payeeName: string;
  totalPaid: number;
  requiresForm: boolean; // true if > $600
}

export function generateContractorReport(
  transactions: Transaction[],
  contractorCategoryIds: string[],
  payees: Payee[]
): ContractorSummary[] {
  const payeeMap = new Map(payees.map((p) => [p.id, p]));
  const totals = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.payee_id) continue;

    // Check if transaction falls into one of the contractor categories
    let matches = false;
    if (tx.is_split && tx.lines) {
      matches = tx.lines.some((l) => contractorCategoryIds.includes(l.category_id));
      // If split, strictly we should only sum the amount for that line!
      if (matches) {
        const relevantAmount = tx.lines
          .filter((l) => contractorCategoryIds.includes(l.category_id))
          .reduce((sum, l) => sum + l.amount, 0);
        const current = totals.get(tx.payee_id) || 0;
        totals.set(tx.payee_id, current + relevantAmount);
        continue;
      }
    } else {
      const catId = tx.lines?.[0]?.category_id;
      if (catId && contractorCategoryIds.includes(catId)) {
        matches = true;
        const current = totals.get(tx.payee_id) || 0;
        totals.set(tx.payee_id, current + tx.amount);
      }
    }
  }

  const results: ContractorSummary[] = [];
  for (const [pId, amount] of totals.entries()) {
    // Only care about expenses (negative amounts usually, but we convert to positive for form)
    const paid = Math.abs(amount);
    results.push({
      payeeId: pId,
      payeeName: payeeMap.get(pId)?.name || 'Unknown',
      totalPaid: paid,
      requiresForm: paid >= 60000, // $600.00
    });
  }

  return results.sort((a, b) => b.totalPaid - a.totalPaid);
}
```

### 2. UI Updates (`src/pages/ReportsPage.tsx`)

**Report Setup:**

- Select Report Type: "1099-NEC / Contractors".
- User selects which Categories constitute "Contractor Labor" (e.g. multiselect).

**Render:**
Table showing Payee, Total Paid, and a "Status" column (Needs Form / Below Threshold).

### 3. Export

Export to CSV compatible with Track1099 or similar services.
Fields: `Payee Name, Address (if we had it), Tax ID (if we had it), Email, Amount`.
_Note: We likely don't store Address/Tax ID in `payees` table yet. We might need to add these fields to `payees` table for a complete solution._

For this phase, just export Name and Amount.

## Verification

1. Create Payee "John Doe".
2. Create transactions totaling $700 categorized as "Contract Labor".
3. Run report.
4. Verify John Doe appears with "Requires Form".
5. Create "Jane Smith" with $500.
6. Verify Jane appears but "Below Threshold".

## Files to Modify

- `src/lib/reports.ts`
- `src/pages/ReportsPage.tsx`
