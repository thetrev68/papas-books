# Phase 2: Account & Category Management

**Status:** Not Started
**Dependencies:** Phase 1 (Foundation & Authentication)
**Estimated Complexity:** Medium
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-1-Foundation.md](Phase-1-Foundation.md)

---

## Overview

Phase 2 builds on the authentication foundation from Phase 1 to enable users to define their financial structure. This includes creating and managing accounts (checking, credit cards, etc.) and categories (tax-deductible expenses, income types, etc.).

**Key Principles:**

- Bare-minimum UI: Native HTML forms, tables, and buttons
- No styling in this phase: Focus entirely on CRUD operations and data integrity
- Business logic separated from UI: Testable functions in `/src/lib/`
- Real-time updates via Supabase subscriptions
- Proper validation using Zod schemas
- Multi-user access enforced through RLS policies (already configured in Phase 1)

---

## Database Schema (Already Created in Phase 1)

The `accounts` and `categories` tables were defined in Phase 1. This phase implements the UI and business logic to interact with them.

### Reminder: `accounts` table structure

```typescript
interface Account {
  id: string;                    // uuid, primary key
  booksetId: string;             // uuid, foreign key to booksets.id
  name: string;                  // "Chase Checking", "Amex Blue"
  type: 'Asset' | 'Liability';   // Affects how balances are calculated
  openingBalance: number;        // Balance before first transaction (in cents)
  openingBalanceDate: timestamp; // The "day zero" for this account

  // Fields used in later phases:
  csvMapping?: {...};            // Phase 3
  lastReconciledDate: timestamp | null;
  lastReconciledBalance: number;

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  isArchived: boolean;           // Soft delete

  // Audit trail (set by triggers)
  createdBy: string;             // uuid, foreign key to users.id
  lastModifiedBy: string;        // uuid, foreign key to users.id
}
```

### Reminder: `categories` table structure

```typescript
interface Category {
  id: string; // uuid, primary key
  booksetId: string; // uuid, foreign key to booksets.id
  name: string; // "Medical", "Groceries", "Office Supplies"

  // Tax reporting
  taxLineItem?: string; // "Schedule C - Line 7", "Form 1040 - Medical"
  isTaxDeductible: boolean; // Quick filter for tax prep

  // Organization
  parentCategoryId?: string; // uuid, foreign key to categories.id
  sortOrder: number; // User-defined display order

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  isArchived: boolean; // Soft delete

  // Audit trail (set by triggers)
  createdBy: string; // uuid, foreign key to users.id
  lastModifiedBy: string; // uuid, foreign key to users.id
}
```

**Important Notes:**

- Both tables already have RLS policies from Phase 1
- `booksetId` ensures data isolation between users/booksets
- `isArchived` allows soft deletes (hide from UI, keep data)
- Audit fields (`createdBy`, `createdAt`, `lastModifiedBy`, `updatedAt`) are managed by database triggers
- `openingBalance` stored in cents to avoid floating-point issues

---

## React Query Integration

### Purpose

React Query (TanStack Query) provides:

- Automatic caching of Supabase data
- Background refetching
- Optimistic updates
- Simplified loading/error states
- Integration with Supabase real-time subscriptions

### Installation

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### Setup: QueryClient Configuration

#### File: `src/lib/queryClient.ts`

**Purpose:** Configure React Query with sensible defaults.

**Exports:**

- `queryClient`: Singleton QueryClient instance

**Configuration:**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

**Why these settings:**

- `staleTime: 5 minutes` - Data considered fresh for 5 minutes (reduces unnecessary refetches)
- `cacheTime: 10 minutes` - Keep unused data in cache for 10 minutes
- `refetchOnWindowFocus: true` - Refresh data when user returns to tab (good for multi-device usage)
- `retry: 1` - Only retry failed requests once (fail fast for better UX)

### Setup: QueryClientProvider

#### File: `src/main.tsx` or `src/App.tsx`

