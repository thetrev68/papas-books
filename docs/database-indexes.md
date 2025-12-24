# Database Index Strategy

## Overview

This document outlines the indexing strategy for Papa's Books to optimize query performance with large datasets (10k+ transactions).

## Index Philosophy

1. **Index frequently queried columns**: Focus on columns used in WHERE, JOIN, and ORDER BY clauses
2. **Composite indexes for common patterns**: Create multi-column indexes matching actual query patterns
3. **Partial indexes for filtered queries**: Use WHERE clauses in indexes to reduce index size
4. **GIN indexes for JSON/Array columns**: Enable efficient searches within JSONB and array fields
5. **Balance read vs write performance**: Indexes speed up reads but slow down writes (acceptable for our use case)

## Index Catalog

### Transactions Table

| Index Name                                 | Columns                               | Type             | Purpose                                                                    |
| ------------------------------------------ | ------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `idx_transactions_bookset_account_date`    | `bookset_id, account_id, date DESC`   | B-tree (partial) | Primary workbench query - fetch transactions for an account sorted by date |
| `idx_transactions_fingerprint`             | `bookset_id, account_id, fingerprint` | B-tree           | Duplicate detection during CSV import                                      |
| `idx_transactions_bookset_reviewed`        | `bookset_id, is_reviewed, date DESC`  | B-tree (partial) | Filter unreviewed transactions in workbench                                |
| `idx_transactions_account_date_reconciled` | `account_id, date, reconciled`        | B-tree (partial) | Reconciliation queries and balance calculations                            |
| `idx_transactions_lines_category`          | `lines`                               | GIN              | Search split transactions by category (JSONB)                              |

**Partial Index Condition**: `WHERE is_archived = false` - excludes archived transactions from most indexes since they're rarely queried.

### Rules Table

| Index Name                   | Columns                                 | Type             | Purpose                                                  |
| ---------------------------- | --------------------------------------- | ---------------- | -------------------------------------------------------- |
| `idx_rules_bookset_priority` | `bookset_id, priority DESC, is_enabled` | B-tree (partial) | Rule application - fetch enabled rules in priority order |
| `idx_rules_keyword`          | `bookset_id, LOWER(keyword)`            | B-tree (partial) | Case-insensitive keyword search                          |

**Partial Index Condition**: `WHERE is_enabled = true` - only active rules need fast lookup.

### Categories Table

| Index Name                      | Columns                          | Type             | Purpose                        |
| ------------------------------- | -------------------------------- | ---------------- | ------------------------------ |
| `idx_categories_bookset_parent` | `bookset_id, parent_category_id` | B-tree (partial) | Build category hierarchy trees |
| `idx_categories_sort`           | `bookset_id, sort_order`         | B-tree (partial) | Sort categories for display    |

**Partial Index Condition**: `WHERE is_archived = false` - excludes archived categories.

### Accounts Table

| Index Name                    | Columns      | Type             | Purpose                             |
| ----------------------------- | ------------ | ---------------- | ----------------------------------- |
| `idx_accounts_bookset_active` | `bookset_id` | B-tree (partial) | Fetch active accounts for dashboard |

**Partial Index Condition**: `WHERE is_archived = false`.

### Access Grants Table

| Index Name                       | Columns               | Type             | Purpose                                                 |
| -------------------------------- | --------------------- | ---------------- | ------------------------------------------------------- |
| `idx_access_grants_user_bookset` | `user_id, bookset_id` | B-tree (partial) | Check if user has access to a bookset (RLS enforcement) |
| `idx_access_grants_bookset`      | `bookset_id`          | B-tree (partial) | Find all users with access to a bookset                 |

**Partial Index Condition**: `WHERE revoked_at IS NULL` - only active grants.

### Import Batches Table

| Index Name                   | Columns                                    | Type   | Purpose                   |
| ---------------------------- | ------------------------------------------ | ------ | ------------------------- |
| `idx_import_batches_account` | `bookset_id, account_id, imported_at DESC` | B-tree | Import history by account |
| `idx_import_batches_undone`  | `bookset_id, is_undone`                    | B-tree | Track undone imports      |

### Payees Table

| Index Name                | Columns            | Type   | Purpose                           |
| ------------------------- | ------------------ | ------ | --------------------------------- |
| `idx_payees_bookset_name` | `bookset_id, name` | B-tree | Payee autocomplete and lookup     |
| `idx_payees_aliases`      | `aliases`          | GIN    | Search payee aliases (text array) |

## Query Patterns

### Pattern 1: Workbench Transaction Fetch

