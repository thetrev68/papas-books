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

export async function fetchLastReconciliation(accountId: string) {
  const { data, error } = await supabase
    .from('reconciliations')
    .select('*')
    .eq('account_id', accountId)
    .order('statement_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return data;
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