**Purpose:** Wrap app with QueryClientProvider to enable React Query hooks.

**Implementation concept:**

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your existing app structure */}
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>

      {/* Only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

**Why ReactQueryDevtools:**

- Visualizes cache state
- Shows query status (loading, success, error)
- Allows manual cache invalidation
- Only included in development builds

---

## Data Access Layer

All database operations should be centralized in `/src/lib/supabase/` to separate business logic from UI.

### Accounts Data Access

#### File: `src/lib/supabase/accounts.ts`

**Purpose:** All Supabase queries and mutations for accounts.

**Exports:**

##### Function: `fetchAccounts(booksetId: string)`

**Purpose:** Fetch all non-archived accounts for a bookset.

**Returns:** `Promise<Account[]>`

**Implementation concept:**

```typescript
export async function fetchAccounts(booksetId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('booksetId', booksetId)
    .eq('isArchived', false)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
```

**Why this approach:**

- Filter by `booksetId` (required for RLS and data isolation)
- Exclude archived accounts (soft delete pattern)
- Order by name for consistent UI display
- Throw errors to let React Query handle error states

##### Function: `createAccount(account: InsertAccount)`

**Purpose:** Create a new account.

**Parameters:**

- `account`: Object with `booksetId`, `name`, `type`, `openingBalance`, `openingBalanceDate`

**Returns:** `Promise<Account>`

**Validation:**

- `name` must be non-empty
- `type` must be 'Asset' or 'Liability'
- `openingBalance` must be a number (in cents)
- `openingBalanceDate` must be a valid date

**Implementation concept:**

```typescript
export async function createAccount(account: InsertAccount): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      booksetId: account.booksetId,
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance,
      openingBalanceDate: account.openingBalanceDate,
      isArchived: false,
      lastReconciledDate: null,
      lastReconciledBalance: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**Why this approach:**

- Database triggers will set `createdBy`, `createdAt`, `lastModifiedBy`, `updatedAt`
- `.select().single()` returns the created record with all fields
- `isArchived: false` explicitly set (default state)
- Null reconciliation fields (not yet reconciled)

##### Function: `updateAccount(id: string, updates: Partial<Account>)`

**Purpose:** Update an existing account.

**Parameters:**

- `id`: Account UUID
- `updates`: Object with fields to update (`name`, `type`, `openingBalance`, etc.)

**Returns:** `Promise<Account>`

**Implementation concept:**

```typescript
export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**Why this approach:**

- Partial updates (only changed fields)
- Database trigger updates `lastModifiedBy` and `updatedAt`
- RLS policies ensure user has write access to this bookset

##### Function: `deleteAccount(id: string)`

**Purpose:** Soft delete an account (set `isArchived = true`).

**Parameters:**

- `id`: Account UUID

**Returns:** `Promise<void>`

**Implementation concept:**

```typescript
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ isArchived: true }).eq('id', id);

  if (error) throw error;
}
```

**Why soft delete:**

- Historical transactions reference accounts (foreign key integrity)
- Prevents accidental data loss
- Can be "undeleted" if needed (future feature)
- Archived accounts don't appear in UI but remain in database

### Categories Data Access

#### File: `src/lib/supabase/categories.ts`

**Purpose:** All Supabase queries and mutations for categories.

**Exports:**

##### Function: `fetchCategories(booksetId: string)`

**Purpose:** Fetch all non-archived categories for a bookset.

**Returns:** `Promise<Category[]>`

**Implementation concept:**

```typescript
export async function fetchCategories(booksetId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('booksetId', booksetId)
    .eq('isArchived', false)
    .order('sortOrder', { ascending: true });

  if (error) throw error;
  return data || [];
}
```

**Why order by sortOrder:**

- User can define custom display order
- Default to 0 for new categories
- Allows drag-and-drop reordering (future feature)

##### Function: `createCategory(category: InsertCategory)`

**Purpose:** Create a new category.

**Parameters:**

- `category`: Object with `booksetId`, `name`, `isTaxDeductible`, optional `parentCategoryId`, `taxLineItem`, `sortOrder`

**Returns:** `Promise<Category>`

**Implementation concept:**

```typescript
export async function createCategory(category: InsertCategory): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      booksetId: category.booksetId,
      name: category.name,
      isTaxDeductible: category.isTaxDeductible ?? false,
      taxLineItem: category.taxLineItem ?? null,
      parentCategoryId: category.parentCategoryId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isArchived: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**Why these defaults:**

- `isTaxDeductible: false` - Safe default (user must explicitly mark as deductible)
- `sortOrder: 0` - Will appear at top of list by default
- `parentCategoryId: null` - Top-level category (no parent)

##### Function: `updateCategory(id: string, updates: Partial<Category>)`

**Purpose:** Update an existing category.

**Implementation:** Same pattern as `updateAccount()`

##### Function: `deleteCategory(id: string)`

**Purpose:** Soft delete a category (set `isArchived = true`).

**Implementation:** Same pattern as `deleteAccount()`

**Note:** Deleting a parent category should be handled carefully:

- Option 1: Prevent deletion if children exist (validation in UI)
- Option 2: Set children's `parentCategoryId` to null (orphan them)
- **Phase 2 approach:** Option 1 (simpler, safer)

---

## React Query Hooks

Custom hooks that wrap React Query with Supabase data access functions.

### Accounts Hooks

#### File: `src/hooks/useAccounts.ts`

**Purpose:** Provide React Query hooks for account operations.

**Exports:**

##### Hook: `useAccounts()`

**Purpose:** Fetch all accounts for the active bookset.

**Returns:**

```typescript
{
  accounts: Account[];
  isLoading: boolean;
  error: Error | null;
}
```

**Implementation concept:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchAccounts } from '../lib/supabase/accounts';

export function useAccounts() {
  const { activeBookset } = useAuth();

  const query = useQuery({
    queryKey: ['accounts', activeBookset?.id],
    queryFn: () => fetchAccounts(activeBookset!.id),
    enabled: !!activeBookset,
  });

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
```

**Why this approach:**

- `queryKey` includes `booksetId` (cache invalidated when switching booksets)
- `enabled: !!activeBookset` prevents query from running before auth loads
- Returns empty array if no data (prevents null checks in UI)

##### Hook: `useCreateAccount()`

**Purpose:** Mutation hook for creating accounts.

**Returns:**

```typescript
{
  createAccount: (account: InsertAccount) => Promise<Account>;
  isLoading: boolean;
  error: Error | null;
}
```

**Implementation concept:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccount } from '../lib/supabase/accounts';
import { useAuth } from '../contexts/AuthContext';

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      // Invalidate accounts query to trigger refetch
      queryClient.invalidateQueries(['accounts', activeBookset?.id]);
    },
  });

  return {
    createAccount: mutation.mutate,
    isLoading: mutation.isLoading,
    error: mutation.error as Error | null,
  };
}
```

**Why invalidateQueries:**

- Tells React Query to refetch accounts after creating one
- Ensures UI shows new account immediately
- Alternative: optimistic updates (more complex, save for later)

##### Hook: `useUpdateAccount()`

**Purpose:** Mutation hook for updating accounts.

**Implementation:** Same pattern as `useCreateAccount()`, but calls `updateAccount()`

##### Hook: `useDeleteAccount()`

**Purpose:** Mutation hook for soft-deleting accounts.

**Implementation:** Same pattern, but calls `deleteAccount()`

### Categories Hooks

#### File: `src/hooks/useCategories.ts`

**Purpose:** Provide React Query hooks for category operations.

**Exports:**

- `useCategories()` - Fetch all categories
- `useCreateCategory()` - Create a category
- `useUpdateCategory()` - Update a category
- `useDeleteCategory()` - Delete a category

**Implementation:** Same patterns as accounts hooks (substitute `categories` for `accounts`)

---

## Validation Schemas

Use Zod for runtime validation of user input before sending to Supabase.

### Accounts Validation

#### File: `src/lib/validation/accounts.ts`

**Purpose:** Zod schemas for account validation.

**Exports:**

##### Schema: `insertAccountSchema`

**Purpose:** Validate account creation input.

```typescript
import { z } from 'zod';

export const insertAccountSchema = z.object({
  booksetId: z.string().uuid(),
  name: z.string().min(1, 'Account name is required').max(100),
  type: z.enum(['Asset', 'Liability']),
  openingBalance: z.number().int(), // In cents
  openingBalanceDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
```

**Why these validations:**

- `name.min(1)` - Prevent empty names
- `name.max(100)` - Reasonable length limit
- `type` enum - Only allow valid types
- `openingBalance` integer - Cents (not dollars with decimals)
- `openingBalanceDate` string - ISO format (e.g., "2024-01-01")

##### Schema: `updateAccountSchema`

**Purpose:** Validate account update input.

```typescript
export const updateAccountSchema = insertAccountSchema.partial().omit({ booksetId: true });

export type UpdateAccount = z.infer<typeof updateAccountSchema>;
```

**Why partial and omit:**

- `partial()` - All fields optional (only update what changed)
- `omit({ booksetId: true })` - Cannot change booksetId after creation

### Categories Validation

#### File: `src/lib/validation/categories.ts`

**Purpose:** Zod schemas for category validation.

**Exports:**

##### Schema: `insertCategorySchema`

```typescript
import { z } from 'zod';

export const insertCategorySchema = z.object({
  booksetId: z.string().uuid(),
  name: z.string().min(1, 'Category name is required').max(100),
  isTaxDeductible: z.boolean(),
  taxLineItem: z.string().max(200).optional(),
  parentCategoryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
```

##### Schema: `updateCategorySchema`

```typescript
export const updateCategorySchema = insertCategorySchema.partial().omit({ booksetId: true });

export type UpdateCategory = z.infer<typeof updateCategorySchema>;
```

---

## UI Components

### Settings Page Structure

#### File: `src/pages/SettingsPage.tsx`

**Purpose:** Multi-tab settings interface (expanded from Phase 1 placeholder).

**Structure:**

```typescript
function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'rules' | 'access'>('accounts');

  return (
    <div>
      <h1>Settings - {activeBookset.name}</h1>

      {/* Tab buttons (unstyled) */}
      <div>
        <button onClick={() => setActiveTab('accounts')}>Accounts</button>
        <button onClick={() => setActiveTab('categories')}>Categories</button>
        <button onClick={() => setActiveTab('rules')}>Rules</button>
        <button onClick={() => setActiveTab('access')}>Access</button>
      </div>

      {/* Tab content (conditional rendering) */}
      {activeTab === 'accounts' && <AccountsTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'rules' && <div>Rules (Phase 4)</div>}
      {activeTab === 'access' && <AccessTab />}
    </div>
  );
}
```

**Why this structure:**

- Simple tab switching via state (no router needed)
- Each tab is a separate component (easier to test)
- Rules and Access tabs are placeholders in Phase 2

### Accounts Tab Component

#### File: `src/components/settings/AccountsTab.tsx`

**Purpose:** List accounts and provide create/edit/delete operations.

**Structure:**

```
<AccountsTab>
  ├── <button>Create Account</button>
  ├── <table> (native HTML)
  │   ├── Columns: Name, Type, Opening Balance, Opening Date, Actions
  │   └── Rows: One per account
  └── <AccountFormModal> (shown when creating/editing)
