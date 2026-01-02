# Implementation Plan: CSV Export for Workbench and Settings Tables

## Overview

This plan outlines how to add CSV export functionality to the Workbench table and all Settings tables (Accounts, Categories, Payees, Tax Year Locks, Access Grants, and Rules). The implementation will leverage the existing `csvUtils.ts` utilities and TanStack Table's filtered/sorted row model to ensure exports reflect the user's current view.

## Current State Analysis

### Existing Infrastructure

- **CSV Utilities**: `src/lib/csvUtils.ts` provides `escapeCsvValue()` and `formatCsvRow()` functions
- **Reports Export Pattern**: `src/lib/reports.ts` demonstrates CSV export patterns with functions like `exportCpaExportToCsv()`, `exportReportToCsv()`, etc.
- **TanStack Table**: All tables use TanStack Table v8 with `getFilteredRowModel()` and `getSortedRowModel()` to provide access to the current filtered/sorted data

### Tables to Update

1. **Workbench Table** (`src/components/workbench/WorkbenchTable.tsx`) - Transaction data with complex split transaction support
2. **Accounts Tab** (`src/components/settings/AccountsTab.tsx`) - Simple table without TanStack Table
3. **Categories Tab** (`src/components/settings/CategoriesTab.tsx`) - Simple table without TanStack Table
4. **Payees Tab** (`src/components/settings/PayeesTab.tsx`) - Uses TanStack Table with filtering/sorting
5. **Tax Year Locks Tab** (`src/components/settings/TaxYearLocksTab.tsx`) - Custom list view, not a traditional table
6. **Access Grants Tab** (`src/components/settings/AccessTab.tsx`) - Simple table without TanStack Table
7. **Rules Tab** (`src/components/settings/RulesTab.tsx`) - Simple table without TanStack Table

## Architecture Decisions

### 1. Reusable Export Utility Functions

Create a new file `src/lib/tableExports.ts` with dedicated export functions for each table type.

**Rationale:**

- Separates export logic from UI components (single responsibility)
- Makes functions testable in isolation
- Follows the pattern established in `reports.ts`
- Allows consistent data formatting across all exports

### 2. Data Source Strategy

For each table type:

- **TanStack Tables** (Workbench, Payees): Use `table.getFilteredRowModel().rows` to get the current filtered/sorted view
- **Simple Tables** (Accounts, Categories, Rules, Access Grants): Export the raw data array (already filtered by bookset via React Query)
- **Tax Year Locks**: Export the locks array with computed status

**Rationale:**

- Ensures exports match what the user sees on screen
- Respects user's applied filters and sorting
- No need to re-implement filtering logic

### 3. Field Selection and Formatting

Each export function will:

- Select relevant fields (exclude internal IDs, bookset_id, etc.)
- Format dates as human-readable (YYYY-MM-DD or localeString)
- Format amounts as dollars with 2 decimal places (divide by 100)
- Resolve foreign key references to display names (category names, account names, payee names, user names)
- Handle boolean values as "Yes"/"No" or "Enabled"/"Disabled"
- Handle null values gracefully with "-" or empty string

**Rationale:**

- CSV is intended for human consumption and external tools (Excel, Google Sheets)
- Business users need readable data, not database internals
- Follows existing pattern from CPA export function

### 4. UI Integration Pattern

Add export button to each table:

- Position: Top-right of table section, next to existing action buttons
- Icon: Download icon (SVG)
- Styling: Consistent with existing button patterns (secondary style with brand accent)
- Disabled state: When no data available
- Click handler: Generates CSV and triggers browser download

**Rationale:**

- Consistent user experience across all tables
- Non-intrusive placement
- Follows existing UI patterns

## Detailed Implementation Steps

### Step 1: Create Table Export Utility Library

Create `src/lib/tableExports.ts` with the following export functions:

#### A. Workbench/Transaction Export

```typescript
export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: CategoryWithDisplayName[],
  payees: Payee[]
): string;
```

**Fields to export:**

- Date (formatted)
- Account Name (resolved from account_id)
- Payee Name (resolved from payee_id or fallback to payee field)
- Description (original_description)
- Category (if split, show "Split Transaction", else resolve category name)
- Amount (formatted as currency)
- Reviewed (Yes/No)
- Reconciled (Yes/No)
- Split Details (if split, include as additional rows or concatenated string)

**Edge Cases:**

- Split transactions: Options include (a) single row with "Split Transaction" in category column, (b) multiple rows with split line details indented
- Missing payee: Use "Uncategorized Payee" or empty string
- Missing category: Use "Uncategorized"

#### B. Accounts Export

```typescript
export function exportAccountsToCsv(accounts: Account[]): string;
```

