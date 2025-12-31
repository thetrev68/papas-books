# Tax Features Implementation Roadmap

**Last Updated:** 2025-12-30

---

## Overview

This document provides the complete implementation roadmap for Papa's Books tax preparation features, organized by priority and phase.

---

## Phase 1: Core Tax Reports (1-2 sprints)

### ✅ Ready for Implementation

**Features:**

1. **Tax Form Report** - `01-tax-form-report.md`
   - Effort: 1-2 days
   - Dependencies: None
   - Status: **Implementation-ready**

2. **CPA Export** - `02-cpa-export.md`
   - Effort: 2-3 days
   - Dependencies: None
   - Status: **Implementation-ready**
   - Can be done in parallel with Tax Form Report

**Deliverables:**

- Users can group reports by Tax Line Item
- Users can export detailed transaction data for CPAs
- CSV exports handle split transactions correctly
- Proper CSV escaping for special characters

---

## Phase 2: Data Protection (1 sprint)

### ✅ Ready for Implementation

**Feature:**

1. **Tax Year Locking** - `03-tax-year-locking.md`
   - Effort: 3-4 days
   - Dependencies: None
   - Status: **Implementation-ready**

**Deliverables:**

- Lock/unlock tax years from Settings
- Database triggers prevent modifications to locked transactions
- Visual indicators in Workbench
- CSV import validation

**Critical Notes:**

- Requires database migration `003_tax_year_locking.sql`
- Test thoroughly before production deployment
- Ensure rollback SQL is verified

---

## Phase 3: Enhanced Reporting (1-2 sprints)

### 📋 Implementation Plan Summary

**Features:**

1. **Quarterly Estimated Tax Summary** - `04-quarterly-estimated-tax.md`
   - Effort: 2-3 days
   - Dependencies: Tax Form Report (optional)
   - Key Components:
     - Add quarterly date range selector to Reports page
     - Calculate income/expenses by quarter (Q1-Q4)
     - Display side-by-side comparison table
     - Optional: Estimated tax calculator (simple % of income)
   - Files to Create/Modify:
     - Modify `src/lib/reports.ts` - Add `generateQuarterlyReport()`
     - Modify `src/pages/ReportsPage.tsx` - Add quarterly view option
   - Testing Focus:
     - Verify quarters calculated correctly (Q1: Jan-Mar, Q2: Apr-Jun, etc.)
     - Test with split transactions
     - Test year-end boundary (Dec 31 → Jan 1)

2. **Year-over-Year Comparison** - `05-year-over-year-comparison.md`
   - Effort: 2-3 days
   - Dependencies: Tax Form Report or Category Report
   - Key Components:
     - Add "Compare to Previous Year" toggle on Reports page
     - Fetch data for two date ranges (e.g., 2024 vs 2023)
     - Display comparison table with variance columns
     - Highlight significant changes (>25% variance)
   - Files to Create/Modify:
     - Modify `src/lib/reports.ts` - Add `generateComparisonReport()`
     - Modify `src/pages/ReportsPage.tsx` - Add comparison UI
   - Testing Focus:
     - Test with categories that exist in one year but not the other
     - Verify percentage calculations
     - Test with different date ranges (YTD, full year, custom)

---

## Phase 4: Workflow Efficiency (1-2 sprints)

### 📋 Implementation Plan Summary

**Feature:**

1. **Bulk Category Update** - `06-bulk-category-update.md`
   - Effort: 3-4 days
   - Dependencies: Tax Year Locking (for lock enforcement)
   - Key Components:
     - Add row selection to WorkbenchTable (TanStack Table `rowSelection`)
     - Create bulk actions toolbar (appears when rows selected)
     - Add database RPC `bulk_update_category` for performance
     - Warn user if updating split transactions (will unsplit)
     - Integrate with tax year lock checks
   - Files to Create/Modify:
     - `supabase/migrations/004_bulk_update_rpc.sql` - RPC function
     - Modify `src/lib/transactionOperations.ts` - Add `updateCategory` to `BulkOperation` type
     - Modify `src/hooks/useTransactionMutations.ts` - Handle bulk update
     - Modify `src/components/workbench/WorkbenchTable.tsx` - Add selection & toolbar
   - Testing Focus:
     - Test with 100+ selected transactions (performance)
     - Test with mix of split and simple transactions
     - Test with locked year transactions (should be rejected)
     - Verify audit trail updated for all transactions

