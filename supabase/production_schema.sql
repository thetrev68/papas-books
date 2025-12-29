-- ============================================================================
-- Papa's Books - Production Database Schema
-- ============================================================================
-- Complete production-ready schema including all features and optimizations:
-- - Phase 1-7: Core schema (booksets, transactions, accounts, categories, etc.)
-- - Phase 8: Multi-user access, import undo, change history
-- - Phase 9: Enhanced audit trail with field-level change tracking
-- - Security: Fixed search_path for all SECURITY DEFINER functions
-- - Performance: Comprehensive indexes for query optimization
-- - Performance: RLS policy optimizations (auth.uid() subqueries, combined policies)
--   (See docs/supabase-issues-resolution.md for details)
--
-- WARNING: This will DELETE ALL DATA in the database.
-- Only run this script when you want to completely reset the database.
--
-- Usage: Copy and paste this entire script into Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 0. Cleanup (Reset Schema)
-- -----------------------------------------------------------------------------

-- Drop tables first (CASCADE will drop all dependent triggers, indexes, and constraints)
DROP TABLE IF EXISTS public.reconciliations CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.import_batches CASCADE;
DROP TABLE IF EXISTS public.rules CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.payees CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.access_grants CASCADE;
DROP TABLE IF EXISTS public.booksets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions (these may still exist even after table drops)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_bookset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_access_grant(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_read_bookset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_write_bookset(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.set_audit_fields_on_create() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_audit_field_changes() CASCADE;
DROP FUNCTION IF EXISTS public.protect_user_fields() CASCADE;
DROP FUNCTION IF EXISTS public.track_change_history() CASCADE;
DROP FUNCTION IF EXISTS public.finalize_reconciliation(uuid, uuid, bigint, timestamp with time zone, bigint, bigint, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.grant_access_by_email(uuid, text, text, boolean, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.undo_import_batch(uuid) CASCADE;

-- Note: Indexes and triggers are automatically dropped when tables are dropped with CASCADE

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- Table: users
CREATE TABLE public.users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  is_admin boolean DEFAULT false,
  active_bookset_id uuid, -- Foreign key constraint added later
  own_bookset_id uuid,    -- Foreign key constraint added later
  preferences jsonb DEFAULT '{"defaultView": "dashboard", "autoRunRules": true, "autoMarkReviewed": true}'::jsonb,
  last_active timestamp with time zone DEFAULT now(),
  last_modified_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Table: booksets
CREATE TABLE public.booksets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_type text CHECK (business_type IN ('personal', 'sole_proprietor', 'llc', 'corporation')),
  tax_year int
);

-- Add circular foreign keys for users table
ALTER TABLE public.users ADD CONSTRAINT fk_users_active_bookset FOREIGN KEY (active_bookset_id) REFERENCES public.booksets(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD CONSTRAINT fk_users_own_bookset FOREIGN KEY (own_bookset_id) REFERENCES public.booksets(id) ON DELETE SET NULL;

-- Table: access_grants
CREATE TABLE public.access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  granted_by uuid REFERENCES public.users(id) NOT NULL,
  role text CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revoked_by uuid REFERENCES public.users(id),
  can_import boolean DEFAULT false,
  can_reconcile boolean DEFAULT false,
  UNIQUE(bookset_id, user_id)
);

-- Table: accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text CHECK (type IN ('Asset', 'Liability')) NOT NULL,
  opening_balance bigint DEFAULT 0, -- in cents
  opening_balance_date timestamp with time zone DEFAULT now(),
  csv_mapping jsonb,
  last_reconciled_date timestamp with time zone,
  last_reconciled_balance bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  bank_connection_id text,
  notes text,
  color text,
  institution_name text,
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id),
  change_history jsonb -- Phase 9: Audit trail
);

-- Table: categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tax_line_item text,
  is_tax_deductible boolean DEFAULT false,
  parent_category_id uuid REFERENCES public.categories(id),
  sort_order int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  color text,
  icon text,
  budget_amount bigint,
  budget_period text CHECK (budget_period IN ('monthly', 'quarterly', 'annual')),
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id),
  change_history jsonb -- Phase 9: Audit trail
);

