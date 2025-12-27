import { supabase } from '../supabase/config';
import { Transaction, Payee } from '../../types/database';
import { Rule, RuleApplicationResult, RuleBatchResult } from '../../types/rules';
import { findMatchingRules, selectBestRule } from './matcher';

export interface ApplyRuleOptions {
  overrideReviewed?: boolean; // If true, apply rule even if transaction is already reviewed
  setReviewedFlag?: boolean; // If true, mark transaction as reviewed after applying rule
}

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
async function applyRuleToTransaction(
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
  if (transaction.is_reviewed && !overrideReviewed) {
    return {
      transactionId: transaction.id,
      applied: false,
      reason: 'Transaction already reviewed',
    };
  }

  try {
    // Determine which category to apply based on hierarchy:
    // 1. If rule has a category → use it
    // 2. Else if rule assigns a payee with default_category_id → use payee's default
    // 3. Else → no category change
    let categoryToApply = rule.target_category_id;

    // Fetch payee if rule specifies one (to check for default category)
    let payeeForRule: Payee | null = null;
    if (rule.payee_id && !categoryToApply) {
      const { data: payeeData } = await supabase
        .from('payees')
        .select('*')
        .eq('id', rule.payee_id)
        .single();

      if (payeeData) {
        payeeForRule = payeeData as Payee;
        // Use payee's default category if rule doesn't specify one
        if (payeeForRule.default_category_id) {
          categoryToApply = payeeForRule.default_category_id;
        }
      }
    }

    // Build transaction update
    const transactionUpdate: Partial<Transaction> = {};

    // Update category if we determined one to apply
    if (categoryToApply) {
      transactionUpdate.lines = [
        {
          category_id: categoryToApply,
          amount: transaction.amount,
          memo: '',
        },
      ];
    }

    // Update payee if rule specifies one (prefer payee_id, fallback to suggested_payee)
    if (rule.payee_id) {
      transactionUpdate.payee_id = rule.payee_id;
      // Clear legacy payee text field when assigning payee_id
      transactionUpdate.payee = null;
    } else if (rule.suggested_payee) {
      // Legacy: Use suggested_payee text (deprecated)
      transactionUpdate.payee = rule.suggested_payee;
    }

    // Set reviewed flag if option enabled
    if (setReviewedFlag) {
      transactionUpdate.is_reviewed = true;
    }

    // Update transaction
    const { error: txnError } = await supabase
      .from('transactions')
      .update(transactionUpdate)
      .eq('id', transaction.id);

    if (txnError) throw txnError;

    // Update rule usage statistics
    // use_count and last_used_at are snake_case in DB
    const { error: ruleError } = await supabase
      .from('rules')
      .update({
        use_count: rule.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', rule.id);

    if (ruleError) {
      console.error('Failed to update rule statistics:', ruleError);
      // Don't fail the whole operation if stats update fails
    }

    // Get previous category ID safely
    const previousLines = transaction.lines as Array<{ category_id: string | null }>;
    const previousCategoryId = previousLines?.[0]?.category_id || null;

    return {
      transactionId: transaction.id,
      applied: true,
      matchedRule: rule,
      previousCategoryId: previousCategoryId,
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
async function applyRulesToTransaction(
  transaction: Transaction,
  rules: Rule[],
  options?: ApplyRuleOptions
): Promise<RuleApplicationResult> {
  // Find matching rules
  const matches = findMatchingRules(transaction, rules);

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
