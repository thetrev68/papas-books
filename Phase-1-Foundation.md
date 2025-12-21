# Phase 1: Foundation & Authentication

**Status:** Completed ✅
**Completion Date:** December 20, 2025
**Dependencies:** None
**Estimated Complexity:** Medium-High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [PapasBooks.md](PapasBooks.md)

---

## Completion Summary
- ✅ **Supabase Integration**: Database schema applied with PostgreSQL tables, RLS policies, and triggers.
- ✅ **Authentication**: Email/password auth implemented via Supabase Auth.
- ✅ **Auto-Scaffolding**: Database triggers automatically create user profiles and initial booksets upon signup.
- ✅ **Multi-User Ready**: Bookset switching infrastructure implemented for CPA/multi-entity support.
- ✅ **App Shell**: Protected routing, global toast notifications, and navigation placeholders established.
- ✅ **Deployment**: Successfully deployed to Vercel.

---

## Overview

Phase 1 establishes the foundational infrastructure for Papa's Books as a **multi-user bookkeeping system**. This includes Supabase configuration, user authentication with password reset, bookset-based access control, and basic admin functionality.

**Key Principles:**

- Multi-user from day one: users can grant access to their books
- Bookset switching: CPAs can view multiple clients' books with single login
- Admin capabilities: designated users can manage system-level settings
- No styling in this phase: focus entirely on authentication flow, security, and access control

---

## Supabase Project Setup

**Project URL:** `https://hdoshdscvlhoqnqaftaq.supabase.co`

### PostgreSQL Database Structure

Design the database schema with multi-user access and future features in mind using PostgreSQL tables with foreign key relationships.

#### Table: `users`

Top-level user table for profile and authentication state.

```typescript
interface User {
  id: string;                    // Supabase Auth UID (uuid, primary key)
  email: string;
  displayName?: string;          // Friendly name (e.g., "John Smith, CPA")
  createdAt: timestamp;

  // System permissions
  isAdmin: boolean;              // Can access admin page, manage users

  // Bookset navigation
  activeBooksetId: string;       // Currently viewing this bookset's data
  ownBooksetId: string;          // User's personal bookset (always equals userId)

  // User preferences (applies across all booksets they access)
  preferences: {
    defaultView?: 'dashboard' | 'workbench' | 'import';  // Where to land after login
    autoRunRules: boolean;        // Run rules automatically on import (default: true)
    autoMarkReviewed: boolean;    // Mark as reviewed when rule matches (default: true)
  };

  // Audit metadata
  lastActive: timestamp;
  lastModifiedBy?: string;       // For multi-user audit trail (uuid, foreign key to users.id)
}
```

**Why these fields:**

- `activeBooksetId`: Tracks which client's books the user is currently viewing
- `ownBooksetId`: Every user has their own bookset, always equals their userId
- `isAdmin`: Enables admin page access without complex role hierarchy
- `displayName`: Better UX for multi-user scenarios (shows "John Smith" not "<john@example.com>")

#### Table: `booksets`

A bookset represents one set of financial books. By default, each user has one bookset (their own).

```typescript
interface Bookset {
  id: string;                    // uuid, primary key (typically equals the owner's userId)
  ownerId: string;               // uuid, foreign key to users.id - User who owns this bookset
  name: string;                  // "Smith Family Finances", "ABC Corp Books"

  createdAt: timestamp;
  updatedAt: timestamp;

  // Future: organizational metadata
  businessType?: 'personal' | 'sole_proprietor' | 'llc' | 'corporation';
  taxYear?: number;              // Primary tax year being tracked
}
```

**Why this collection:**

- Separates "who can log in" (users) from "whose books" (booksets)
- Enables future: one person managing multiple business entities
- Clean permission model: grant access to bookset, not individual accounts

#### Table: `access_grants`

Tracks who has access to a bookset and what they can do.

```typescript
interface AccessGrant {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  userId: string;                // uuid, foreign key to users.id - Who is being granted access
  grantedBy: string;             // uuid, foreign key to users.id - Who created this grant

  // Permissions
  role: 'owner' | 'editor' | 'viewer';
  // owner: full access (only one, the creator)
  // editor: can import, categorize, reconcile (typical bookkeeper)
  // viewer: read-only (CPA doing tax prep)

  // Metadata
  createdAt: timestamp;
  expiresAt?: timestamp;         // Optional: time-limited access
  revokedAt?: timestamp;         // Soft delete: track when access was removed
  revokedBy?: string;            // uuid, foreign key to users.id

  // Future: granular permissions
  canImport?: boolean;           // Override: viewer who can import
  canReconcile?: boolean;        // Override: editor who cannot reconcile
}
```

**Why this structure:**