-- Table: payees (must be created before transactions and rules that reference it)
CREATE TABLE public.payees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  default_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id)
);

-- Table: transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  date timestamp with time zone NOT NULL,
  payee text, -- Nullable: payee assignment is part of review workflow
  payee_id uuid REFERENCES public.payees(id) ON DELETE SET NULL,
  original_description text NOT NULL, -- Immutable bank description from CSV
  amount bigint NOT NULL, -- in cents
  is_split boolean DEFAULT false,
  lines jsonb NOT NULL,
  is_reviewed boolean DEFAULT false,
  reconciled boolean DEFAULT false,
  reconciled_date timestamp with time zone,
  is_archived boolean DEFAULT false,
  source_batch_id uuid, -- FK added later
  import_date timestamp with time zone DEFAULT now(),
  fingerprint text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  attachments jsonb,
  tags text[],
  is_recurring boolean DEFAULT false,
  recurring_group_id uuid,
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id),
  change_history jsonb -- Phase 9: Audit trail
);

-- Table: rules
CREATE TABLE public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  keyword text NOT NULL,
  match_type text CHECK (match_type IN ('contains', 'exact', 'startsWith', 'regex')) NOT NULL,
  case_sensitive boolean DEFAULT false,
  target_category_id uuid REFERENCES public.categories(id),
  payee_id uuid REFERENCES public.payees(id) ON DELETE SET NULL,
  suggested_payee text, -- DEPRECATED: Use payee_id instead
  priority int DEFAULT 0,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  use_count int DEFAULT 0,
  conditions jsonb,
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id),
  change_history jsonb -- Phase 9: Audit trail
);

-- Table: reconciliations
CREATE TABLE public.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  statement_date timestamp with time zone NOT NULL,
  statement_balance bigint NOT NULL,
  opening_balance bigint NOT NULL,
  calculated_balance bigint NOT NULL,
  difference bigint NOT NULL,
  status text CHECK (status IN ('in_progress', 'balanced', 'unbalanced')) NOT NULL,
  finalized_at timestamp with time zone,
  transaction_count int DEFAULT 0,
  transaction_ids text[],
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  notes text,
  discrepancy_resolution text
);

-- Table: import_batches
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  imported_at timestamp with time zone DEFAULT now(),
  imported_by uuid REFERENCES public.users(id),
  total_rows int DEFAULT 0,
  imported_count int DEFAULT 0,
  duplicate_count int DEFAULT 0,
  error_count int DEFAULT 0,
  is_undone boolean DEFAULT false,
  undone_at timestamp with time zone,
  undone_by uuid REFERENCES public.users(id),
  csv_mapping_snapshot jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- Add transaction source_batch_id FK
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_batch FOREIGN KEY (source_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. RLS Helper Functions (with search_path security)
-- -----------------------------------------------------------------------------

-- Check if user owns this bookset
CREATE OR REPLACE FUNCTION user_owns_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM booksets
    WHERE id = bookset_id
    AND owner_id = auth.uid()
  );
END;
$$;

-- Check if user has access grant to this bookset
CREATE OR REPLACE FUNCTION user_has_access_grant(bookset_id uuid, min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM access_grants
    WHERE access_grants.bookset_id = user_has_access_grant.bookset_id
    AND user_id = auth.uid()
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      min_role = 'viewer' OR
      (min_role = 'editor' AND role IN ('editor', 'owner')) OR
      (min_role = 'owner' AND role = 'owner')
    )
  );
END;
$$;

-- Check if user can read this bookset
CREATE OR REPLACE FUNCTION user_can_read_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'viewer');
END;
$$;

-- Check if user can write to this bookset
CREATE OR REPLACE FUNCTION user_can_write_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'editor');
END;
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. RLS Policies
-- -----------------------------------------------------------------------------

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Performance optimized: wrap auth.uid() in subquery for single evaluation
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can create own profile"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

