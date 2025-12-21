# Phase 4: The Rules Engine (Auto-Categorization)

**Status:** Ready for Implementation
**Dependencies:** Phase 3 (Import & Transaction Management)
**Estimated Complexity:** Medium-High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-3-Import-Transactions-v2.md](Phase-3-Import-Transactions-v2.md)

---

## Overview

Phase 4 implements the automated categorization system that learns from user behavior and applies consistent category assignments to transactions. This is a critical productivity feature that reduces manual data entry from hundreds of clicks per month to near-zero for recurring vendors.

**Key Principles:**

- **Logic-First:** All rule matching logic must exist in pure, testable TypeScript functions in `/src/lib/rules/`
- **Zero UI Polish:** Raw HTML forms and buttons only, serving as a harness to trigger and verify the rule engine
- **Idempotency:** Running rules multiple times on the same transaction should produce the same result
- **Auditability:** Every rule application should be traceable (which rule matched, when, by whom)
- **Performance:** Must handle 10,000 transactions with 100 rules in < 2 seconds
- **User Control:** Rules are suggestions that can be overridden; `isReviewed` flag gives users final say

---

## Conceptual Model

### The Rule Lifecycle

```text
1. User creates rule (manually or from transaction)
   ↓
2. Rule stored in database with priority and matching criteria
   ↓
3. Rule applied during:
   - Import (automatic, Phase 3 integration)
   - Manual "Run Rules" (Workbench page)
   - Single transaction edit (optional)
   ↓
4. Rule matches transaction description
   ↓
5. Transaction updated:
   - Category assigned
   - Payee normalized (optional)
   - isReviewed flag set (if user preference enabled)
   ↓
6. Rule usage statistics updated (useCount, lastUsedAt)
```

### Rule Priority & Conflict Resolution

**Problem:** Multiple rules might match a single transaction.

**Solution:** Priority-based resolution

1. Filter rules that match the transaction description
2. Sort by priority (higher number = higher priority)
3. Apply the first matching rule
4. Stop processing (no cascading)

**Example:**

- Rule 1: "target" → Category: "Shopping" (priority: 10)
- Rule 2: "target pharmacy" → Category: "Medical" (priority: 20)
- Transaction: "TARGET PHARMACY #1234"
- **Result:** Category assigned to "Medical" (Rule 2 wins due to higher priority)

**Why this matters:**

- Specific rules should override general rules
- User has full control via priority values
- Predictable behavior (deterministic)

---

## Database Schema (Already Created in Phase 1)

The `rules` table was defined in Phase 1. This phase implements the business logic to interact with it.

### Reminder: `rules` table structure

```typescript
interface Rule {
  id: string; // uuid, primary key
  booksetId: string; // uuid, foreign key to booksets.id

  // Matching criteria
  keyword: string; // Lowercase search string
  matchType: 'contains' | 'exact' | 'startsWith' | 'regex';
  caseSensitive: boolean; // Usually false

  // Action to take
  targetCategoryId: string; // uuid, foreign key to categories.id
  suggestedPayee?: string; // Also normalize payee name

  // Priority and control
  priority: number; // Higher priority wins if multiple rules match
  isEnabled: boolean; // Allow disabling without deleting

  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  lastUsedAt?: timestamp; // Track which rules are actually useful
  useCount: number; // How many times this rule has matched

  // Audit trail (set by triggers)
  createdBy: string; // uuid, foreign key to users.id
  lastModifiedBy: string; // uuid, foreign key to users.id
}
```

**Important Notes:**

- `keyword` is stored in lowercase for case-insensitive matching (default)
- `matchType` determines the matching algorithm
- `priority` is a user-defined integer (1-100 recommended range)
- `isEnabled` allows rules to be temporarily disabled without deletion
- `useCount` and `lastUsedAt` track rule effectiveness

---

## Types & Interfaces

### File: `src/types/rules.ts`

**Purpose:** TypeScript types for rule operations.

```typescript
import { Rule } from './database';

export type MatchType = 'contains' | 'exact' | 'startsWith' | 'regex';

export interface InsertRule {
  booksetId: string;
  keyword: string;
  matchType: MatchType;
  caseSensitive: boolean;
  targetCategoryId: string;
  suggestedPayee?: string;
  priority: number;
  isEnabled: boolean;
}

export type UpdateRule = Partial<Omit<InsertRule, 'booksetId'>>;

export interface RuleMatch {
  rule: Rule;
  matchedText: string; // The portion of description that matched
  confidence: number; // 0-100 (100 = exact match, lower for partial matches)
}

export interface RuleApplicationResult {
  transactionId: string;
  applied: boolean; // True if rule was applied
  matchedRule?: Rule; // The rule that was applied
  reason?: string; // Why it wasn't applied (if applicable)
  previousCategoryId?: string; // For undo functionality (future)
}

export interface RuleBatchResult {
  totalTransactions: number;
  appliedCount: number;
  skippedCount: number;
  errorCount: number;
  results: RuleApplicationResult[];
}
```

**Why these types:**

- `RuleMatch` separates finding matches from applying them (testable)
- `RuleApplicationResult` provides detailed feedback for each transaction
- `RuleBatchResult` aggregates statistics for batch operations
- `confidence` field enables future UI features (show match quality)

---

## Domain Logic: The Rules Engine

All rule matching logic is pure functions in `src/lib/rules/`.

### Module: Rule Matcher

**File:** `src/lib/rules/matcher.ts`

**Dependencies:** None

**Objective:** Implement rule matching algorithms for all match types.

#### Types (Matcher)

```typescript
import { Rule } from '../../types/database';
import { RuleMatch } from '../../types/rules';

export interface MatchOptions {
  caseSensitive?: boolean; // Override rule's caseSensitive flag (for testing)
}
```

#### Function: `normalizeText(text: string, caseSensitive: boolean): string`

**Purpose:** Prepare text for matching based on case sensitivity.

**Parameters:**

- `text`: Raw text to normalize
- `caseSensitive`: Whether to preserve case

**Returns:** Normalized string

**Implementation concept:**

```typescript
/**
 * Normalizes text for matching.
 *
 * Rules:
 * - Trim leading/trailing whitespace
 * - Convert to lowercase if case-insensitive
 * - Replace multiple spaces with single space
 *
 * @param text - Raw text to normalize
 * @param caseSensitive - Whether to preserve case
 * @returns Normalized string
 */
export function normalizeText(text: string, caseSensitive: boolean): string {
  let normalized = text.trim().replace(/\s+/g, ' ');
  return caseSensitive ? normalized : normalized.toLowerCase();
}
```

**Why this normalization:**

- Consistent matching across different banks' CSV formats
- Handles extra whitespace (common in bank exports)
- Case-insensitive by default (most users expect this)

#### Function: `matchesRule(description: string, rule: Rule): boolean`

**Purpose:** Determine if a transaction description matches a rule.

**Parameters:**

- `description`: Transaction's originalDescription field
- `rule`: Rule to test against

**Returns:** `true` if rule matches, `false` otherwise

**Implementation concept:**

