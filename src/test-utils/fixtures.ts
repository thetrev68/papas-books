import type { Transaction, Account, Category, Bookset, User, Rule, Payee } from '../types/database';

/**
 * Mock transaction factory
 */
export const mockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'test-transaction-id',
  bookset_id: 'test-bookset-id',
  account_id: 'test-account-id',
  date: '2024-01-15',
  amount: 5000, // $50.00
  payee: 'Test Payee',
  payee_id: 'test-payee-id',
  original_description: 'Test Transaction Description',
  fingerprint: 'a'.repeat(64), // Mock SHA-256
  source_batch_id: null,
  import_date: new Date().toISOString(),
  is_reviewed: false,
  is_split: false,
  reconciled: false,
  is_archived: false,
  lines: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'test-user-id',
  last_modified_by: 'test-user-id',
  ...overrides,
});

/**
 * Mock split transaction factory
 */
export const mockSplitTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  ...mockTransaction({
    is_split: true,
    lines: [
      { category_id: 'category-1', amount: 3000, memo: 'Split 1' },
      { category_id: 'category-2', amount: 2000, memo: 'Split 2' },
    ],
  }),
  ...overrides,
});

/**
 * Mock account factory
 */
export const mockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'test-account-id',
  bookset_id: 'test-bookset-id',
  name: 'Test Checking Account',
  type: 'Asset',
  opening_balance: 100000, // $1000.00
  opening_balance_date: '2024-01-01',
  csv_mapping: {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },
  last_reconciled_date: null,
  last_reconciled_balance: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_archived: false,
  created_by: 'test-user-id',
  last_modified_by: 'test-user-id',
  ...overrides,
});

/**
 * Mock category factory
 */
export const mockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'test-category-id',
  bookset_id: 'test-bookset-id',
  name: 'Test Category',
  tax_line_item: null,
  is_tax_deductible: false,
  parent_category_id: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_archived: false,
  created_by: 'test-user-id',
  last_modified_by: 'test-user-id',
  ...overrides,
});

/**
 * Mock parent category with children
 */
export const mockCategoryHierarchy = () => {
  const parent = mockCategory({
    id: 'parent-category-id',
    name: 'Parent Category',
  });
  const child1 = mockCategory({
    id: 'child-category-1',
    name: 'Child Category 1',
    parent_category_id: parent.id,
  });
  const child2 = mockCategory({
    id: 'child-category-2',
    name: 'Child Category 2',
    parent_category_id: parent.id,
  });
  return { parent, children: [child1, child2] };
};

/**
 * Mock rule factory
 */
export const mockRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: 'test-rule-id',
  bookset_id: 'test-bookset-id',
  keyword: 'walmart',
  match_type: 'contains',
  case_sensitive: false,
  target_category_id: 'test-category-id',
  payee_id: 'test-payee-id',
  suggested_payee: null,
  priority: 0,
  is_enabled: true,
  use_count: 0,
  last_used_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'test-user-id',
  last_modified_by: 'test-user-id',
  ...overrides,
});

/**
 * Mock payee factory
 */
export const mockPayee = (overrides: Partial<Payee> = {}): Payee => ({
  id: 'test-payee-id',
  bookset_id: 'test-bookset-id',
  name: 'Test Payee',
  default_category_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'test-user-id',
  last_modified_by: 'test-user-id',
  ...overrides,
});

/**
 * Mock bookset factory
 */
export const mockBookset = (overrides: Partial<Bookset> = {}): Bookset => ({
  id: 'test-bookset-id',
  owner_id: 'test-user-id',
  name: 'Test Bookset',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  business_type: 'personal',
  tax_year: new Date().getFullYear(),
  ...overrides,
});

/**
 * Mock user factory
 */
export const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  display_name: 'Test User',
  is_admin: false,
  active_bookset_id: 'test-bookset-id',
  own_bookset_id: 'test-bookset-id',
  preferences: {
    defaultView: 'workbench',
    autoRunRules: false,
    autoMarkReviewed: false,
  },
  last_active: new Date().toISOString(),
  last_modified_by: 'test-user-id',
  created_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Creates multiple mock transactions with sequential IDs
 */
export const mockTransactionBatch = (
  count: number,
  baseOverrides: Partial<Transaction> = {}
): Transaction[] => {
  return Array.from({ length: count }, (_, i) =>
    mockTransaction({
      id: `transaction-${i + 1}`,
      amount: (i + 1) * 1000,
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      ...baseOverrides,
    })
  );
};