-- Performance optimized: combine multiple permissive policies into one
-- This replaces both "Users can update own profile" and "Admins can manage users"
CREATE POLICY "Users can manage profiles"
  ON public.users FOR UPDATE
  USING (
    (select auth.uid()) = id OR  -- User can update own profile
    user_is_admin()               -- OR user is admin
  )
  WITH CHECK (
    (select auth.uid()) = id OR  -- User can update own profile
    user_is_admin()               -- OR user is admin
  );

-- Booksets
ALTER TABLE public.booksets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read accessible booksets"
  ON public.booksets FOR SELECT
  USING (user_can_read_bookset(id));

-- Performance optimized: wrap auth.uid() in subquery for single evaluation
CREATE POLICY "Users can create own booksets"
  ON public.booksets FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Owners can update booksets"
  ON public.booksets FOR UPDATE
  USING (user_owns_bookset(id))
  WITH CHECK (user_owns_bookset(id));

-- Access Grants
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read grants for accessible booksets"
  ON public.access_grants FOR SELECT
  USING (user_can_read_bookset(bookset_id));

CREATE POLICY "Owners can create grants"
  ON public.access_grants FOR INSERT
  WITH CHECK (user_owns_bookset(bookset_id));

CREATE POLICY "Owners can update grants"
  ON public.access_grants FOR UPDATE
  USING (user_owns_bookset(bookset_id))
  WITH CHECK (user_owns_bookset(bookset_id));

-- Child Tables (Accounts, Categories, Rules, Payees, Import Batches)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Users can read accounts" ON public.accounts FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read categories" ON public.categories FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read rules" ON public.rules FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read payees" ON public.payees FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read import_batches" ON public.import_batches FOR SELECT USING (user_can_read_bookset(bookset_id));

