import { supabase } from './config';
import { handleSupabaseError, DatabaseError } from '../errors';

export async function finalizeReconciliationRPC(
  booksetId: string,
  accountId: string,
  statementBalance: number,
  statementDate: string,
  openingBalance: number,
  calculatedBalance: number,
  transactionIds: string[]
): Promise<void> {
  try {
    const { error } = await supabase.rpc('finalize_reconciliation', {
      _bookset_id: booksetId,
      _account_id: accountId,
      _statement_balance: statementBalance,
      _statement_date: statementDate,
      _opening_balance: openingBalance,
      _calculated_balance: calculatedBalance,
      _transaction_ids: transactionIds,
    });

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to finalize reconciliation', undefined, error);
  }
}

export async function fetchUnreconciledTransactions(accountId: string, statementDate: string) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .lte('date', statementDate)
      .eq('reconciled', false)
      .eq('is_archived', false)
      .order('date', { ascending: true });

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch unreconciled transactions', undefined, error);
  }
}