- Owner automatically has implicit access (no grant needed for their own bookset)
- Multiple grants per bookset (owner can share with multiple CPAs/bookkeepers)
- Soft delete via `revokedAt` maintains audit trail
- `expiresAt`: Enables temporary access (e.g., "CPA access during tax season")

#### Table: `accounts`

```typescript
interface Account {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  name: string;                  // "Chase Checking", "Amex Blue"
  type: 'Asset' | 'Liability';   // Affects how balances are calculated
  openingBalance: number;        // Balance before first transaction (in cents)
  openingBalanceDate: timestamp; // The "day zero" for this account

  // CSV Import Configuration (Phase 3 - per account, not per bank!)
  csvMapping?: {
    dateColumn: string;          // "Date", "Transaction Date", "Posted Date"
    descriptionColumn: string;   // "Description", "Memo"
    amountColumn: string;        // "Amount"
    // OR for split debit/credit columns:
    debitColumn?: string;
    creditColumn?: string;

    dateFormat: string;          // "MM/DD/YYYY", "YYYY-MM-DD"
    hasHeaderRow: boolean;
    skipRows: number;            // How many rows to skip at top
    amountIsNegativeForExpenses: boolean;  // Sign convention
  };

  // Reconciliation tracking
  lastReconciledDate: timestamp | null;
  lastReconciledBalance: number;           // In cents

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  isArchived: boolean;           // Soft delete (hide from UI, keep data)

  // Future features
  bankConnectionId?: string;     // Future: link to Plaid/Teller integration
  notes?: string;                // User notes about this account
  color?: string;                // UI color coding
  institutionName?: string;      // "Chase", "American Express"

  // Audit trail
  createdBy: string;             // uuid, foreign key to users.id - userId who created this
  lastModifiedBy: string;        // uuid, foreign key to users.id - userId who last edited
  changeHistory?: jsonb;         // Future: track all changes as JSON array
}
```

**Why these changes:**

- `csvMapping`: **Per-account** CSV configuration (same bank, different formats!)
- Flexible mapping supports various CSV layouts from different institutions
- Sign convention flag handles banks that use negative for expenses vs. positive

#### Table: `categories`

```typescript
interface Category {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  name: string;                  // "Medical", "Groceries", "Office Supplies"

  // Tax reporting
  taxLineItem?: string;          // "Schedule C - Line 7", "Form 1040 - Medical"
  isTaxDeductible: boolean;      // Quick filter for tax prep

  // Organization
  parentCategoryId?: string;     // uuid, foreign key to categories.id - Hierarchical categories
  sortOrder: number;             // User-defined display order

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  isArchived: boolean;           // Soft delete

  // Future features
  color?: string;                // UI color coding
  icon?: string;                 // Icon identifier
  budgetAmount?: number;         // Monthly budget tracking (in cents)
  budgetPeriod?: 'monthly' | 'quarterly' | 'annual';

  // Audit trail
  createdBy: string;             // uuid, foreign key to users.id
  lastModifiedBy: string;        // uuid, foreign key to users.id
}
```

#### Table: `transactions`

```typescript
interface Transaction {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  accountId: string;             // uuid, foreign key to accounts.id

  // Core transaction data
  date: timestamp;               // Transaction date (not import date)
  payee: string;                 // Normalized vendor name (user editable)
  originalDescription: string;   // Raw bank description (immutable, for rules)
  amount: number;                // In cents. Negative = expense, Positive = income

  // Split transaction support
  isSplit: boolean;
  lines: jsonb;                  // Array of split lines stored as JSON
  // Structure: Array<{
  //   categoryId: string;        // uuid, reference to categories.id
  //   amount: number;            // In cents. Must sum to parent amount
  //   memo?: string;             // Optional note for this specific line
  // }>
  // Note: If isSplit=false, lines array has exactly 1 entry

  // Workflow state
  isReviewed: boolean;           // User has verified this transaction
  reconciled: boolean;           // Locked by reconciliation process
  reconciledDate?: timestamp;    // When it was reconciled

  // Import tracking
  sourceBatchId: string;         // UUID of the import batch (for undo)
  importDate: timestamp;         // When this was imported
  fingerprint: string;           // Deduplication hash (date + amount + description hash)

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;

  // Future features
  attachments?: jsonb;           // Receipt images stored as JSON array
  // Structure: Array<{
  //   id: string;
  //   fileName: string;
  //   storagePath: string;       // Supabase Storage path
  //   uploadedAt: timestamp;
  //   uploadedBy: string;        // uuid, reference to users.id
  // }>

  tags?: text[];                 // Flexible tagging ("reimbursable", "personal") - PostgreSQL array
  isRecurring?: boolean;         // Recurring transaction detection
  recurringGroupId?: string;     // Link related recurring transactions

  // Audit trail
  createdBy: string;             // uuid, foreign key to users.id
  lastModifiedBy: string;        // uuid, foreign key to users.id
  changeHistory?: jsonb;         // Track all changes as JSON array
}
```

