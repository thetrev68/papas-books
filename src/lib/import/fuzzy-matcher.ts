import { Transaction } from '../../types/database';
import { ProcessedTransaction } from './reconciler';

export interface FuzzyMatchOptions {
  dateWindowDays: number; // Default: 3
  requireExactAmount: boolean; // Default: true
}

/**
 * Finds potential duplicate transactions using fuzzy matching.
 *
 * Fuzzy match criteria:
 * - Amount must match exactly (in cents)
 * - Date must be within ±N days (default: 3)
 *
 * @param transaction - Processed transaction (status='new')
 * @param existing - Array of existing transactions from database
 * @param options - Fuzzy matching configuration
 * @returns Array of potentially matching transactions
 */
export function findFuzzyMatches(
  transaction: ProcessedTransaction,
  existing: Transaction[],
  options: FuzzyMatchOptions = { dateWindowDays: 3, requireExactAmount: true }
): Transaction[] {
  if (!transaction.date || transaction.amount === undefined) {
    return [];
  }

  const transactionDate = new Date(transaction.date);
  const matches: Transaction[] = [];

  for (const existingTxn of existing) {
    // Check amount match
    if (options.requireExactAmount && existingTxn.amount !== transaction.amount) {
      continue;
    }

    // Check date window
    const existingDate = new Date(existingTxn.date);
    const daysDiff = Math.abs(
      (transactionDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff <= options.dateWindowDays) {
      matches.push(existingTxn);
    }
  }

  return matches;
}

/**
 * Applies fuzzy duplicate detection to all "new" transactions.
 *
 * @param processed - Array of ProcessedTransactions from exact duplicate detection
 * @param existing - Array of all existing transactions for the account
 * @param options - Fuzzy matching configuration
 * @returns Array with fuzzy_duplicate status applied where matches found
 */
export function detectFuzzyDuplicates(
  processed: ProcessedTransaction[],
  existing: Transaction[],
  options?: FuzzyMatchOptions
): ProcessedTransaction[] {
  return processed.map((txn) => {
    // Only check transactions that aren't already exact duplicates or errors
    if (txn.status !== 'new') {
      return txn;
    }

    const fuzzyMatches = findFuzzyMatches(txn, existing, options);

    if (fuzzyMatches.length > 0) {
      return {
        ...txn,
        status: 'fuzzy_duplicate',
        fuzzyMatches,
      };
    }

    return txn;
  });
}
