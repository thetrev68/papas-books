# Optimistic Locking Implementation Guide

**Version:** 1.0
**Last Updated:** 2025-12-24
**Related:** Task 2.6 - Concurrent Edit Detection

---

## Overview

Optimistic locking prevents users from overwriting each other's changes by detecting when a record has been modified by another user since it was loaded.

## How It Works

1. **User A** loads a transaction (updated_at: `2025-01-15T10:00:00Z`)
2. **User B** loads the same transaction (updated_at: `2025-01-15T10:00:00Z`)
3. **User B** saves their changes → Server updates updated_at to `2025-01-15T10:05:00Z`
4. **User A** tries to save their changes:
   - System detects: Server version (`10:05:00Z`) ≠ Local version (`10:00:00Z`)
   - Shows conflict modal to User A
   - User A chooses: Overwrite B's changes OR Discard their own changes

---

## Usage Example: Workbench Transaction Editing

### Step 1: Add Optimistic Locking Hook

```typescript
// src/components/workbench/TransactionRow.tsx
import { useOptimisticLocking } from '../../hooks/useOptimisticLocking';
import { VersionConflictModal } from '../common/VersionConflictModal';
import type { Transaction } from '../../types/database';

export function TransactionRow({ transaction, onSave }: TransactionRowProps) {
  const { activeBookset } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [originalTransaction] = useState(transaction); // Snapshot when editing starts
  const [editedTransaction, setEditedTransaction] = useState(transaction);

  // Add optimistic locking
  const { conflictData, checkForConflict, resolveConflict, hasConflict } =
    useOptimisticLocking<Transaction>(['transactions', activeBookset!.id]);

  const handleSave = async () => {
    // Check for concurrent edits BEFORE saving
    const hasConflict = await checkForConflict(originalTransaction, editedTransaction);

    if (hasConflict) {
      // Don't save - show conflict modal instead
      return;
    }

    // No conflict - proceed with save
    onSave(editedTransaction);
    setIsEditing(false);
  };

  const handleConflictResolve = (strategy: 'overwrite' | 'reload') => {
    const resolvedRecord = resolveConflict(strategy);

    if (strategy === 'overwrite' && resolvedRecord) {
      // User chose to keep their changes
      onSave(resolvedRecord);
      setIsEditing(false);
    } else {
      // User chose to discard their changes
      setEditedTransaction(conflictData!.serverRecord);
      setIsEditing(false);
    }
  };

  return (
    <>
      <tr>
        {/* ... transaction row UI ... */}
        <td>
          <button onClick={handleSave}>Save</button>
        </td>
      </tr>

      {/* Conflict Modal */}
      {hasConflict && conflictData && (
        <VersionConflictModal
          isOpen={hasConflict}
          entityType="transaction"
          entityName={editedTransaction.payee || 'Untitled'}
          yourChanges={conflictData.updatedRecord}
          theirChanges={conflictData.serverRecord}
          onResolve={handleConflictResolve}
          onClose={() => resolveConflict('reload')}
        />
      )}
    </>
  );
}
```

### Step 2: Track Original Record

**Important:** You must track the original record when editing starts:

```typescript
const [originalTransaction] = useState(transaction); // ← Snapshot at component mount
const [editedTransaction, setEditedTransaction] = useState(transaction); // ← Working copy
```

This ensures `checkForConflict` compares against the version the user started editing, not the current cached version.

---

## Integration with Existing Hooks

### Accounts

```typescript
// src/hooks/useAccounts.ts or component using it
const { conflictData, checkForConflict, resolveConflict } = useOptimisticLocking<Account>([
  'accounts',
  activeBookset!.id,
]);

// Before calling updateAccount mutation
const hasConflict = await checkForConflict(originalAccount, updatedAccount);
if (hasConflict) return; // Show modal

updateAccount(accountId, updates);
```

### Categories

```typescript
const { conflictData, checkForConflict, resolveConflict } = useOptimisticLocking<Category>([
  'categories',
  activeBookset!.id,
]);
```

### Rules

```typescript
const { conflictData, checkForConflict, resolveConflict } = useOptimisticLocking<Rule>([
  'rules',
  activeBookset!.id,
]);
```

---

## API Reference

### `useOptimisticLocking<T>(queryKey, enabled?)`

**Parameters:**

- `queryKey: string[]` - React Query cache key (e.g., `['transactions', booksetId]`)
- `enabled?: boolean` - Enable/disable conflict detection (default: `true`)

**Returns:**

```typescript
{
  conflictData: ConflictData<T> | null;     // Current conflict info
  checkForConflict: (original, updated) => Promise<boolean>;  // Check for conflicts
  resolveConflict: (strategy) => T | null;  // Resolve conflict
  clearConflict: () => void;                // Clear conflict state
  hasConflict: boolean;                     // Whether conflict exists
}
```

**ConflictData:**

```typescript
interface ConflictData<T> {
  originalRecord: T; // Version when user started editing
  updatedRecord: T; // User's changes
  serverRecord: T; // Current server version
}
```

---

## Conflict Resolution Strategies

### 1. Reload (Discard My Changes)