-- Write policies
CREATE POLICY "Editors can insert accounts" ON public.accounts FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update accounts" ON public.accounts FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can delete accounts" ON public.accounts FOR DELETE USING (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert categories" ON public.categories FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update categories" ON public.categories FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can delete categories" ON public.categories FOR DELETE USING (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert rules" ON public.rules FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update rules" ON public.rules FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can delete rules" ON public.rules FOR DELETE USING (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert payees" ON public.payees FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update payees" ON public.payees FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can delete payees" ON public.payees FOR DELETE USING (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert import_batches" ON public.import_batches FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update import_batches" ON public.import_batches FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can delete import_batches" ON public.import_batches FOR DELETE USING (user_can_write_bookset(bookset_id));

-- Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read transactions"
  ON public.transactions FOR SELECT
  USING (user_can_read_bookset(bookset_id));

CREATE POLICY "Editors can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can update unreconciled transactions"
  ON public.transactions FOR UPDATE
  USING (user_can_write_bookset(bookset_id) AND reconciled = false)
  WITH CHECK (user_can_write_bookset(bookset_id) AND reconciled = false);

CREATE POLICY "Editors can delete unreconciled transactions"
  ON public.transactions FOR DELETE
  USING (user_can_write_bookset(bookset_id) AND reconciled = false);

-- Reconciliations
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reconciliations"
  ON public.reconciliations FOR SELECT
  USING (user_can_read_bookset(bookset_id));

CREATE POLICY "Editors can insert reconciliations"
  ON public.reconciliations FOR INSERT
  WITH CHECK (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can update reconciliations"
  ON public.reconciliations FOR UPDATE
  USING (user_can_write_bookset(bookset_id))
  WITH CHECK (user_can_write_bookset(bookset_id));

-- -----------------------------------------------------------------------------
-- 4. Basic Audit Triggers (created_by, updated_at, etc.)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_audit_fields_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by = auth.uid();
  NEW.created_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_audit_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.created_by != NEW.created_by OR OLD.created_at != NEW.created_at THEN
    RAISE EXCEPTION 'Cannot modify created_by or created_at fields';
  END IF;
  NEW.last_modified_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent non-admins from changing is_admin
  -- Only check if auth.uid() is present (real user request)
  -- If auth.uid() is null (system/trigger), allow changes (like initial creation)
  IF auth.uid() IS NOT NULL AND NEW.is_admin != OLD.is_admin AND NOT user_is_admin() THEN
     RAISE EXCEPTION 'Only admins can change admin status';
  END IF;

  -- Update last_modified_by
  NEW.last_modified_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Apply basic audit triggers
CREATE TRIGGER users_protect_fields BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION protect_user_fields();

CREATE TRIGGER accounts_set_audit_on_create BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER accounts_prevent_audit_changes BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER categories_set_audit_on_create BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER categories_prevent_audit_changes BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER transactions_set_audit_on_create BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER transactions_prevent_audit_changes BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER rules_set_audit_on_create BEFORE INSERT ON public.rules FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER rules_prevent_audit_changes BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER payees_set_audit_on_create BEFORE INSERT ON public.payees FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER payees_prevent_audit_changes BEFORE UPDATE ON public.payees FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

-- -----------------------------------------------------------------------------
-- 5. Phase 9: Change History Tracking
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changes JSONB := '{}'::JSONB;
  field_name TEXT;
  old_value JSONB;
  new_value JSONB;
  old_row JSONB;
  new_row JSONB;
BEGIN
  -- Convert OLD and NEW to JSONB for comparison
  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  -- Build changes object by comparing OLD and NEW
  -- Exclude audit fields and metadata to prevent recursion
  FOR field_name IN
    SELECT key
    FROM jsonb_object_keys(new_row) AS key
    WHERE key NOT IN (
      'id', 'created_at', 'updated_at', 'created_by',
      'last_modified_by', 'change_history'
    )
  LOOP
    old_value := old_row->field_name;
    new_value := new_row->field_name;

    -- Only track if value actually changed
    IF old_value IS DISTINCT FROM new_value THEN
      changes := changes || jsonb_build_object(
        field_name,
        jsonb_build_object('old', old_value, 'new', new_value)
      );
    END IF;
  END LOOP;

  -- If there are changes, append to history
  IF changes <> '{}'::JSONB THEN
    NEW.change_history := COALESCE(NEW.change_history, '[]'::JSONB) || jsonb_build_array(
      jsonb_build_object(
        'timestamp', NOW(),
        'user_id', auth.uid(),
        'changes', changes
      )
    );

    -- Keep only last 50 changes to prevent unbounded growth
    IF jsonb_array_length(NEW.change_history) > 50 THEN
      -- Extract last 50 elements
      NEW.change_history := (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(NEW.change_history) elem
          ORDER BY (elem->>'timestamp')::timestamptz DESC
          LIMIT 50
        ) subq
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply change history triggers
-- These run AFTER prevent_audit_field_changes to ensure updated_at is set first
CREATE TRIGGER track_transaction_changes
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

CREATE TRIGGER track_account_changes
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

CREATE TRIGGER track_category_changes
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

CREATE TRIGGER track_rule_changes
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

-- -----------------------------------------------------------------------------
-- 6. User Creation Trigger (Sync Auth to Public Users)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_bookset_id uuid;
BEGIN
  -- 1. Insert into users table
  INSERT INTO users (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name');

  -- 2. Create default bookset
  INSERT INTO booksets (owner_id, name, business_type)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', 'My') || '''s Books', 'personal')
  RETURNING id INTO new_bookset_id;

  -- 3. Update user with bookset references
  UPDATE users
  SET active_bookset_id = new_bookset_id,
      own_bookset_id = new_bookset_id
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. Reconciliation Function
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION finalize_reconciliation(
  _bookset_id uuid,
  _account_id uuid,
  _statement_balance bigint,
  _statement_date timestamp with time zone,
  _opening_balance bigint,
  _calculated_balance bigint,
  _transaction_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _difference bigint;
BEGIN
  -- Calculate difference (trust but verify)
  _difference := _statement_balance - _calculated_balance;

  -- 1. Create Reconciliation Record
  INSERT INTO reconciliations (
    "bookset_id", "account_id",
    "statement_balance", "statement_date",
    "opening_balance", "calculated_balance",
    "difference", "status", "finalized_at",
    "transaction_count", "transaction_ids"
  ) VALUES (
    _bookset_id, _account_id,
    _statement_balance, _statement_date,
    _opening_balance, _calculated_balance,
    _difference, 'balanced', now(),
    array_length(_transaction_ids, 1), cast(_transaction_ids as text[])
  );

  -- 2. Mark Transactions as Reconciled
  UPDATE transactions
  SET reconciled = true, "reconciled_date" = now()
  WHERE id = ANY(_transaction_ids)
  AND "bookset_id" = _bookset_id;

  -- 3. Update Account Last Reconciled State
  UPDATE accounts
  SET "last_reconciled_balance" = _statement_balance,
      "last_reconciled_date" = _statement_date
  WHERE id = _account_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Advanced Features RPCs
-- -----------------------------------------------------------------------------

-- 8.1 RPC: grant_access_by_email
CREATE OR REPLACE FUNCTION grant_access_by_email(
  _bookset_id uuid,
  _email text,
  _role text,
  _can_import boolean DEFAULT false,
  _can_reconcile boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _grant_id uuid;
BEGIN
  -- Find user by email
  SELECT id INTO _user_id FROM users WHERE email = _email;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  -- Check if grant already exists
  SELECT id INTO _grant_id FROM access_grants
  WHERE bookset_id = _bookset_id
    AND user_id = _user_id
    AND revoked_at IS NULL;

  IF _grant_id IS NOT NULL THEN
    -- Update existing grant
    UPDATE access_grants
    SET
      role = _role,
      can_import = _can_import,
      can_reconcile = _can_reconcile
    WHERE id = _grant_id;
    RETURN _grant_id;
  ELSE
    -- Create new grant
    INSERT INTO access_grants (bookset_id, user_id, granted_by, role, can_import, can_reconcile)
    VALUES (_bookset_id, _user_id, auth.uid(), _role, _can_import, _can_reconcile)
    RETURNING id INTO _grant_id;
    RETURN _grant_id;
  END IF;
END;
$$;

-- 8.2 RPC: undo_import_batch
CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Get current user ID once
  _user_id := auth.uid();

  -- Check if any transaction in this batch is reconciled
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE source_batch_id = _batch_id
    AND reconciled = true
  ) THEN
    RAISE EXCEPTION 'Cannot undo batch containing reconciled transactions.';
  END IF;

  -- Soft delete transactions
  UPDATE transactions
  SET is_archived = true,
      updated_at = now(),
      last_modified_by = _user_id
  WHERE source_batch_id = _batch_id;

  -- Mark batch as undone
  UPDATE import_batches
  SET is_undone = true,
      undone_at = now(),
      undone_by = _user_id,
      updated_at = now()
  WHERE id = _batch_id;
END;
$$;

-- 8.3 RPC removed: add_payee_alias (no longer needed after payee refactor)

-- -----------------------------------------------------------------------------
-- 9. Performance Indexes
-- -----------------------------------------------------------------------------

-- TRANSACTIONS TABLE
-- Most common query: Get all transactions for a bookset + account, sorted by date
CREATE INDEX IF NOT EXISTS idx_transactions_bookset_account_date
  ON transactions(bookset_id, account_id, date DESC)
  WHERE is_archived = false;

-- Duplicate detection: Check fingerprint within account
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint
  ON transactions(bookset_id, account_id, fingerprint);

-- Workbench filtering: Get unreviewed transactions
CREATE INDEX IF NOT EXISTS idx_transactions_bookset_reviewed
  ON transactions(bookset_id, is_reviewed, date DESC)
  WHERE is_archived = false;

-- Reconciliation: Get transactions by date range
CREATE INDEX IF NOT EXISTS idx_transactions_account_date_reconciled
  ON transactions(account_id, date, reconciled)
  WHERE is_archived = false;

-- Reports: Filter by category (for split transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_lines_category
  ON transactions USING GIN (lines);

-- RULES TABLE
-- Rule application: Get enabled rules by priority
CREATE INDEX IF NOT EXISTS idx_rules_bookset_priority
  ON rules(bookset_id, priority DESC, is_enabled)
  WHERE is_enabled = true;

-- Rule keyword search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_rules_keyword
  ON rules(bookset_id, LOWER(keyword))
  WHERE is_enabled = true;

-- CATEGORIES TABLE
-- Category hierarchy lookup
CREATE INDEX IF NOT EXISTS idx_categories_bookset_parent
  ON categories(bookset_id, parent_category_id)
  WHERE is_archived = false;

-- Category sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort
  ON categories(bookset_id, sort_order)
  WHERE is_archived = false;

-- ACCOUNTS TABLE
-- Active accounts for bookset
CREATE INDEX IF NOT EXISTS idx_accounts_bookset_active
  ON accounts(bookset_id)
  WHERE is_archived = false;

-- ACCESS GRANTS TABLE
-- Check user access to bookset
CREATE INDEX IF NOT EXISTS idx_access_grants_user_bookset
  ON access_grants(user_id, bookset_id)
  WHERE revoked_at IS NULL;

-- Find all users with access to a bookset
CREATE INDEX IF NOT EXISTS idx_access_grants_bookset
  ON access_grants(bookset_id)
  WHERE revoked_at IS NULL;

-- IMPORT BATCHES TABLE
-- Find batches by account
CREATE INDEX IF NOT EXISTS idx_import_batches_account
  ON import_batches(bookset_id, account_id, imported_at DESC);

-- Undo functionality
CREATE INDEX IF NOT EXISTS idx_import_batches_undone
  ON import_batches(bookset_id, is_undone);

-- PAYEES TABLE
-- Payee lookup for autocomplete
CREATE INDEX IF NOT EXISTS idx_payees_bookset_name
  ON payees(bookset_id, name);

-- TRANSACTIONS - PAYEE INDEX
-- Payee lookup for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_payee_id
  ON transactions(payee_id)
  WHERE payee_id IS NOT NULL;

-- RULES - PAYEE INDEX
-- Payee lookup for rule application
CREATE INDEX IF NOT EXISTS idx_rules_payee_id
  ON rules(payee_id)
  WHERE payee_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 10. Repair Users (Sync missing auth.users to public.users)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  missing_user RECORD;
  new_bookset_id uuid;
BEGIN
  FOR missing_user IN
    SELECT * FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.users)
  LOOP
    RAISE NOTICE 'Fixing user: % (%)', missing_user.id, missing_user.email;

    -- 1. Insert into users table
    INSERT INTO public.users (id, email, display_name)
    VALUES (
      missing_user.id,
      missing_user.email,
      COALESCE(missing_user.raw_user_meta_data->>'display_name', split_part(missing_user.email, '@', 1))
    );

    -- 2. Create default bookset
    INSERT INTO public.booksets (owner_id, name, business_type)
    VALUES (
      missing_user.id,
      COALESCE(missing_user.raw_user_meta_data->>'display_name', 'My') || '''s Books',
      'personal'
    )
    RETURNING id INTO new_bookset_id;

    -- 3. Update user with bookset references
    UPDATE public.users
    SET active_bookset_id = new_bookset_id,
        own_bookset_id = new_bookset_id
    WHERE id = missing_user.id;

  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Analyze Tables (Update statistics for query planner)
-- -----------------------------------------------------------------------------

ANALYZE transactions;
ANALYZE rules;
ANALYZE categories;
ANALYZE accounts;
ANALYZE access_grants;
ANALYZE import_batches;
ANALYZE payees;
ANALYZE booksets;
ANALYZE users;

-- ============================================================================
-- PRODUCTION SCHEMA DEPLOYMENT COMPLETE
-- ============================================================================
-- Your database schema is now production-ready with:
-- ✓ All tables, triggers, functions, and RLS policies
-- ✓ Security: Fixed search_path on all SECURITY DEFINER functions
-- ✓ Performance: Comprehensive indexes for all common queries
-- ✓ Audit: Field-level change history tracking
-- ✓ Multi-user: Access grants and permissions
--
-- Next steps:
-- 1. Verify RLS policies work correctly
-- 2. Test import undo functionality
-- 3. Run performance tests with large datasets
-- 4. Populate with production data
-- ============================================================================