#### Table: `rules`

```typescript
interface Rule {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id

  // Matching criteria
  keyword: string;               // Lowercase search string
  matchType: 'contains' | 'exact' | 'startsWith' | 'regex';
  caseSensitive: boolean;        // Usually false

  // Action to take
  targetCategoryId: string;      // uuid, foreign key to categories.id - Auto-assign this category
  suggestedPayee?: string;       // Also normalize payee name

  // Priority and control
  priority: number;              // Higher priority wins if multiple rules match
  isEnabled: boolean;            // Allow disabling without deleting

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  lastUsedAt?: timestamp;        // Track which rules are actually useful
  useCount: number;              // How many times this rule has matched

  // Future: Advanced conditions
  conditions?: jsonb;            // Store advanced conditions as JSON
  // Structure: {
  //   amountMin?: number;
  //   amountMax?: number;
  //   accountIds?: string[];     // Only apply to specific accounts
  //   dateRange?: {
  //     start: timestamp;
  //     end: timestamp;
  //   };
  // }

  // Audit trail
  createdBy: string;             // uuid, foreign key to users.id
  lastModifiedBy: string;        // uuid, foreign key to users.id
}
```

#### Table: `reconciliations`

```typescript
interface Reconciliation {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  accountId: string;             // uuid, foreign key to accounts.id

  // Reconciliation details
  statementDate: timestamp;      // Ending date on bank statement
  statementBalance: number;      // Bank's reported balance (in cents)
  calculatedBalance: number;     // Our computed balance (in cents)
  difference: number;            // statementBalance - calculatedBalance

  // Status
  status: 'in_progress' | 'balanced' | 'unbalanced';
  finalizedAt?: timestamp;       // When user clicked "Finalize"

  // Tracking
  transactionCount: number;      // How many transactions were included
  transactionIds: text[];        // All transactions locked by this reconciliation - PostgreSQL array

  // Metadata
  createdAt: timestamp;
  createdBy: string;             // uuid, foreign key to users.id

  // Notes and audit
  notes?: string;                // User explanation for discrepancies
  discrepancyResolution?: string; // How was the difference resolved
}
```

#### Table: `import_batches`

```typescript
interface ImportBatch {
  id: string;                    // uuid, primary key - Used as sourceBatchId in transactions
  booksetId: string;             // uuid, foreign key to booksets.id

  // Import details
  accountId: string;             // uuid, foreign key to accounts.id
  fileName: string;
  importedAt: timestamp;
  importedBy: string;            // uuid, foreign key to users.id

  // Results
  totalRows: number;
  importedCount: number;         // Successfully imported
  duplicateCount: number;        // Skipped as duplicates
  errorCount: number;            // Failed to parse

  // Undo support
  isUndone: boolean;             // If true, transactions from this batch should be hidden
  undoneAt?: timestamp;
  undoneBy?: string;             // uuid, foreign key to users.id

  // Metadata
  csvMappingSnapshot: jsonb;     // Copy of account.csvMapping at time of import
}
```

**Why this field:**

- `csvMappingSnapshot`: If user changes CSV mapping later, can still understand old imports

---

## Supabase Row Level Security (RLS) Policies

### Core Security Principles

1. **User Isolation:** Users can only access booksets they own or have grants for
2. **Authentication Required:** No unauthenticated reads or writes
3. **Immutable Audit Fields:** `createdBy`, `createdAt` cannot be changed after creation (enforced via triggers)
4. **Reconciliation Locks:** Reconciled transactions cannot be modified (enforced via check constraints)
5. **Permission Enforcement:** Viewers cannot write, editors can write (non-admin operations)

### RLS Helper Functions

Create these PostgreSQL functions to be used in RLS policies:

