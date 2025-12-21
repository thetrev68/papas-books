-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 0. Cleanup (Reset Schema)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.reconciliations CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.import_batches CASCADE;
DROP TABLE IF EXISTS public.rules CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.access_grants CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.booksets CASCADE;

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
  can_reconcile boolean DEFAULT false
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
  change_history jsonb
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
  last_modified_by uuid REFERENCES public.users(id)
);

-- Table: transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  date timestamp with time zone NOT NULL,
  payee text NOT NULL,
  original_description text NOT NULL,
  amount bigint NOT NULL, -- in cents
  is_split boolean DEFAULT false,
  lines jsonb NOT NULL,
  is_reviewed boolean DEFAULT false,
  reconciled boolean DEFAULT false,
  reconciled_date timestamp with time zone,
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
  change_history jsonb
);

-- Table: rules
CREATE TABLE public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  keyword text NOT NULL,
  match_type text CHECK (match_type IN ('contains', 'exact', 'startsWith', 'regex')) NOT NULL,
  case_sensitive boolean DEFAULT false,
  target_category_id uuid REFERENCES public.categories(id),
  suggested_payee text,
  priority int DEFAULT 0,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  use_count int DEFAULT 0,
  conditions jsonb,
  created_by uuid REFERENCES public.users(id),
  last_modified_by uuid REFERENCES public.users(id)
);

-- Table: reconciliations
CREATE TABLE public.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  statement_date timestamp with time zone NOT NULL,
  statement_balance bigint NOT NULL,
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
  csv_mapping_snapshot jsonb
);

-- Add transaction source_batch_id FK
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_batch FOREIGN KEY (source_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. RLS Helper Functions
-- -----------------------------------------------------------------------------

-- Check if user owns this bookset
CREATE OR REPLACE FUNCTION user_owns_bookset(bookset_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.booksets
    WHERE id = bookset_id
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access grant to this bookset
CREATE OR REPLACE FUNCTION user_has_access_grant(bookset_id uuid, min_role text DEFAULT 'viewer')
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.access_grants
    WHERE bookset_id = bookset_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can read this bookset
CREATE OR REPLACE FUNCTION user_can_read_bookset(bookset_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can write to this bookset
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
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3. RLS Policies
-- -----------------------------------------------------------------------------

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can create own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage users"
  ON public.users FOR UPDATE
  USING (user_is_admin())
  WITH CHECK (user_is_admin());

-- Booksets
ALTER TABLE public.booksets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read accessible booksets"
  ON public.booksets FOR SELECT
  USING (user_can_read_bookset(id));

CREATE POLICY "Users can create own booksets"
  ON public.booksets FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

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

-- Child Tables (Accounts, Categories, Rules, Import Batches)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Users can read accounts" ON public.accounts FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read categories" ON public.categories FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read rules" ON public.rules FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Users can read import_batches" ON public.import_batches FOR SELECT USING (user_can_read_bookset(bookset_id));

-- Write policies
CREATE POLICY "Editors can insert accounts" ON public.accounts FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update accounts" ON public.accounts FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert categories" ON public.categories FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update categories" ON public.categories FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert rules" ON public.rules FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update rules" ON public.rules FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));

CREATE POLICY "Editors can insert import_batches" ON public.import_batches FOR INSERT WITH CHECK (user_can_write_bookset(bookset_id));
CREATE POLICY "Editors can update import_batches" ON public.import_batches FOR UPDATE USING (user_can_write_bookset(bookset_id)) WITH CHECK (user_can_write_bookset(bookset_id));

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
-- 4. Triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_audit_fields_on_create()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  NEW.created_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION prevent_audit_field_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_by != NEW.created_by OR OLD.created_at != NEW.created_at THEN
    RAISE EXCEPTION 'Cannot modify created_by or created_at fields';
  END IF;
  NEW.last_modified_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION protect_user_fields()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Apply triggers
CREATE TRIGGER users_protect_fields BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION protect_user_fields();

CREATE TRIGGER accounts_set_audit_on_create BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER accounts_prevent_audit_changes BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER categories_set_audit_on_create BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER categories_prevent_audit_changes BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER transactions_set_audit_on_create BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER transactions_prevent_audit_changes BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

CREATE TRIGGER rules_set_audit_on_create BEFORE INSERT ON public.rules FOR EACH ROW EXECUTE FUNCTION set_audit_fields_on_create();
CREATE TRIGGER rules_prevent_audit_changes BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION prevent_audit_field_changes();

-- -----------------------------------------------------------------------------
-- 5. User Creation Trigger (Sync Auth to Public Users)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_bookset_id uuid;
BEGIN
  -- 1. Insert into users table
  INSERT INTO public.users (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name');

  -- 2. Create default bookset
  INSERT INTO public.booksets (owner_id, name, business_type)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', 'My') || '''s Books', 'personal')
  RETURNING id INTO new_bookset_id;

  -- 3. Update user with bookset references
  UPDATE public.users
  SET active_bookset_id = new_bookset_id,
      own_bookset_id = new_bookset_id
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();