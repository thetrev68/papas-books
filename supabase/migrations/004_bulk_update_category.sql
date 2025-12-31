-- Migration: Bulk Category Update Function
-- Description: Updates category for multiple transactions in a single operation
-- Safely handles splits by converting them to simple transactions

CREATE OR REPLACE FUNCTION bulk_update_category(
  _transaction_ids uuid[],
  _category_id uuid
)
RETURNS TABLE(
  updated_count int,
  skipped_count int,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _updated_count int := 0;
  _skipped_count int := 0;
  _tx_record RECORD;
BEGIN
  -- Validate inputs
  IF _transaction_ids IS NULL OR array_length(_transaction_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 'No transaction IDs provided'::text;
    RETURN;
  END IF;

  IF _category_id IS NULL THEN
    RETURN QUERY SELECT 0, 0, 'Category ID is required'::text;
    RETURN;
  END IF;

  -- Loop through transactions and update those that are editable
  FOR _tx_record IN
    SELECT id, amount, is_archived, reconciled, date
    FROM transactions
    WHERE id = ANY(_transaction_ids)
  LOOP
    -- Skip if transaction is locked (archived, reconciled, or in filed tax year)
    IF _tx_record.is_archived OR _tx_record.reconciled THEN
      _skipped_count := _skipped_count + 1;
      CONTINUE;
    END IF;

    -- Update transaction:
    -- - Convert split to simple (is_split = false)
    -- - Replace lines with single category line
    -- - Preserve original amount
    UPDATE transactions
    SET
      is_split = false,
      lines = jsonb_build_array(
        jsonb_build_object(
          'category_id', _category_id,
          'amount', _tx_record.amount,
          'memo', ''
        )
      ),
      updated_at = now(),
      last_modified_by = auth.uid()
    WHERE id = _tx_record.id;

    _updated_count := _updated_count + 1;
  END LOOP;

  RETURN QUERY SELECT _updated_count, _skipped_count, NULL::text;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION bulk_update_category TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_update_category IS
  'Bulk update category for multiple transactions. Converts split transactions to simple. Skips locked/reconciled transactions.';