```typescript
/**
 * Tests if a transaction description matches a rule.
 *
 * Supports four match types:
 * - 'contains': Keyword appears anywhere in description
 * - 'exact': Description equals keyword exactly
 * - 'startsWith': Description begins with keyword
 * - 'regex': Keyword is a regular expression pattern
 *
 * @param description - Transaction's originalDescription
 * @param rule - Rule to test against
 * @returns True if rule matches
 */
export function matchesRule(description: string, rule: Rule): boolean {
  // Normalize both description and keyword
  const normalizedDescription = normalizeText(description, rule.caseSensitive);
  const normalizedKeyword = normalizeText(rule.keyword, rule.caseSensitive);

  switch (rule.matchType) {
    case 'contains':
      return normalizedDescription.includes(normalizedKeyword);

    case 'exact':
      return normalizedDescription === normalizedKeyword;

    case 'startsWith':
      return normalizedDescription.startsWith(normalizedKeyword);

    case 'regex':
      try {
        const flags = rule.caseSensitive ? '' : 'i';
        const regex = new RegExp(rule.keyword, flags);
        return regex.test(description); // Use original description for regex
      } catch (error) {
        // Invalid regex - treat as no match
        console.error(`Invalid regex in rule ${rule.id}:`, error);
        return false;
      }

    default:
      return false;
  }
}
```

**Why these match types:**

- **contains**: Most common (e.g., "target" matches "TARGET STORE #1234")
- **exact**: Rare but useful for specific vendors
- **startsWith**: Good for bank names (e.g., "DEBIT CARD")
- **regex**: Advanced users can create complex patterns

**Error Handling:**

- Invalid regex patterns are caught and logged (don't crash the app)
- Future enhancement: Validate regex on rule creation (UI feedback)

#### Function: `findMatchingRules(description: string, rules: Rule[]): RuleMatch[]`

**Purpose:** Find all rules that match a description, sorted by priority.

**Parameters:**

- `description`: Transaction's originalDescription
- `rules`: Array of all active rules

**Returns:** Array of RuleMatch objects, sorted by priority (highest first)

**Implementation concept:**

```typescript
/**
 * Finds all rules that match a description.
 *
 * Filters out:
 * - Disabled rules (isEnabled = false)
 * - Rules that don't match the description
 *
 * Returns:
 * - Sorted by priority (highest first)
 * - Includes confidence score (100 for all matches in Phase 4)
 *
 * @param description - Transaction's originalDescription
 * @param rules - Array of all rules
 * @returns Array of matching rules, sorted by priority
 */
export function findMatchingRules(description: string, rules: Rule[]): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.isEnabled) {
      continue;
    }

    // Test if rule matches
    if (matchesRule(description, rule)) {
      matches.push({
        rule,
        matchedText: rule.keyword, // Simplified for Phase 4
        confidence: 100, // All matches are 100% confidence in Phase 4
      });
    }
  }

  // Sort by priority (highest first)
  matches.sort((a, b) => b.rule.priority - a.rule.priority);

  return matches;
}
```

**Why sort by priority:**

- Ensures the highest-priority rule is first
- Caller can simply use `matches[0]` to get the winning rule
- Enables future UI to show "runner-up" rules

#### Function: `selectBestRule(matches: RuleMatch[]): Rule | null`

**Purpose:** Select the winning rule from multiple matches.

**Parameters:**

- `matches`: Array of RuleMatch objects (already sorted by priority)

**Returns:** The winning rule, or `null` if no matches

**Implementation concept:**

```typescript
/**
 * Selects the best rule from multiple matches.
 *
 * Logic:
 * - Returns the first rule (highest priority)
 * - Returns null if no matches
 *
 * Future enhancement: Consider confidence scores, specificity, etc.
 *
 * @param matches - Array of matching rules (sorted by priority)
 * @returns The winning rule, or null
 */
export function selectBestRule(matches: RuleMatch[]): Rule | null {
  if (matches.length === 0) {
    return null;
  }

  // Return highest priority rule (first in sorted array)
  return matches[0].rule;
}
```

**Why separate function:**

- Encapsulates selection logic (can be enhanced later)
- Testable independently
- Clear single responsibility

---

### Module: Rule Applicator

**File:** `src/lib/rules/applicator.ts`

**Dependencies:** `matcher.ts`, Supabase client

**Objective:** Apply rules to transactions and update the database.

#### Types (Applicator)

```typescript
import { Transaction } from '../../types/database';
import { Rule, RuleApplicationResult } from '../../types/rules';

export interface ApplyRuleOptions {
  overrideReviewed?: boolean; // If true, apply rule even if transaction is already reviewed
  setReviewedFlag?: boolean; // If true, mark transaction as reviewed after applying rule
}
```

#### Function: `applyRuleToTransaction(transaction: Transaction, rule: Rule, options?: ApplyRuleOptions): Promise<RuleApplicationResult>`

**Purpose:** Apply a single rule to a single transaction.

**Parameters:**

- `transaction`: Transaction to update
- `rule`: Rule to apply
- `options`: Optional configuration

**Returns:** `Promise<RuleApplicationResult>`

**Business Logic:**

1. Check if transaction is already reviewed (skip if `overrideReviewed` is false)
2. Update transaction:
   - Set `lines[0].categoryId` to `rule.targetCategoryId`
   - Set `payee` to `rule.suggestedPayee` (if provided)
   - Set `isReviewed` to true (if `setReviewedFlag` is true)
3. Update rule usage statistics:
   - Increment `useCount`
   - Set `lastUsedAt` to current timestamp
4. Return result with success/failure status

**Implementation concept:**

```typescript
import { supabase } from '../supabase/config';

/**
 * Applies a rule to a transaction.
 *
 * Steps:
 * 1. Check if transaction should be updated (respect isReviewed and reconciled flags)
 * 2. Update transaction category and payee
 * 3. Update rule usage statistics
 * 4. Return result
 *
 * @param transaction - Transaction to update
 * @param rule - Rule to apply
 * @param options - Optional configuration
 * @returns Result with success/failure status
 */
export async function applyRuleToTransaction(
  transaction: Transaction,
  rule: Rule,
  options: ApplyRuleOptions = {}
): Promise<RuleApplicationResult> {
  const { overrideReviewed = false, setReviewedFlag = true } = options;

  // Check if transaction is reconciled (NEVER update reconciled transactions via rules)
  if (transaction.reconciled) {
    return {
      transactionId: transaction.id,
      applied: false,
      reason: 'Transaction is reconciled',
    };
  }

  // Check if transaction is already reviewed
  if (transaction.isReviewed && !overrideReviewed) {
    return {
      transactionId: transaction.id,
      applied: false,
      reason: 'Transaction already reviewed',
    };
  }

  try {
    // Build transaction update
    const transactionUpdate: Partial<Transaction> = {
      // Update category (modify first line of split)
      lines: [
        {
          categoryId: rule.targetCategoryId,
          amount: transaction.amount,
          memo: null,
        },
      ],
    };

    // Update payee if rule provides suggestion
    if (rule.suggestedPayee) {
      transactionUpdate.payee = rule.suggestedPayee;
    }

    // Set reviewed flag if option enabled
    if (setReviewedFlag) {
      transactionUpdate.isReviewed = true;
    }

    // Update transaction
    const { error: txnError } = await supabase
      .from('transactions')
      .update(transactionUpdate)
      .eq('id', transaction.id);

    if (txnError) throw txnError;

    // Update rule usage statistics
    const { error: ruleError } = await supabase
      .from('rules')
      .update({
        useCount: rule.useCount + 1,
        lastUsedAt: new Date().toISOString(),
      })
      .eq('id', rule.id);

    if (ruleError) {
      console.error('Failed to update rule statistics:', ruleError);
      // Don't fail the whole operation if stats update fails
    }

    return {
      transactionId: transaction.id,
      applied: true,
      matchedRule: rule,
      previousCategoryId: transaction.lines?.[0]?.categoryId || null,
    };
  } catch (error) {
    console.error('Failed to apply rule:', error);
    return {
      transactionId: transaction.id,
      applied: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Why these options:**

- `overrideReviewed`: Allows re-running rules on reviewed transactions (advanced feature)
- `setReviewedFlag`: Configurable per user preference (some users want to review all transactions)

**Important Notes:**

- Only updates the first line of the `lines` array (Phase 4 doesn't support split transactions)
- Preserves `amount` when updating category
- Statistics update failure doesn't fail the whole operation (resilient)

#### Function: `applyRulesToTransaction(transaction: Transaction, rules: Rule[], options?: ApplyRuleOptions): Promise<RuleApplicationResult>`

**Purpose:** Find the best matching rule and apply it to a transaction.

**Parameters:**

- `transaction`: Transaction to categorize
- `rules`: Array of all active rules
- `options`: Optional configuration

**Returns:** `Promise<RuleApplicationResult>`

**Implementation concept:**

```typescript
import { findMatchingRules, selectBestRule } from './matcher';

/**
 * Finds and applies the best matching rule to a transaction.
 *
 * Steps:
 * 1. Find all matching rules
 * 2. Select best rule (highest priority)
 * 3. Apply rule to transaction
 * 4. Return result
 *
 * @param transaction - Transaction to categorize
 * @param rules - Array of all rules
 * @param options - Optional configuration
 * @returns Result with success/failure status
 */
export async function applyRulesToTransaction(
  transaction: Transaction,
  rules: Rule[],
  options?: ApplyRuleOptions
): Promise<RuleApplicationResult> {
  // Find matching rules
  const matches = findMatchingRules(transaction.originalDescription, rules);

  // Select best rule
  const bestRule = selectBestRule(matches);

  // No matching rules
  if (!bestRule) {
    return {
      transactionId: transaction.id,
      applied: false,
      reason: 'No matching rules',
    };
  }

  // Apply the winning rule
  return applyRuleToTransaction(transaction, bestRule, options);
}
```

**Why this wrapper:**

- Combines matching and application in one function
- Simplifies calling code (don't need to manually find matches)
- Single function for "categorize this transaction"

#### Function: `applyRulesToBatch(transactions: Transaction[], rules: Rule[], options?: ApplyRuleOptions): Promise<RuleBatchResult>`

**Purpose:** Apply rules to multiple transactions in batch.

**Parameters:**

- `transactions`: Array of transactions to categorize
- `rules`: Array of all active rules
- `options`: Optional configuration

**Returns:** `Promise<RuleBatchResult>`

**Implementation concept:**

```typescript
/**
 * Applies rules to a batch of transactions.
 *
 * Processes transactions sequentially (not parallel) to:
 * - Avoid overwhelming the database with concurrent updates
 * - Maintain consistent rule usage statistics
 * - Provide progress updates (future enhancement)
 *
 * @param transactions - Array of transactions to categorize
 * @param rules - Array of all rules
 * @param options - Optional configuration
 * @returns Batch result with statistics
 */
export async function applyRulesToBatch(
  transactions: Transaction[],
  rules: Rule[],
  options?: ApplyRuleOptions
): Promise<RuleBatchResult> {
  const results: RuleApplicationResult[] = [];
  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const transaction of transactions) {
    const result = await applyRulesToTransaction(transaction, rules, options);
    results.push(result);

    if (result.applied) {
      appliedCount++;
    } else if (
      result.reason === 'No matching rules' ||
      result.reason === 'Transaction already reviewed'
    ) {
      skippedCount++;
    } else {
      errorCount++;
    }
  }

  return {
    totalTransactions: transactions.length,
    appliedCount,
    skippedCount,
    errorCount,
    results,
  };
}
```

**Performance Consideration:**

- Sequential processing (not parallel) prevents database overload
- For 1,000 transactions with 100 rules: ~10-20 seconds (acceptable for background operation)
- Future enhancement: Use Supabase batch update API or PostgreSQL function for better performance

---

## Data Access Layer (Supabase)

New functions needed in `src/lib/supabase/`.

### File: `src/lib/supabase/rules.ts`

**Purpose:** All Supabase queries and mutations for rules.

**Exports:**

#### Function: `fetchRules(booksetId: string): Promise<Rule[]>`

**Purpose:** Fetch all active rules for a bookset.

**Parameters:**

- `booksetId`: Bookset UUID

**Returns:** `Promise<Rule[]>`

**Implementation concept:**

```typescript
import { supabase } from './config';
import { Rule } from '../../types/database';

