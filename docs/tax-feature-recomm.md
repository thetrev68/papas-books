# Tax Preparation Feature Recommendations for Papa's Books

**Generated:** 2025-12-30

---

## Current Feature Set Summary

Papa's Books already has a solid foundation for tax preparation:

| Feature                    | Status | Notes                            |
| -------------------------- | ------ | -------------------------------- |
| Multi-Bookset Management   | ✅     | Separate books per client/entity |
| CSV Import with Mapping    | ✅     | Bank profiles for common banks   |
| Rules-Based Categorization | ✅     | Keyword matching with priority   |
| Split Transactions         | ✅     | Business/personal splits         |
| Category Tax Line Mapping  | ✅     | `tax_line_item` field exists     |
| Reconciliation             | ✅     | Statement matching               |
| Reports                    | ✅     | Category summaries               |
| Audit Trail                | ✅     | Change history tracking          |

---

## Recommended New Features

### Priority 1: High Impact, Lower Effort

#### 1. Tax Form Report (Group by Tax Line Item)

**Description:** Create a report that aggregates transactions by `tax_line_item` instead of just category. This groups expenses by IRS form line (Schedule C Line 7, Schedule A Line 1, etc.).

**Implementation Notes:**

- Modify [`src/lib/reports.ts`](src/lib/reports.ts) to aggregate by tax_line_item
- Add a toggle in [`src/pages/ReportsPage.tsx`](src/pages/ReportsPage.tsx) to switch between "By Category" and "By Tax Line"
- Filter out categories where `tax_line_item` is null

**Effort:** Low (1-2 days)

---

#### 2. CPA Export (Transaction Detail Export)

**Description:** Export all transactions with full detail for the CPA to import into their tax software.

**Fields to Include:**

- Transaction Date
- Original Description (from bank)
- Payee (normalized)
- Amount (in dollars)
- Category Name
- Tax Line Item
- Split Line Details (if applicable)
- Account Name

**Implementation Notes:**

- Create new export function in [`src/lib/reports.ts`](src/lib/reports.ts)
- Add button to Reports page: "Export for CPA"
- Format as CSV with headers compatible with common tax software

**Effort:** Medium (2-3 days)

---

#### 3. Tax Year Locking

**Description:** Prevent modifications to transactions in closed tax years. Once a year is "filed," all transactions before that date become read-only.

**Features:**

- "Close Tax Year" action in Settings
- Select year to close (e.g., 2024)
- Archive all transactions <= Dec 31, 2024
- Set `is_archived` or new `is_locked` flag
- UI feedback when viewing locked transactions

**Implementation Notes:**

- Database: Add `is_locked` column to transactions table, or use existing `is_archived`
- Add RPC function to lock transactions by date range
- Add "Close Tax Year" page in Settings
- Modify workbench to prevent editing locked transactions

**Effort:** Medium (3-4 days)

---

### Priority 2: Medium Impact, Medium Effort

#### 4. Quarterly Estimated Tax Summary

**Description:** Breakdown of income and expenses by quarter (Q1, Q2, Q3, Q4) for estimated tax payments.

**Features:**

- Select tax year
- Show income and expenses per quarter
- Calculate estimated tax due (based on configurable tax rate)
- Compare to prior year quarters

**Implementation Notes:**

- Add new report type in [`src/pages/ReportsPage.tsx`](src/pages/ReportsPage.tsx)
- Aggregate transactions by quarter
- Display in table or bar chart format

**Effort:** Low-Medium (2-3 days)

---

#### 5. Year-Over-Year Comparison

**Description:** Compare current year totals to previous years by category.

**Features:**

- Select current year and comparison year
- Side-by-side column for each category
- Calculate variance ($ and %)
- Highlight significant changes

**Implementation Notes:**

- Fetch data for two date ranges
- Aggregate separately
- Display in comparison table

**Effort:** Medium (2-3 days)

---

#### 6. Bulk Category Update

**Description:** Select multiple transactions in the workbench and change their category in one action.

**Features:**

- Multi-select in workbench table
- "Change Category" action
- Apply to all selected transactions
- Optional: Create rule from selection

**Implementation Notes:**

- Add checkboxes to workbench table (see [`src/components/workbench/WorkbenchTable.tsx`](src/components/workbench/WorkbenchTable.tsx))
- Add bulk actions toolbar
- Modify `updateTransaction` to handle batch updates

**Effort:** Medium (3-4 days)

---

### Priority 3: Nice to Have

#### 7. 1099-K Income Tracking

**Description:** Track payment processor income (Stripe, PayPal, Square) separately from bank deposits.

**Features:**

- Create "Payment Processor" account type
- Tag transactions as 1099-K vs regular income
- Summary of 1099-K amounts for the year

**Implementation Notes:**

- Add account type enum value
- Filter/summarize by account type in reports

**Effort:** Low (1-2 days)

---

#### 8. Mileage Deduction Tracker

**Description:** Simple mileage log for Schedule C business mileage deduction.

**Features:**

- Log trips: date, miles, purpose (business/medical/charity)
- Calculate deduction using IRS standard rate
- Include mileage in tax reports

**Implementation Notes:**

- New `mileage_logs` table
- Integration with workbench or standalone page
- Calculate and export totals

**Effort:** Medium (4-5 days)

---

#### 9. 1099-NEC Generation

**Description:** Generate 1099-NEC forms for contractors paid >$600.

**Features:**

- Track vendor payments by payee
- Calculate annual total per vendor
- Generate 1099-NEC data format
- TrackForm 1096 summary data

**Implementation Notes:**

- New "Contractors" report type
- Filter payees by category (e.g., "Contractor Services")
- Export in IRS-compatible format

**Effort:** Medium (3-4 days)

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 sprints)

1. Tax Form Report
2. CPA Export

### Phase 2: Data Protection (1 sprint)

1. Tax Year Locking

### Phase 3: Enhanced Reporting (1-2 sprints)

1. Quarterly Summary
2. Year-Over-Year Comparison

### Phase 4: Efficiency Features (1-2 sprints)

1. Bulk Category Update

### Phase 5: Advanced Features (future)

7-9. 1099-K, Mileage, 1099-NEC

---

## Technical Considerations

### Database Changes

If implementing Tax Year Locking, consider:

```sql
-- Option A: Use existing is_archived
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Option B: New table for locks
CREATE TABLE tax_year_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id UUID REFERENCES booksets(id),
  year INTEGER NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  locked_by UUID REFERENCES users(id),
  UNIQUE(bookset_id, year)
);
```

### API Changes

- Add RPC function: `lock_transactions_by_date(bookset_id, year, user_id)`
- Add RPC function: `bulk_update_categories(transaction_ids[], category_id)`

### UI Changes

- New report view with grouping options
- Bulk action toolbar in Workbench
- Tax Year management in Settings
- Locked transaction indicators

---

## Risk Assessment

| Feature          | Risk Level | Mitigation                               |
| ---------------- | ---------- | ---------------------------------------- |
| Tax Form Report  | Low        | Existing data structure supports it      |
| CPA Export       | Low        | Standard CSV generation                  |
| Tax Year Locking | Medium     | Requires careful UX to prevent data loss |
| Bulk Updates     | Medium     | Test thoroughly with undo capability     |
| Mileage Tracker  | Low        | Standalone feature, minimal integration  |

---

## Success Metrics

After implementation, measure:

1. **Tax Form Report:** % of users utilizing tax line item mapping
2. **CPA Export:** Number of CPA exports per bookset
3. **Tax Year Locking:** Number of years locked (indicates filing completion)
4. **Quarterly Summary:** Usage of estimated tax feature
