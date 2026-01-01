# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application

```bash
npm run dev              # Start development server (Vite)
npm run build            # Build for production (TypeScript + Vite)
npm run preview          # Preview production build locally
```

### Code Quality

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without writing
npm run lint:md          # Lint markdown files
npm run lint:md:fix      # Auto-fix markdown issues
```

### Testing

```bash
npm run test             # Run unit tests (Vitest)
npm run test:ui          # Run unit tests with interactive UI
npm run test:coverage    # Run unit tests with coverage report
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Run E2E tests in interactive mode
npm run test:e2e:report  # View E2E test HTML report
```

### Other Tools

```bash
npm run knip             # Find unused files, dependencies, and exports
```

## Architecture Overview

### Core Concept: Bookset Model

Papa's Books uses a **Bookset-centric** architecture instead of the traditional user-centric model:

- Every user owns a personal `Bookset` (created automatically on signup)
- Users can be granted access to other booksets via `access_grants` table
- ALL data (accounts, transactions, categories, rules, payees) is scoped to a `bookset_id`
- Row Level Security (RLS) enforces data isolation at the PostgreSQL level

**Key insight**: When querying any data table, you must filter by the current user's `activeBookset.id` (from `AuthContext`).

### Database Layer

**Location**: `supabase/schema.sql`

The database uses PostgreSQL with:

- **Row Level Security (RLS)**: All tables enforce RLS policies to ensure users can only access booksets they have permission for
- **Database Triggers**: Audit fields (`created_by`, `last_modified_by`, `updated_at`) are automatically set via PL/pgSQL triggers
- **Fingerprint-based Deduplication**: Transactions use SHA-256 fingerprints to prevent duplicate imports

**Important Tables**:

- `users` - User accounts with circular FK to `booksets` (via `active_bookset_id` and `own_bookset_id`)
- `booksets` - Independent sets of books (one per client/business entity)
- `access_grants` - Multi-user access control with roles (owner/editor/viewer)
- `accounts` - Bank/credit card accounts with CSV mapping configuration
- `transactions` - Financial transactions with split support (JSONB `lines` field)
- `categories` - Hierarchical categories with tax line item mapping
- `rules` - Pattern-based auto-categorization engine with priority system
- `payees` - Normalized payee names with alias matching

### Frontend Architecture

**Stack**: React 18 + TypeScript + Vite + React Router v6

**Key Directories**:

- `src/context/` - React Context providers (AuthContext manages bookset switching and user state)
- `src/hooks/` - React Query hooks for data fetching and mutations
- `src/lib/supabase/` - Supabase client functions (one file per table: `transactions.ts`, `accounts.ts`, etc.)
- `src/lib/import/` - CSV import pipeline (parser, mapper, reconciler, fingerprint, fuzzy-matcher)
- `src/components/` - React components organized by feature
- `src/pages/` - Top-level page components (routed in `main.tsx`)
- `src/types/` - TypeScript type definitions matching database schema

### State Management

**TanStack Query (React Query)** is used for all server state:

- Query keys follow pattern: `['<table>', booksetId, ...filters]`
- Example: `['transactions', booksetId]` or `['accounts', booksetId]`
- Mutations invalidate queries to trigger refetch
- See `src/lib/queryClient.ts` for configuration

**AuthContext** (`src/context/AuthContext.tsx`):

- Manages authentication state via Supabase Auth with `onAuthStateChange` listener
- Provides multi-state status: `initializing`, `authenticated`, `unauthenticated`, `error`
- Provides `activeBookset` and `myBooksets` for bookset switching
- Exposes `canEdit` (based on active bookset) and `canAdmin` (based on user.is_admin) permission flags
- Includes retry mechanism with timeouts for user data fetching
- Handles token refresh without re-fetching user data (performance optimization)
- Automatic user profile creation handled via database trigger

### CSV Import Pipeline

**Location**: `src/lib/import/`

The import flow is a multi-stage pipeline:

1. **Parser** (`parser.ts`): Uses PapaParse to validate CSV and extract rows
2. **Mapper** (`mapper.ts`): Maps CSV columns to transaction fields using account-specific `csv_mapping` configuration
3. **Fingerprint** (`fingerprint.ts`): Generates SHA-256 hash for duplicate detection
4. **Reconciler** (`reconciler.ts`):
   - Compares fingerprints against existing transactions to detect exact duplicates
   - Validates import dates are not in locked tax years
5. **Fuzzy Matcher** (`fuzzy-matcher.ts`): Detects near-duplicates based on date proximity and amount similarity

**Bank Profiles** (`bank-profiles.ts`): Pre-configured mappings for common banks to simplify CSV setup.

**Import Session** (`src/hooks/useImportSession.ts`): Orchestrates the entire import workflow with wizard-style steps (upload → mapping → review → importing → complete).

### Rules Engine

**Location**: `src/hooks/useApplyRules.ts`, `src/lib/rules/`, `src/lib/supabase/rules.ts`

Rules are evaluated in **priority order** (higher priority = evaluated first):

- Each rule has a `keyword`, `match_type` (contains/exact/startsWith/regex), and target category/payee
- Rules can set both `category_id` and `payee_id`
- The first matching rule wins (short-circuit evaluation)
- Rules track usage statistics (`use_count`, `last_used_at`)
- **Matcher** (`matcher.ts`): Evaluates rule match types against transaction descriptions
- **Applicator** (`applicator.ts`): Applies rules in batches with options for overriding reviewed transactions
- **Hook** (`useApplyRules.ts`): React hook that fetches transactions, applies rules, and invalidates cache

### Transaction Split Support

Transactions support **split categorization** via the `lines` JSONB field:

- `is_split` flag indicates whether transaction uses split lines
- Each split line has: `category_id`, `amount` (in cents), and optional `memo`
- Split amounts must sum to transaction total (validated client-side in `src/lib/splitCalculator.ts`)

### Workbench

**Location**: `src/pages/WorkbenchPage.tsx`, `src/components/workbench/`

The Workbench is the primary UI for reviewing and categorizing transactions:

- Uses TanStack Table with TanStack Virtual for efficient rendering of large datasets
- Supports inline editing of payee, category, and split lines
- Keyboard navigation (arrow keys, Enter, Escape) via `KeyboardHandler.tsx`
- Bulk operations: apply rules, mark reviewed, batch edits
- Real-time updates via React Query cache invalidation

### Reconciliation

**Location**: `src/pages/ReconcilePage.tsx`, `src/components/reconcile/`, `src/lib/reconciler.ts`

Reconciliation compares book balance against bank statement:

- **Setup Step**: Select account, date range, and enter statement ending balance
- **Workspace Step**: Toggle transactions as reconciled/unreconciled
- **Calculation** (`reconciler.ts`): Calculates `openingBalance + deposits + withdrawals` and compares to target
- **Completion**: Updates account's `last_reconciled_date` and `last_reconciled_balance`
- **Validation**: Must balance exactly (difference = 0) before completing

### Reports

**Location**: `src/pages/ReportsPage.tsx`, `src/lib/reports.ts`

Multiple report types for financial analysis:

- **Category Report**: Summarizes transactions by category with totals and counts
- **Tax Line Report**: Groups transactions by tax line items (e.g., Schedule C lines)
- **Quarterly Report**: Calculates income, expenses, and estimated taxes by quarter
- **Year Comparison**: Side-by-side comparison of category spending across years
- **CPA Export**: Detailed CSV export with all transaction details for tax professionals
- **Export Formats**: CSV downloads with proper formatting via `csvUtils.ts`

All reports support:

- Date range filtering
- Account filtering
- Split transaction handling (allocates split lines to their respective categories)
- Hierarchical category display (Parent: Child format)

### Tax Features

**Location**: `src/pages/SettingsPage.tsx` (Tax tab), `src/lib/supabase/taxYearLocks.ts`

Tax features support year-end preparation and compliance:

- **Tax Year Locks**: Lock past years to prevent accidental changes after filing
  - Locked years prevent transaction edits/deletions via database triggers
  - Import validation rejects transactions in locked years
  - Lock/unlock via settings with database RPC functions
- **Tax Line Items**: Categories can map to tax form line items (e.g., Schedule C Line 8)
  - `tax_line_item` field on categories table
  - Used for generating tax-ready reports (see Reports section above)

### Settings & Multi-User Access

**Location**: `src/pages/SettingsPage.tsx`, `src/components/settings/`, `src/lib/supabase/accessGrants.ts`

Settings page provides tabs for managing bookset configuration:

- **Accounts Tab**: Manage bank/credit card accounts and CSV import mappings
- **Categories Tab**: Create/edit hierarchical categories with tax line item assignments
- **Payees Tab**: Manage normalized payee names with default categories
- **Tax Tab**: Lock/unlock tax years to prevent accidental changes
- **Access Tab**: Grant/revoke user access with role-based permissions
  - **Owner**: Full control (can delete bookset, manage access)
  - **Editor**: Can add/edit transactions and settings (most CPA use cases)
  - **Viewer**: Read-only access
  - Email-based invitations managed via `access_grants` table

## Environment Setup

1. Create `.env.local` (see `.env.example`):

   ```text
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Initialize database by running `supabase/schema.sql` in Supabase SQL Editor

