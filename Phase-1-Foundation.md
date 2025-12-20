# Phase 1: Foundation & Authentication

**Status:** Planning
**Dependencies:** None
**Estimated Complexity:** Medium-High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [PapasBooks.md](PapasBooks.md)

---

## Overview

Phase 1 establishes the foundational infrastructure for Papa's Books as a **multi-user bookkeeping system**. This includes Firebase configuration, user authentication with password reset, bookset-based access control, and basic admin functionality.

**Key Principles:**
- Multi-user from day one: users can grant access to their books
- Bookset switching: CPAs can view multiple clients' books with single login
- Admin capabilities: designated users can manage system-level settings
- No styling in this phase: focus entirely on authentication flow, security, and access control

---

## Firebase Project Setup

### Firestore Database Structure

Design the database schema with multi-user access and future features in mind.

#### Collection: `users/{userId}`

Top-level user document for profile and authentication state.

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName?: string;          // Friendly name (e.g., "John Smith, CPA")
  createdAt: Timestamp;

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
  lastActive: Timestamp;
  lastModifiedBy?: string;       // For multi-user audit trail
}
```

**Why these fields:**
- `activeBooksetId`: Tracks which client's books the user is currently viewing
- `ownBooksetId`: Every user has their own bookset, always equals their userId
- `isAdmin`: Enables admin page access without complex role hierarchy
- `displayName`: Better UX for multi-user scenarios (shows "John Smith" not "john@example.com")

#### Collection: `booksets/{booksetId}`

A bookset represents one set of financial books. By default, each user has one bookset (their own).

```typescript
interface Bookset {
  id: string;                    // Typically equals the owner's userId
  ownerId: string;               // User who owns this bookset
  name: string;                  // "Smith Family Finances", "ABC Corp Books"

  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Future: organizational metadata
  businessType?: 'personal' | 'sole_proprietor' | 'llc' | 'corporation';
  taxYear?: number;              // Primary tax year being tracked
}
```

**Why this collection:**
- Separates "who can log in" (users) from "whose books" (booksets)
- Enables future: one person managing multiple business entities
- Clean permission model: grant access to bookset, not individual accounts

#### Subcollection: `booksets/{booksetId}/accessGrants/{grantId}`

Tracks who has access to a bookset and what they can do.

```typescript
interface AccessGrant {
  id: string;                    // Auto-generated
  booksetId: string;             // Which bookset this grant is for
  userId: string;                // Who is being granted access
  grantedBy: string;             // Who created this grant

  // Permissions
  role: 'owner' | 'editor' | 'viewer';
  // owner: full access (only one, the creator)
  // editor: can import, categorize, reconcile (typical bookkeeper)
  // viewer: read-only (CPA doing tax prep)

