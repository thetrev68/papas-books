import type { Transaction } from '../types/database';

export type BulkOperation =
  | { type: 'markReviewed'; transactionIds: string[] }
  | { type: 'markUnreviewed'; transactionIds: string[] }
  | { type: 'updateCategory'; transactionIds: string[]; categoryId: string }
  | { type: 'applyRules'; transactionIds: string[] };

/**
 * Creates a new manual transaction object (not persisted to DB)
 */
export function createManualTransaction(
  accountId: string,
  date: string,
  payee: string,
  amount: number,
  categoryId?: string
): Transaction {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    bookset_id: '', // Will be set by caller
    account_id: accountId,
    date,
    import_date: now,
    payee,
    payee_id: null, // Will be set by user during review
    original_description: payee,
    amount,
    is_split: !!categoryId,
    lines: categoryId
      ? [
          {
            category_id: categoryId,
            amount: amount,
            memo: '',
          },
        ]
      : [],
    is_reviewed: false,
    reconciled: false,
    is_archived: false,
    created_at: now,
    updated_at: now,
    created_by: '', // Will be set by caller
    last_modified_by: '', // Will be set by caller
    source_batch_id: null,
    fingerprint: '', // Will be generated
  };
}