```sql
-- Check if user owns this bookset
CREATE OR REPLACE FUNCTION user_owns_bookset(bookset_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM booksets
    WHERE id = bookset_id
    AND ownerId = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access grant to this bookset (not revoked, not expired)
CREATE OR REPLACE FUNCTION user_has_access_grant(bookset_id uuid, min_role text DEFAULT 'viewer')
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM access_grants
    WHERE booksetId = bookset_id
    AND userId = auth.uid()
    AND revokedAt IS NULL
    AND (expiresAt IS NULL OR expiresAt > now())
    AND (
      min_role = 'viewer' OR
      (min_role = 'editor' AND role IN ('editor', 'owner')) OR
      (min_role = 'owner' AND role = 'owner')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can read this bookset (owner OR has grant)
CREATE OR REPLACE FUNCTION user_can_read_bookset(bookset_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can write to this bookset (owner OR editor+ grant)
CREATE OR REPLACE FUNCTION user_can_write_bookset(bookset_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'editor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND isAdmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies by Table

#### Table: `users`

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can create own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile (except isAdmin)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (OLD.isAdmin = NEW.isAdmin OR user_is_admin()));

-- Admins can update other users' admin status
CREATE POLICY "Admins can manage users"
  ON users FOR UPDATE
  USING (user_is_admin())
  WITH CHECK (user_is_admin());
```

#### Table: `booksets`

```sql
-- Enable RLS
ALTER TABLE booksets ENABLE ROW LEVEL SECURITY;

-- Users can read booksets they own or have access to
CREATE POLICY "Users can read accessible booksets"
  ON booksets FOR SELECT
  USING (user_can_read_bookset(id));

-- Users can create booksets they own
CREATE POLICY "Users can create own booksets"
  ON booksets FOR INSERT
  WITH CHECK (auth.uid() = ownerId);

-- Only owners can update their booksets
CREATE POLICY "Owners can update booksets"
  ON booksets FOR UPDATE
  USING (user_owns_bookset(id))
  WITH CHECK (user_owns_bookset(id));

-- No deletes allowed (use soft delete via archiving if needed)
```

#### Table: `access_grants`

```sql
-- Enable RLS
ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;

-- Users can read grants for booksets they have access to
CREATE POLICY "Users can read grants for accessible booksets"
  ON access_grants FOR SELECT
  USING (user_can_read_bookset(booksetId));

-- Only bookset owners can create grants
CREATE POLICY "Owners can create grants"
  ON access_grants FOR INSERT
  WITH CHECK (user_owns_bookset(booksetId));

-- Only bookset owners can update grants (revoke, etc.)
CREATE POLICY "Owners can update grants"
  ON access_grants FOR UPDATE
  USING (user_owns_bookset(booksetId))
  WITH CHECK (user_owns_bookset(booksetId));

-- No hard deletes - use revokedAt
```

#### Tables: `accounts`, `categories`, `rules`, `import_batches`

```sql
-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Read policy (same for all)
CREATE POLICY "Users can read from accessible booksets"
  ON accounts FOR SELECT
  USING (user_can_read_bookset(booksetId));

CREATE POLICY "Users can read from accessible booksets"
  ON categories FOR SELECT
  USING (user_can_read_bookset(booksetId));

CREATE POLICY "Users can read from accessible booksets"
  ON rules FOR SELECT
  USING (user_can_read_bookset(booksetId));

CREATE POLICY "Users can read from accessible booksets"
  ON import_batches FOR SELECT
  USING (user_can_read_bookset(booksetId));

-- Write policies (same for all - requires editor role)
CREATE POLICY "Editors can insert"
  ON accounts FOR INSERT
  WITH CHECK (user_can_write_bookset(booksetId));

CREATE POLICY "Editors can update"
  ON accounts FOR UPDATE
  USING (user_can_write_bookset(booksetId))
  WITH CHECK (user_can_write_bookset(booksetId));

-- Repeat for categories, rules, import_batches...
-- No DELETE policies - use soft delete flags
```

#### Table: `transactions`

```sql
-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Read policy
CREATE POLICY "Users can read transactions from accessible booksets"
  ON transactions FOR SELECT
  USING (user_can_read_bookset(booksetId));

-- Insert policy
CREATE POLICY "Editors can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (user_can_write_bookset(booksetId));

-- Update policy - CANNOT update reconciled transactions
CREATE POLICY "Editors can update unreconciled transactions"
  ON transactions FOR UPDATE
  USING (user_can_write_bookset(booksetId) AND reconciled = false)
  WITH CHECK (user_can_write_bookset(booksetId) AND reconciled = false);

-- No DELETE policy
```

#### Table: `reconciliations`

```sql
-- Enable RLS
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

-- Read policy
CREATE POLICY "Users can read reconciliations from accessible booksets"
  ON reconciliations FOR SELECT
  USING (user_can_read_bookset(booksetId));

-- Write policies
CREATE POLICY "Editors can insert reconciliations"
  ON reconciliations FOR INSERT
  WITH CHECK (user_can_write_bookset(booksetId));

CREATE POLICY "Editors can update reconciliations"
  ON reconciliations FOR UPDATE
  USING (user_can_write_bookset(booksetId))
  WITH CHECK (user_can_write_bookset(booksetId));

-- No DELETE policy
```

### Database Triggers for Audit Fields