**Fields to export:**

- Name
- Type (Asset/Liability)
- Opening Balance (formatted)
- Opening Date (formatted)
- Last Reconciled Date (formatted or "-")
- Last Reconciled Balance (formatted)
- Status (Active/Archived)

#### C. Categories Export

```typescript
export function exportCategoriesToCsv(
  categories: Category[],
  categoriesMap: Map<string, Category>
): string;
```

**Fields to export:**

- Name
- Parent Category (resolved from parent_category_id or "-")
- Tax Deductible (Yes/No)
- Tax Line Item (or "-")
- Sort Order

#### D. Payees Export

```typescript
export function exportPayeesToCsv(payees: Payee[], categories: CategoryWithDisplayName[]): string;
```

**Fields to export:**

- Name
- Default Category (resolved from default_category_id or "-")

#### E. Rules Export

```typescript
export function exportRulesToCsv(rules: Rule[], categories: Category[], payees: Payee[]): string;
```

**Fields to export:**

- Priority
- Keyword
- Match Type
- Target Category (resolved from target_category_id)
- Suggested Payee (or "-")
- Enabled (Yes/No)
- Use Count
- Last Used Date (formatted or "-")

#### F. Tax Year Locks Export

```typescript
export function exportTaxYearLocksToCsv(
  locks: TaxYearLock[],
  userMap: Map<string, string>, // userId -> display name
  maxLockedYear: number | null
): string;
```

**Fields to export:**

- Tax Year
- Status (Locked/Locked by [year]/Unlocked)
- Locked By (user display name)
- Locked At (formatted date)

#### G. Access Grants Export

```typescript
export function exportAccessGrantsToCsv(
  grants: AccessGrant[],
  userMap: Map<string, string> // userId -> display name/email
): string;
```

**Fields to export:**

- User (display name or email)
- Role (capitalized)
- Granted At (formatted)
- Granted By (resolved user display name)
- Status (Active/Revoked)
- Revoked At (formatted or "-")

### Step 2: Update Workbench Table Component

**File**: `src/components/workbench/WorkbenchTable.tsx`

**Changes:**

1. Import `exportTransactionsToCsv` from `tableExports.ts`
2. Add export handler function that:
   - Gets filtered rows from `table.getFilteredRowModel().rows`
   - Maps row objects to `Transaction[]`
   - Calls export function with necessary lookup data (accounts, categories, payees)
   - Creates blob and triggers download
3. Pass export handler to `WorkbenchToolbar` component as prop
4. Update `WorkbenchToolbar` to add "Export to CSV" button next to bulk action buttons

**Button placement**: In the toolbar area between search and bulk actions

**Filename pattern**: `transactions-export-YYYY-MM-DD.csv`

### Step 3: Update Settings Tab Components

For each settings tab, follow this pattern:

#### A. Payees Tab (already uses TanStack Table)

- Add export button next to "Add Payee" button
- Use `table.getFilteredRowModel().rows` for export
- Handle search filter state

#### B. Simple Tables (Accounts, Categories, Rules, Access Grants)

- Add export button next to "Create [Entity]" button
- Export the full data array from React Query
- No filtering needed (already scoped by bookset)

#### C. Tax Year Locks Tab

- Add export button in header section
- Export the `locks` array with computed status fields
- Include user lookup for "Locked By" field

### Step 4: Add Download Trigger Utility

Create a reusable download helper in `tableExports.ts`:

