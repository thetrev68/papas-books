# Change History Developer Guide

Quick reference for working with the change_history audit trail feature.

---

## Overview

The `change_history` JSONB column automatically tracks all field-level changes to transactions, accounts, categories, and rules. This is handled entirely by PostgreSQL triggers - **no application code changes needed** for basic tracking.

---

## Automatic Tracking

### What Gets Tracked

✅ **Automatically tracked:**

- All field changes on UPDATE operations
- User who made the change (auth.uid())
- Timestamp of change
- Old and new values for each field

❌ **Not tracked:**

- INSERT operations (use created_by/created_at instead)
- DELETE operations (records are soft-deleted via is_archived)
- Metadata fields (id, created_at, updated_at, change_history itself)

### Which Tables

- ✅ `transactions`
- ✅ `accounts`
- ✅ `categories`
- ✅ `rules`

---

## Data Format

### Structure

```typescript
interface ChangeHistoryEntry {
  timestamp: string; // ISO 8601 timestamp
  user_id: string | null; // UUID of user (null for system ops)
  changes: {
    [fieldName: string]: {
      old: any;
      new: any;
    };
  };
}

// The change_history column is an array of these entries
type ChangeHistory = ChangeHistoryEntry[];
```

### Example

```json
[
  {
    "timestamp": "2025-12-25T10:30:00.000Z",
    "user_id": "abc123-def456-...",
    "changes": {
      "payee": {
        "old": "Amazon.com",
        "new": "Amazon Web Services"
      },
      "amount": {
        "old": 2999,
        "new": 3499
      }
    }
  },
  {
    "timestamp": "2025-12-26T14:20:00.000Z",
    "user_id": "abc123-def456-...",
    "changes": {
      "is_reviewed": {
        "old": false,
        "new": true
      }
    }
  }
]
```

---

## Reading Change History

### Via Supabase Client

```typescript
import { supabase } from '../lib/supabase/config';

// Fetch transaction with change history
const { data, error } = await supabase
  .from('transactions')
  .select('id, payee, amount, change_history')
  .eq('id', transactionId)
  .single();

if (data) {
  const history = data.change_history || [];
  console.log(`${history.length} changes recorded`);
}
```

### Via React Query

```typescript
import { useQuery } from '@tanstack/react-query';

function useTransactionHistory(transactionId: string) {
  return useQuery({
    queryKey: ['transaction-history', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('change_history')
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      return data.change_history || [];
    },
  });
}

// Usage in component
const { data: history } = useTransactionHistory(transactionId);
```

---

## Displaying Change History

### Format for UI Display

```typescript
import { format } from 'date-fns';

interface ChangeHistoryEntry {
  timestamp: string;
  user_id: string | null;
  changes: Record<string, { old: any; new: any }>;
}

function formatChangeEntry(entry: ChangeHistoryEntry, users: Map<string, string>): string {
  const date = format(new Date(entry.timestamp), 'PPpp');
  const userName = entry.user_id ? users.get(entry.user_id) || 'Unknown User' : 'System';

  const changesList = Object.entries(entry.changes)
    .map(([field, { old, new: newVal }]) => {
      // Format field name (camelCase -> Title Case)
      const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      // Format values based on type
      const oldFormatted = formatValue(field, old);
      const newFormatted = formatValue(field, newVal);

      return `${fieldName}: ${oldFormatted} → ${newFormatted}`;
    })
    .join(', ');

  return `${userName} changed ${changesList} on ${date}`;
}

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return 'None';

  // Currency fields (stored as cents)
  if (field === 'amount' || field.includes('balance')) {
    return `$${(value / 100).toFixed(2)}`;
  }

  // Boolean fields
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Dates
  if (field.includes('date') && typeof value === 'string') {
    return format(new Date(value), 'PP');
  }

  // Default: string representation
  return String(value);
}

// Example output:
// "John Doe changed Payee: Amazon.com → AWS, Amount: $29.99 → $34.99 on Dec 25, 2025, 10:30 AM"
```