Create triggers to enforce audit field immutability:

```sql
-- Trigger function to set createdBy and createdAt
CREATE OR REPLACE FUNCTION set_audit_fields_on_create()
RETURNS TRIGGER AS $$
BEGIN
  NEW.createdBy = auth.uid();
  NEW.createdAt = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to prevent modification of audit fields
CREATE OR REPLACE FUNCTION prevent_audit_field_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.createdBy != NEW.createdBy OR OLD.createdAt != NEW.createdAt THEN
    RAISE EXCEPTION 'Cannot modify createdBy or createdAt fields';
  END IF;
  NEW.lastModifiedBy = auth.uid();
  NEW.updatedAt = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to all tables with audit fields
-- Example for accounts table:
CREATE TRIGGER accounts_set_audit_on_create
  BEFORE INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields_on_create();

CREATE TRIGGER accounts_prevent_audit_changes
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_field_changes();

-- Repeat for all other tables: categories, transactions, rules, reconciliations, import_batches, booksets, access_grants
```

**Why these policies:**

- RLS enforces permissions at the database level, not just client code
- Helper functions make policies readable and maintainable
- `SECURITY DEFINER` allows functions to check tables despite RLS
- Soft deletes prevent accidental data loss
- Reconciled transaction lock enforced at database level
- Audit trail automatically maintained via triggers

---

## Authentication System

### Supabase Auth Configuration

**Providers:**

- Email/Password (Phase 1)
- Google OAuth (Future)

### Auth Context Setup

#### Function: `useAuth()`

**Purpose:** React hook that provides current user and auth methods.

**Returns:**

```typescript
{
  user: User | null;              // Current authenticated user (from PostgreSQL users table)
  supabaseUser: SupabaseUser | null;  // Raw Supabase Auth user
  loading: boolean;               // Still checking auth state
  error: Error | null;

  // Current bookset context
  activeBookset: Bookset | null;  // Currently viewing this bookset
  myBooksets: Bookset[];          // All booksets user has access to (own + granted)

  // Methods
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;  // Phase 1: password reset

  // Bookset switching
  switchBookset: (booksetId: string) => Promise<void>;

  // Permission checks
  canEdit: boolean;               // Can current user edit active bookset?
  canAdmin: boolean;             // Is current user system admin?
}
```

**Key Behavior:**

- On auth state change, fetch user document from PostgreSQL `users` table
- Load all booksets user has access to (own + access grants via SQL join)
- Set `activeBooksetId` to user's own bookset by default
- **Crucial:** User document and initial bookset creation handled by **Supabase Database Function** (trigger on `auth.users` insert)
- Password reset sends Supabase reset email

**Implementation concept:**

```typescript
// Client-side:
// 1. Create Supabase Auth user via supabase.auth.signUp()
// 2. Wait for auth state change (Database trigger creates user profile + bookset)
// 3. If user profile missing after timeout, show error (or retry)

// Server-side (Supabase Database Trigger):
// 1. Trigger on INSERT to auth.users
// 2. Create user record in public.users with isAdmin=false, ownBooksetId=userId
// 3. Create bookset record with ownerId=userId, name="[DisplayName]'s Books"

// On bookset switch:
// 1. Update user.activeBooksetId in PostgreSQL
// 2. All subsequent queries filter by activeBooksetId
```

#### Function: `requireAuth()`

**Purpose:** Hook that redirects unauthenticated users to login.

**Usage:**

```typescript
const user = requireAuth();  // Redirects to /login if not authenticated
```

#### Function: `requireAdmin()`

**Purpose:** Hook that checks if user is admin, redirects if not.

**Usage:**

```typescript
const user = requireAdmin();  // Redirects to /app/dashboard if not admin
```

---

## Application Routes

### Route Structure

```text
/ (public)
├── /login
├── /signup
├── /forgot-password          → NEW: Password reset page
└── (authenticated routes below)

/app (requires auth)
├── /app/dashboard          → Dashboard page
├── /app/settings           → Settings page (tabs: accounts, categories, rules, access)
├── /app/import             → Import page (CSV upload)
├── /app/workbench          → Workbench page (transaction grid)
├── /app/reconcile          → Reconciliation page
└── /app/reports            → Reports page
```

### Router Configuration

**Library:** React Router v6

#### Component: `<ProtectedRoute>`

**Purpose:** Wrapper that checks authentication before rendering children.

**Implementation concept:**

- Check `useAuth()` loading and user state
- If loading: show spinner
- If no user: redirect to `/login` with return URL
- If authenticated: render children

**Usage:**

```typescript
<Route path="/app/*" element={<ProtectedRoute />}>
  <Route path="dashboard" element={<DashboardPage />} />
  <Route path="settings" element={<SettingsPage />} />
  {/* etc */}
</Route>
```

