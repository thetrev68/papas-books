export interface User {
  id: string;
  email: string;
  display_name?: string;
  is_admin: boolean;
  active_bookset_id: string;
  own_bookset_id: string;
  preferences: {
    defaultView?: 'dashboard' | 'workbench' | 'import';
    autoRunRules: boolean;
    autoMarkReviewed: boolean;
  };
  last_active: string;
  last_modified_by?: string;
  created_at: string;
}

export interface Bookset {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  business_type?: 'personal' | 'sole_proprietor' | 'llc' | 'corporation';
  tax_year?: number;
}

export interface Account {
  id: string;
  bookset_id: string;
  name: string;
  type: 'Asset' | 'Liability';
  opening_balance: number;
  opening_balance_date: string;
  csv_mapping?: Record<string, unknown>;
  last_reconciled_date: string | null;
  last_reconciled_balance: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  created_by: string;
  last_modified_by: string;
  change_history?: unknown; // JSONB
}

export interface Category {
  id: string;
  bookset_id: string;
  name: string;
  tax_line_item: string | null;
  is_tax_deductible: boolean;
  parent_category_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  created_by: string;
  last_modified_by: string;
}

export interface SplitLine {
  category_id: string;
  amount: number; // In cents (can be positive or negative)
  memo?: string; // Optional note for this line
}

export interface Transaction {
  id: string;
  bookset_id: string;
  account_id: string;

  // Core Financial Data
  date: string; // ISO 8601 date (YYYY-MM-DD)
  amount: number; // Integer in cents (e.g., -1499 for -$14.99)
  payee: string | null; // DEPRECATED: Legacy text field (use payee_id instead)
  payee_id: string | null; // Foreign key to payees table
  original_description: string; // Raw bank description from CSV (immutable)

  // Metadata & Audit
  fingerprint: string; // SHA-256 hash for duplicate detection
  source_batch_id: string | null; // Link to import_batches
  import_date: string; // ISO timestamp

  // Status Flags
  is_reviewed: boolean; // False = "New", True = "Accepted"
  is_split: boolean; // Phase 5 feature
  reconciled: boolean; // Phase 6 feature
  is_archived: boolean; // Soft delete flag

  // Split transaction data (Phase 5)
  lines: SplitLine[]; // JSONB - array of split lines

  // Timestamps
  created_at: string;
  updated_at: string;

  // Audit trail (set by triggers)
  created_by: string; // uuid, foreign key to users.id
  last_modified_by: string; // uuid, foreign key to users.id
  change_history?: unknown; // JSONB
}

export interface ImportBatch {
  id: string;
  bookset_id: string;
  account_id: string;
  file_name: string;
  imported_at: string;
  imported_by: string;

  // Statistics
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;

  // Audit Snapshot
  csv_mapping_snapshot: unknown; // JSONB - Copy of CsvMapping used for this import

  // Undo support (future feature)
  is_undone: boolean;
  undone_at: string | null;
  undone_by: string | null;
}

export interface Payee {
  id: string;
  bookset_id: string;
  name: string; // Clean, normalized name (e.g., "Starbucks")
  default_category_id: string | null; // Default category for this payee
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;
}

export interface Rule {
  id: string;
  bookset_id: string;

  // Matching criteria
  keyword: string; // Lowercase search string
  match_type: 'contains' | 'exact' | 'startsWith' | 'regex';
  case_sensitive: boolean;

  // Action to take
  target_category_id: string | null;
  payee_id: string | null; // Payee to assign when rule matches
  suggested_payee: string | null; // DEPRECATED: Use payee_id instead

  // Priority and control
  priority: number;
  is_enabled: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  use_count: number;

  // Audit trail
  created_by: string;
  last_modified_by: string;
  change_history?: unknown; // JSONB
  conditions?: unknown; // JSONB
}

export interface TaxYearLock {
  id: string;
  bookset_id: string;
  tax_year: number;
  locked_at: string;
  locked_by: string;
}