  // Metadata
  createdAt: Timestamp;
  expiresAt?: Timestamp;         // Optional: time-limited access
  revokedAt?: Timestamp;         // Soft delete: track when access was removed
  revokedBy?: string;

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

#### Subcollection: `booksets/{booksetId}/accounts/{accountId}`

```typescript
interface Account {
  id: string;
  name: string;                  // "Chase Checking", "Amex Blue"
  type: 'Asset' | 'Liability';   // Affects how balances are calculated
  openingBalance: number;        // Balance before first transaction (in cents)
  openingBalanceDate: Timestamp; // The "day zero" for this account

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
  lastReconciledDate: Timestamp | null;
  lastReconciledBalance: number;           // In cents

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;           // Soft delete (hide from UI, keep data)

  // Future features
  bankConnectionId?: string;     // Future: link to Plaid/Teller integration
  notes?: string;                // User notes about this account
  color?: string;                // UI color coding
  institutionName?: string;      // "Chase", "American Express"

  // Audit trail
  createdBy: string;             // userId who created this
  lastModifiedBy: string;        // userId who last edited
  changeHistory?: Array<{        // Future: track all changes
    timestamp: Timestamp;
    userId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}
```

**Why these changes:**
- `csvMapping`: **Per-account** CSV configuration (same bank, different formats!)
- Flexible mapping supports various CSV layouts from different institutions
- Sign convention flag handles banks that use negative for expenses vs. positive

#### Subcollection: `booksets/{booksetId}/categories/{categoryId}`

```typescript
interface Category {
  id: string;
  name: string;                  // "Medical", "Groceries", "Office Supplies"

  // Tax reporting
  taxLineItem?: string;          // "Schedule C - Line 7", "Form 1040 - Medical"
  isTaxDeductible: boolean;      // Quick filter for tax prep

  // Organization
  parentCategoryId?: string;     // Hierarchical categories
  sortOrder: number;             // User-defined display order

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;           // Soft delete

  // Future features
  color?: string;                // UI color coding
  icon?: string;                 // Icon identifier
  budgetAmount?: number;         // Monthly budget tracking (in cents)
  budgetPeriod?: 'monthly' | 'quarterly' | 'annual';

  // Audit trail
  createdBy: string;
  lastModifiedBy: string;
}
```

#### Subcollection: `booksets/{booksetId}/transactions/{transactionId}`

```typescript
interface Transaction {
  id: string;
  accountId: string;             // Reference to accounts collection

  // Core transaction data
  date: Timestamp;               // Transaction date (not import date)
  payee: string;                 // Normalized vendor name (user editable)
  originalDescription: string;   // Raw bank description (immutable, for rules)
  amount: number;                // In cents. Negative = expense, Positive = income

  // Split transaction support
  isSplit: boolean;
  lines: Array<{
    categoryId: string;          // Reference to categories collection
    amount: number;              // In cents. Must sum to parent amount
    memo?: string;               // Optional note for this specific line
  }>;
  // Note: If isSplit=false, lines array has exactly 1 entry

  // Workflow state
  isReviewed: boolean;           // User has verified this transaction
  reconciled: boolean;           // Locked by reconciliation process
  reconciledDate?: Timestamp;    // When it was reconciled

  // Import tracking
  sourceBatchId: string;         // UUID of the import batch (for undo)
  importDate: Timestamp;         // When this was imported
  fingerprint: string;           // Deduplication hash (date + amount + description hash)

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Future features
  attachments?: Array<{          // Receipt images
    id: string;
    fileName: string;
    storagePath: string;         // Firebase Storage path
    uploadedAt: Timestamp;
    uploadedBy: string;
  }>;

  tags?: string[];               // Flexible tagging ("reimbursable", "personal")
  isRecurring?: boolean;         // Recurring transaction detection
  recurringGroupId?: string;     // Link related recurring transactions

  // Audit trail
  createdBy: string;
  lastModifiedBy: string;
  changeHistory?: Array<{
    timestamp: Timestamp;
    userId: string;
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;             // User can explain why they changed it
  }>;
}
```

#### Subcollection: `booksets/{booksetId}/rules/{ruleId}`

```typescript
interface Rule {
  id: string;

  // Matching criteria
  keyword: string;               // Lowercase search string
  matchType: 'contains' | 'exact' | 'startsWith' | 'regex';
  caseSensitive: boolean;        // Usually false

  // Action to take
  targetCategoryId: string;      // Auto-assign this category
  suggestedPayee?: string;       // Also normalize payee name

  // Priority and control
  priority: number;              // Higher priority wins if multiple rules match
  isEnabled: boolean;            // Allow disabling without deleting

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastUsedAt?: Timestamp;        // Track which rules are actually useful
  useCount: number;              // How many times this rule has matched

  // Future: Advanced conditions
  conditions?: {
    amountMin?: number;
    amountMax?: number;
    accountIds?: string[];       // Only apply to specific accounts
    dateRange?: {
      start: Timestamp;
      end: Timestamp;
    };
  };

  // Audit trail
  createdBy: string;
  lastModifiedBy: string;
}
```

#### Subcollection: `booksets/{booksetId}/reconciliations/{reconciliationId}`

```typescript
interface Reconciliation {
  id: string;
  accountId: string;

  // Reconciliation details
  statementDate: Timestamp;      // Ending date on bank statement
  statementBalance: number;      // Bank's reported balance (in cents)
  calculatedBalance: number;     // Our computed balance (in cents)
  difference: number;            // statementBalance - calculatedBalance

  // Status
  status: 'in_progress' | 'balanced' | 'unbalanced';
  finalizedAt?: Timestamp;       // When user clicked "Finalize"

  // Tracking
  transactionCount: number;      // How many transactions were included
  transactionIds: string[];      // All transactions locked by this reconciliation

  // Metadata
  createdAt: Timestamp;
  createdBy: string;

  // Notes and audit
  notes?: string;                // User explanation for discrepancies
  discrepancyResolution?: string; // How was the difference resolved
}
```

#### Subcollection: `booksets/{booksetId}/importBatches/{batchId}`

```typescript
interface ImportBatch {
  id: string;                    // Used as sourceBatchId in transactions

  // Import details
  accountId: string;
  fileName: string;
  importedAt: Timestamp;
  importedBy: string;

  // Results
  totalRows: number;
  importedCount: number;         // Successfully imported
  duplicateCount: number;        // Skipped as duplicates
  errorCount: number;            // Failed to parse

  // Undo support
  isUndone: boolean;             // If true, transactions from this batch should be hidden
  undoneAt?: Timestamp;
  undoneBy?: string;

  // Metadata
  csvMappingSnapshot: object;    // Copy of account.csvMapping at time of import
}
```

**Why this field:**

- `csvMappingSnapshot`: If user changes CSV mapping later, can still understand old imports

---

## Firebase Security Rules

**File:** `firestore.rules`

### Core Security Principles

1. **User Isolation:** Users can only access booksets they own or have grants for
2. **Authentication Required:** No unauthenticated reads or writes
3. **Immutable Audit Fields:** `createdBy`, `createdAt` cannot be changed after creation
4. **Reconciliation Locks:** Reconciled transactions cannot be modified
5. **Permission Enforcement:** Viewers cannot write, editors can write (non-admin operations)

### Rule Helper Functions

```javascript
// Check if request is authenticated
function isSignedIn() {
  return request.auth != null;
}

// Check if user is system admin
function isAdmin() {
  return isSignedIn()
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}

// Check if user owns this bookset
function isBooksetOwner(booksetId) {
  return isSignedIn()
      && get(/databases/$(database)/documents/booksets/$(booksetId)).data.ownerId == request.auth.uid;
}

// Check if user has any access grant to this bookset (not revoked, not expired)
function hasAccessGrant(booksetId, minRole) {
  return exists(/databases/$(database)/documents/booksets/$(booksetId)/accessGrants/$(request.auth.uid))
      && get(/databases/$(database)/documents/booksets/$(booksetId)/accessGrants/$(request.auth.uid)).data.revokedAt == null;
}

// Check if user can read this bookset (owner OR has grant)
function canReadBookset(booksetId) {
  return isBooksetOwner(booksetId) || hasAccessGrant(booksetId, 'viewer');
}

// Check if user can write to this bookset (owner OR editor/owner grant)
function canWriteBookset(booksetId) {
  let grant = get(/databases/$(database)/documents/booksets/$(booksetId)/accessGrants/$(request.auth.uid)).data;
  return isBooksetOwner(booksetId)
      || (hasAccessGrant(booksetId, 'editor') && grant.role in ['editor', 'owner']);
}

// Audit field validation
function hasValidAuditFieldsOnCreate() {
  return request.resource.data.createdBy == request.auth.uid
      && request.resource.data.createdAt == request.time;
}

function auditFieldsUnchanged() {
  return request.resource.data.createdBy == resource.data.createdBy
      && request.resource.data.createdAt == resource.data.createdAt;
}

function hasValidModifiedBy() {
  return request.resource.data.lastModifiedBy == request.auth.uid;
}

// Check if transaction is locked
function isReconciled() {
  return resource.data.reconciled == true;
}
```

### Security Rules Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User documents - users can read/update their own
    match /users/{userId} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && request.auth.uid == userId;
      // Only admins can set isAdmin flag
      allow update: if isAdmin() && request.auth.uid != userId;
    }

    // Bookset documents
    match /booksets/{booksetId} {
      allow read: if canReadBookset(booksetId);
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isBooksetOwner(booksetId);
    }

    // Access grants subcollection
    match /booksets/{booksetId}/accessGrants/{grantId} {
      allow read: if canReadBookset(booksetId);
      allow create: if isBooksetOwner(booksetId);
      allow update: if isBooksetOwner(booksetId);
      allow delete: if false;  // Use revokedAt instead
    }

    // Accounts subcollection
    match /booksets/{booksetId}/accounts/{accountId} {
      allow read: if canReadBookset(booksetId);
      allow create, update: if canWriteBookset(booksetId);
      allow delete: if false;  // Use isArchived instead
    }

    // Categories subcollection
    match /booksets/{booksetId}/categories/{categoryId} {
      allow read: if canReadBookset(booksetId);
      allow create, update: if canWriteBookset(booksetId);
      allow delete: if false;
    }

    // Transactions subcollection
    match /booksets/{booksetId}/transactions/{transactionId} {
      allow read: if canReadBookset(booksetId);
      allow create: if canWriteBookset(booksetId);
      allow update: if canWriteBookset(booksetId) && !isReconciled();
      allow delete: if false;
    }

    // Rules subcollection
    match /booksets/{booksetId}/rules/{ruleId} {
      allow read: if canReadBookset(booksetId);
      allow create, update: if canWriteBookset(booksetId);
      allow delete: if false;
    }

    // Reconciliations subcollection
    match /booksets/{booksetId}/reconciliations/{reconciliationId} {
      allow read: if canReadBookset(booksetId);
      allow create, update: if canWriteBookset(booksetId);
      allow delete: if false;
    }

    // Import batches subcollection
    match /booksets/{booksetId}/importBatches/{batchId} {
      allow read: if canReadBookset(booksetId);
      allow create, update: if canWriteBookset(booksetId);
      allow delete: if false;
    }
  }
}
```

**Why these rules:**

- `allow delete: if false`: Prevent accidental data loss, use soft delete flags instead
- `!isReconciled()`: Enforces business rule at database level
- Audit fields validated at database level, not just in client code
- Viewers can read but not write
- Only bookset owner can grant/revoke access

---

## Authentication System

### Firebase Auth Configuration

**Providers:**

- Email/Password (Phase 1)
- Google OAuth (Future)

### Auth Context Setup

#### Function: `useAuth()`

**Purpose:** React hook that provides current user and auth methods.

**Returns:**

```typescript
{
  user: User | null;              // Current authenticated user (from Firestore)
  firebaseUser: FirebaseUser | null;  // Raw Firebase Auth user
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

- On auth state change, fetch user document from Firestore
- Load all booksets user has access to (own + access grants)
- Set `activeBooksetId` to user's own bookset by default
- Automatically creates user document and bookset on first sign-up
- Password reset sends Firebase reset email

**Implementation concept:**

```typescript
// On user creation (sign-up):
// 1. Create Firebase Auth user
// 2. Create user document with isAdmin=false, ownBooksetId=userId
// 3. Create bookset document with ownerId=userId, name="[DisplayName]'s Books"
// 4. Set activeBooksetId = ownBooksetId

// On bookset switch:
// 1. Update user.activeBooksetId in Firestore
// 2. All subsequent queries use activeBooksetId in path
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
├── /app/reports            → Reports page
└── /app/admin              → NEW: Admin page (requires isAdmin)
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
- "Admin" link (only if `user.isAdmin`)
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

### Page: `AdminPage` (NEW)

**Route:** `/app/admin`

**Protected:** Requires `isAdmin === true`

**Content (Phase 1):**

- Header: "System Administration"
- Section: "User Management"
  - Placeholder: "List all users here"
  - Placeholder: "Toggle admin status for users"
- Section: "System Stats"
  - Placeholder: "Total users, total booksets, etc."

**Why this page:**

- Admins need to be able to promote other users to admin
- Future: system-wide settings, user support tools

### Page: `ForgotPasswordPage` (NEW)

**Route:** `/forgot-password`

**Content (Phase 1):**

- Header: "Reset Password"
- Email input field
- "Send Reset Email" button
- Uses Firebase `sendPasswordResetEmail()`
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
    "firebase": "^10.8.0",
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
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**File:** `.env.example` (committed to git)

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Firebase Initialization

#### File: `src/lib/firebase/config.ts`

**Purpose:** Initialize Firebase app instance.

**Exports:**

- `app`: Firebase app instance
- `auth`: Firebase Auth instance
- `db`: Firestore instance

**Implementation concept:**

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // ... other config
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

---

## Testing Requirements

### Unit Tests

**Framework:** Vitest

#### Test: Firebase configuration

**File:** `src/lib/firebase/config.test.ts`

**Assertions:**

- Firebase app initializes without error
- Auth and Firestore instances are defined
- Environment variables are loaded

#### Test: Auth flows

**Assertions:**

- User can sign up and user document + bookset created
- User can sign in
- User can reset password (email sent)
- Admin user can access admin page
- Non-admin user redirected from admin page

#### Test: Bookset switching

**Assertions:**

- User can switch between own bookset and granted bookset
- activeBooksetId updates correctly
- Cannot switch to bookset without access grant

#### Test: Security rules (Firebase emulator)

**File:** `firestore.rules.test.ts` (use Firebase emulator)

**Assertions:**

- Unauthenticated users cannot read/write any data
- User can read their own bookset
- User can read bookset they have viewer grant for
- Viewer cannot write to bookset
- Editor can write to bookset
- User cannot read bookset without grant
- Only bookset owner can create access grants
- Audit fields are enforced on create/update

### Integration Tests

#### Test: Sign-up flow

**Assertions:**

- User can create account with email/password
- User document is created in Firestore with default preferences
- Bookset document is created with correct ownerId
- User is redirected to `/app/dashboard`
- `createdBy` and `createdAt` fields are set correctly

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
- [ ] Create admin user and access admin page
- [ ] Verify non-admin cannot access admin page
- [ ] Attempt to access `/app/dashboard` while logged out (should redirect)
- [ ] Navigate to all page routes using nav links
- [ ] Refresh page while authenticated (should stay logged in)
- [ ] Inspect Firestore and verify bookset and user document structure matches schema
- [ ] Check browser console for errors

---

## Success Criteria

**Phase 1 is complete when:**

1. ✅ User can register, sign in, sign out, and reset password
2. ✅ Firebase Security Rules enforce bookset-based access control
3. ✅ Users can switch between their own and shared booksets
4. ✅ Admin users can access admin page
5. ✅ All page routes accessible via navigation (placeholder content)
6. ✅ Auth state persists across page refreshes
7. ✅ User document and bookset created automatically on sign-up
8. ✅ Bookset switcher dropdown functional
9. ✅ Security rules tested in Firebase emulator
10. ✅ Multi-user access verified (create two users, grant access, test permissions)
11. ✅ All environment variables properly configured
12. ✅ Build runs without errors (`npm run build`)
13. ✅ Tests pass (`npm run test`)
14. ✅ Firebase emulator can run locally for development
15. ✅ `.env.local` is in `.gitignore` (secrets not committed)

---

## Notes for LLM-Assisted Development

### When implementing auth context

- Fetch all booksets user has access to on auth state change
- Query `booksets` collection where `ownerId == userId` (own bookset)
- Query `accessGrants` subcollections across all booksets where `userId == userId` (granted booksets)
- Cache bookset list to avoid refetching on every navigation
- Focus on clean separation: auth logic vs. UI rendering
- Use TypeScript generics for type safety on user object
- Consider loading states to prevent flash of unauthenticated content

### When implementing bookset switching

- Update user.activeBooksetId in Firestore
- All data queries must include activeBooksetId in path: `booksets/{activeBooksetId}/transactions`
- React Query should invalidate all cached data when switching booksets

### When writing security rules

- Test owner, editor, and viewer roles separately
- Verify access grants are checked correctly
- Test expired grants (future: check `expiresAt < now()`)
- Test revoked grants (`revokedAt != null`)
- Test each rule in Firebase emulator before deploying
- Use helper functions for readability (defined at top of rules file)
- Remember: rules are not filters, they are access control (fail closed)

### When setting up routes

- Use nested routes to avoid duplicating `<ProtectedRoute>` wrapper
- Keep page components simple in Phase 1 (just render placeholders)
- Route parameters will be added in later phases (e.g., `/app/account/:accountId`)

### Database schema extensibility

- Optional fields marked with `?` can be added in future phases
- All `createdAt`, `createdBy`, `lastModifiedBy` fields are required from day one
- Use subcollections (not embedded arrays) for collections that will grow unbounded
- Every subcollection under `booksets/{booksetId}/` is automatically scoped
- Users table is global (not under booksets)
- AccessGrants is under booksets (each bookset has its own grants)

---

## Changes from Original Phase 1

1. **Added `booksets` collection** - Separates users from financial data
2. **Added `accessGrants` subcollection** - Multi-user access control
3. **Added bookset switcher** - CPA can switch between clients
4. **Added admin page** - System admin functionality
5. **Added password reset** - Forgot password flow
6. **Changed Account.csvMapping** - Per-account (not per-bank) CSV format definitions
7. **Updated all subcollections** - Now under `booksets/{booksetId}/` instead of `users/{userId}/`
8. **Added `displayName` to User** - Better multi-user UX
9. **Added `isAdmin` flag** - System admin permissions
10. **Updated security rules** - Bookset-based access control

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