### Navigation Component

#### Component: `<AppNav>`

**Purpose:** Basic navigation menu shown on all authenticated pages.

**Structure (unstyled in Phase 1):**

- Simple `<nav>` with `<Link>` elements to each page
- **NEW:** Bookset switcher dropdown
  - Lists all booksets user has access to (own + granted)
  - Shows current active bookset name
  - Clicking switches bookset (updates `activeBooksetId`)
- Display current user displayName or email
- "Sign Out" button

**Bookset Switcher Implementation:**

```typescript
// Simple HTML select in Phase 1
<select
  value={user.activeBooksetId}
  onChange={(e) => switchBookset(e.target.value)}
>
  {myBooksets.map(b => (
    <option key={b.id} value={b.id}>
      {b.name} {b.id === user.ownBooksetId ? '(Mine)' : '(Shared)'}
    </option>
  ))}
</select>
```

**No styling requirements:**

- Use native `<a>` or React Router `<Link>`
- No CSS classes needed
- Default browser styling is fine

---

## Page Structure (Shells Only)

Each page is just a skeleton in Phase 1. No functionality, just routing and placeholders.

### Page: `DashboardPage`

**Route:** `/app/dashboard`

**Content (Phase 1):**

- Header: "Dashboard - [Active Bookset Name]"
- Shows which bookset is active
- Placeholder text: "Account summaries will appear here in Phase 2+"

**Future (Phase 7):**

- Account balance cards
- Recent transaction preview
- Quick action buttons

### Page: `SettingsPage`

**Route:** `/app/settings`

**Content (Phase 1):**

- Header: "Settings - [Active Bookset Name]"
- Four tabs: "Accounts", "Categories", "Rules", "Access" (unstyled buttons)
- **NEW: Access tab** - Shows who has access to current bookset (if owner)
  - List of access grants
  - Placeholder: "Grant access functionality coming in Phase 2"
- Basic tab switching logic (show/hide content divs)
- Each tab shows placeholder: "Content coming in Phase 2/4"

**Tab Structure:**

```typescript
const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'rules' | 'access'>('accounts');

// Simple conditional rendering
{activeTab === 'accounts' && <div>Accounts content (Phase 2)</div>}
{activeTab === 'categories' && <div>Categories content (Phase 2)</div>}
{activeTab === 'rules' && <div>Rules content (Phase 4)</div>}
{activeTab === 'access' && <div>Access grants list (Phase 2)</div>}
```

### Page: `ImportPage`

**Route:** `/app/import`

**Content (Phase 1):**

- Header: "Import Transactions"
- Placeholder: "CSV upload will appear here in Phase 3"

### Page: `WorkbenchPage`

**Route:** `/app/workbench`

**Content (Phase 1):**

- Header: "Transaction Workbench"
- Placeholder: "Transaction grid will appear here in Phase 5"

### Page: `ReconcilePage`

**Route:** `/app/reconcile`

**Content (Phase 1):**

- Header: "Reconcile Account"
- Placeholder: "Reconciliation wizard will appear here in Phase 6"

### Page: `ReportsPage`

**Route:** `/app/reports`

**Content (Phase 1):**

- Header: "Reports"
- Placeholder: "Report generation will appear here in Phase 6"

### Page: `ForgotPasswordPage` (NEW)

**Route:** `/forgot-password`

**Content (Phase 1):**

- Header: "Reset Password"
- Email input field
- "Send Reset Email" button
- Uses Supabase `supabase.auth.resetPasswordForEmail()`
- Success message: "Check your email for reset link"

---

## Development Environment Setup

### Project Initialization

**Tool:** Vite + React + TypeScript

**Command:**

```bash
npm create vite@latest papas-books -- --template react-ts
cd papas-books
npm install
```

### Required Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.4.0",
    "vite": "^5.1.0",
    "vitest": "^1.3.0"
  }
}
```

**Note:** No Tailwind CSS or styling libraries in Phase 1.

### Environment Variables

**File:** `.env.local`

```bash
VITE_SUPABASE_URL=https://hdoshdscvlhoqnqaftaq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**File:** `.env.example` (committed to git)

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Note:** Get your `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public` key.

### Supabase Initialization

#### File: `src/lib/supabase/config.ts`

**Purpose:** Initialize Supabase client instance.

**Exports:**

- `supabase`: Supabase client instance (handles auth, database, storage)

**Implementation concept:**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Frontend Hosting with Vercel

### Deployment Setup

**Platform:** Vercel (free tier)

**Why Vercel:**