/**
 * Fetches all rules for a bookset.
 *
 * Filters:
 * - By booksetId (RLS enforces this, but explicit for clarity)
 * - Includes both enabled and disabled rules (UI will filter)
 *
 * Sorting:
 * - By priority descending (highest priority first)
 *
 * @param booksetId - Bookset UUID
 * @returns Array of rules
 */
export async function fetchRules(booksetId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('booksetId', booksetId)
    .order('priority', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

**Why include disabled rules:**

- UI needs to show all rules (with visual indicator for disabled)
- User can enable/disable without re-fetching
- Filtering happens in UI, not query

#### Function: `createRule(rule: InsertRule): Promise<Rule>`

**Purpose:** Create a new rule.

**Parameters:**

- `rule`: Rule data (without ID)

**Returns:** `Promise<Rule>`

**Implementation concept:**

```typescript
import { InsertRule } from '../../types/rules';

/**
 * Creates a new rule.
 *
 * Defaults:
 * - useCount: 0
 * - lastUsedAt: null
 *
 * Database triggers set:
 * - createdBy, createdAt, lastModifiedBy, updatedAt
 *
 * @param rule - Rule data
 * @returns Created rule with all fields
 */
export async function createRule(rule: InsertRule): Promise<Rule> {
  const { data, error } = await supabase
    .from('rules')
    .insert({
      booksetId: rule.booksetId,
      keyword: rule.keyword.toLowerCase(), // Store in lowercase for case-insensitive matching
      matchType: rule.matchType,
      caseSensitive: rule.caseSensitive,
      targetCategoryId: rule.targetCategoryId,
      suggestedPayee: rule.suggestedPayee || null,
      priority: rule.priority,
      isEnabled: rule.isEnabled,
      useCount: 0,
      lastUsedAt: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**Why lowercase keyword:**

- Normalized storage for consistent matching
- Case-insensitive by default (most common use case)
- `caseSensitive` flag allows override when needed

#### Function: `updateRule(id: string, updates: UpdateRule): Promise<Rule>`

**Purpose:** Update an existing rule.

**Parameters:**

- `id`: Rule UUID
- `updates`: Partial rule data

**Returns:** `Promise<Rule>`

**Implementation concept:**

```typescript
import { UpdateRule } from '../../types/rules';

/**
 * Updates an existing rule.
 *
 * Note: If updating keyword, convert to lowercase for consistency.
 *
 * Database triggers update:
 * - lastModifiedBy, updatedAt
 *
 * @param id - Rule UUID
 * @param updates - Partial rule data
 * @returns Updated rule
 */
export async function updateRule(id: string, updates: UpdateRule): Promise<Rule> {
  // Normalize keyword if provided
  if (updates.keyword) {
    updates.keyword = updates.keyword.toLowerCase();
  }

  const { data, error } = await supabase
    .from('rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

#### Function: `deleteRule(id: string): Promise<void>`

**Purpose:** Delete a rule.

**Parameters:**

- `id`: Rule UUID

**Returns:** `Promise<void>`

**Note:** Hard delete (not soft delete like accounts/categories).

**Why hard delete:**

- Rules don't have foreign key references (no data integrity issues)
- User expects deleted rules to be gone (unlike accounts which have transactions)
- Deleted rules don't need to be preserved for audit trail

**Implementation concept:**

```typescript
/**
 * Deletes a rule.
 *
 * Hard delete (not soft delete).
 *
 * @param id - Rule UUID
 */
export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('rules').delete().eq('id', id);

  if (error) throw error;
}
```

---

## React Query Hooks

Custom hooks that wrap React Query with Supabase data access functions.

### File: `src/hooks/useRules.ts`

**Purpose:** Provide React Query hooks for rule operations.

**Exports:**

#### Hook: `useRules()`

**Purpose:** Fetch all rules for the active bookset.

**Returns:**

```typescript
{
  rules: Rule[];
  isLoading: boolean;
  error: Error | null;
}
```

**Implementation concept:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchRules } from '../lib/supabase/rules';

/**
 * Fetches all rules for the active bookset.
 *
 * Cache key: ['rules', booksetId]
 * - Invalidated when bookset changes
 * - Invalidated after create/update/delete
 *
 * @returns Rules array, loading state, error
 */
export function useRules() {
  const { activeBookset } = useAuth();

  const query = useQuery({
    queryKey: ['rules', activeBookset?.id],
    queryFn: () => fetchRules(activeBookset!.id),
    enabled: !!activeBookset,
  });

  return {
    rules: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
```

#### Hook: `useCreateRule()`

**Purpose:** Mutation hook for creating rules.

**Returns:**

```typescript
{
  createRule: (rule: InsertRule) => Promise<Rule>;
  isLoading: boolean;
  error: Error | null;
}
```

**Implementation concept:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRule } from '../lib/supabase/rules';
import { useAuth } from '../contexts/AuthContext';

/**
 * Creates a new rule.
 *
 * On success:
 * - Invalidates rules query to trigger refetch
 *
 * @returns Mutation function, loading state, error
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries(['rules', activeBookset?.id]);
    },
  });

  return {
    createRule: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    error: mutation.error as Error | null,
  };
}
```

#### Hook: `useUpdateRule()`

**Purpose:** Mutation hook for updating rules.

**Implementation:** Same pattern as `useCreateRule()`, but calls `updateRule()`

#### Hook: `useDeleteRule()`

**Purpose:** Mutation hook for deleting rules.

**Implementation:** Same pattern as `useCreateRule()`, but calls `deleteRule()`

---

### File: `src/hooks/useApplyRules.ts`

**Purpose:** Hook for applying rules to transactions.

**Exports:**

#### Hook: `useApplyRules()`

**Purpose:** Mutation hook for batch rule application.

**Returns:**

```typescript
{
  applyRules: (transactionIds: string[]) => Promise<RuleBatchResult>;
  isApplying: boolean;
  error: Error | null;
  result: RuleBatchResult | null;
}
```

**Implementation concept:**

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRules } from './useRules';
import { applyRulesToBatch } from '../lib/rules/applicator';
import { supabase } from '../lib/supabase/config';
import { Transaction } from '../types/database';
import { RuleBatchResult } from '../types/rules';

/**
 * Hook for applying rules to transactions.
 *
 * Steps:
 * 1. Fetch specified transactions from database
 * 2. Apply rules using applyRulesToBatch()
 * 3. Invalidate transaction queries to trigger refetch
 *
 * @returns Mutation function, loading state, error, result
 */
export function useApplyRules() {
  const queryClient = useQueryClient();
  const { rules } = useRules();
  const [result, setResult] = useState<RuleBatchResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      // Fetch transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .in('id', transactionIds);

      if (error) throw error;
      if (!transactions) throw new Error('No transactions found');

      // Apply rules
      const batchResult = await applyRulesToBatch(transactions as Transaction[], rules, {
        overrideReviewed: false,
        setReviewedFlag: true, // Mark as reviewed after applying rule
      });

      setResult(batchResult);
      return batchResult;
    },
    onSuccess: () => {
      // Invalidate transaction queries
      queryClient.invalidateQueries(['transactions']);
    },
  });

  return {
    applyRules: mutation.mutateAsync,
    isApplying: mutation.isLoading,
    error: mutation.error as Error | null,
    result,
  };
}
```

**Why fetch transactions in hook:**

- Separates UI concerns from business logic
- `applyRulesToBatch()` is pure function (testable without database)
- Hook handles database access (React Query caching)

---

## Validation Schemas (Zod)

### File: `src/lib/validation/rules.ts`

**Purpose:** Runtime validation for rule creation and updates.

**Exports:**

```typescript
import { z } from 'zod';

export const insertRuleSchema = z.object({
  booksetId: z.string().uuid(),
  keyword: z.string().min(1, 'Keyword is required').max(200),
  matchType: z.enum(['contains', 'exact', 'startsWith', 'regex']),
  caseSensitive: z.boolean(),
  targetCategoryId: z.string().uuid('Category is required'),
  suggestedPayee: z.string().max(200).optional(),
  priority: z.number().int().min(1).max(100),
  isEnabled: z.boolean(),
});

export type InsertRuleValidated = z.infer<typeof insertRuleSchema>;

export const updateRuleSchema = insertRuleSchema.partial().omit({ booksetId: true });

export type UpdateRuleValidated = z.infer<typeof updateRuleSchema>;

// Additional validation: Test regex patterns
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}
```

**Why these validations:**

- `keyword.min(1)`: Prevent empty keywords
- `priority`: 1-100 range (keeps values manageable)
- `validateRegex()`: Separate function for regex validation (used in UI before submitting)

---

## UI Components

### Settings Page: Rules Tab

#### File: `src/components/settings/RulesTab.tsx`

**Purpose:** List rules and provide create/edit/delete operations.

**Structure:**

```text
<RulesTab>
  ├── <button>Create Rule</button>
  ├── <table> (native HTML)
  │   ├── Columns: Priority, Keyword, Match Type, Category, Payee, Enabled, Actions
  │   └── Rows: One per rule
  └── <RuleFormModal> (shown when creating/editing)
