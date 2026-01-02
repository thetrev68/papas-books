-- ============================================================================
-- Migration: Payee Refactor
-- ============================================================================
-- This migration refactors the payee system to separate concerns:
-- - Bank Description (original_description): Immutable reference data from CSV
-- - Payee: User-managed master list with optional default category
-- - Remove unused 'aliases' concept from payees table
--
-- Changes:
-- 1. Make transactions.payee nullable (payee assignment is part of review workflow)
-- 2. Add payees.default_category_id for payee-level default categorization
-- 3. Remove payees.aliases column (no longer used)
-- 4. Update rules to support payee_id instead of suggested_payee text
-- 5. Add payee_id to transactions table (FK to payees)
-- ============================================================================

-- Step 1: Make transactions.payee nullable
ALTER TABLE public.transactions
  ALTER COLUMN payee DROP NOT NULL;

-- Step 2: Add payee_id to transactions
ALTER TABLE public.transactions
  ADD COLUMN payee_id uuid REFERENCES public.payees(id) ON DELETE SET NULL;

-- Step 3: Create index for payee lookups
CREATE INDEX IF NOT EXISTS idx_transactions_payee_id
  ON public.transactions(payee_id)
  WHERE payee_id IS NOT NULL;

-- Step 4: Rename category_id to default_category_id in payees table for clarity
ALTER TABLE public.payees
  RENAME COLUMN category_id TO default_category_id;

-- Step 5: Remove aliases column from payees
ALTER TABLE public.payees
  DROP COLUMN IF EXISTS aliases;

-- Step 6: Drop the old alias index
DROP INDEX IF EXISTS idx_payees_aliases;

-- Step 7: Drop the old add_payee_alias function (no longer needed)
DROP FUNCTION IF EXISTS public.add_payee_alias(uuid, text);

-- Step 8: Add payee_id to rules table
ALTER TABLE public.rules
  ADD COLUMN payee_id uuid REFERENCES public.payees(id) ON DELETE SET NULL;

-- Step 9: Create index for rule payee lookups
CREATE INDEX IF NOT EXISTS idx_rules_payee_id
  ON public.rules(payee_id)
  WHERE payee_id IS NOT NULL;

-- Step 10: Update comments for clarity
COMMENT ON COLUMN public.transactions.payee IS 'Legacy text field for payee name (will be deprecated in favor of payee_id)';
COMMENT ON COLUMN public.transactions.payee_id IS 'Foreign key to payees table - the actual person/company being paid';
COMMENT ON COLUMN public.transactions.original_description IS 'Immutable bank description from CSV - reference data only, not editable';
COMMENT ON COLUMN public.payees.default_category_id IS 'Default category to apply when this payee is assigned to a transaction';
COMMENT ON COLUMN public.rules.payee_id IS 'Payee to assign when this rule matches';
COMMENT ON COLUMN public.rules.suggested_payee IS 'DEPRECATED: Use payee_id instead. Legacy text field for payee suggestions.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next steps for application code:
-- 1. Update TypeScript types to reflect nullable payee and new payee_id
-- 2. Remove payee auto-creation from CSV import pipeline
-- 3. Update rules engine to use payee_id and apply category hierarchy
-- 4. Update UI to support payee assignment during review workflow
-- ============================================================================
