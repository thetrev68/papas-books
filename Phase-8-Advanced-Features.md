# Phase 8A: Advanced Features (Post-MVP, Free Supabase Scope)

**Status:** Planned
**Dependencies:** Phase 1-7 (Core System)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md)

---

## Overview

Phase 8A transitions Papa's Books from a personal tool into a professional-grade multi-user system. It adds collaboration, accountability, safe rollbacks, and more powerful automation. This phase intentionally excludes paid Supabase capabilities.

**Key Goals:**

1. **Collaboration:** Enable Bookkeepers (Editors) and Clients (Viewers) via email grants.
2. **Accountability:** Track who changed what and when.
3. **Safety:** Undo bad imports without data loss.
4. **Automation Power:** Rules based on amount ranges, regex, and dates.

**Scope Note:** This phase intentionally excludes features that depend on paid Supabase capabilities.

---

## Out of Scope (Deferred from Phase 8)

- Attachments (receipt images linked to transactions)
- Scheduled reports / email delivery
- Budget tracking against categories
- Bank account balance tracking over time
- Recurring transaction templates

---

## Conceptual Model

### Access Grants

```text
1. Owner enters collaborator email + role
   ↓
2. RPC resolves userId and inserts/updates access_grant
   ↓
3. RLS policies allow read/write based on role
   ↓
4. Collaborator sees bookset in switcher
```

### Audit Trail

```text
1. User edits a transaction/account/rule
   ↓
2. Trigger captures changeHistory entry
   ↓
3. UI renders history modal with timestamps and fields
```

### Undo Import

```text
1. User selects a recent import batch
   ↓
2. RPC checks for reconciled transactions
   ↓
3. If safe, mark transactions archived + batch undone
```

### Advanced Rules

```text
1. Rule keyword matches description
   ↓
2. Optional conditions check amount, regex, date patterns
   ↓
3. Rule applied if all conditions pass
```

---

## Data Model

### Access Grants (Data Model, Existing in Phase 1)

**Table:** `access_grants`

- `booksetId`
- `userId`
- `role` ('viewer' | 'editor')
- `grantedBy`
- `revokedAt`

**RLS Expectations:**

- Owner can grant/revoke.
- Editors can edit transactions/rules.
- Viewers are read-only.

### Audit Trail (Data Model)

**Columns:**

- `changeHistory` JSONB on `transactions`, `accounts`, `rules`
- `lastModifiedBy`, `updatedAt` updated by triggers

### Undo Import (Data Model)

**Tables:**

- `import_batches` must include `isUndone`, `undoneAt`, `undoneBy`.
- `transactions` must include `isArchived` to allow soft-delete.

### Advanced Rules (Data Model)

**Table:** `rules`

- New JSONB field `conditions` to store advanced constraints.

---

## Types & Interfaces

### File: `src/types/access.ts`

```typescript
export interface AccessGrant {
  id: string;
  booksetId: string;
  userId: string;
  role: 'viewer' | 'editor';
  grantedBy: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface GrantAccessResult {
  success: boolean;
  grantId?: string;
  message?: string;
}
```

### File: `src/types/audit.ts`

```typescript
export interface ChangeHistoryEntry {
  timestamp: string;
  userId: string;
  changes: Record<string, unknown>;
}
```

### File: `src/types/rules.ts`

```typescript
export interface RuleConditions {
  amountMin?: number; // cents
  amountMax?: number; // cents
  dateRange?: {
    startMonth?: number; // 1-12
    endMonth?: number; // 1-12
    startDay?: number; // 1-31
    endDay?: number; // 1-31
  };
  descriptionRegex?: string;
}

export interface Rule {
  // existing fields
  conditions?: RuleConditions;
}
```

---

## Supabase Functions & Triggers