```sql
SELECT * FROM transactions
WHERE bookset_id = ? AND account_id = ? AND is_archived = false
ORDER BY date DESC
LIMIT 100;
```

**Index Used**: `idx_transactions_bookset_account_date`

**Performance**: O(log n) index scan + limit

### Pattern 2: Duplicate Detection

```sql
SELECT * FROM transactions
WHERE bookset_id = ? AND account_id = ? AND fingerprint = ?;
```

**Index Used**: `idx_transactions_fingerprint`

**Performance**: O(log n) index scan, returns 0-1 rows

### Pattern 3: Rule Application

```sql
SELECT * FROM rules
WHERE bookset_id = ? AND is_enabled = true
ORDER BY priority DESC;
```

**Index Used**: `idx_rules_bookset_priority`

**Performance**: O(log n) index scan + sort (pre-sorted by index)

### Pattern 4: Reconciliation Balance

```sql
SELECT SUM(amount) FROM transactions
WHERE account_id = ? AND date BETWEEN ? AND ? AND reconciled = true AND is_archived = false;
```

**Index Used**: `idx_transactions_account_date_reconciled`

**Performance**: Index range scan + aggregate

### Pattern 5: Category Hierarchy

```sql
SELECT * FROM categories
WHERE bookset_id = ? AND parent_category_id = ? AND is_archived = false;
```

**Index Used**: `idx_categories_bookset_parent`

**Performance**: O(log n) index scan

## Performance Benchmarks

| Query Type                       | Without Index | With Index | Improvement      |
| -------------------------------- | ------------- | ---------- | ---------------- |
| Workbench load (1k transactions) | ~150ms        | ~8ms       | **18.7x faster** |
| Duplicate detection              | ~80ms         | ~2ms       | **40x faster**   |
| Rule application (50 rules)      | ~25ms         | ~3ms       | **8.3x faster**  |
| Reconciliation (1k transactions) | ~120ms        | ~15ms      | **8x faster**    |

**Note:** Benchmarks measured on Supabase free tier with 10,000 transactions

## Index Size Estimates

Approximate storage overhead per 10,000 transactions:

- **Transactions indexes**: ~5-8 MB total
- **Rules indexes**: <1 MB
- **Categories indexes**: <1 MB
- **Payees indexes**: ~2 MB
- **Other tables**: <1 MB

**Total overhead**: ~10 MB per 10,000 transactions

## Maintenance

### Automatic Maintenance

PostgreSQL automatically maintains indexes via:

- **Auto-vacuum**: Removes dead tuples from indexes
- **Auto-analyze**: Updates index statistics for query planner

### Manual Maintenance

Run these commands if experiencing slow queries:

```sql
-- Update statistics (run after bulk imports)
ANALYZE transactions;
ANALYZE rules;
ANALYZE categories;

-- Rebuild bloated indexes (rare, only if needed)
REINDEX TABLE transactions;
```

### Monitoring Index Usage

Check if indexes are being used:

```sql
-- View index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

Low `idx_scan` values indicate unused indexes (consider dropping).

## Future Optimizations

### If Performance Degrades at Scale

1. **Partitioning**: Partition `transactions` table by date (monthly or yearly)
2. **Materialized Views**: Pre-aggregate report data
3. **Covering Indexes**: Add INCLUDE clause to avoid table lookups
4. **Hash Indexes**: Consider for exact-match lookups (fingerprint)

### Example: Covering Index

```sql
-- Include commonly selected columns in index
CREATE INDEX idx_transactions_with_payee
  ON transactions(bookset_id, account_id, date DESC)
  INCLUDE (payee, amount, is_reviewed);
```

This allows index-only scans without hitting the table.

## Testing Index Effectiveness

Use `EXPLAIN ANALYZE` to verify index usage:

```sql
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE bookset_id = '<your-id>'
  AND account_id = '<account-id>'
  AND is_archived = false
ORDER BY date DESC
LIMIT 100;
```

**Good output**: `Index Scan using idx_transactions_bookset_account_date`

**Bad output**: `Seq Scan on transactions` (full table scan)

## Rollback Plan

If indexes cause issues, drop them individually:

```sql
DROP INDEX IF EXISTS idx_transactions_bookset_account_date;
DROP INDEX IF EXISTS idx_transactions_fingerprint;
-- etc.
```

Then run `ANALYZE` to update statistics.

## Related Documentation

- [Performance Testing Results](./performance-test-results.md) - Benchmark data
- [Production Readiness Plan](../Production-Readiness-Plan.md) - Task 2.2
- [Database Schema](../supabase/schema.sql) - Full schema definition

---

**Document Version**: 1.0
**Last Updated**: 2025-12-24
**Status**: Implemented
