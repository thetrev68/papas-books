CREATE OR REPLACE FUNCTION finalize_reconciliation(
  _bookset_id uuid,
  _account_id uuid,
  _statement_balance bigint,
  _statement_date timestamp with time zone,
  _opening_balance bigint,
  _calculated_balance bigint,
  _transaction_ids uuid[]
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