---

## Phase 5: Advanced Features (Future)

### 📝 Brief Implementation Notes

These features are lower priority and may be implemented based on user demand.

#### 7. 1099-K Income Tracking

- Effort: 1-2 days
- Add new account type: "Payment Processor"
- Add "Income Type" field to categories (1099-K, W2, Other)
- Create report filter to show 1099-K income only
- Simple feature, low complexity

#### 8. Mileage Deduction Tracker

- Effort: 4-5 days
- Create new table: `mileage_logs`
  - Fields: date, miles, purpose (business/medical/charity), description
- Create new page: MileageLogPage
- Calculate deduction using IRS standard rate (fetch from settings or hardcode)
- Add to tax reports as "Mileage Deduction" line item
- Medium complexity due to new page/table

#### 9. 1099-NEC Generation

- Effort: 3-4 days
- Track contractor payments (filter by payee + category)
- Calculate annual totals per payee (>$600 threshold)
- Generate CSV export in IRS-compatible format
- Include Form 1096 summary data
- Medium complexity, requires understanding IRS formats

---

## Implementation Priority Matrix

| Phase | Feature              | Priority | Effort | Value  | Implement?       |
| ----- | -------------------- | -------- | ------ | ------ | ---------------- |
| 1     | Tax Form Report      | High     | Low    | High   | ✅ Yes           |
| 1     | CPA Export           | High     | Medium | High   | ✅ Yes           |
| 2     | Tax Year Locking     | High     | Medium | High   | ✅ Yes           |
| 3     | Quarterly Summary    | Medium   | Low    | Medium | ⏳ After Phase 2 |
| 3     | Year-over-Year       | Medium   | Low    | Medium | ⏳ After Phase 2 |
| 4     | Bulk Category Update | Medium   | Medium | High   | ⏳ After Phase 3 |
| 5     | 1099-K Tracking      | Low      | Low    | Low    | ⚠️ As needed     |
| 5     | Mileage Tracker      | Low      | Medium | Low    | ⚠️ As needed     |
| 5     | 1099-NEC Generation  | Low      | Medium | Low    | ⚠️ As needed     |

---

## Recommended Implementation Sequence

### Sprint 1: Core Tax Reports

**Week 1:**

- Day 1-2: Implement Tax Form Report
  - Write unit tests first (TDD)
  - Implement `generateTaxLineReport()`
  - Add UI toggle and table
  - Manual testing

- Day 3-5: Implement CPA Export
  - Create `csvUtils.ts` with tests
  - Implement `generateCpaExport()`
  - Add export button and help text
  - Manual testing with various scenarios

**Deliverable:** Users can view tax line reports and export for CPA

### Sprint 2: Data Protection

**Week 2:**

- Day 1-2: Database Migration
  - Create and test `003_tax_year_locking.sql`
  - Test all RPC functions in Supabase SQL Editor
  - Verify triggers work correctly
  - Test rollback SQL

- Day 3-4: React Implementation
  - Create `useTaxYearLocks` hook
  - Add Settings page UI
  - Add Workbench indicators
  - Integration testing

- Day 5: CSV Import Protection
  - Add import validation
  - Test with locked dates
  - Full end-to-end testing

**Deliverable:** Tax years can be locked to prevent data tampering

### Sprint 3-4: Enhanced Reporting (Optional)

Implement Quarterly Summary and Year-over-Year as needed.

### Sprint 5: Bulk Operations (Optional)

Implement Bulk Category Update if users request it.

---

## Testing Strategy

### Unit Tests

