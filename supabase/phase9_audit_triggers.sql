-- ============================================================================
-- Phase 9: Audit Trail Implementation
-- ============================================================================
-- This script adds change_history tracking to all major entities
-- using PostgreSQL triggers and JSONB storage.
--
-- Features:
-- - Automatic change tracking on UPDATE operations
-- - Stores last 50 changes per record
-- - Tracks user_id, timestamp, and field-level changes
-- - Excludes audit fields from tracking to avoid recursion
--
-- Usage: Run this script in Supabase SQL Editor after main schema.sql
-- ============================================================================

-- Add change_history column to categories and rules tables
-- (transactions and accounts already have this column in schema.sql)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS change_history jsonb;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS change_history jsonb;

-- ============================================================================
-- Change History Tracking Function
-- ============================================================================

CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER AS $$
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
    SELECT jsonb_object_keys(new_row)
    WHERE jsonb_object_keys(new_row) NOT IN (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Apply Triggers to Track Changes
-- ============================================================================

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS track_transaction_changes ON public.transactions;
DROP TRIGGER IF EXISTS track_account_changes ON public.accounts;
DROP TRIGGER IF EXISTS track_category_changes ON public.categories;
DROP TRIGGER IF EXISTS track_rule_changes ON public.rules;

-- Create triggers on each table
-- IMPORTANT: These run BEFORE UPDATE, after the prevent_audit_field_changes trigger
-- This ensures updated_at and last_modified_by are set before we snapshot the change

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

-- ============================================================================
-- Testing & Verification
-- ============================================================================

-- Test 1: Update a transaction and verify change_history is populated
-- Run this after creating sample data:
--
-- UPDATE transactions
-- SET payee = 'Updated Payee Name'
-- WHERE id = '<your-transaction-id>';
--
-- SELECT id, payee, change_history
-- FROM transactions
-- WHERE id = '<your-transaction-id>';
--
-- Expected output:
-- change_history should contain an array with one entry showing:
-- {
--   "timestamp": "2025-12-25T...",
--   "user_id": "<your-user-id>",
--   "changes": {
--     "payee": {
--       "old": "Old Payee Name",
--       "new": "Updated Payee Name"
--     }
--   }
-- }

-- Test 2: Verify multiple changes accumulate
-- UPDATE the same transaction again and verify array length increases

-- Test 3: Verify 50-change limit
-- Make 60+ updates and verify only last 50 are kept

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- To remove change tracking:
-- DROP TRIGGER IF EXISTS track_transaction_changes ON public.transactions;
-- DROP TRIGGER IF EXISTS track_account_changes ON public.accounts;
-- DROP TRIGGER IF EXISTS track_category_changes ON public.categories;
-- DROP TRIGGER IF EXISTS track_rule_changes ON public.rules;
-- DROP FUNCTION IF EXISTS track_change_history();
--
-- To remove columns:
-- ALTER TABLE public.categories DROP COLUMN IF EXISTS change_history;
-- ALTER TABLE public.rules DROP COLUMN IF EXISTS change_history;
