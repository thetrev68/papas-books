-- ============================================================================
-- Fix Function Search Path Security Issues
-- ============================================================================
-- This migration adds "SET search_path = public, pg_temp" to all functions
-- to prevent search path injection attacks as recommended by Supabase linter.
--
-- Context: Functions without a fixed search_path can be vulnerable to attacks
-- where a malicious user creates objects in a schema that gets searched before
-- the intended schema, potentially hijacking function behavior.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================================

-- 1. RLS Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION user_owns_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM booksets WHERE id = bookset_id AND owner_id = auth.uid()
  );
END;
$$;

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
        (min_role = 'viewer' AND role IN ('viewer', 'editor', 'owner')) OR
        (min_role = 'editor' AND role IN ('editor', 'owner')) OR
        (min_role = 'owner' AND role = 'owner')
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION user_can_read_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'viewer') OR user_is_admin();
END;
$$;

CREATE OR REPLACE FUNCTION user_can_write_bookset(bookset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN user_owns_bookset(bookset_id) OR user_has_access_grant(bookset_id, 'editor') OR user_is_admin();
END;
$$;

CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true);
END;
$$;

-- 2. Audit Trail Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION set_audit_fields_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.last_modified_by := auth.uid();
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
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.last_modified_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 3. Business Logic Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION add_payee_alias(payee_id uuid, new_alias text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE payees
  SET aliases = array_append(aliases, new_alias)
  WHERE id = payee_id;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_reconciliation(
  _account_id uuid,
  _statement_date date,
  _statement_balance bigint,
  _reconciled_transaction_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mark transactions as reconciled
  UPDATE transactions
  SET reconciled = true
  WHERE id = ANY(_reconciled_transaction_ids);

  -- Update account reconciliation info
  UPDATE accounts
  SET
    last_reconciled_date = _statement_date,
    last_reconciled_balance = _statement_balance,
    updated_at = now()
  WHERE id = _account_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  field_name text;
  old_value jsonb;
  new_value jsonb;
BEGIN
  -- Build changes object by comparing OLD and NEW
  FOR field_name IN
    SELECT column_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = TG_TABLE_NAME
      AND column_name NOT IN ('id', 'created_at', 'updated_at', 'last_modified_by', 'change_history')
  LOOP
    old_value := to_jsonb(OLD.*)->>field_name;
    new_value := to_jsonb(NEW.*)->>field_name;

    IF old_value IS DISTINCT FROM new_value THEN
      changes := changes || jsonb_build_object(
        field_name,
        jsonb_build_object('old', old_value, 'new', new_value)
      );
    END IF;
  END LOOP;

  -- If there are changes, append to history
  IF changes <> '{}'::jsonb THEN
    NEW.change_history := COALESCE(NEW.change_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'user_id', auth.uid(),
        'changes', changes
      )
    );

    -- Keep only last 50 changes
    IF jsonb_array_length(NEW.change_history) > 50 THEN
      NEW.change_history := NEW.change_history->(-50);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate to handle signature changes
DROP FUNCTION IF EXISTS undo_import_batch(uuid);

CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
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
      last_modified_by = auth.uid()
  WHERE source_batch_id = _batch_id;

  -- Mark batch as undone
  UPDATE import_batches
  SET is_undone = true,
      updated_at = now()
  WHERE id = _batch_id;
END;
$$;

-- 4. Auth Integration Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_bookset_id uuid;
BEGIN
  -- Create personal bookset
  INSERT INTO public.booksets (owner_id, name, business_type)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)) || '''s Books', 'personal')
  RETURNING id INTO new_bookset_id;

  -- Create user profile
  INSERT INTO public.users (id, email, display_name, active_bookset_id, own_bookset_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    new_bookset_id,
    new_bookset_id
  );

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify all functions now have search_path set
-- Run this query to confirm:
-- SELECT
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as arguments,
--   p.proconfig as config_settings
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
--   AND p.proname IN (
--     'user_owns_bookset',
--     'user_has_access_grant',
--     'user_can_read_bookset',
--     'user_can_write_bookset',
--     'user_is_admin',
--     'set_audit_fields_on_create',
--     'prevent_audit_field_changes',
--     'add_payee_alias',
--     'finalize_reconciliation',
--     'grant_access_by_email',
--     'track_change_history',
--     'undo_import_batch',
--     'handle_new_user'
--   )
-- ORDER BY p.proname;