```

**Component State:**

```typescript
function RulesTab() {
  const { rules, isLoading, error } = useRules();
  const { deleteRule } = useDeleteRule();
  const { categories } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Handlers
  function handleCreate() {
    setEditingRule(null);
    setIsFormOpen(true);
  }

  function handleEdit(rule: Rule) {
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this rule?')) {
      await deleteRule(id);
    }
  }

  async function handleToggleEnabled(rule: Rule) {
    await updateRule(rule.id, { isEnabled: !rule.isEnabled });
  }

  // Render
  return (
    <div>
      <button onClick={handleCreate}>Create Rule</button>

      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}

      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Keyword</th>
            <th>Match Type</th>
            <th>Category</th>
            <th>Payee</th>
            <th>Enabled</th>
            <th>Usage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => {
            const category = categories.find((c) => c.id === rule.targetCategoryId);

            return (
              <tr key={rule.id} style={{ opacity: rule.isEnabled ? 1 : 0.5 }}>
                <td>{rule.priority}</td>
                <td>{rule.keyword}</td>
                <td>{rule.matchType}</td>
                <td>{category?.name || 'Unknown'}</td>
                <td>{rule.suggestedPayee || '-'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isEnabled}
                    onChange={() => handleToggleEnabled(rule)}
                  />
                </td>
                <td>
                  {rule.useCount} times
                  {rule.lastUsedAt && (
                    <div style={{ fontSize: '0.8em', color: 'gray' }}>
                      Last: {new Date(rule.lastUsedAt).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td>
                  <button onClick={() => handleEdit(rule)}>Edit</button>
                  <button onClick={() => handleDelete(rule.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isFormOpen && (
        <RuleFormModal rule={editingRule} onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  );
}
```

**Why this approach:**

- Native `<table>` (no styling library needed)
- Inline checkbox for toggling enabled state (instant feedback)
- Show usage statistics (helps user identify useful rules)
- Dim disabled rules (visual indicator)

---

### Rule Form Modal

#### File: `src/components/settings/RuleFormModal.tsx`

**Purpose:** Form for creating or editing a rule.

**Props:**

```typescript
interface RuleFormModalProps {
  rule: Rule | null; // null = creating, non-null = editing
  onClose: () => void;
}
```

**Structure:**

```text
<RuleFormModal>
  ├── <form>
  │   ├── <input name="keyword">
  │   ├── <select name="matchType"> (contains, exact, startsWith, regex)
  │   ├── <input type="checkbox" name="caseSensitive">
  │   ├── <select name="targetCategoryId"> (all categories)
  │   ├── <input name="suggestedPayee">
  │   ├── <input type="number" name="priority">
  │   ├── <input type="checkbox" name="isEnabled">
  │   ├── <button type="submit">Save</button>
  │   └── <button type="button" onClick={onClose}>Cancel</button>
  └── (Validation errors displayed below each field)
```

**Component Logic:**

```typescript
function RuleFormModal({ rule, onClose }: RuleFormModalProps) {
  const { activeBookset } = useAuth();
  const { createRule, isLoading: isCreating } = useCreateRule();
  const { updateRule, isLoading: isUpdating } = useUpdateRule();
  const { categories } = useCategories();

  const [formData, setFormData] = useState({
    keyword: rule?.keyword || '',
    matchType: rule?.matchType || 'contains',
    caseSensitive: rule?.caseSensitive ?? false,
    targetCategoryId: rule?.targetCategoryId || '',
    suggestedPayee: rule?.suggestedPayee || '',
    priority: rule?.priority ?? 50,
    isEnabled: rule?.isEnabled ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate regex if matchType is 'regex'
    if (formData.matchType === 'regex') {
      const regexValidation = validateRegex(formData.keyword);
      if (!regexValidation.valid) {
        setErrors({ keyword: regexValidation.error! });
        return;
      }
    }

    // Validate with Zod
    const validation = insertRuleSchema.safeParse({
      booksetId: activeBookset!.id,
      keyword: formData.keyword,
      matchType: formData.matchType,
      caseSensitive: formData.caseSensitive,
      targetCategoryId: formData.targetCategoryId,
      suggestedPayee: formData.suggestedPayee || undefined,
      priority: formData.priority,
      isEnabled: formData.isEnabled,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Submit
    if (rule) {
      updateRule(rule.id, validation.data).then(() => onClose());
    } else {
      createRule(validation.data).then(() => onClose());
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'white', margin: '100px auto', padding: '20px', maxWidth: '500px' }}>
        <h2>{rule ? 'Edit Rule' : 'Create Rule'}</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label>Keyword:</label>
            <input
              type="text"
              value={formData.keyword}
              onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              placeholder="e.g., target, starbucks, amazon"
            />
            {errors.keyword && <div style={{ color: 'red' }}>{errors.keyword}</div>}
          </div>

          <div>
            <label>Match Type:</label>
            <select
              value={formData.matchType}
              onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
            >
              <option value="contains">Contains (default)</option>
              <option value="exact">Exact match</option>
              <option value="startsWith">Starts with</option>
              <option value="regex">Regular expression</option>
            </select>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={formData.caseSensitive}
                onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
              />
              Case sensitive
            </label>
          </div>

          <div>
            <label>Category:</label>
            <select
              value={formData.targetCategoryId}
              onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
            >
              <option value="">-- Select Category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.targetCategoryId && <div style={{ color: 'red' }}>{errors.targetCategoryId}</div>}
          </div>

          <div>
            <label>Suggested Payee (optional):</label>
            <input
              type="text"
              value={formData.suggestedPayee}
              onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
              placeholder="e.g., Target, Starbucks"
            />
          </div>

          <div>
            <label>Priority (1-100):</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
            />
            {errors.priority && <div style={{ color: 'red' }}>{errors.priority}</div>}
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>

          <div>
            <button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Why this approach:**

- Controlled form inputs (React state)
- Zod validation on submit
- Regex validation before Zod (better error messages)
- Inline errors below each field
- Placeholder text for guidance

---

### Workbench Page: Run Rules Button

#### File: `src/pages/WorkbenchPage.tsx` (Update)

**Purpose:** Add "Run Rules" button to Workbench page.

**New UI Elements:**

```text
<WorkbenchPage>
  ├── <h1>Transaction Workbench</h1>
  ├── <button>Run Rules on All</button>  ← NEW
  ├── <button>Run Rules on Selected</button>  ← NEW
  ├── <TransactionGrid /> (Phase 5 - placeholder in Phase 4)
  └── <RuleBatchResultModal /> (shows results after running rules)
```

**Component Logic (Placeholder for Phase 4):**

```typescript
function WorkbenchPage() {
  const { transactions, isLoading } = useTransactions();
  const { applyRules, isApplying, result } = useApplyRules();
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);

  async function handleRunRulesOnAll() {
    const unreviewed = transactions.filter((t) => !t.isReviewed);
    const ids = unreviewed.map((t) => t.id);

    if (ids.length === 0) {
      alert('No unreviewed transactions to apply rules to.');
      return;
    }

    if (confirm(`Apply rules to ${ids.length} unreviewed transactions?`)) {
      await applyRules(ids);
      setShowResultModal(true);
    }
  }

  async function handleRunRulesOnSelected() {
    if (selectedTransactionIds.length === 0) {
      alert('No transactions selected.');
      return;
    }

    if (confirm(`Apply rules to ${selectedTransactionIds.length} selected transactions?`)) {
      await applyRules(selectedTransactionIds);
      setShowResultModal(true);
    }
  }

  return (
    <div>
      <h1>Transaction Workbench</h1>

      <div>
        <button onClick={handleRunRulesOnAll} disabled={isApplying}>
          {isApplying ? 'Applying Rules...' : 'Run Rules on All Unreviewed'}
        </button>
        <button onClick={handleRunRulesOnSelected} disabled={isApplying || selectedTransactionIds.length === 0}>
          Run Rules on Selected ({selectedTransactionIds.length})
        </button>
      </div>

      {isLoading && <div>Loading transactions...</div>}

      {/* Transaction grid (Phase 5 - placeholder in Phase 4) */}
      <div>Transaction grid will appear here in Phase 5</div>

      {showResultModal && result && (
        <RuleBatchResultModal result={result} onClose={() => setShowResultModal(false)} />
      )}
    </div>
  );
}
```

**Why these buttons:**

- "Run Rules on All": Batch operation for all unreviewed transactions
- "Run Rules on Selected": User can cherry-pick transactions (Phase 5 feature)
- Confirmation dialog prevents accidental batch operations

---

### Rule Batch Result Modal

#### File: `src/components/workbench/RuleBatchResultModal.tsx`

**Purpose:** Display results of batch rule application.

**Props:**

```typescript
interface RuleBatchResultModalProps {
  result: RuleBatchResult;
  onClose: () => void;
}
```

**Component Structure:**

```typescript
function RuleBatchResultModal({ result, onClose }: RuleBatchResultModalProps) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'white', margin: '100px auto', padding: '20px', maxWidth: '600px' }}>
        <h2>Rule Application Results</h2>

        <div>
          <h3>Summary:</h3>
          <ul>
            <li>Total transactions: {result.totalTransactions}</li>
            <li>Rules applied: {result.appliedCount}</li>
            <li>Skipped (no match or already reviewed): {result.skippedCount}</li>
            <li>Errors: {result.errorCount}</li>
          </ul>
        </div>

        {result.errorCount > 0 && (
          <div>
            <h3>Errors:</h3>
            <ul>
              {result.results
                .filter((r) => !r.applied && r.reason !== 'No matching rules' && r.reason !== 'Transaction already reviewed')
                .map((r) => (
                  <li key={r.transactionId}>
                    Transaction {r.transactionId}: {r.reason}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

**Why this modal:**

- Provides transparency (user sees exactly what happened)
- Shows errors separately (actionable information)
- Simple close button (no further action needed)

---

## Integration with Phase 3 Import

### File: `src/hooks/useImportSession.ts` (Update)

**Purpose:** Add automatic rule application during import.

**Changes:**

1. Add option to `commit()` function to run rules after import
2. Fetch rules before committing
3. Apply rules to newly imported transactions
4. Update import result with rule statistics

**Implementation concept:**

```typescript
// In useImportSession hook

// Add to ImportSessionState
interface ImportSessionState {
  // ... existing fields
  applyRulesOnImport: boolean; // User preference (default: true)
  ruleApplicationResult: RuleBatchResult | null; // Results of rule application
}

// Update commit() function
const commit = async () => {
  // ... existing commit logic

  try {
    // ... existing import logic (commitImportBatch)

    // NEW: Apply rules if enabled
    if (state.applyRulesOnImport) {
      const { data: rules } = await supabase
        .from('rules')
        .select('*')
        .eq('booksetId', activeBookset.id)
        .eq('isEnabled', true);

      if (rules && rules.length > 0) {
        const ruleResult = await applyRulesToBatch(
          importResult.transactionIds.map((id) => ({ id }) as Transaction), // Simplified
          rules,
          { setReviewedFlag: true }
        );

        setState((prev) => ({
          ...prev,
          ruleApplicationResult: ruleResult,
        }));
      }
    }

    // ... existing success state update
  } catch (error) {
    // ... existing error handling
  }
};
```

**Why integrate with import:**

- Automatic categorization on import (biggest time saver)
- User doesn't need to remember to run rules manually
- Configurable (can be disabled if user prefers manual categorization)

**UI Update (ImportPage):**

Add checkbox to enable/disable automatic rule application:

```typescript
<label>
  <input
    type="checkbox"
    checked={state.applyRulesOnImport}
    onChange={(e) => setState({ ...state, applyRulesOnImport: e.target.checked })}
  />
  Automatically apply rules after import
</label>
```

---

## "Create Rule from Transaction" Workflow

### File: `src/components/workbench/CreateRuleFromTransactionButton.tsx`

**Purpose:** Quick rule creation from an existing transaction.

**Props:**

```typescript
interface CreateRuleFromTransactionButtonProps {
  transaction: Transaction;
}
```

**Component Logic:**

```typescript
function CreateRuleFromTransactionButton({ transaction }: CreateRuleFromTransactionButtonProps) {
  const { createRule } = useCreateRule();
  const { activeBookset } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    keyword: extractKeyword(transaction.originalDescription),
    matchType: 'contains' as MatchType,
    caseSensitive: false,
    targetCategoryId: transaction.lines?.[0]?.categoryId || '',
    suggestedPayee: transaction.payee,
    priority: 50,
    isEnabled: true,
  });

  function extractKeyword(description: string): string {
    // Simple heuristic: Extract first word or merchant name
    // Future enhancement: Use NLP or user selection
    const words = description.trim().toLowerCase().split(/\s+/);
    return words[0] || '';
  }

  async function handleCreateRule() {
    await createRule({
      booksetId: activeBookset!.id,
      ...formData,
    });
    setIsFormOpen(false);
  }

  return (
    <>
      <button onClick={() => setIsFormOpen(true)}>Create Rule</button>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'white', margin: '100px auto', padding: '20px', maxWidth: '500px' }}>
            <h2>Create Rule from Transaction</h2>
            <p>Transaction: {transaction.originalDescription}</p>

            <div>
              <label>Keyword:</label>
              <input
                type="text"
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              />
            </div>

            <div>
              <label>Category:</label>
              <select
                value={formData.targetCategoryId}
                onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
              >
                {/* Category options */}
              </select>
            </div>

            <div>
              <label>Payee:</label>
              <input
                type="text"
                value={formData.suggestedPayee}
                onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
              />
            </div>

            <button onClick={handleCreateRule}>Create Rule</button>
            <button onClick={() => setIsFormOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
```

**Why this feature:**

- Fastest way to create rules (one click from transaction)
- Pre-fills keyword, category, and payee (smart defaults)
- User can adjust before saving

**Future Enhancement (Phase 7):**

- Let user select specific text from description as keyword
- Use NLP to extract merchant name
- Suggest similar transactions that would match

---

## User Preferences Integration

### File: `src/lib/supabase/users.ts` (Update)

**Purpose:** Add user preference for automatic rule application.

**Update to User interface:**

```typescript
interface User {
  // ... existing fields
  preferences: {
    // ... existing preferences
    autoRunRules: boolean; // Run rules automatically on import (default: true)
    autoMarkReviewed: boolean; // Mark as reviewed when rule matches (default: true)
  };
}
```

**Implementation:**

Already defined in Phase 1. No code changes needed in Phase 4 (just use existing preference).

**UI Integration:**

Add checkbox to Settings page (User Preferences section):

```typescript
<label>
  <input
    type="checkbox"
    checked={user.preferences.autoRunRules}
    onChange={(e) => updateUserPreferences({ autoRunRules: e.target.checked })}
  />
  Automatically run rules on import
</label>

<label>
  <input
    type="checkbox"
    checked={user.preferences.autoMarkReviewed}
    onChange={(e) => updateUserPreferences({ autoMarkReviewed: e.target.checked })}
  />
  Mark transactions as reviewed when rule matches
</label>
```

**Why these preferences:**

- `autoRunRules`: Some users want manual control over categorization
- `autoMarkReviewed`: Some users want to review all transactions, even if auto-categorized

---

## Testing Plan

### Unit Tests

#### Test: Rule Matching (`src/lib/rules/matcher.test.ts`)

```typescript
describe('matchesRule', () => {
  it('should match "contains" rule', () => {
    const rule = {
      keyword: 'target',
      matchType: 'contains',
      caseSensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE #1234', rule)).toBe(true);
    expect(matchesRule('WALMART', rule)).toBe(false);
  });

  it('should match "exact" rule', () => {
    const rule = {
      keyword: 'target',
      matchType: 'exact',
      caseSensitive: false,
    } as Rule;

    expect(matchesRule('target', rule)).toBe(true);
    expect(matchesRule('TARGET', rule)).toBe(true);
    expect(matchesRule('target store', rule)).toBe(false);
  });

  it('should match "startsWith" rule', () => {
    const rule = {
      keyword: 'debit card',
      matchType: 'startsWith',
      caseSensitive: false,
    } as Rule;

    expect(matchesRule('DEBIT CARD PURCHASE - TARGET', rule)).toBe(true);
    expect(matchesRule('PURCHASE - DEBIT CARD', rule)).toBe(false);
  });

  it('should match "regex" rule', () => {
    const rule = {
      keyword: 'target|walmart|costco',
      matchType: 'regex',
      caseSensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE', rule)).toBe(true);
    expect(matchesRule('WALMART', rule)).toBe(true);
    expect(matchesRule('STARBUCKS', rule)).toBe(false);
  });

  it('should handle case sensitivity', () => {
    const rule = {
      keyword: 'Target',
      matchType: 'contains',
      caseSensitive: true,
    } as Rule;

    expect(matchesRule('Target Store', rule)).toBe(true);
    expect(matchesRule('TARGET STORE', rule)).toBe(false);
  });

  it('should handle invalid regex gracefully', () => {
    const rule = {
      keyword: '[invalid(regex',
      matchType: 'regex',
      caseSensitive: false,
    } as Rule;

    expect(matchesRule('any description', rule)).toBe(false);
  });
});

describe('findMatchingRules', () => {
  it('should find all matching rules', () => {
    const rules = [
      { id: '1', keyword: 'target', matchType: 'contains', isEnabled: true, priority: 10 } as Rule,
      { id: '2', keyword: 'store', matchType: 'contains', isEnabled: true, priority: 20 } as Rule,
      { id: '3', keyword: 'walmart', matchType: 'contains', isEnabled: true, priority: 30 } as Rule,
    ];

    const matches = findMatchingRules('TARGET STORE', rules);

    expect(matches).toHaveLength(2);
    expect(matches[0].rule.id).toBe('2'); // Higher priority first
    expect(matches[1].rule.id).toBe('1');
  });

  it('should skip disabled rules', () => {
    const rules = [
      { id: '1', keyword: 'target', matchType: 'contains', isEnabled: false, priority: 10 } as Rule,
      { id: '2', keyword: 'store', matchType: 'contains', isEnabled: true, priority: 20 } as Rule,
    ];

    const matches = findMatchingRules('TARGET STORE', rules);

    expect(matches).toHaveLength(1);
    expect(matches[0].rule.id).toBe('2');
  });
});

describe('selectBestRule', () => {
  it('should select highest priority rule', () => {
    const matches = [
      { rule: { id: '1', priority: 10 } as Rule, matchedText: 'target', confidence: 100 },
      { rule: { id: '2', priority: 20 } as Rule, matchedText: 'store', confidence: 100 },
    ];

    const best = selectBestRule(matches);

    expect(best?.id).toBe('2');
  });

  it('should return null for no matches', () => {
    const best = selectBestRule([]);
    expect(best).toBeNull();
  });
});
```

#### Test: Rule Application (`src/lib/rules/applicator.test.ts`)

```typescript
describe('applyRulesToTransaction', () => {
  it('should apply matching rule to transaction', async () => {
    const transaction = {
      id: 'txn-1',
      originalDescription: 'TARGET STORE',
      isReviewed: false,
      lines: [{ categoryId: null, amount: 10000, memo: null }],
    } as Transaction;

    const rules = [
      {
        id: 'rule-1',
        keyword: 'target',
        matchType: 'contains',
        isEnabled: true,
        priority: 10,
        targetCategoryId: 'cat-1',
        suggestedPayee: 'Target',
      } as Rule,
    ];

    const result = await applyRulesToTransaction(transaction, rules);

    expect(result.applied).toBe(true);
    expect(result.matchedRule?.id).toBe('rule-1');
  });

  it('should skip reviewed transactions', async () => {
    const transaction = {
      id: 'txn-1',
      originalDescription: 'TARGET STORE',
      isReviewed: true,
    } as Transaction;

    const rules = [
      {
        id: 'rule-1',
        keyword: 'target',
        matchType: 'contains',
        isEnabled: true,
        priority: 10,
        targetCategoryId: 'cat-1',
      } as Rule,
    ];

    const result = await applyRulesToTransaction(transaction, rules);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('Transaction already reviewed');
  });

  it('should return no match if no rules match', async () => {
    const transaction = {
      id: 'txn-1',
      originalDescription: 'STARBUCKS',
      isReviewed: false,
    } as Transaction;

    const rules = [
      {
        id: 'rule-1',
        keyword: 'target',
        matchType: 'contains',
        isEnabled: true,
        priority: 10,
        targetCategoryId: 'cat-1',
      } as Rule,
    ];

    const result = await applyRulesToTransaction(transaction, rules);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('No matching rules');
  });
});
```

### Integration Tests

#### Test: Rule CRUD Flow

**Scenario:**

1. Create a rule via `createRule()`
2. Verify it appears in `fetchRules()`
3. Update the rule keyword via `updateRule()`
4. Verify the keyword changed
5. Delete the rule via `deleteRule()`
6. Verify it no longer appears in `fetchRules()`

**Assertions:**

- All operations succeed without errors
- Data persists correctly in Supabase
- RLS policies allow access (user can read/write their own bookset)
- Audit fields are set correctly (createdBy, lastModifiedBy)

#### Test: Rule Priority Resolution

**Scenario:**

1. Create two rules:
   - Rule 1: "target" → Category: "Shopping" (priority: 10)
   - Rule 2: "target pharmacy" → Category: "Medical" (priority: 20)
2. Create transaction: "TARGET PHARMACY #1234"
3. Apply rules to transaction
4. Verify category is "Medical" (Rule 2 wins)

**Assertions:**

- Higher priority rule is applied
- Lower priority rule is ignored
- Rule usage statistics updated (Rule 2 useCount incremented)

#### Test: Batch Rule Application

**Scenario:**

1. Create 10 transactions (5 match rules, 5 don't)
2. Create 2 rules
3. Run `applyRulesToBatch()`
4. Verify 5 transactions categorized, 5 skipped

**Assertions:**

- Batch result statistics are correct
- Only matching transactions updated
- All transactions remain in database (no accidental deletes)

#### Test: Import Integration

**Scenario:**

1. Create rule: "starbucks" → Category: "Dining"
2. Import CSV with 3 Starbucks transactions
3. Verify all 3 auto-categorized to "Dining"
4. Verify `isReviewed` flag set (if user preference enabled)

**Assertions:**

- Rules applied during import (not manual step)
- User preference respected (`autoMarkReviewed`)
- Rule usage statistics updated

### Manual Testing Checklist

- [ ] Create rule via Settings > Rules tab
- [ ] Edit rule and verify changes persist
- [ ] Delete rule and verify it's removed
- [ ] Toggle rule enabled/disabled via checkbox
- [ ] Create rule with "contains" match type
- [ ] Create rule with "exact" match type
- [ ] Create rule with "startsWith" match type
- [ ] Create rule with "regex" match type (test valid and invalid regex)
- [ ] Create two overlapping rules with different priorities
- [ ] Verify higher priority rule wins
- [ ] Run "Run Rules on All" on Workbench page
- [ ] Verify batch result modal shows statistics
- [ ] Import CSV with auto-categorization enabled
- [ ] Verify transactions auto-categorized
- [ ] Import CSV with auto-categorization disabled
- [ ] Verify transactions NOT auto-categorized
- [ ] Create rule from transaction (quick create button)
- [ ] Verify keyword, category, and payee pre-filled
- [ ] Test with 1,000 transactions and 50 rules (performance test)
- [ ] Verify rule application completes in < 2 seconds
- [ ] Switch booksets and verify rules isolated to correct bookset
- [ ] Test with viewer role (should not be able to create/edit rules - RLS should block)

---

## Success Criteria

**Phase 4 is complete when:**

1. ✅ User can create, edit, and delete rules via Settings > Rules tab
2. ✅ Rules support all match types: contains, exact, startsWith, regex
3. ✅ Rules support case-sensitive and case-insensitive matching
4. ✅ Rule priority system works (higher priority wins conflicts)
5. ✅ Rule usage statistics tracked (useCount, lastUsedAt)
6. ✅ User can enable/disable rules via checkbox
7. ✅ "Run Rules on All" button on Workbench page works
8. ✅ Batch rule application shows result modal with statistics
9. ✅ Rules automatically applied during CSV import (if user preference enabled)
10. ✅ User preferences control rule behavior (autoRunRules, autoMarkReviewed)
11. ✅ "Create Rule from Transaction" quick create workflow works
12. ✅ Regex validation prevents invalid patterns from being saved
13. ✅ All unit tests pass
14. ✅ All integration tests pass
15. ✅ Performance test passes (1,000 transactions with 100 rules in < 2 seconds)
16. ✅ RLS policies enforce bookset isolation
17. ✅ Build runs without errors (`npm run build`)
18. ✅ App deployed to Vercel successfully

---

## Performance Considerations

### Rule Matching Performance

**Problem:** Matching 10,000 transactions against 100 rules is 1,000,000 comparisons.

**Solution:**

- Pre-filter disabled rules (reduces rule count)
- Use efficient string methods (`includes`, `startsWith`)
- Regex compilation is cached by JavaScript engine
- Stop after first match (for single transaction)

**Expected Performance:**

- 1 transaction × 100 rules: < 1ms
- 1,000 transactions × 100 rules: ~500ms
- 10,000 transactions × 100 rules: ~2s (acceptable for background operation)

### Database Update Performance

**Problem:** Updating 10,000 transactions one-by-one is slow.

**Solution (Future Enhancement - Phase 8):**

- Use Supabase RPC with PostgreSQL function
- Batch update in single query
- Expected performance: 10,000 updates in ~1s

**Phase 4 Approach:**

- Sequential updates (simple, reliable)
- Show progress indicator in UI
- Acceptable for MVP (most users have < 1,000 transactions per month)

---

## Notes for LLM-Assisted Development

### When implementing rule matching

- Test all match types separately (unit tests)
- Normalize text consistently (trim, lowercase, collapse spaces)
- Handle regex errors gracefully (don't crash on invalid patterns)
- Case-insensitive by default (most user-friendly)

### When implementing rule application

- Respect `isReviewed` flag (don't override user decisions)
- Update rule usage statistics (valuable for user)
- Use transactions if database supports them (Supabase doesn't via JS client)
- Return detailed results (not just success/failure)

### When implementing UI

- Show usage statistics (helps user identify useful rules)
- Dim disabled rules (visual feedback)
- Validate regex before saving (immediate feedback)
- Confirm batch operations (prevent accidents)

### Database considerations

- Index `(booksetId, isEnabled)` for fast rule fetching
- Store keyword in lowercase for consistency
- Hard delete rules (no foreign key references)
- Track usage statistics for future optimization

### Integration with other phases

- Phase 3: Add rule application after import
- Phase 5: Add "Create Rule" button to transaction grid
- Phase 6: Prevent rule application on reconciled transactions
- Phase 7: Add visual rule match indicators in UI

---

## Next Phase Preview

**Phase 5** will implement:

- TanStack Table with virtualization (2000+ row performance)
- Workbench page with Excel-like data grid
- Inline editing with keyboard navigation
- Split transaction UI and business logic
- Filter controls (isReviewed, account, date range)
- Bulk operations (mark all reviewed, batch edit)

The rules created in Phase 4 will automatically categorize transactions displayed in the Phase 5 Workbench.

---

## Changes from Original Phase 4 (Implementation Plan)

### Additions

1. **Detailed Type Definitions** - Complete TypeScript interfaces for all rule operations
2. **Rule Matching Algorithms** - Separate module with pure functions for each match type
3. **Rule Priority Resolution** - Explicit algorithm for conflict resolution
4. **User Preferences Integration** - Hooks into existing Phase 1 user preferences
5. **Import Integration** - Detailed steps for adding rules to Phase 3 import flow
6. **"Create Rule from Transaction"** - Complete workflow with UI and logic
7. **Performance Benchmarks** - Expected timing for various batch sizes
8. **Comprehensive Testing** - Unit tests, integration tests, manual checklist
9. **Validation Schemas** - Zod schemas with regex validation
10. **Database Optimization** - Index recommendations and query patterns

### Structural Improvements

1. **Separation of Concerns** - Matcher and Applicator modules clearly separated
2. **Pure Functions** - All rule logic is testable without database
3. **Error Handling** - Graceful degradation for invalid regex, database errors
4. **Audit Trail** - Usage statistics tracked automatically
5. **User Control** - Multiple configurable options (autoRunRules, autoMarkReviewed, overrideReviewed)

### Documentation Enhancements

1. **Code Examples** - Complete implementation concepts for all functions
2. **UI Wireframes** - Detailed component structures with inline styles
3. **Test Cases** - Specific test scenarios with assertions
4. **Integration Points** - Clear guidance on Phase 3 integration
5. **LLM Implementation Notes** - Specific guidance for each module

This Phase 4 document is comprehensive and ready for direct LLM implementation without ambiguity.
