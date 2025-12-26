import { supabase } from './config';
import { Transaction, ImportBatch } from '../../types/database';
import { handleSupabaseError, DatabaseError } from '../errors';

/**
 * Fetches all transaction fingerprints for an account.
 *
 * Used for duplicate detection (O(1) lookups via Map).
 *
 * @param accountId - Account UUID
 * @returns Map<fingerprint, transactionId>
 */
export async function fetchExistingFingerprints(accountId: string): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, fingerprint')
      .eq('account_id', accountId)
      .not('fingerprint', 'is', null); // Exclude transactions without fingerprints

    if (error) {
      handleSupabaseError(error);
    }

    // Build Map for O(1) lookups
    const fingerprintMap = new Map<string, string>();
    data?.forEach((txn) => {
      fingerprintMap.set(txn.fingerprint, txn.id);
    });

    return fingerprintMap;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch fingerprints', undefined, error);
  }
}

/**
 * Fetches all transactions for an account (for fuzzy matching).
 *
 * @param accountId - Account UUID
 * @param dateRange - Optional date range filter (start/end ISO dates)
 * @returns Array of transactions
 */
export async function fetchExistingTransactions(
  accountId: string,
  dateRange?: { start: string; end: string }
): Promise<Transaction[]> {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    // Apply date range filter if provided
    if (dateRange) {
      query = query.gte('date', dateRange.start).lte('date', dateRange.end);
    }

    const { data, error } = await query;

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
 * Creates an import batch and inserts transactions.
 *
 * Steps:
 * 1. Insert import_batches record
 * 2. Get batch ID
 * 3. Add batch ID to all transactions
 * 4. Bulk insert transactions
 *
 * @param batch - Import batch metadata
 * @param transactions - Array of transactions to insert
 * @returns Promise with batch ID and transaction IDs
 */
export async function commitImportBatch(
  batch: Omit<ImportBatch, 'id' | 'imported_by'>,
  transactions: Omit<
    Transaction,
    'id' | 'created_by' | 'last_modified_by' | 'created_at' | 'updated_at'
  >[]
): Promise<{ batchId: string; transactionIds: string[] }> {
  try {
    // Step 1: Create import batch
    const { data: batchData, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        bookset_id: batch.bookset_id,
        account_id: batch.account_id,
        file_name: batch.file_name,
        imported_at: new Date().toISOString(),
        total_rows: batch.total_rows,
        imported_count: batch.imported_count,
        duplicate_count: batch.duplicate_count,
        error_count: batch.error_count,
        csv_mapping_snapshot: batch.csv_mapping_snapshot,
        is_undone: false,
      })
      .select()
      .single();

    if (batchError) {
      handleSupabaseError(batchError);
    }

    const batchId = batchData.id;

    // Step 2: Add batch ID to transactions
    const transactionsWithBatch = transactions.map((txn) => ({
      ...txn,
      source_batch_id: batchId,
      import_date: new Date().toISOString(),
      is_reviewed: false,
      is_split: false,
      reconciled: false,
      lines: [{ category_id: null, amount: txn.amount, memo: null }], // Default single-line
    }));

    // Step 3: Bulk insert transactions
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .insert(transactionsWithBatch)
      .select('id');

    if (txnError) {
      handleSupabaseError(txnError);
    }

    return {
      batchId,
      transactionIds: txnData?.map((t) => t.id) || [],
    };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to commit import batch', undefined, error);
  }
}

/**
 * Undoes an import batch.
 *
 * Calls the RPC 'undo_import_batch'.
 *
 * @param batchId - UUID of the batch to undo
 */
export async function undoImportBatch(batchId: string): Promise<void> {
  try {
    console.log('Calling undo_import_batch RPC with batch_id:', batchId);
    const { error } = await supabase.rpc('undo_import_batch', { _batch_id: batchId });
    if (error) {
      console.error('Supabase RPC error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to undo import batch', undefined, error);
  }
}

/**
 * Lists import batches for a bookset.
 */
export async function listImportBatches(booksetId: string): Promise<ImportBatch[]> {
  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('bookset_id', booksetId)
      .order('imported_at', { ascending: false })
      .limit(20);

    if (error) {
      handleSupabaseError(error);
    }

    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to list import batches', undefined, error);
  }
}