### RPC: `grant_access_by_email`

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
  SELECT id INTO _target_user_id FROM users WHERE email = _email;

  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  INSERT INTO access_grants ("booksetId", "userId", "role", "grantedBy")
  VALUES (_bookset_id, _target_user_id, _role, auth.uid())
  ON CONFLICT ("booksetId", "userId")
  DO UPDATE SET
    role = EXCLUDED.role,
    "revokedAt" = NULL
  RETURNING id INTO _grant_id;

  RETURN jsonb_build_object('success', true, 'grantId', _grant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Trigger: `track_change_history`

**File:** `supabase/schema.sql`

```sql
CREATE OR REPLACE FUNCTION track_change_history()
RETURNS TRIGGER AS $$
DECLARE
  _history_entry jsonb;
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    _history_entry := jsonb_build_object(
      'timestamp', now(),
      'userId', auth.uid(),
      'changes', to_jsonb(NEW) - 'changeHistory' - 'updatedAt'
    );

    NEW."changeHistory" := coalesce(OLD."changeHistory", '[]'::jsonb) || _history_entry;
  END IF;

  NEW."lastModifiedBy" := auth.uid();
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RPC: `undo_import_batch`

**File:** `supabase/schema.sql`

```sql
CREATE OR REPLACE FUNCTION undo_import_batch(_batch_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE "sourceBatchId" = _batch_id
    AND reconciled = true
  ) THEN
    RAISE EXCEPTION 'Cannot undo batch containing reconciled transactions.';
  END IF;

  UPDATE transactions
  SET "isArchived" = true,
      "updatedAt" = now()
  WHERE "sourceBatchId" = _batch_id;

  UPDATE import_batches
  SET "isUndone" = true,
      "undoneAt" = now(),
      "undoneBy" = auth.uid()
  WHERE id = _batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Domain Logic

### Access Grants (Logic)

**File:** `src/lib/supabase/access.ts`

- `grantAccessByEmail(booksetId, email, role)`
- `listAccessGrants(booksetId)`
- `revokeAccess(grantId)`

### Audit Trail (Logic)

**File:** `src/lib/audit/format.ts`

- `parseHistory(jsonb)` to strong types
- `formatChanges(entry)` for UI display

### Advanced Rules (Logic)

**File:** `src/lib/rules/matcher.ts`

Update `matchesRule` to check conditions after keyword match:

```typescript
export function matchesRule(description: string, amount: number, date: Date, rule: Rule): boolean {
  if (!basicMatch(description, rule)) return false;

  if (rule.conditions) {
    const { amountMin, amountMax, dateRange, descriptionRegex } = rule.conditions;
    const absAmount = Math.abs(amount);

    if (amountMin !== undefined && absAmount < amountMin) return false;
    if (amountMax !== undefined && absAmount > amountMax) return false;

    if (descriptionRegex) {
      try {
        const regex = new RegExp(descriptionRegex, 'i');
        if (!regex.test(description)) return false;
      } catch (e) {
        console.warn('Invalid regex in rule', rule.id);
        return false;
      }
    }

    if (dateRange) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      if (dateRange.startMonth && month < dateRange.startMonth) return false;
      if (dateRange.endMonth && month > dateRange.endMonth) return false;
      if (dateRange.startDay && day < dateRange.startDay) return false;
      if (dateRange.endDay && day > dateRange.endDay) return false;
    }
  }

  return true;
}
```

---

## UI Components & Flow

### Settings Access Tab

**Component:** `SettingsAccessTab.tsx`

- Input: email
- Role selector: viewer/editor
- Submit uses `grant_access_by_email` RPC
- Table of current grants with revoke action

**Empty State:** If no grants exist, show helper text and call-to-action.

### Transaction History Modal

**Component:** `TransactionHistoryModal.tsx`

- Props: `history: ChangeHistoryEntry[]`
- Render: timestamp, userId, and a simplified diff per entry

### Import Page - Recent Imports

**Component:** `ImportRecentBatches.tsx`

- Table of import batches with status and counts
- Undo button calls `undo_import_batch`
- Confirm dialog and error messaging

### Rules - Advanced Conditions

**Component:** `RuleFormModal.tsx`

- Collapsible "Advanced Conditions" section
- Inputs: Min Amount, Max Amount, Regex, Date Range

---

## Success Criteria

- Owners can grant and revoke access via email.
- Viewers are read-only; editors can modify.
- Change history is recorded for transactions, accounts, and rules.
- Users can undo an import batch if no reconciled transactions exist.
- Advanced rules correctly enforce conditions.
- No regressions in Phase 3/4/5 flows.

---

## Testing Plan

### Unit Tests

**File:** `src/lib/rules/matcher.test.ts`

- Amount min/max checks
- Regex matches and invalid regex handling
- Date range boundary checks

**File:** `src/lib/audit/format.test.ts`

- Parses JSONB history into typed entries
- Formats changes for UI display

### Integration Tests

1. Access grants:
   - Grant access and verify collaborator can read data.
2. Undo import:
   - Attempt undo with reconciled transaction and verify error.
3. Audit trail:
   - Update transaction and verify history entry exists.

---

## Task Checklist

1. **Multi-User:** Add `grant_access_by_email` RPC to Supabase.
2. **Multi-User:** Implement `src/lib/supabase/access.ts`.
3. **Multi-User:** Build `SettingsAccessTab.tsx` with grant list + revoke.
4. **Audit:** Add `changeHistory` JSONB columns if missing.
5. **Audit:** Add/verify `track_change_history` trigger.
6. **Audit:** Build `TransactionHistoryModal.tsx`.
7. **Undo:** Add `undo_import_batch` RPC.
8. **Undo:** Add recent import list and undo action to `ImportPage.tsx`.
9. **Rules:** Update rule types and `matchesRule` logic.
10. **Rules:** Add "Advanced Conditions" UI inputs.
11. **Test:** Add unit + integration tests for rules, audit, access, undo.
