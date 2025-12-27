# Payee Refactor Migration Guide

## Overview

This migration refactors the payee system to properly separate three distinct concepts:

1. **Bank Description** (`original_description`): The immutable text from the CSV file
2. **Payee** (`payee_id`): A user-managed master list of actual people/companies being paid
3. **Category**: Financial categorization (can be set at transaction level or via payee default)

## What Changed

### Database Schema

#### Transactions Table

- **`payee` field**: Now nullable (previously required). This is a legacy text field that will be deprecated.
- **`payee_id` field**: New FK to payees table. This is the preferred way to assign payees.
- **`original_description` field**: Unchanged. This is the immutable bank description from CSV.

#### Payees Table

- **`aliases` column**: REMOVED (no longer needed)
- **`category_id` → `default_category_id`**: Renamed for clarity. This is the default category to apply when the payee is assigned.

#### Rules Table

- **`payee_id` field**: New FK to payees table. Rules can now assign payees directly.
- **`target_category_id` field**: Now nullable (previously required). Rules can assign just a payee, just a category, or both.
- **`suggested_payee` field**: Deprecated. Use `payee_id` instead.

### Application Behavior

#### Import Flow

**BEFORE**: Import would auto-create 84 payees for 84 transactions, even if they were all to the same vendor.

**AFTER**: Import does NOT create or assign payees. Transactions are imported with:

- `payee` = `null`
- `payee_id` = `null`
- `original_description` = raw bank description from CSV

#### Review Workflow

**BEFORE**: Payee was pre-filled with bank description (garbage data).

**AFTER**: Payee assignment is part of the review workflow. Users manually select/assign payees during review in the Workbench.

#### Rules Engine - Category Hierarchy

When a rule matches a transaction, the following logic applies:

1. **Payee Assignment**:
   - If rule has `payee_id` → assign that payee to the transaction
   - If rule has legacy `suggested_payee` text → use that (deprecated path)

2. **Category Assignment** (hierarchy):
   - If rule has `target_category_id` → use rule's category (rule wins)
   - Else if payee (from rule) has `default_category_id` → use payee's default category
   - Else → no category assigned

**Example**:

```typescript
// Rule 1: Assign payee only (payee has default category "Office Supplies")
rule = { keyword: "staples", payee_id: "payee-123", target_category_id: null }
payee-123 = { name: "Staples", default_category_id: "cat-office-supplies" }
→ Transaction gets payee "Staples" and category "Office Supplies"

// Rule 2: Assign payee AND override category
rule = { keyword: "staples", payee_id: "payee-123", target_category_id: "cat-furniture" }
→ Transaction gets payee "Staples" and category "Furniture" (rule wins)

// Rule 3: Assign category only
rule = { keyword: "amazon", payee_id: null, target_category_id: "cat-shopping" }
→ Transaction gets category "Shopping", no payee assigned
```

## Migration Steps

### 1. Run Database Migration

Execute the migration SQL script:

```bash
# Run in Supabase SQL Editor
supabase/migrations/001_payee_refactor.sql
```

Or apply to main schema:

```bash
# The main schema.sql has been updated
# You can reset the entire database or run the migration incrementally
```

### 2. Data Cleanup (Recommended)

After migration, you may want to:

1. **Clean up garbage payee data**: Review transactions and remove auto-generated payee text
2. **Create master payee list**: Add actual vendors/companies to payees table
3. **Update rules**: Convert `suggested_payee` text to `payee_id` references
4. **Assign payees**: Go through unreviewed transactions and assign proper payees

### 3. Update Application Code

The TypeScript code has been updated to support the new schema:

- ✅ Types updated (Transaction, Payee, Rule)
- ✅ Import pipeline no longer creates payees
- ✅ Rules engine supports payee_id and category hierarchy
- ✅ Transaction operations support payee_id field

### 4. Test

Recommended testing:

1. Import a CSV file → verify no payees are auto-created
2. Create a rule with just payee_id → verify payee's default category applies
3. Create a rule with both payee_id and category → verify rule category wins
4. Manually assign payees in Workbench → verify it works

## Rollback Plan

If you need to rollback:

1. The `payee` text field is still available (nullable)
2. The `suggested_payee` field in rules is still supported (deprecated)
3. You can continue using the old workflow if needed

## Breaking Changes

⚠️ **API Changes**:

- `InsertPayee` interface: Removed `aliases` field, renamed `category_id` to `default_category_id`
- `Transaction` interface: `payee` is now nullable, added `payee_id`
- `Rule` interface: `target_category_id` is now nullable, added `payee_id`

⚠️ **Behavior Changes**:

- Import no longer auto-creates payees
- Payee assignment is now manual (part of review workflow)
- Rules can assign payees directly (not just suggest text)

## Benefits

✅ **Clean Data**: No more duplicate payee records for the same vendor

✅ **Clear Separation**: Bank description ≠ Payee ≠ Category

✅ **User Control**: Users explicitly manage the payee master list

✅ **Better Rules**: Rules can assign both payee and category with proper hierarchy

✅ **Audit Trail**: `original_description` is immutable reference data
