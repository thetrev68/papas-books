-- ============================================================================
-- Fix: track_change_history function
-- ============================================================================
-- Addresses "set-returning functions are not allowed in WHERE" error
-- by correctly selecting from jsonb_object_keys in FROM clause.
-- ============================================================================

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
