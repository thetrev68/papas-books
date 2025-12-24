import { supabase } from './config';

export async function finalizeReconciliationRPC(
  booksetId: string,
  accountId: string,
  statementBalance: number,
  statementDate: string,
  openingBalance: number,
  calculatedBalance: number,
  transactionIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('finalize_reconciliation', {
    _bookset_id: booksetId,
    _account_id: accountId,
    _statement_balance: statementBalance,
    _statement_date: statementDate,
    _opening_balance: openingBalance,
    _calculated_balance: calculatedBalance,
    _transaction_ids: transactionIds,
  });

  if (error) throw error;
}

export async function fetchUnreconciledTransactions(accountId: string, statementDate: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', accountId)
    .lte('date', statementDate)
    .eq('reconciled', false)
    .eq('is_archived', false)
    .order('date', { ascending: true });

  if (error) throw error;
  return data;
}
