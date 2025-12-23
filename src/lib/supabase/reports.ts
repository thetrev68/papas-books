import { supabase } from './config';

export async function fetchTransactionsForReport(
  booksetId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('bookset_id', booksetId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_archived', false);

  if (error) throw error;
  return data;
}
