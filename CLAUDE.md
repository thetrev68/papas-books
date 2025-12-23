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
npm run test             # Run tests (Vitest)
npm run test:ui          # Run tests with interactive UI
npm run test:coverage    # Run tests with coverage report
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

- Manages authentication state via Supabase Auth
- Provides `activeBookset` and `myBooksets` for bookset switching
- Exposes `canEdit` and `canAdmin` permission flags
- Handles automatic user profile creation via database trigger

### CSV Import Pipeline

**Location**: `src/lib/import/`

The import flow is a multi-stage pipeline:

1. **Parser** (`parser.ts`): Uses PapaParse to validate CSV and extract rows
2. **Mapper** (`mapper.ts`): Maps CSV columns to transaction fields using account-specific `csv_mapping` configuration
3. **Fingerprint** (`fingerprint.ts`): Generates SHA-256 hash for duplicate detection
4. **Fuzzy Matcher** (`fuzzy-matcher.ts`): Suggests payee names based on historical patterns
5. **Reconciler** (`reconciler.ts`): Compares fingerprints against existing transactions to prevent duplicates

**Bank Profiles** (`bank-profiles.ts`): Pre-configured mappings for common banks to simplify CSV setup.

### Rules Engine

**Location**: `src/hooks/useApplyRules.ts`, `src/lib/supabase/rules.ts`

Rules are evaluated in **priority order** (higher priority = evaluated first):

- Each rule has a `keyword`, `match_type` (contains/exact/startsWith/regex), and target category
- Rules can optionally suggest a payee name
- The first matching rule wins (short-circuit evaluation)
- Rules track usage statistics (`use_count`, `last_used_at`)

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

**Location**: `src/pages/ReconcilePage.tsx`, `src/lib/reconciler.ts`

Reconciliation compares book balance against bank statement:

- Filters transactions by account and date range
- Calculates balance from `opening_balance` + sum of reconciled transactions
- Updates `last_reconciled_date` and `last_reconciled_balance` on account record

## Environment Setup

1. Create `.env.local` (see `.env.example`):

   ```text
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Initialize database by running `supabase/schema.sql` in Supabase SQL Editor

3. **Important**: Disable "Confirm Email" in Supabase Auth settings for local development

## Testing Patterns

- Tests use Vitest with jsdom environment (see `vitest.config.ts`)
- Test files are colocated with source files using `.test.ts` suffix
- Mock Supabase environment variables are set in `vitest.config.ts`
- Use `@testing-library/react` for component tests

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