```typescript
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

**Rationale:**

- Reusable across all export handlers
- Proper memory cleanup with `revokeObjectURL`
- Follows pattern from `ReportsPage.tsx`

### Step 5: Handle Edge Cases and Data Integrity

#### A. Split Transactions in Workbench

- Option 1 (Recommended): Export split transactions as a single row with category column showing "Split Transaction" and a separate "Split Details" column with pipe-separated categories
- Option 2: Export each split line as a separate row with the same date/amount but different categories
- Recommendation: Use Option 1 to maintain 1:1 mapping with visible rows

#### B. Hierarchical Categories

- Export with "Parent: Child" format using existing `getCategoryFullName` or `displayName` from `useSortedCategories`
- Ensures readability in Excel

#### C. Empty Tables

- Disable export button when no data
- Show tooltip: "No data to export"

#### D. Large Datasets (Workbench)

- TanStack Table already handles virtualization
- Export should handle thousands of rows efficiently
- Test with 10,000+ transaction dataset
- Consider showing loading indicator for exports >1000 rows

#### E. Date Formatting

- Use ISO format (YYYY-MM-DD) for consistency and Excel compatibility
- Alternatively, use `toLocaleDateString()` for human readability

#### F. Character Encoding

- Use UTF-8 BOM (`\uFEFF`) at start of CSV for Excel compatibility with special characters
- Ensure `escapeCsvValue` handles quotes, commas, newlines

### Step 6: Testing Strategy

#### Unit Tests (create alongside implementation)

- `tableExports.test.ts` with tests for each export function
- Test edge cases: null values, split transactions, empty arrays, special characters in names
- Verify CSV escaping with commas, quotes, newlines in data

#### E2E Tests (optional, can be added later)

- Add test to verify export button presence
- Verify download is triggered (mock `URL.createObjectURL`)

#### Manual Testing Checklist

- Export from each table with various filters applied
- Verify CSV opens correctly in Excel and Google Sheets
- Test with special characters (quotes, commas) in data
- Test empty tables (button disabled)
- Test large datasets (1000+ rows)

## Implementation Sequence

### Phase 1: Foundation (Most Critical)

1. Create `tableExports.ts` with all export functions
2. Add unit tests for export functions
3. Add `downloadCsv` utility

### Phase 2: Workbench Export (High Value)

1. Update `WorkbenchTable.tsx` with export handler
2. Update `WorkbenchToolbar.tsx` with export button
3. Test with filtered/sorted data

### Phase 3: Settings Tables (Incremental Value)

1. Update Accounts Tab
2. Update Categories Tab
3. Update Payees Tab
4. Update Rules Tab
5. Update Tax Year Locks Tab
6. Update Access Grants Tab

### Phase 4: Polish

1. Consistent button styling across all tables
2. Loading indicators for large exports
3. Success toast messages (optional)
4. Documentation in CLAUDE.md

## Technical Considerations

### Dependency Injection

- Export functions should accept lookup data (accounts, categories, payees) as parameters
- Components are responsible for fetching and passing this data
- Avoids coupling export logic to React hooks

### Performance

- CSV generation is synchronous and should be fast (<100ms for <10,000 rows)
- Browser download trigger is also fast
- No need for Web Workers unless performance issues arise

### Accessibility

- Export buttons should have proper `aria-label` attributes
- Keyboard accessible (standard button element)
- Disabled state should be announced to screen readers

### TypeScript

- All export functions should be strictly typed
- Return type is always `string` (CSV content)
- Parameter types should match database types

## Alternative Approaches Considered

### 1. Use existing report export functions

- **Rejected**: Report exports are designed for aggregated data (summaries), not raw table data
- Different use case: reports show summaries, table exports show individual records

### 2. Backend CSV generation

- **Rejected**: Adds server load, requires API endpoint, slower for user
- Client-side generation is fast and reduces server dependency

### 3. Library like PapaParse for CSV generation

- **Rejected**: PapaParse is for parsing, not generation
- Existing `csvUtils.ts` is sufficient and lightweight

### 4. Excel export (XLSX) instead of CSV

- **Rejected**: More complex, larger file size, requires library
- CSV is universal, simple, and works with all spreadsheet software

## Risk Assessment

### Low Risk

- CSV export is a read-only operation (no data modification)
- Uses existing utilities (`csvUtils.ts`)
- Follows established patterns (`reports.ts`)
- No database queries needed (uses data already loaded in component)

### Medium Risk

- Large datasets (10,000+ transactions) may cause brief UI freeze during CSV generation
  - **Mitigation**: Add loading indicator, consider async generation with setTimeout

### Minimal Risk

- Unicode/encoding issues in Excel
  - **Mitigation**: Use UTF-8 BOM, test with international characters

## Success Metrics

### Functional

- All 7 tables have working export functionality
- Exported CSV opens correctly in Excel and Google Sheets
- Exported data matches visible table data (filtered/sorted)

### Quality

- 100% test coverage for export functions
- No reported bugs in first week after release
- Export completes in <500ms for typical datasets (<1000 rows)

### User Experience

- Export button is discoverable (positioned consistently)
- No user confusion about what data is exported
- CSV format is immediately usable without manual cleanup

## Critical Files for Implementation

- **src/lib/tableExports.ts** - Core export functions to be created; centralizes all table-to-CSV conversion logic with proper type safety and data formatting
- **src/lib/csvUtils.ts** - Existing CSV utilities to leverage; provides `escapeCsvValue` and `formatCsvRow` functions that ensure proper CSV formatting
- **src/components/workbench/WorkbenchTable.tsx** - Most complex table requiring export; demonstrates TanStack Table integration pattern with filtered/sorted data access
- **src/lib/reports.ts** - Reference pattern for CSV exports; shows established patterns for CSV generation and download triggers
- **src/pages/ReportsPage.tsx** - Reference implementation for download trigger; demonstrates blob creation and file download pattern to follow
