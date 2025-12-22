import type { Transaction } from '../types/database';

/**
 * Creates a new manual transaction
 */
export function createManualTransaction(
  accountId: string,
  date: string,
  payee: string,
  amount: number,
  categoryId?: string
): Transaction {
  const lines = categoryId ? [{ category_id: categoryId, amount, memo: '' }] : [];

  return {
    id: crypto.randomUUID(),
    bookset_id: '', // Will be set by caller
    account_id: accountId,
    date,
    payee,
    original_description: payee, // For manual transactions
    amount,
    is_split: !!categoryId && lines.length === 1,
    lines,
    is_reviewed: false,
    reconciled: false,
    is_archived: false,
    source_batch_id: null,
    fingerprint: '', // Will be generated
    import_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: '', // Will be set by caller
    last_modified_by: '', // Will be set by caller
  };
}

/**
 * Deletes a transaction (soft delete via isArchived flag)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deleteTransaction(_transactionId: string): Promise<void> {
  // Implementation in supabase/transactions.ts
  throw new Error('Not implemented - use supabase/transactions.ts');
}

/**
 * Bulk operations on transactions
 */
export interface BulkOperation {
  type: 'markReviewed' | 'markUnreviewed' | 'applyRules';
  transactionIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function performBulkOperation(_operation: BulkOperation): Promise<void> {
  // Implementation in supabase/transactions.ts
  throw new Error('Not implemented - use supabase/transactions.ts');
}
