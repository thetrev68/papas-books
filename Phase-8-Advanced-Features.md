# Phase 8: Advanced Features (Post-MVP)

**Status:** Planned
**Dependencies:** Phase 1-7 (Core System)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md)

---

## Overview

Phase 8 transitions Papa's Books from a personal tool into a professional-grade multi-user system. We unlock capabilities for collaboration, accountability, and power-user automation.

**Key Goals:**

1. **Collaboration:** Enable Bookkeepers (Editors) and Clients (Viewers) to work together via simple email grants.
2. **Accountability:** Track specific field changes (who changed Amount from $10 to $100?).
3. **Safety:** Allow reverting bad import batches (Undo).
4. **Automation Power:** Rules based on amount ranges, regex, and dates.

---

## Feature 1: Multi-User Collaboration

### Database Schema

(Already defined in Phase 1, `access_grants` table).

**New RPC Function: `grant_access_by_email`**
**File:** `supabase/schema.sql`

```sql
CREATE OR REPLACE FUNCTION grant_access_by_email(
  _bookset_id uuid,
  _email text,
  _role text
) RETURNS jsonb AS $$
DECLARE
  _target_user_id uuid;
  _grant_id uuid;
BEGIN
  -- 1. Find User ID
  SELECT id INTO _target_user_id FROM users WHERE email = _email;

  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  -- 2. Check if grant exists (update if so)
  INSERT INTO access_grants ("booksetId", "userId", "role", "grantedBy")
  VALUES (_bookset_id, _target_user_id, _role, auth.uid())
  ON CONFLICT ("booksetId", "userId")
  DO UPDATE SET
    role = EXCLUDED.role,
    "revokedAt" = NULL -- Re-activate if revoked
  RETURNING id INTO _grant_id;

  RETURN jsonb_build_object('success', true, 'grantId', _grant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### UI Implementation

**Component:** `SettingsAccessTab.tsx`

**State:**

- `email`: string
- `role`: 'viewer' | 'editor'

**Logic:**

1. Call `supabase.rpc('grant_access_by_email', { ... })`.
2. Handle error "User not found" by telling user: "The person you are inviting must sign up for Papa's Books first."

---

## Feature 2: Audit Trail & History

### Schema Update: `changeHistory`

Ensure all major tables (`transactions`, `accounts`, `rules`) have the `changeHistory` column (JSONB).

### Trigger Function Enhancement

**File:** `supabase/schema.sql`

Modify the existing `prevent_audit_field_changes` trigger (or create a new one `track_changes`) to actually _record_ the delta.

```sql
CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER AS $$
DECLARE
  _history_entry jsonb;
BEGIN
  -- Only track if meaningful fields changed (ignore updatedAt)
  IF OLD IS DISTINCT FROM NEW THEN
    _history_entry := jsonb_build_object(
      'timestamp', now(),
      'userId', auth.uid(),
      'changes', to_jsonb(NEW) - 'changeHistory' - 'updatedAt' -- Simplistic full dump for POC
      -- Ideally, we calculate specific field diffs here, but full row dump is safer/easier for now
    );

    -- Append to array (initialize if null)
    NEW."changeHistory" := coalesce(OLD."changeHistory", '[]'::jsonb) || _history_entry;
  END IF;

  NEW."lastModifiedBy" := auth.uid();
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### UI Implementation (Audit)

**Component:** `TransactionHistoryModal.tsx`

**Props:**

- `history`: Array of changes (from JSONB).

**Render:**

- List of timestamps and User IDs.
- For each entry, show a crude diff (e.g., "Amount changed").

---

## Feature 3: Undo Import (The "Oops" Button)

### Database Schema (Undo)

(Already defined in Phase 3, `import_batches` table).

### RPC Function: `undo_import_batch`

**File:** `supabase/schema.sql`

```sql
CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. Validate: Ensure no transactions in this batch are reconciled
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE "sourceBatchId" = _batch_id
    AND reconciled = true
  ) THEN
    RAISE EXCEPTION 'Cannot undo batch containing reconciled transactions.';
  END IF;

  -- 2. Soft Delete Transactions
  UPDATE transactions
  SET "isArchived" = true,
      "updatedAt" = now()
  WHERE "sourceBatchId" = _batch_id;

  -- 3. Mark Batch as Undone
  UPDATE import_batches
  SET "isUndone" = true,
      "undoneAt" = now(),
      "undoneBy" = auth.uid()
  WHERE id = _batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### UI Implementation (Undo)

**Page:** `ImportPage.tsx`

**Addition:** "Recent Imports" list below the upload area.

- Columns: Date, File Name, Count, Status.
- Action: "Undo" button (Red).
- Confirmation: "Are you sure? This will remove X transactions."

---

## Feature 4: Advanced Rules Engine

### TypeScript Interfaces

**File:** `src/types/rules.ts`

```typescript
export interface RuleConditions {
  amountMin?: number; // Cents
  amountMax?: number; // Cents
  dateRange?: {
    startMonth?: number; // 1-12
    endMonth?: number;
    startDay?: number; // 1-31
    endDay?: number;
  };
  descriptionRegex?: string; // Raw regex string
}

// Update existing Rule interface
export interface Rule {
  // ... existing fields
  conditions?: RuleConditions;
}
```

### Logic Implementation

**File:** `src/lib/rules/matcher.ts`

Update `matchesRule` function to check conditions _after_ the keyword match.

```typescript
export function matchesRule(description: string, amount: number, date: Date, rule: Rule): boolean {
  // 1. Basic Keyword Match (Existing)
  if (!basicMatch(description, rule)) return false;

  // 2. Advanced Conditions
  if (rule.conditions) {
    const { amountMin, amountMax, dateRange, descriptionRegex } = rule.conditions;

    // Amount Check (Absolute value to handle expenses consistently)
    const absAmount = Math.abs(amount);
    if (amountMin !== undefined && absAmount < amountMin) return false;
    if (amountMax !== undefined && absAmount > amountMax) return false;

    // Regex Check
    if (descriptionRegex) {
      try {
        const regex = new RegExp(descriptionRegex, 'i');
        if (!regex.test(description)) return false;
      } catch (e) {
        console.warn('Invalid regex in rule', rule.id);
        return false;
      }
    }

    // Date checks...
  }

  return true;
}
```

### UI Implementation (Rules)

**Component:** `RuleFormModal.tsx`

**Addition:** "Advanced Conditions" section (collapsible).

- Inputs for Min Amount, Max Amount.
- Input for Regex.

---

## Task Checklist

1. [ ] **Multi-User:** Add `grant_access_by_email` RPC to Supabase.
2. [ ] **Multi-User:** Update Settings UI to call this RPC.
3. [ ] **Audit:** Update `track_changes` trigger in Supabase.
4. [ ] **Audit:** Add `TransactionHistoryModal` to Workbench.
5. [ ] **Undo:** Add `undo_import_batch` RPC.
6. [ ] **Undo:** Add "Recent Imports" list to Import Page.
7. [ ] **Rules:** Update `Rule` type with `conditions`.
8. [ ] **Rules:** Update `matchesRule` logic to check conditions.
9. [ ] **Rules:** Add inputs to `RuleFormModal`.
