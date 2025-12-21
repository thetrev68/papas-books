# Phase 2 Troubleshooting

## Issue: App stuck on "Loading..."

### Likely Causes

1. **Database tables don't exist yet**
   - The `accounts` and `categories` tables need to be created in Supabase
   - Check Supabase dashboard > Table Editor

2. **Column naming mismatch**
   - Our code uses camelCase (e.g., `booksetId`)
   - Supabase might use snake_case (e.g., `bookset_id`)
   - Need to verify actual column names in database

3. **RLS Policies blocking queries**
   - Ensure RLS policies allow authenticated users to read/write their bookset data

### Quick Diagnostic Steps

1. Open browser DevTools > Console
2. Look for actual error messages (red text, not warnings)
3. Check Network tab for failed requests to Supabase
4. Go to Supabase dashboard and verify:
   - `accounts` table exists with columns: id, booksetId (or bookset_id), name, type, openingBalance, openingBalanceDate, etc.
   - `categories` table exists with columns: id, booksetId (or bookset_id), name, isTaxDeductible, taxLineItem, parentCategoryId, sortOrder, etc.
   - RLS is enabled on both tables
   - Policies exist to allow SELECT, INSERT, UPDATE for authenticated users

### Expected Database Schema

The tables should have been created in Phase 1. If they don't exist, we need to run migrations to create them.

Check if you have migration files in a `supabase/migrations/` directory.
