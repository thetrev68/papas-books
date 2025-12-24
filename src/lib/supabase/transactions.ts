import { supabase } from './config';
import type { Transaction } from '../../types/database';

/**
 * Fetch transactions for workbench (with filtering)
 */
export async function fetchTransactions(booksetId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('bookset_id', booksetId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new transaction
 */
export async function createTransaction(transaction: Transaction): Promise<Transaction> {
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

  if (error) throw error;
  return data;
}

/**
 * Update a single transaction
 */
export async function updateTransaction(transaction: Transaction): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      payee: transaction.payee,
      is_reviewed: transaction.is_reviewed,
      is_split: transaction.is_split,
      lines: transaction.lines,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a transaction (soft delete)
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Bulk update reviewed status
 */
export async function bulkUpdateReviewed(
  transactionIds: string[],
  isReviewed: boolean
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ is_reviewed: isReviewed, updated_at: new Date().toISOString() })
    .in('id', transactionIds);

  if (error) throw error;
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
