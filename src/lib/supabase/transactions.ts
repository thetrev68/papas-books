import { supabase } from './config';
import type { Transaction } from '../../types/database';
import { handleSupabaseError, DatabaseError } from '../errors';
import { validateSplitLines } from '../validation/splits';

/**
 * Fetch transactions for workbench (with filtering)
 */
export async function fetchTransactions(booksetId: string): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('bookset_id', booksetId)
      .order('date', { ascending: false });

    if (error) {
      handleSupabaseError(error);
    }
    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch transactions', undefined, error);
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transaction,
        fingerprint: await generateFingerprint(
          transaction.date,
          transaction.amount,
          transaction.payee
        ),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to create transaction', undefined, error);
  }
}

/**
 * Update a single transaction
 */
export async function updateTransaction(
  transaction: Transaction,
  options?: { skipVersionCheck?: boolean }
): Promise<Transaction> {
  try {
    // Validate split lines if present
    if (transaction.is_split && transaction.lines.length > 0) {
      const validation = await validateSplitLines(transaction.lines, transaction.bookset_id);
      if (!validation.valid) {
        throw new DatabaseError(`Invalid split lines: ${validation.errors.join('; ')}`);
      }
    }

    let query = supabase
      .from('transactions')
      .update({
        payee: transaction.payee,
        payee_id: transaction.payee_id,
        is_reviewed: transaction.is_reviewed,
        is_split: transaction.is_split,
        lines: transaction.lines,
      })
      .eq('id', transaction.id);

    // Optimistic locking: only update if updated_at hasn't changed
    // This prevents overwriting another user's concurrent edits
    if (!options?.skipVersionCheck && transaction.updated_at) {
      query = query.eq('updated_at', transaction.updated_at);
    }

    const { data, error } = await query.select().single();

    if (error) {
      // Check if no rows were updated (version conflict)
      if (error.code === 'PGRST116') {
        throw new DatabaseError(
          'This transaction was modified by another user. Please reload and try again.',
          'CONCURRENT_EDIT',
          error
        );
      }
      handleSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError(
        'This transaction was modified by another user. Please reload and try again.',
        'CONCURRENT_EDIT'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update transaction', undefined, error);
  }
}

/**
 * Delete a transaction (soft delete)
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', transactionId);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete transaction', undefined, error);
  }
}

/**
 * Bulk update reviewed status
 */
export async function bulkUpdateReviewed(
  transactionIds: string[],
  isReviewed: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({ is_reviewed: isReviewed, updated_at: new Date().toISOString() })
      .in('id', transactionIds);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update transactions', undefined, error);
  }
}

/**
 * Generate fingerprint for duplicate detection
 */
async function generateFingerprint(date: string, amount: number, payee: string): Promise<string> {
  const data = `${date}-${amount}-${payee}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