- Zero-config deployment for Vite/React apps
- Automatic deployments from Git
- Free SSL certificates
- Preview deployments for pull requests
- Environment variable management UI

### Deployment Steps

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Import your `papas-books` repository

2. **Configure Build Settings:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables:**
   - In Vercel Dashboard → Project Settings → Environment Variables
   - Add:
     - `VITE_SUPABASE_URL` = `https://hdoshdscvlhoqnqaftaq.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = (your anon key from Supabase)

4. **Deploy:**
   - Vercel auto-deploys on every push to `main`
   - Pull requests get preview URLs

### Architecture Overview

```text
┌─────────────────────────────┐
│   Vercel (Frontend Host)    │
│   - React/Vite SPA          │
│   - Auto SSL                │
│   - CDN Distribution        │
└──────────┬──────────────────┘
           │
           │ HTTPS API Calls
           ▼
┌─────────────────────────────┐
│   Supabase (Backend)        │
│   - PostgreSQL Database     │
│   - Row Level Security      │
│   - Authentication          │
│   - Storage (future)        │
└─────────────────────────────┘
```

**URL Structure:**

- Production: `https://papas-books.vercel.app` (or your custom domain)
- Supabase API: `https://hdoshdscvlhoqnqaftaq.supabase.co`

---

## DevOps & Quality Assurance

### Automated Checks (CI)

**Tools:** GitHub Actions, Husky, lint-staged

#### 1. Pre-commit Hooks (Husky)

- Run `eslint` on staged files
- Run `prettier` check on staged files
- Prevent commit if linting fails

#### 2. Continuous Integration (GitHub Actions)

- Trigger on push to `main` and all PRs
- Steps:
  1. `npm install`
  2. `npm run build` (Ensures no TS errors)
  3. `npm run test` (Runs Vitest suite)

### Global Error Handling (UX)

**Component:** `<GlobalToastProvider>`

**Purpose:** Display success/error messages to the user without `alert()`.

**Implementation (Phase 1):**

- Simple React Context API
- Renders a fixed `<div>` at top/bottom of screen
- Methods: `showError(message)`, `showSuccess(message)`
- No styling library needed: use inline styles for basic visibility (red/green background)

---

## Testing Requirements

### Unit Tests

**Framework:** Vitest

#### Test: Supabase configuration

**File:** `src/lib/supabase/config.test.ts`

**Assertions:**

- Supabase client initializes without error
- Client instance is defined
- Environment variables are loaded

#### Test: Auth flows

**Assertions:**

- User can sign up and user document + bookset created
- User can sign in
- User can reset password (email sent)

#### Test: Bookset switching

**Assertions:**

- User can switch between own bookset and granted bookset
- activeBooksetId updates correctly
- Cannot switch to bookset without access grant

#### Test: Row Level Security policies

**File:** `rls.test.ts` (use Supabase local development or test project)

**Assertions:**

- Unauthenticated users cannot read/write any data
- User can read their own bookset
- User can read bookset they have viewer grant for
- Viewer cannot write to bookset
- Editor can write to bookset
- User cannot read bookset without grant
- Only bookset owner can create access grants
- Audit fields are enforced on create/update via triggers

### Integration Tests

#### Test: Sign-up flow

**Assertions:**

- User can create account with email/password
- User document is created in PostgreSQL `users` table with default preferences
- Bookset document is created in `booksets` table with correct ownerId
- User is redirected to `/app/dashboard`
- `createdBy` and `createdAt` fields are set correctly by triggers

#### Test: Sign-in flow

**Assertions:**

- User can sign in with valid credentials
- User cannot sign in with invalid credentials
- Auth state persists across page refresh

#### Test: Protected routes

**Assertions:**

- Unauthenticated users redirected to `/login`
- After login, user redirected back to original destination
- Sign out redirects to login page

#### Test: Multi-user access

**Scenario:**

1. User A creates account (gets bookset A)
2. User B creates account (gets bookset B)
3. User A grants viewer access to User B for bookset A
4. User B can switch to bookset A and read data
5. User B cannot edit data in bookset A

### Manual Testing Checklist

- [ ] Create new account via sign-up form
- [ ] Sign out and sign back in
- [ ] Reset password and verify email received
- [ ] Create second account and grant access to first account
- [ ] Switch between booksets using dropdown
- [ ] Verify viewer cannot edit transactions
- [ ] Attempt to access `/app/dashboard` while logged out (should redirect)
- [ ] Navigate to all page routes using nav links
- [ ] Refresh page while authenticated (should stay logged in)
- [ ] Inspect Supabase database and verify bookset and user table structure matches schema
- [ ] Check browser console for errors
- [ ] Verify app is deployed to Vercel and accessible via URL

---

## Success Criteria

