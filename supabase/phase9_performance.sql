-- ============================================================================
-- PHASE 9: PERFORMANCE OPTIMIZATION
-- ============================================================================
-- This script creates indexes to optimize common query patterns.
-- Run this after Phase 8 schema is deployed.
--
-- Performance Impact:
-- - Reduces query time for large datasets (10k+ transactions)
-- - Improves workbench load times
-- - Speeds up duplicate detection during imports
-- - Optimizes rule matching and reporting
--
-- IMPORTANT: Run ANALYZE after creating indexes to update query planner statistics
-- ============================================================================

-- Drop existing indexes if recreating (uncomment if needed)
-- DROP INDEX IF EXISTS idx_transactions_bookset_account_date;
-- DROP INDEX IF EXISTS idx_transactions_fingerprint;
-- DROP INDEX IF EXISTS idx_transactions_bookset_reviewed;
-- DROP INDEX IF EXISTS idx_transactions_account_date_reconciled;
-- DROP INDEX IF EXISTS idx_transactions_lines_category;
-- DROP INDEX IF EXISTS idx_rules_bookset_priority;
-- DROP INDEX IF EXISTS idx_rules_keyword;
-- DROP INDEX IF EXISTS idx_categories_bookset_parent;
-- DROP INDEX IF EXISTS idx_categories_sort;
-- DROP INDEX IF EXISTS idx_accounts_bookset_active;
-- DROP INDEX IF EXISTS idx_access_grants_user_bookset;
-- DROP INDEX IF EXISTS idx_access_grants_bookset;
-- DROP INDEX IF EXISTS idx_import_batches_account;
-- DROP INDEX IF EXISTS idx_import_batches_undone;
-- DROP INDEX IF EXISTS idx_payees_bookset_name;
-- DROP INDEX IF EXISTS idx_payees_aliases;

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================

-- Most common query: Get all transactions for a bookset + account, sorted by date
-- Used by: Workbench, Account views, Reports
CREATE INDEX IF NOT EXISTS idx_transactions_bookset_account_date
  ON transactions(bookset_id, account_id, date DESC)
  WHERE is_archived = false;

-- Duplicate detection: Check fingerprint within account
-- Used by: CSV import pipeline
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint
  ON transactions(bookset_id, account_id, fingerprint);

-- Workbench filtering: Get unreviewed transactions
-- Used by: Workbench "Unreviewed" filter
CREATE INDEX IF NOT EXISTS idx_transactions_bookset_reviewed
  ON transactions(bookset_id, is_reviewed, date DESC)
  WHERE is_archived = false;

-- Reconciliation: Get transactions by date range
-- Used by: Reconciliation page, balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_account_date_reconciled
  ON transactions(account_id, date, reconciled)
  WHERE is_archived = false;

-- Reports: Filter by category (for split transactions)
-- Note: This requires GIN index for JSONB
-- Used by: Category reports, expense analysis
CREATE INDEX IF NOT EXISTS idx_transactions_lines_category
  ON transactions USING GIN (lines);

-- ============================================================================
-- RULES TABLE
-- ============================================================================

-- Rule application: Get enabled rules by priority
-- Used by: Automatic rule application, batch rule application
CREATE INDEX IF NOT EXISTS idx_rules_bookset_priority
  ON rules(bookset_id, priority DESC, is_enabled)
  WHERE is_enabled = true;

-- Rule keyword search (case-insensitive)
-- Used by: Rule management page, keyword searches
CREATE INDEX IF NOT EXISTS idx_rules_keyword
  ON rules(bookset_id, LOWER(keyword))
  WHERE is_enabled = true;

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================

-- Category hierarchy lookup
-- Used by: Category tree rendering, parent-child relationships
CREATE INDEX IF NOT EXISTS idx_categories_bookset_parent
  ON categories(bookset_id, parent_category_id)
  WHERE is_archived = false;

-- Category sorting
-- Used by: Category dropdowns, category management
CREATE INDEX IF NOT EXISTS idx_categories_sort
  ON categories(bookset_id, sort_order)
  WHERE is_archived = false;

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================

-- Active accounts for bookset
-- Used by: Account selection, dashboard summaries
CREATE INDEX IF NOT EXISTS idx_accounts_bookset_active
  ON accounts(bookset_id)
  WHERE is_archived = false;