### React Component Example

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AuditLogProps {
  transactionId: string;
}

export function AuditLog({ transactionId }: AuditLogProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['transaction-history', transactionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('change_history')
        .eq('id', transactionId)
        .single();

      return data?.change_history || [];
    },
  });

  if (isLoading) return <div>Loading history...</div>;

  if (!history || history.length === 0) {
    return <div>No changes recorded</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Change History</h3>
      <ul className="space-y-1">
        {history.reverse().map((entry: ChangeHistoryEntry, index: number) => (
          <li key={index} className="text-sm text-gray-600 border-l-2 border-blue-500 pl-3">
            {formatChangeEntry(entry)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Querying Change History

### Find Records Changed by Specific User

```sql
SELECT id, payee, change_history
FROM transactions
WHERE change_history @> '[{"user_id": "user-uuid-here"}]'::jsonb;
```

### Find Records Changed in Date Range

```sql
SELECT id, payee, change_history
FROM transactions
WHERE change_history::text LIKE '%2025-12-25%';

-- More precise (PostgreSQL 12+):
SELECT id, payee,
  jsonb_path_query_array(change_history, '$[*].timestamp') as timestamps
FROM transactions
WHERE jsonb_path_exists(
  change_history,
  '$[*].timestamp ? (@ >= "2025-12-25T00:00:00Z" && @ <= "2025-12-26T00:00:00Z")'
);
```

### Find Records Where Specific Field Changed

```sql
-- Find transactions where payee was changed
SELECT id, payee, change_history
FROM transactions
WHERE change_history @> '[{"changes": {"payee": {}}}]'::jsonb;
```

### Count Total Changes Per Record

```sql
SELECT id, payee, jsonb_array_length(change_history) as change_count
FROM transactions
WHERE change_history IS NOT NULL
ORDER BY change_count DESC;
```

---

## Advanced Queries

### Get Most Recent Change Per Record

```sql
SELECT
  id,
  payee,
  change_history->-1 as latest_change
FROM transactions
WHERE jsonb_array_length(change_history) > 0;
```

### Extract All Changes to Specific Field

```typescript
// TypeScript function to extract all changes to a specific field
function getFieldChanges(
  history: ChangeHistoryEntry[],
  fieldName: string
): Array<{ timestamp: string; old: any; new: any; user_id: string | null }> {
  return history
    .filter((entry) => entry.changes[fieldName])
    .map((entry) => ({
      timestamp: entry.timestamp,
      user_id: entry.user_id,
      old: entry.changes[fieldName].old,
      new: entry.changes[fieldName].new,
    }));
}

// Example usage:
const payeeChanges = getFieldChanges(history, 'payee');
console.log(`Payee changed ${payeeChanges.length} times`);
```

---

## Performance Tips

### ✅ DO

- Query change_history only when needed (user clicks "View History")
- Use `.select('change_history')` to fetch only the history column
- Limit results when displaying in UI (e.g., last 10 changes)

### ❌ DON'T

- Include change_history in every query (adds bandwidth)
- Index the change_history column (JSONB is already efficient)
- Query change_history in loops (batch queries instead)

### Optimal Query Pattern

```typescript
// BAD: Fetches change_history for all transactions
const { data } = await supabase
  .from('transactions')
  .select('*, change_history') // ❌ Wasteful
  .eq('bookset_id', booksetId);

// GOOD: Fetch change_history only when needed
const { data } = await supabase
  .from('transactions')
  .select('id, payee, amount') // ✅ Only essential fields
  .eq('bookset_id', booksetId);

// Later, when user clicks "View History" for a specific transaction:
const { data: history } = await supabase
  .from('transactions')
  .select('change_history') // ✅ Only history for one record
  .eq('id', transactionId)
  .single();
```

---

## Common Patterns

### Show "Last Modified" Information

```typescript
function getLastModified(history: ChangeHistoryEntry[] | null): {
  timestamp: string | null;
  user_id: string | null;
} {
  if (!history || history.length === 0) {
    return { timestamp: null, user_id: null };
  }

  const latest = history[history.length - 1];
  return {
    timestamp: latest.timestamp,
    user_id: latest.user_id,
  };
}

// Usage in component:
const lastMod = getLastModified(transaction.change_history);
if (lastMod.timestamp) {
  return <span>Last edited {formatDistanceToNow(new Date(lastMod.timestamp))} ago</span>;
}
```

### Detect if Field Has Ever Changed

```typescript
function hasFieldChanged(history: ChangeHistoryEntry[] | null, fieldName: string): boolean {
  if (!history) return false;
  return history.some((entry) => fieldName in entry.changes);
}

// Usage:
if (hasFieldChanged(transaction.change_history, 'amount')) {
  console.log('Amount has been modified since creation');
}
```

### Revert to Previous Value (Manual)

```typescript
// Get previous value of a field
function getPreviousValue(history: ChangeHistoryEntry[] | null, fieldName: string): any {
  if (!history) return null;

  // Find most recent change to this field
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].changes[fieldName]) {
      return history[i].changes[fieldName].old;
    }
  }

  return null;
}

// Usage: Manual revert
const previousPayee = getPreviousValue(transaction.change_history, 'payee');
if (previousPayee) {
  await supabase.from('transactions').update({ payee: previousPayee }).eq('id', transactionId);
}
```

---

## Troubleshooting

### Change history is empty

**Cause:** Triggers not applied or updates happening outside application

**Solution:**

```sql
-- Verify triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE 'track_%_changes';

-- If missing, run:
-- supabase/phase9_audit_triggers.sql
```

### Change history showing null user_id

**Cause:** Updates made via database migrations or system operations

**Solution:** This is expected behavior. System operations have no auth.uid(). Filter these out in UI if needed:

```typescript
const userChanges = history.filter((entry) => entry.user_id !== null);
```

### Change history growing too large

**Cause:** Very frequently updated records

**Solution:** Trigger automatically keeps only last 50 changes. No action needed. To view full history, consider separate audit table (future enhancement).

---

## Testing

### Manual Test

```sql
-- 1. Update a transaction
UPDATE transactions
SET payee = 'Test Update'
WHERE id = '<transaction-id>';

-- 2. Verify change was recorded
SELECT
  id,
  payee,
  jsonb_array_length(change_history) as change_count,
  change_history->-1 as latest_change
FROM transactions
WHERE id = '<transaction-id>';
```

### Automated Test

```bash
# Run test script (requires bookset and transaction ID)
npx tsx scripts/test-change-history.ts <bookset-id> <transaction-id>
```

---

## Security Considerations

### RLS Policies

Change history is stored in the same table as the data, so existing RLS policies apply:

```sql
-- Users can only see change_history for booksets they have access to
SELECT change_history FROM transactions
WHERE bookset_id = '<bookset-user-cannot-access>';
-- ❌ Returns empty (blocked by RLS)
```

### User Privacy

- User IDs are stored (not email/names)
- Resolve user_id to display_name at render time
- Consider GDPR implications for long-term storage
- Audit logs may need to be redacted if user is deleted

---

## Future Enhancements

Potential improvements for later:

1. **Separate audit table** for unlimited history
2. **Configurable retention** (keep 30/60/90 days)
3. **Audit log export** (CSV download)
4. **Revert functionality** (one-click restore)
5. **Change notifications** (email when critical fields change)
6. **Audit reports** (who changed what in date range)

---

## References

- [Task 3.1 Implementation Summary](./task-3.1-implementation-summary.md)
- [Production Readiness Plan](../Production-Readiness-Plan.md)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)

---

**Last Updated:** 2025-12-25