**Phase 1 is complete when:**

1. ✅ User can register, sign in, sign out, and reset password
2. ✅ Supabase Row Level Security (RLS) policies enforce bookset-based access control
3. ✅ Users can switch between their own and shared booksets
4. ✅ All page routes accessible via navigation (placeholder content)
5. ✅ Auth state persists across page refreshes
6. ✅ User document and bookset created automatically on sign-up via database trigger
7. ✅ Bookset switcher dropdown functional
8. ✅ RLS policies tested with Supabase local development or test project
9. ✅ Multi-user access verified (create two users, grant access, test permissions)
10. ✅ All environment variables properly configured (locally and in Vercel)
11. ✅ Build runs without errors (`npm run build`)
12. ✅ Tests pass (`npm run test`)
13. ✅ App deployed to Vercel successfully
14. ✅ Supabase database schema created with all tables, RLS policies, and triggers
15. ✅ `.env.local` is in `.gitignore` (secrets not committed)

---

## Notes for LLM-Assisted Development

### When implementing auth context

- Fetch all booksets user has access to on auth state change
- Use SQL JOIN to query `booksets` table:
  - Where `ownerId = userId` (own bookset)
  - OR where exists in `access_grants` with `userId = userId` AND `revokedAt IS NULL` (granted booksets)
- Cache bookset list to avoid refetching on every navigation
- Focus on clean separation: auth logic vs. UI rendering
- Use TypeScript generics for type safety on user object
- Consider loading states to prevent flash of unauthenticated content

### When implementing bookset switching

- Update `user.activeBooksetId` in PostgreSQL `users` table
- All data queries must filter by `booksetId = activeBooksetId`
- React Query should invalidate all cached data when switching booksets
- Use Supabase real-time subscriptions to listen for bookset data changes

### When writing RLS policies

- Test owner, editor, and viewer roles separately
- Verify access grants are checked correctly via helper functions
- Test expired grants (check `expiresAt < now()`)
- Test revoked grants (`revokedAt IS NOT NULL`)
- Test each policy using Supabase SQL Editor or local development setup
- Use PostgreSQL functions (`SECURITY DEFINER`) for reusable permission checks
- Remember: RLS policies are access control, not filters (fail closed)
- Test policies by running queries as different users (use `auth.uid()` override in tests)

### When setting up routes

- Use nested routes to avoid duplicating `<ProtectedRoute>` wrapper
- Keep page components simple in Phase 1 (just render placeholders)
- Route parameters will be added in later phases (e.g., `/app/account/:accountId`)

### Database schema extensibility

- Optional fields marked with `?` can be added in future phases
- All `createdAt`, `createdBy`, `lastModifiedBy` fields are required from day one and managed by triggers
- Use separate tables (not JSONB arrays) for collections that will grow unbounded
- Every table has a `booksetId` foreign key column (except `users` and `booksets`)
- `users` table is global (not bookset-scoped)
- `access_grants` table references both `booksetId` and `userId`
- Use PostgreSQL's JSONB type for flexible/nested data (e.g., `lines`, `attachments`, `conditions`)
- Use PostgreSQL array types (e.g., `text[]`) for simple lists (e.g., `tags`, `transactionIds`)

---

## Changes from Original Phase 1

### Migration from Firebase to Supabase

1. **Backend changed from Firebase to Supabase**
   - Firestore → PostgreSQL database
   - Firebase Auth → Supabase Auth
   - Security Rules → Row Level Security (RLS) policies
   - Cloud Functions → Database triggers

2. **Added Vercel for frontend hosting** - Separate from backend (Supabase only provides backend)

3. **Database structure changes:**
   - Collections → Tables with foreign keys
   - Subcollections → Separate tables with `booksetId` column
   - Nested objects → JSONB columns
   - Timestamp → PostgreSQL `timestamp` type
   - Arrays → PostgreSQL array types (`text[]`) or JSONB

4. **Architecture additions:**
   - `booksets` table - Separates users from financial data
   - `access_grants` table - Multi-user access control
   - Bookset switcher - CPA can switch between clients
   - Password reset flow
   - Per-account CSV mapping (not per-bank)
   - `displayName` in User table - Better multi-user UX
   - `isAdmin` flag - System admin permissions
   - RLS policies - Bookset-based access control enforced at database level
   - Database triggers - Automatic audit field management

---

## Next Phase Preview

**Phase 2** will implement:

- CRUD operations for accounts and categories
- Access grant management UI (grant/revoke access to bookset)
- Admin page user list and permission toggles
- Settings page "Access" tab with grant list
- Form validation using Zod schemas
- React Query for data fetching/caching

The multi-user database schema and auth system built in Phase 1 will not need changes.
