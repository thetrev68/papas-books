-- ============================================================================
-- Migration 003: Tax Year Locking
-- ============================================================================
-- Adds tax_year_locks table to prevent modifications to closed tax years
-- ============================================================================

-- Create tax year locks table
CREATE TABLE IF NOT EXISTS public.tax_year_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  tax_year int NOT NULL,
  locked_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_by uuid REFERENCES public.users(id) NOT NULL,
  UNIQUE(bookset_id, tax_year)
);

-- Enable RLS
ALTER TABLE public.tax_year_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read locks for their booksets"
  ON public.tax_year_locks
  FOR SELECT
  USING (user_can_read_bookset(bookset_id));

CREATE POLICY "Owners can manage locks"
  ON public.tax_year_locks
  FOR ALL
  USING (user_owns_bookset(bookset_id))
  WITH CHECK (user_owns_bookset(bookset_id));

-- Index for fast lookups
CREATE INDEX idx_tax_year_locks_bookset
  ON public.tax_year_locks(bookset_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

/**
 * Gets the maximum locked year for a bookset
 * Returns NULL if no years are locked
 */
CREATE OR REPLACE FUNCTION get_max_locked_year(p_bookset_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_year int;
BEGIN
  SELECT MAX(tax_year)
  INTO max_year
  FROM tax_year_locks
  WHERE bookset_id = p_bookset_id;

  RETURN max_year;
END;
$$;

/**
 * Checks if a transaction date is in a locked year
 * A year is considered locked if it's <= the maximum locked year
 */
CREATE OR REPLACE FUNCTION is_date_locked(
  p_bookset_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_locked_year int;
  transaction_year int;
BEGIN
  -- Get max locked year for this bookset
  max_locked_year := get_max_locked_year(p_bookset_id);

  -- If no years are locked, date is not locked
  IF max_locked_year IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Extract year from date
  transaction_year := EXTRACT(YEAR FROM p_date);

  -- Date is locked if its year is <= max locked year
  RETURN transaction_year <= max_locked_year;
END;
$$;

/**
 * Lock a specific tax year
 * Validates that the year hasn't been locked yet
 */
CREATE OR REPLACE FUNCTION lock_tax_year(
  p_bookset_id uuid,
  p_year int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify user owns bookset
  IF NOT user_owns_bookset(p_bookset_id) THEN
    RAISE EXCEPTION 'Only bookset owners can lock tax years';
  END IF;

  -- Insert lock record
  INSERT INTO tax_year_locks (bookset_id, tax_year, locked_by)
  VALUES (p_bookset_id, p_year, auth.uid())
  ON CONFLICT (bookset_id, tax_year) DO NOTHING;
END;
$$;

/**
 * Unlock a specific tax year
 */
CREATE OR REPLACE FUNCTION unlock_tax_year(
  p_bookset_id uuid,
  p_year int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify user owns bookset
  IF NOT user_owns_bookset(p_bookset_id) THEN
    RAISE EXCEPTION 'Only bookset owners can unlock tax years';
  END IF;

  -- Delete lock record
  DELETE FROM tax_year_locks
  WHERE bookset_id = p_bookset_id
    AND tax_year = p_year;
END;
$$;

-- ============================================================================
-- Transaction Protection Trigger
-- ============================================================================

/**
 * Prevents updates/deletes to transactions in locked years
 */
CREATE OR REPLACE FUNCTION prevent_locked_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_locked boolean;
BEGIN
  -- For DELETE operations, check OLD record
  IF TG_OP = 'DELETE' THEN
    is_locked := is_date_locked(OLD.bookset_id, OLD.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot delete transaction in locked tax year %',
        EXTRACT(YEAR FROM OLD.date::date);
    END IF;
    RETURN OLD;
  END IF;

  -- For UPDATE operations, check both OLD and NEW
  IF TG_OP = 'UPDATE' THEN
    -- Check if old date is locked
    is_locked := is_date_locked(OLD.bookset_id, OLD.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot modify transaction in locked tax year %',
        EXTRACT(YEAR FROM OLD.date::date);
    END IF;

    -- Check if new date would move it into a locked year
    is_locked := is_date_locked(NEW.bookset_id, NEW.date::date);
    IF is_locked THEN
      RAISE EXCEPTION 'Cannot change transaction date to locked tax year %',
        EXTRACT(YEAR FROM NEW.date::date);
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT operations are not blocked
  RETURN NEW;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS enforce_tax_year_locks ON public.transactions;
CREATE TRIGGER enforce_tax_year_locks
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_transaction_changes();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_max_locked_year TO authenticated;
GRANT EXECUTE ON FUNCTION is_date_locked TO authenticated;
GRANT EXECUTE ON FUNCTION lock_tax_year TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_tax_year TO authenticated;

-- ============================================================================
-- Rollback SQL (for reference)
-- ============================================================================
-- To rollback this migration, run:
--
-- DROP TRIGGER IF EXISTS enforce_tax_year_locks ON public.transactions;
-- DROP FUNCTION IF EXISTS prevent_locked_transaction_changes();
-- DROP FUNCTION IF EXISTS lock_tax_year(uuid, int);
-- DROP FUNCTION IF EXISTS unlock_tax_year(uuid, int);
-- DROP FUNCTION IF EXISTS is_date_locked(uuid, date);
-- DROP FUNCTION IF EXISTS get_max_locked_year(uuid);
-- DROP TABLE IF EXISTS public.tax_year_locks CASCADE;