All Phase 1-4 features require ≥90% code coverage:

- `src/lib/reports.test.ts` - Report generation logic
- `src/lib/csvUtils.test.ts` - CSV escaping
- `src/hooks/useTaxYearLocks.test.ts` - Lock/unlock logic

### Integration Tests

- Database trigger tests (via Supabase SQL Editor)
- End-to-end CSV import/export tests
- Multi-user access scenarios (if applicable)

### Manual Testing

- Follow checklists in each implementation plan
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test with large datasets (1000+ transactions)
- Test edge cases (empty states, errors, etc.)

---

## Risk Assessment

| Risk                                     | Likelihood | Impact | Mitigation                             |
| ---------------------------------------- | ---------- | ------ | -------------------------------------- |
| Tax Year Locking breaks imports          | Medium     | High   | Thorough testing, rollback plan ready  |
| CSV exports too large (memory)           | Low        | Medium | Implement pagination if needed         |
| RLS policies block legitimate operations | Low        | High   | Test all permission scenarios          |
| Users accidentally lock current year     | Medium     | Low    | Confirmation dialogs, clear warnings   |
| Bulk updates cause data corruption       | Low        | High   | Transaction-based updates, audit trail |

---

## Success Metrics

After Phase 1-2 implementation:

1. **Tax Form Report**
   - % of users with tax_line_item mapped (target: >50%)
   - Tax line report views per user per month (target: 2+)

2. **CPA Export**
   - Number of CPA exports per bookset (target: 1+ per year)
   - Export success rate (target: >99%)

3. **Tax Year Locking**
   - % of booksets with at least one locked year (target: >30% after tax season)
   - Number of prevented modifications (audit trail)

---

## Post-Implementation Tasks

### Documentation

- [ ] Update user guide with tax features
- [ ] Create video tutorials for CPA export
- [ ] Document tax_line_item naming conventions (Schedule C lines, etc.)
- [ ] Add FAQ section for tax year locking

### User Communication

- [ ] Email announcement to existing users
- [ ] Blog post highlighting tax features
- [ ] Social media posts with screenshots
- [ ] Outreach to accounting professionals

### Data Quality

- [ ] Audit existing categories for tax_line_item assignments
- [ ] Create default tax line mappings for common categories
- [ ] Add tooltips with tax line suggestions

---

## Future Enhancements (Beyond Phase 5)

- **Tax Form PDF Generation:** Auto-generate Schedule C from transaction data
- **Multi-Year Tax Summary:** 3-year comparison for trend analysis
- **Tax Deduction Optimizer:** Suggest categories to maximize deductions
- **CPA Collaboration:** Allow CPAs to directly access booksets (view-only)
- **Automated Tax Reminders:** Email reminders for quarterly estimated payments
- **Integration with Tax Software:** Direct export to TurboTax, H&R Block, etc.

---

## Questions & Decisions Needed

Before starting implementation:

1. **Tax Year Locking Business Logic:**
   - ✅ Confirmed: Locking year N locks all years ≤ N
   - ✅ Confirmed: Unlocking only unlocks specific year

2. **CPA Export Format:**
   - ✅ Confirmed: Use standard CSV format
   - Future: Consider adding QuickBooks IIF export option

3. **Bulk Operations:**
   - ✅ Confirmed: Warn when overwriting split transactions
   - Question: Should bulk operations create audit log entry?

4. **1099-NEC Generation:**
   - Question: What IRS format should we use? (Need research)
   - Question: Should we integrate with e-filing services?

---

## Appendix: Related Documents

- [Tax Feature Recommendations](../tax-feature-recomm.md) - Original feature list from Minimax
- [Production Readiness Plan](../archive/Production-Readiness-Plan.md) - Overall app production plan
- [Supabase Schema](../../supabase/schema.sql) - Current database schema

---

## Change Log

- **2025-12-30:** Initial roadmap created based on enhanced implementation plans
- Phase 1-4 plans completed with full implementation details
- Phase 5 features outlined with brief notes