-- ============================================================================
-- ACCESS GRANTS TABLE
-- ============================================================================

-- Check user access to bookset
-- Used by: Authentication, permission checks
CREATE INDEX IF NOT EXISTS idx_access_grants_user_bookset
  ON access_grants(user_id, bookset_id)
  WHERE revoked_at IS NULL;

-- Find all users with access to a bookset
-- Used by: Bookset sharing, access management
CREATE INDEX IF NOT EXISTS idx_access_grants_bookset
  ON access_grants(bookset_id)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- IMPORT BATCHES TABLE
-- ============================================================================

-- Find batches by account
-- Used by: Import history, batch tracking
CREATE INDEX IF NOT EXISTS idx_import_batches_account
  ON import_batches(bookset_id, account_id, imported_at DESC);

-- Undo functionality
-- Used by: Undo import feature
CREATE INDEX IF NOT EXISTS idx_import_batches_undone
  ON import_batches(bookset_id, is_undone);

-- ============================================================================
-- PAYEES TABLE
-- ============================================================================

-- Payee lookup for autocomplete
-- Used by: Payee autocomplete, fuzzy matching
CREATE INDEX IF NOT EXISTS idx_payees_bookset_name
  ON payees(bookset_id, name);

-- Alias search (GIN index for array)
-- Used by: Payee alias matching
CREATE INDEX IF NOT EXISTS idx_payees_aliases
  ON payees USING GIN (aliases);

-- ============================================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- ============================================================================
-- Run this after creating indexes to ensure the query planner uses them effectively

ANALYZE transactions;
ANALYZE rules;
ANALYZE categories;
ANALYZE accounts;
ANALYZE access_grants;
ANALYZE import_batches;
ANALYZE payees;
ANALYZE booksets;
ANALYZE users;

-- ============================================================================
-- PERFORMANCE TESTING QUERIES
-- ============================================================================
-- Use these queries to verify index usage with EXPLAIN ANALYZE
-- Look for "Index Scan" or "Bitmap Index Scan" in the output
-- If you see "Seq Scan", the index may not be used (check your WHERE clause)
-- ============================================================================

-- Test 1: Fetch transactions for workbench
-- Expected: Index Scan using idx_transactions_bookset_account_date
-- EXPLAIN ANALYZE
-- SELECT * FROM transactions
-- WHERE bookset_id = '<bookset-id>'
--   AND account_id = '<account-id>'
--   AND is_archived = false
-- ORDER BY date DESC
-- LIMIT 100;

-- Test 2: Duplicate detection
-- Expected: Index Scan using idx_transactions_fingerprint
-- EXPLAIN ANALYZE
-- SELECT * FROM transactions
-- WHERE bookset_id = '<bookset-id>'
--   AND account_id = '<account-id>'
--   AND fingerprint = '<fingerprint-hash>';

-- Test 3: Rule matching
-- Expected: Index Scan using idx_rules_bookset_priority
-- EXPLAIN ANALYZE
-- SELECT * FROM rules
-- WHERE bookset_id = '<bookset-id>'
--   AND is_enabled = true
-- ORDER BY priority DESC;

-- Test 4: Reconciliation balance calculation
-- Expected: Index Scan using idx_transactions_account_date_reconciled
-- EXPLAIN ANALYZE
-- SELECT SUM(amount) FROM transactions
-- WHERE account_id = '<account-id>'
--   AND date >= '2025-01-01'
--   AND date <= '2025-12-31'
--   AND reconciled = true
--   AND is_archived = false;

-- Test 5: Category lookup
-- Expected: Index Scan using idx_categories_bookset_parent
-- EXPLAIN ANALYZE
-- SELECT * FROM categories
-- WHERE bookset_id = '<bookset-id>'
--   AND is_archived = false
-- ORDER BY sort_order;

-- Test 6: Access grant check
-- Expected: Index Scan using idx_access_grants_user_bookset
-- EXPLAIN ANALYZE
-- SELECT * FROM access_grants
-- WHERE user_id = '<user-id>'
--   AND bookset_id = '<bookset-id>'
--   AND revoked_at IS NULL;