```

**Component State:**

```typescript
function AccountsTab() {
  const { accounts, isLoading, error } = useAccounts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Handlers
  function handleCreate() {
    setEditingAccount(null);
    setIsFormOpen(true);
  }

  function handleEdit(account: Account) {
    setEditingAccount(account);
    setIsFormOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm('Delete this account? It will be archived.')) {
      deleteAccount(id);
    }
  }

  // Render
  return (
    <div>
      <button onClick={handleCreate}>Create Account</button>

      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Opening Balance</th>
            <th>Opening Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => (
            <tr key={account.id}>
              <td>{account.name}</td>
              <td>{account.type}</td>
              <td>${(account.openingBalance / 100).toFixed(2)}</td>
              <td>{new Date(account.openingBalanceDate).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleEdit(account)}>Edit</button>
                <button onClick={() => handleDelete(account.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isFormOpen && (
        <AccountFormModal
          account={editingAccount}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </div>
  );
}
```

**Why this approach:**

- Native `<table>` (no styling library needed)
- Loading and error states handled explicitly
- Dollars displayed with 2 decimal places (cents / 100)
- Browser `confirm()` for delete (simple, no modal needed)
- Modal form for create/edit (reuses same component)

### Account Form Modal

#### File: `src/components/settings/AccountFormModal.tsx`

**Purpose:** Form for creating or editing an account.

**Props:**

```typescript
interface AccountFormModalProps {
  account: Account | null; // null = creating, non-null = editing
  onClose: () => void;
}
```

**Structure:**

```
<AccountFormModal>
  ├── <form>
  │   ├── <input name="name">
  │   ├── <select name="type"> (Asset | Liability)
  │   ├── <input name="openingBalance" type="number">
  │   ├── <input name="openingBalanceDate" type="date">
  │   ├── <button type="submit">Save</button>
  │   └── <button type="button" onClick={onClose}>Cancel</button>
  └── (Validation errors displayed below each field)
```

**Component Logic:**

```typescript
function AccountFormModal({ account, onClose }: AccountFormModalProps) {
  const { activeBookset } = useAuth();
  const { createAccount, isLoading: isCreating } = useCreateAccount();
  const { updateAccount, isLoading: isUpdating } = useUpdateAccount();

  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'Asset',
    openingBalance: account ? account.openingBalance / 100 : 0, // Convert to dollars for display
    openingBalanceDate: account?.openingBalanceDate
      ? new Date(account.openingBalanceDate).toISOString().split('T')[0]
      : '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate with Zod
    const validation = insertAccountSchema.safeParse({
      booksetId: activeBookset.id,
      name: formData.name,
      type: formData.type,
      openingBalance: Math.round(formData.openingBalance * 100), // Convert to cents
      openingBalanceDate: formData.openingBalanceDate,
    });

    if (!validation.success) {
      // Extract Zod errors into { fieldName: errorMessage }
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Submit
    if (account) {
      updateAccount(account.id, validation.data).then(() => onClose());
    } else {
      createAccount(validation.data).then(() => onClose());
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'white', margin: '100px auto', padding: '20px', maxWidth: '500px' }}>
        <h2>{account ? 'Edit Account' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
            {errors.name && <div style={{ color: 'red' }}>{errors.name}</div>}
          </div>

          <div>
            <label>Type:</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as 'Asset' | 'Liability' })}
            >
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
            </select>
          </div>

          <div>
            <label>Opening Balance ($):</label>
            <input
              type="number"
              step="0.01"
              value={formData.openingBalance}
              onChange={e => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
            />
            {errors.openingBalance && <div style={{ color: 'red' }}>{errors.openingBalance}</div>}
          </div>

          <div>
            <label>Opening Date:</label>
            <input
              type="date"
              value={formData.openingBalanceDate}
              onChange={e => setFormData({ ...formData, openingBalanceDate: e.target.value })}
            />
            {errors.openingBalanceDate && <div style={{ color: 'red' }}>{errors.openingBalanceDate}</div>}
          </div>

          <div>
            <button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Why this approach:**

- Controlled form inputs (React state)
- Zod validation on submit (client-side validation)
- Display errors inline below each field
- Cents ↔ dollars conversion (UI shows dollars, database stores cents)
- Modal overlay with inline styles (no CSS needed)
- Disabled save button while submitting (prevents double-submit)

### Categories Tab Component

#### File: `src/components/settings/CategoriesTab.tsx`

**Purpose:** List categories and provide create/edit/delete operations.

**Structure:** Same pattern as `AccountsTab`:

- List categories in native HTML table
- Columns: Name, Tax Deductible, Tax Line Item, Parent Category, Actions
- Create/Edit/Delete buttons
- `CategoryFormModal` for form handling

**Additional Logic:**

- **Parent category dropdown:** When creating/editing, show a `<select>` with all categories as options
- **Prevent circular references:** Cannot set a category as its own parent (validation in form)
- **Display hierarchy:** Option 1 (simple): Flat list. Option 2 (better UX): Indent child categories in table

**Phase 2 approach:** Flat list (simpler). Hierarchy display can be added in Phase 7 (UI polish).

### Category Form Modal

#### File: `src/components/settings/CategoryFormModal.tsx`

**Purpose:** Form for creating or editing a category.

**Props:**

```typescript
interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
}
```

**Form Fields:**

- `name` (text input)
- `isTaxDeductible` (checkbox)
- `taxLineItem` (text input, optional)
- `parentCategoryId` (select dropdown, optional)
- `sortOrder` (number input, optional - default to 0)

**Validation:**

- Use `insertCategorySchema` from Zod
- Prevent setting category as its own parent:
  ```typescript
  if (category && formData.parentCategoryId === category.id) {
    setErrors({ parentCategoryId: 'Category cannot be its own parent' });
    return;
  }
  ```

**Implementation:** Same pattern as `AccountFormModal` (controlled form, Zod validation, inline errors)

### Access Tab Component (Placeholder)

#### File: `src/components/settings/AccessTab.tsx`

**Purpose:** Placeholder for multi-user access management (Phase 1 requirement).

**Phase 2 Content:**

```typescript
function AccessTab() {
  const { activeBookset, user } = useAuth();
  const isOwner = activeBookset.ownerId === user.id;

  if (!isOwner) {
    return <div>Only the bookset owner can manage access.</div>;
  }

  return (
    <div>
      <h2>Access Grants</h2>
      <p>Multi-user access management coming in future phase.</p>
      <p>This bookset is owned by: {activeBookset.name}</p>
    </div>
  );
}
```

**Why a placeholder:**

- Access grants UI is not required for Phase 2 MVP
- Schema and RLS policies already support it (from Phase 1)
- Can be implemented in a future phase when multi-user features are prioritized

---

## Supabase Real-Time Subscriptions (Optional Enhancement)

### Purpose

Enable real-time updates when data changes (e.g., another user edits an account).

### Implementation Concept

#### File: `src/hooks/useAccounts.ts` (enhanced)

Add a Supabase subscription to invalidate React Query cache when data changes:

```typescript
import { useEffect } from 'react';
import { supabase } from '../lib/supabase/config';
import { useQueryClient } from '@tanstack/react-query';

export function useAccounts() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();

  // Existing query logic...
  const query = useQuery({ ... });

  // Real-time subscription
  useEffect(() => {
    if (!activeBookset) return;

    const channel = supabase
      .channel('accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'accounts',
          filter: `booksetId=eq.${activeBookset.id}`,
        },
        () => {
          // Invalidate cache when any account changes
          queryClient.invalidateQueries(['accounts', activeBookset.id]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBookset?.id, queryClient]);

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
```

**Why this is optional for Phase 2:**

- Adds complexity (error handling, reconnection logic)
- MVP is single-user in practice (multi-user is future feature)
- Can be added later without changing component code

**When to implement:**

- If users report stale data issues
- When multi-user access is actively used

---

## Testing Requirements

### Unit Tests

#### Test: Zod validation schemas

**File:** `src/lib/validation/accounts.test.ts`

**Assertions:**

- Valid account data passes `insertAccountSchema.parse()`
- Empty name fails validation
- Invalid type fails validation
- Non-integer opening balance fails validation
- Invalid date format fails validation
- `updateAccountSchema` allows partial updates

#### Test: Category validation (same structure as accounts)

**File:** `src/lib/validation/categories.test.ts`

### Integration Tests

#### Test: Account CRUD flow

**Scenario:**

1. Create an account via `createAccount()`
2. Verify it appears in `fetchAccounts()`
3. Update the account name via `updateAccount()`
4. Verify the name changed
5. Delete the account via `deleteAccount()`
6. Verify it no longer appears in `fetchAccounts()` (archived)

**Assertions:**

- All operations succeed without errors
- Data persists correctly in Supabase
- RLS policies allow access (user can read/write their own bookset)
- Audit fields are set correctly (createdBy, lastModifiedBy)

#### Test: Category CRUD flow (same pattern)

#### Test: Hierarchical categories

**Scenario:**

1. Create parent category "Expenses"
2. Create child category "Office Supplies" with `parentCategoryId = "Expenses"`
3. Verify child appears in `fetchCategories()`
4. Verify `parentCategoryId` is set correctly

**Assertions:**

- Parent-child relationship persists
- Can query categories by `parentCategoryId` (future feature)

#### Test: RLS enforcement

**Scenario:**

1. User A creates bookset A and account A1
2. User B creates bookset B
3. User B attempts to read account A1 (should fail - no access grant)
4. User A grants viewer access to User B for bookset A
5. User B can now read account A1
6. User B attempts to edit account A1 (should fail - viewer role)

**Assertions:**

- RLS policies enforce bookset isolation
- Access grants work correctly
- Viewer role is read-only

### Component Tests

#### Test: AccountsTab component

**Assertions:**

- Displays loading state while fetching
- Displays error state if fetch fails
- Displays accounts in table
- "Create Account" button opens modal
- "Edit" button opens modal with pre-filled data
- "Delete" button shows confirmation, then archives account

#### Test: AccountFormModal component

**Assertions:**

- Form displays empty fields when creating
- Form displays pre-filled fields when editing
- Submit button is disabled while saving
- Validation errors display below fields
- Form closes after successful save
- Cancel button closes form without saving

#### Test: CategoriesTab and CategoryFormModal (same patterns)

### Manual Testing Checklist

- [ ] Create multiple accounts with different types (Asset, Liability)
- [ ] Edit account name, opening balance, and date
- [ ] Delete an account (verify it's archived, not hard-deleted)
- [ ] Create top-level categories
- [ ] Create child categories with parent categories
- [ ] Mark categories as tax-deductible
- [ ] Add tax line items to categories
- [ ] Verify accounts table sorts by name
- [ ] Verify categories table sorts by sortOrder
- [ ] Switch between tabs (Accounts, Categories, Rules, Access)
- [ ] Verify placeholders show for Rules and Access tabs
- [ ] Check browser console for errors
- [ ] Verify data persists after page refresh
- [ ] Test with two users: verify RLS isolation (User B cannot see User A's data)
- [ ] Grant access to bookset, verify viewer can read but not edit
- [ ] Deploy to Vercel, verify production build works

---

## Success Criteria

**Phase 2 is complete when:**

1. ✅ User can create, edit, and delete accounts
2. ✅ User can create, edit, and delete categories
3. ✅ Categories support hierarchical structure (parent-child relationships)
4. ✅ All data validated with Zod schemas before submission
5. ✅ React Query caching works (data persists without refetching on navigation)
6. ✅ Real-time updates via Supabase subscriptions (optional, but recommended)
7. ✅ RLS policies enforce bookset isolation (tested with multiple users)
8. ✅ Audit fields (createdBy, lastModifiedBy, etc.) are set correctly by database triggers
9. ✅ Soft delete (isArchived) works for both accounts and categories
10. ✅ Settings page tabs work (Accounts, Categories, Rules, Access)
11. ✅ All forms display validation errors inline
12. ✅ Loading and error states handled in UI
13. ✅ All tests pass (`npm run test`)
14. ✅ Build runs without errors (`npm run build`)
15. ✅ App deployed to Vercel successfully

---

## Notes for LLM-Assisted Development

### When implementing React Query hooks

- Always invalidate queries after mutations (`invalidateQueries`)
- Use `enabled` option to prevent queries from running before auth loads
- Return consistent shape from hooks ({ data, isLoading, error })
- Use TypeScript generics for type safety (`useQuery<Account[]>`)
- Consider optimistic updates for better UX (add in Phase 7)

### When implementing forms

- Use controlled inputs (React state) for all form fields
- Validate on submit (not on every keystroke - better UX)
- Display Zod errors inline below each field
- Disable submit button while mutation is pending
- Close modal/form after successful save
- Reset form state when opening for new creation

### When implementing CRUD operations

- Always filter by `booksetId` to respect RLS and multi-user isolation
- Use soft delete (`isArchived = true`) instead of hard delete
- Use `.select().single()` after INSERT to get created record with all fields
- Let database triggers handle audit fields (don't set manually)
- Throw errors from data access functions (let React Query handle error states)

### When displaying data in tables

- Format cents as dollars: `(cents / 100).toFixed(2)`
- Format dates: `new Date(timestamp).toLocaleDateString()`
- Show loading state while fetching
- Show error message if fetch fails
- Handle empty state ("No accounts yet. Create one!")

### When working with hierarchical categories

- Prevent circular references (category cannot be its own parent)
- Consider cascade behavior when deleting parent (Phase 2: prevent deletion if children exist)
- Store `sortOrder` for custom user ordering
- Flatten hierarchy for display (Phase 2) or render tree (Phase 7)

### Database indexes to consider (if performance issues arise)

```sql
-- Index on booksetId (most common filter)
CREATE INDEX idx_accounts_bookset ON accounts(booksetId) WHERE isArchived = false;
CREATE INDEX idx_categories_bookset ON categories(booksetId) WHERE isArchived = false;

-- Index on parent category (for querying children)
CREATE INDEX idx_categories_parent ON categories(parentCategoryId) WHERE isArchived = false;
```

**When to add indexes:**

- If queries are slow (check Supabase query performance)
- If table has 1000+ rows per bookset
- **Not needed for Phase 2 MVP** (premature optimization)

---

## Changes from Phase 1

### New in Phase 2

1. **React Query integration** - Data fetching and caching layer
2. **Zod validation** - Runtime validation of user input
3. **CRUD operations** - Create, read, update, delete for accounts and categories
4. **Forms and modals** - Basic HTML forms for data entry
5. **Data access layer** - Centralized Supabase queries in `/src/lib/supabase/`
6. **Custom hooks** - React Query hooks for data operations
7. **Settings page expansion** - Functional Accounts and Categories tabs

### Carried over from Phase 1

1. **Multi-user isolation** - RLS policies enforce bookset-based access control
2. **Audit trail** - Database triggers set createdBy, lastModifiedBy, timestamps
3. **Soft delete** - `isArchived` flag for accounts and categories
4. **Minimal UI** - No styling, native HTML elements only
5. **Vercel deployment** - Automatic deployments from Git

---

## Next Phase Preview

**Phase 3** will implement:

- CSV import functionality (PapaParse integration)
- Bank profile definitions (column mappings)
- Duplicate detection (fingerprinting algorithm)
- Staging UI (New vs Duplicates tables)
- Batch import with `sourceBatchId` tracking
- Transaction creation in `transactions` table

The accounts and categories created in Phase 2 will be used to categorize transactions in Phase 3.
