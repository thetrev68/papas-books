# React Query Cache Strategy

**Version:** 1.0
**Last Updated:** 2025-12-24
**Status:** Production Ready

---

## Overview

Papa's Books uses [TanStack Query (React Query)](https://tanstack.com/query) for all server state management. This document outlines our caching strategy, query configuration, and best practices.

## Core Principles

### 1. Bookset-Scoped Queries

**All queries MUST include `booksetId` in the query key** to ensure proper cache isolation:

```typescript
// ✅ CORRECT
const { data } = useQuery({
  queryKey: ['transactions', booksetId],
  queryFn: () => fetchTransactions(booksetId),
});

// ❌ WRONG - Will cause cache pollution across booksets
const { data } = useQuery({
  queryKey: ['transactions'],
  queryFn: () => fetchTransactions(booksetId),
});
```

### 2. Query Key Conventions

Query keys follow a consistent pattern:

```typescript
// Pattern: [entity, booksetId, ...filters]

['transactions', booksetId][('transactions', booksetId, accountId)][('accounts', booksetId)][ // All transactions for bookset // Transactions for specific account // All accounts
  ('categories', booksetId)
][('rules', booksetId)][('payees', booksetId)][('import-batches', booksetId)]; // All categories // All rules // All payees // Import history
```

### 3. Optimistic Updates

**All update mutations implement optimistic updates** for instant UI feedback:

1. Cancel outgoing queries
2. Snapshot current cache data
3. Optimistically update the cache
4. On error: rollback to snapshot
5. On success/error: invalidate and refetch

**Example Pattern:**

```typescript
const mutation = useMutation({
  mutationFn: updateEntity,
  onMutate: async (newData) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['entities', booksetId] });

    // Snapshot
    const previousData = queryClient.getQueryData(['entities', booksetId]);

    // Optimistic update
    queryClient.setQueryData(['entities', booksetId], (old: Entity[] = []) => {
      return old.map((item) => (item.id === newData.id ? { ...item, ...newData } : item));
    });

    return { previousData };
  },
  onError: (error, variables, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(['entities', booksetId], context.previousData);
    }
  },
  onSettled: () => {
    // Always refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['entities', booksetId] });
  },
});
```

---

## Global Query Configuration

**Location:** `src/lib/queryClient.ts`

### Query Defaults

```typescript
{
  queries: {
    // Retry logic
    retry: (failureCount, error) => {
      // Don't retry 4xx client errors
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry up to 3 times for network/server errors
      return failureCount < 3;
    },

    // Exponential backoff: 1s, 2s, 4s
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Data freshness
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)

    // Automatic refetch
    refetchOnWindowFocus: true,  // User returns to tab
    refetchOnReconnect: true,    // Network reconnects
  },

  mutations: {
    retry: false, // Never retry mutations (prevents duplicate writes)
    onError: (error) => console.error('Mutation error:', error),
  },
}
```

### Configuration Rationale

| Setting                | Value       | Reason                                                 |
| ---------------------- | ----------- | ------------------------------------------------------ |
| `staleTime`            | 5 minutes   | Financial data changes infrequently; reduces API calls |
| `gcTime`               | 10 minutes  | Keep unused data in cache briefly for quick navigation |
| `retry`                | 3 attempts  | Tolerate transient network issues                      |
| `retryDelay`           | Exponential | Prevents server overload during outages                |
| `refetchOnWindowFocus` | true        | Ensure fresh data when user returns                    |
| `refetchOnReconnect`   | true        | Sync after network interruption                        |
| `mutations.retry`      | false       | Prevent duplicate database writes                      |

---

## Cache Invalidation Strategy

### When to Invalidate

**After every mutation**, invalidate related queries:

```typescript
// After creating/updating/deleting a transaction
queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });

// After changing an account
queryClient.invalidateQueries({ queryKey: ['accounts', booksetId] });

// After modifying a category
queryClient.invalidateQueries({ queryKey: ['categories', booksetId] });
```

### Invalidation Scope

Use **prefix matching** to invalidate multiple related queries:

```typescript
// Invalidate ALL transaction queries for this bookset
queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });

// This will invalidate:
// - ['transactions', booksetId]
// - ['transactions', booksetId, accountId]
// - ['transactions', booksetId, accountId, dateRange]
```

### Bookset Switching

When switching booksets, **all queries auto-invalidate** because query keys change:

```typescript
// User switches from booksetA to booksetB
// Old queries: ['transactions', 'booksetA']
// New queries: ['transactions', 'booksetB']
// React Query automatically fetches new data
```

---

## Optimistic Update Patterns

### Pattern 1: Update Single Item in Array

**Use Case:** Editing a transaction, account, category, or rule

