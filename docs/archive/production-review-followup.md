# Production Review Follow-up (Proposed SQL Changes)

This document captures the critical findings from the v1.0 production candidate review and proposes SQL hardening changes for follow-up at a later time. The focus is on privileged RPCs that currently bypass row-level security (RLS).

## Summary of Critical Findings

- `grant_access_by_email` is `SECURITY DEFINER` with no authorization guard, which allows any authenticated user to grant access to arbitrary booksets if they know the ID.
- `finalize_reconciliation` is `SECURITY DEFINER` with no authorization guard or ownership checks for accounts/transactions.
- `undo_import_batch` is `SECURITY DEFINER` with no authorization guard on the target batch/bookset.

## Proposed SQL Changes

Below are proposed updates to add explicit authorization checks. These checks assume that only **bookset owners** can perform these actions. If your intended policy is different (e.g., editors can reconcile or undo imports), adjust the `user_owns_bookset(...)` calls to `user_can_write_bookset(...)` or a more specific policy function.

### 1) `grant_access_by_email`

Add an ownership check before granting or updating access grants.

```sql
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
  -- Authorization: Only owner (or admin) can grant access
  IF NOT (user_owns_bookset(_bookset_id) OR user_is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to grant access for this bookset';
  END IF;

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
```

### 2) `finalize_reconciliation`

Add authorization and ownership checks for the account and transaction IDs.

```sql
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
  -- Authorization: Only owner (or admin) can reconcile
  IF NOT (user_owns_bookset(_bookset_id) OR user_is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to reconcile this bookset';
  END IF;

  -- Ensure account belongs to bookset
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = _account_id AND bookset_id = _bookset_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to bookset';
  END IF;

  -- Ensure all transactions belong to bookset and account
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE id = ANY(_transaction_ids)
      AND (bookset_id != _bookset_id OR account_id != _account_id)
  ) THEN
    RAISE EXCEPTION 'One or more transactions do not belong to bookset/account';
  END IF;

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
```

### 3) `undo_import_batch`

Add authorization and ownership checks for the import batch.

```sql
CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _bookset_id uuid;
BEGIN
  -- Resolve bookset for the batch
  SELECT bookset_id INTO _bookset_id
  FROM import_batches
  WHERE id = _batch_id;

  IF _bookset_id IS NULL THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;

  -- Authorization: Only owner (or admin) can undo imports
  IF NOT (user_owns_bookset(_bookset_id) OR user_is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to undo imports for this bookset';
  END IF;

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
      undone_at = now(),
      undone_by = auth.uid(),
      updated_at = now()
  WHERE id = _batch_id;
END;
$$;
```

## Optional Hardening (If You Want RLS Instead of Definers)

If you choose to rely on RLS instead of explicit checks, convert these to `SECURITY INVOKER` and set `SET row_security = on`, then ensure RLS policies allow only the intended role. This is more invasive and would need testing with the RPC call paths.

## Follow-up Tests (Suggested)

- Add security tests that attempt unauthorized RPC calls (grant, reconcile, undo) from a non-owner user and assert they fail.
- Add a positive-path test for owners to confirm expected behavior.
