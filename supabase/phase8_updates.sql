-- Phase 8: Advanced Features Updates

-- -----------------------------------------------------------------------------
-- 1. RPC: grant_access_by_email
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_access_by_email(
  _bookset_id uuid,
  _email text,
  _role text
) RETURNS jsonb AS $$
DECLARE
  _target_user_id uuid;
  _grant_id uuid;
BEGIN
  -- Find user by email in public.users
  SELECT id INTO _target_user_id FROM public.users WHERE email = _email;

  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Prevent self-granting (optional, but good practice)
  IF _target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot grant access to yourself');
  END IF;

  -- Insert or update grant
  INSERT INTO public.access_grants ("bookset_id", "user_id", "role", "granted_by")
  VALUES (_bookset_id, _target_user_id, _role, auth.uid())
  ON CONFLICT ("bookset_id", "user_id")
  DO UPDATE SET
    role = EXCLUDED.role,
    revoked_at = NULL,
    revoked_by = NULL
  RETURNING id INTO _grant_id;

  RETURN jsonb_build_object('success', true, 'grantId', _grant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. Trigger: track_change_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER AS $$
DECLARE
  _history_entry jsonb;
BEGIN
  -- Only track if something actually changed
  IF OLD IS DISTINCT FROM NEW THEN
    -- Construct history entry
    -- We filter out 'change_history', 'updated_at', 'updated_by' to avoid noise/recursion
    _history_entry := jsonb_build_object(
      'timestamp', now(),
      'userId', auth.uid(),
      'changes', to_jsonb(NEW) - 'change_history' - 'updated_at' - 'last_modified_by'
    );

    -- Append to existing history or start new array
    -- Note: 'change_history' column must exist on the table
    NEW.change_history := coalesce(OLD.change_history, '[]'::jsonb) || _history_entry;
  END IF;

  -- Ensure standard audit fields are updated (though prevent_audit_field_changes might already do this,
  -- we do it here to be safe and consistent with the history entry)
  NEW.last_modified_by := auth.uid();
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS tr_audit_transactions ON public.transactions;
CREATE TRIGGER tr_audit_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

DROP TRIGGER IF EXISTS tr_audit_accounts ON public.accounts;
CREATE TRIGGER tr_audit_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

DROP TRIGGER IF EXISTS tr_audit_rules ON public.rules;
CREATE TRIGGER tr_audit_rules
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION track_change_history();

-- -----------------------------------------------------------------------------
-- 3. RPC: undo_import_batch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if any transaction in this batch is reconciled
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE source_batch_id = _batch_id
    AND reconciled = true
  ) THEN
    RAISE EXCEPTION 'Cannot undo batch containing reconciled transactions.';
  END IF;

  -- Soft delete transactions
  UPDATE public.transactions
  SET is_archived = true,
      updated_at = now(),
      last_modified_by = auth.uid()
  WHERE source_batch_id = _batch_id;

  -- Mark batch as undone
  UPDATE public.import_batches
  SET is_undone = true,
      undone_at = now(),
      undone_by = auth.uid()
  WHERE id = _batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