```typescript
onMutate: async (updatedItem) => {
  await queryClient.cancelQueries({ queryKey: ['items', booksetId] });
  const previous = queryClient.getQueryData(['items', booksetId]);

  queryClient.setQueryData(['items', booksetId], (old: Item[] = []) => {
    return old.map((item) =>
      item.id === updatedItem.id ? { ...item, ...updatedItem } : item
    );
  });

  return { previous };
},
```

### Pattern 2: Add Item to Array

**Use Case:** Creating a new transaction

```typescript
onMutate: async (newItem) => {
  await queryClient.cancelQueries({ queryKey: ['items', booksetId] });
  const previous = queryClient.getQueryData(['items', booksetId]);

  queryClient.setQueryData(['items', booksetId], (old: Item[] = []) => {
    return [newItem, ...old]; // Prepend new item
  });

  return { previous };
},
```

### Pattern 3: Remove Item from Array

**Use Case:** Deleting a transaction

```typescript
onMutate: async (deletedId) => {
  await queryClient.cancelQueries({ queryKey: ['items', booksetId] });
  const previous = queryClient.getQueryData(['items', booksetId]);

  queryClient.setQueryData(['items', booksetId], (old: Item[] = []) => {
    return old.filter((item) => item.id !== deletedId);
  });

  return { previous };
},
```

### Pattern 4: Bulk Update

**Use Case:** Bulk mark transactions as reviewed

```typescript
onMutate: async ({ ids, updates }) => {
  await queryClient.cancelQueries({ queryKey: ['transactions', booksetId] });
  const previous = queryClient.getQueryData(['transactions', booksetId]);

  queryClient.setQueryData(['transactions', booksetId], (old: Transaction[] = []) => {
    return old.map((tx) =>
      ids.includes(tx.id) ? { ...tx, ...updates } : tx
    );
  });

  return { previous };
},
```

---

## Real-Time Updates

### Supabase Realtime Subscriptions

Selected tables use **Supabase Realtime** to sync changes across users:

```typescript
// Example: useAccounts.ts
useEffect(() => {
  if (!activeBookset) return;

  const channel = supabase
    .channel(`accounts-changes-${activeBookset.id}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'accounts',
        filter: `bookset_id=eq.${activeBookset.id}`,
      },
      () => {
        // Invalidate cache when remote changes detected
        queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset.id] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [activeBookset?.id, queryClient]);
```

**Current Realtime-Enabled Tables:**

- `accounts`
- `categories`

**Not Using Realtime (by design):**

- `transactions` - Too high volume, optimistic updates sufficient
- `rules` - Changes infrequent
- `payees` - Changes infrequent

---

## Performance Optimization Tips

### 1. Avoid Over-Fetching

Use **bookset-scoped queries** instead of fetching all data and filtering client-side:

```typescript
// ✅ GOOD - Fetch only what's needed
const { data } = useQuery({
  queryKey: ['transactions', booksetId, accountId],
  queryFn: () => fetchTransactionsByAccount(booksetId, accountId),
});

// ❌ BAD - Fetch everything, filter later
const { data: allTransactions } = useQuery({
  queryKey: ['transactions', booksetId],
  queryFn: () => fetchTransactions(booksetId),
});
const filtered = allTransactions?.filter((tx) => tx.account_id === accountId);
```

### 2. Pagination for Large Datasets

For reports and large transaction lists, use **pagination**:

```typescript
const { data } = useQuery({
  queryKey: ['transactions', booksetId, { page, pageSize }],
  queryFn: () => fetchTransactionsPaginated(booksetId, page, pageSize),
});
```

See [Task 2.3: Add Pagination to Reports](../Production-Readiness-Plan.md#task-23-add-pagination-to-reports) for implementation.

### 3. Selective Invalidation

Invalidate **only affected queries**:

```typescript
// ✅ GOOD - Only invalidate what changed
await updateAccount(accountId, { name: 'New Name' });
queryClient.invalidateQueries({ queryKey: ['accounts', booksetId] });

// ❌ BAD - Invalidates everything
queryClient.invalidateQueries();
```

### 4. Background Refetch

Use `refetchOnWindowFocus` to keep data fresh without user action:

```typescript
// Already enabled globally in queryClient.ts
refetchOnWindowFocus: true;
```

When user returns to the tab after 5+ minutes, queries automatically refetch.

---

## Common Patterns by Entity

### Transactions

```typescript
// Fetch all transactions for bookset
useQuery({
  queryKey: ['transactions', booksetId],
  queryFn: () => fetchTransactions(booksetId),
});

// Fetch transactions for specific account
useQuery({
  queryKey: ['transactions', booksetId, accountId],
  queryFn: () => fetchTransactionsByAccount(booksetId, accountId),
});