```typescript
onResolve={(strategy) => {
  if (strategy === 'reload') {
    // Discard user's changes, use server version
    setEditedData(conflictData.serverRecord);
  }
}}
```

**Use when:**

- User realizes their changes are outdated
- Other user's changes are more important
- User wants to start over with fresh data

### 2. Overwrite (Keep My Changes)

```typescript
onResolve={(strategy) => {
  if (strategy === 'overwrite') {
    // Force save user's changes
    const record = resolveConflict('overwrite');
    if (record) {
      mutate(record);
    }
  }
}}
```

**Use when:**

- User is confident their changes are correct
- User reviewed both versions and chose theirs
- Other user's changes were accidental

---

## Best Practices

### 1. Always Check Before Saving

```typescript
// ✅ CORRECT
const handleSave = async () => {
  const hasConflict = await checkForConflict(original, updated);
  if (hasConflict) return; // Show modal
  mutate(updated);
};

// ❌ WRONG - No conflict check
const handleSave = () => {
  mutate(updated); // Might overwrite other user's changes!
};
```

### 2. Snapshot Original Record

```typescript
// ✅ CORRECT - Snapshot when editing starts
const [originalRecord] = useState(record);

// ❌ WRONG - Uses current cached version
const checkForConflict(record, updatedRecord);
```

### 3. Handle Modal Closure Properly

```typescript
<VersionConflictModal
  isOpen={hasConflict}
  onResolve={handleConflictResolve}
  onClose={() => resolveConflict('reload')} // ← Default to reload on close
/>
```

### 4. Disable for Batch Operations

```typescript
// For bulk updates, disable optimistic locking
const { checkForConflict } = useOptimisticLocking(
  ['transactions', booksetId],
  false // ← Disabled for batch operations
);
```

---

## Limitations

### 1. Cache-Based Detection

Optimistic locking relies on React Query cache. If the cache is stale, conflicts may not be detected.

**Mitigation:**

- Ensure `staleTime` is reasonable (currently 5 minutes)
- Supabase Realtime keeps cache fresh for accounts/categories

### 2. Race Conditions

If two users save simultaneously, both might pass the conflict check.

**Mitigation:**

- Database `updated_at` trigger is the source of truth
- Last write wins (database level)
- Very rare in practice (millisecond timing required)

### 3. Not a Database Lock

This is "optimistic" locking - it doesn't prevent concurrent edits, just detects them.

**For pessimistic locking:**

- Would require database row locks (`SELECT FOR UPDATE`)
- Would require WebSocket connection to maintain lock
- Not implemented (unnecessary complexity for this use case)

---

## Testing

### Manual Testing Procedure

1. **Setup:**
   - Open app in two browser windows
   - Log in as different users (or same user in incognito)
   - Both users navigate to the same transaction

2. **Test Conflict Detection:**
   - User A: Click edit on transaction
   - User B: Click edit on same transaction
   - User B: Change payee to "Coffee Shop B", save
   - User A: Change payee to "Coffee Shop A", save
   - **Expected:** User A sees conflict modal

3. **Test Reload Strategy:**
   - User A: Click "Discard My Changes"
   - **Expected:** Transaction shows "Coffee Shop B" (User B's version)

4. **Test Overwrite Strategy:**
   - Repeat steps above
   - User A: Click "Keep My Changes"
   - **Expected:** Transaction shows "Coffee Shop A" (User A's version)
   - User B: Refreshes page
   - **Expected:** User B sees "Coffee Shop A"

### Automated Testing

```typescript
// src/hooks/useOptimisticLocking.test.ts
import { renderHook } from '@testing-library/react';
import { useOptimisticLocking } from './useOptimisticLocking';

describe('useOptimisticLocking', () => {
  it('should detect conflicts when updated_at differs', async () => {
    const { result } = renderHook(() =>
      useOptimisticLocking<Transaction>(['transactions', 'bookset-123'])
    );

    const original = { id: '1', updated_at: '2025-01-01T10:00:00Z' };
    const updated = { id: '1', updated_at: '2025-01-01T10:00:00Z', payee: 'New' };

    // Mock server having different updated_at
    // ... test implementation
  });
});
```

---

## Troubleshooting

### Issue: Conflict Not Detected

**Cause:** Cache is stale or not populated
**Fix:** Check that query is enabled and cache is fresh

### Issue: False Positive Conflicts

**Cause:** Comparing against wrong original record
**Fix:** Ensure original record is snapshotted when editing starts, not when saving

### Issue: Modal Shows Wrong Data

**Cause:** ConflictData not properly set
**Fix:** Check that `checkForConflict` is awaited before rendering modal

---

## Future Enhancements

### Phase 9+

- **Merge Conflicts:** Smart 3-way merge for non-overlapping changes
- **Change Highlighting:** Visual diff of specific field changes
- **Audit Trail Integration:** Show who made what changes when
- **Auto-Resolution:** Automatically merge non-conflicting field changes

---

## References

- [Optimistic Locking (Wikipedia)](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- Task 2.6 in [Production-Readiness-Plan.md](../Production-Readiness-Plan.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-24
**Next Review:** After user testing feedback