3. **Important**: Disable "Confirm Email" in Supabase Auth settings for local development

## Testing Patterns

### Unit Tests

- **Test Framework**: Vitest with jsdom environment (see `vitest.config.ts`)
- **Test Files**: 34 test files colocated with source files using `.test.ts` or `.test.tsx` suffix
- **Coverage**: 97%+ code coverage (lines, functions, statements)
- **Mocking**: Mock Supabase environment variables set in `vitest.config.ts`
- **Component Testing**: Use `@testing-library/react` for component tests
- **Windows Note**: Coverage tools have compatibility issues on Windows; run in WSL for accurate metrics

### E2E Tests

- **Test Framework**: Playwright with TypeScript
- **Test Files**: 5 E2E tests in `e2e/` directory (`.spec.ts` files)
- **Coverage**: Critical user workflows (import, workbench, reconciliation, rules, accessibility)
- **Runs in**: CI/CD pipeline on every PR

## Common Patterns

### Querying Data with Bookset Scope

```typescript
const { data } = useQuery({
  queryKey: ['transactions', booksetId],
  queryFn: () => fetchTransactions(booksetId),
});
```

### Mutations with Cache Invalidation

```typescript
const mutation = useMutation({
  mutationFn: (data) => updateTransaction(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
  },
});
```

### Accessing Current Bookset

```typescript
import { useAuth } from '../context/AuthContext';

const { activeBookset } = useAuth();
// Always use activeBookset.id when querying bookset-scoped data
```

### Working with Amounts

All monetary values are stored as **integers in cents**:

- Display: Divide by 100 and format with `toFixed(2)`
- Input: Multiply by 100 and round to nearest integer
- Never use floating-point arithmetic for currency calculations

## Key Constraints

- All table writes must include `bookset_id` (enforced by RLS)
- Transaction fingerprints must be unique per account (prevents duplicates)
- Split line amounts must sum to transaction total
- Category hierarchy enforced via `parent_category_id` (optional)
- CSV mappings are stored as JSONB on account records

## Database Triggers

**Important**: Do NOT manually set these fields in application code:

- `created_by` - Set by trigger on INSERT
- `last_modified_by` - Set by trigger on UPDATE
- `updated_at` - Set by trigger on UPDATE

The application relies on PostgreSQL triggers to manage audit fields. Setting them manually will cause inconsistencies.
