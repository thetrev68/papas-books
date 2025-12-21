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

export interface AccessGrant {
  id: string;
  bookset_id: string;
  user_id: string;
  granted_by: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  expires_at?: string;
  revoked_at?: string;
  revoked_by?: string;
  can_import: boolean;
  can_reconcile: boolean;
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