// Update transaction (optimistic)
useMutation({
  mutationFn: updateTransaction,
  onMutate: async (updated) => {
    await queryClient.cancelQueries({ queryKey: ['transactions'] });
    const previous = queryClient.getQueryData(['transactions', booksetId]);
    queryClient.setQueryData(['transactions', booksetId], (old: Transaction[]) =>
      old.map((tx) => (tx.id === updated.id ? updated : tx))
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['transactions', booksetId], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
  },
});
```

### Accounts

```typescript
// Fetch all accounts
useQuery({
  queryKey: ['accounts', booksetId],
  queryFn: () => fetchAccounts(booksetId),
});

// Includes Supabase Realtime subscription for multi-user updates
```

### Categories

```typescript
// Fetch all categories (includes hierarchy)
useQuery({
  queryKey: ['categories', booksetId],
  queryFn: () => fetchCategories(booksetId),
});

// Includes Supabase Realtime subscription
```

### Rules

```typescript
// Fetch all rules (sorted by priority)
useQuery({
  queryKey: ['rules', booksetId],
  queryFn: () => fetchRules(booksetId),
});
```

---

## Error Handling

### Query Errors

Errors are exposed via the `error` property:

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['transactions', booksetId],
  queryFn: () => fetchTransactions(booksetId),
});

if (error) {
  // Display user-friendly error message
  return <ErrorMessage error={error} />;
}
```

### Mutation Errors

Mutations show **toast notifications** on error:

```typescript
const mutation = useMutation({
  mutationFn: updateTransaction,
  onError: (error) => {
    const message = error instanceof DatabaseError ? error.message : 'Failed to update transaction';
    showToast(message, 'error');
  },
});
```

### Retry Behavior

- **Queries**: Retry 3 times with exponential backoff
- **Mutations**: Never retry (prevents duplicate writes)
- **Client Errors (4xx)**: No retry (fix required)
- **Server Errors (5xx)**: Retry up to 3 times

---

## Testing Cache Behavior

### Manual Testing Checklist

1. **Optimistic Updates**:
   - Edit a transaction → UI updates instantly
   - If save fails → Reverts to original state
   - If save succeeds → Data persists

2. **Bookset Switching**:
   - Switch booksets → New data loads
   - Old bookset data not visible
   - Switch back → Original data restored from cache (if still fresh)

3. **Multi-User Sync** (for Realtime tables):
   - User A updates an account
   - User B sees update within 5 seconds (Realtime)
   - User B's cache invalidated and refetched

4. **Network Interruption**:
   - Disconnect network
   - Attempt mutation → Error shown
   - Reconnect → Next query refetches fresh data

### Automated Testing

See `src/hooks/*.test.ts` for unit tests covering:

- Query key generation
- Optimistic update logic
- Rollback on error
- Cache invalidation

---

## Debugging Tips

### Inspect React Query DevTools

Install the devtools (already included in dev builds):

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In App.tsx
<ReactQueryDevtools initialIsOpen={false} />
```

**Key Features:**

- View all cached queries
- See query status (fresh, stale, fetching)
- Manually invalidate queries
- Inspect query data

### Common Issues

#### Issue: Stale Data After Mutation

**Cause:** Forgot to invalidate queries
**Fix:** Add `onSuccess` or `onSettled` invalidation

```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
};
```

#### Issue: Cache Pollution Across Booksets

**Cause:** Query key missing `booksetId`
**Fix:** Always include bookset in key

```typescript
// ❌ WRONG
queryKey: ['transactions'];

// ✅ CORRECT
queryKey: ['transactions', booksetId];
```

#### Issue: Optimistic Update Not Rolling Back

**Cause:** Missing `context` in `onError`
**Fix:** Return context from `onMutate` and use in `onError`

```typescript
onMutate: async () => {
  const previous = queryClient.getQueryData(['items', booksetId]);
  return { previous }; // ← Must return this
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['items', booksetId], context.previous); // ← Use it here
},
```

---

## Future Enhancements

### Phase 9+ Roadmap

1. **Infinite Queries for Transactions**
   - Implement virtual scrolling with infinite loading
   - Replace pagination with `useInfiniteQuery`

2. **Prefetching**
   - Prefetch next page of transactions on hover
   - Prefetch related entities (accounts, categories)

3. **Persistent Cache**
   - Use `persistQueryClient` for offline support
   - Store cache in IndexedDB

4. **Query Deduplication**
   - Already handled by React Query
   - Monitor for unnecessary duplicate requests

---

## References

- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Optimistic Updates Guide](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Query Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-24
**Next Review:** After Phase 9 completion
