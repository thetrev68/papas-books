import { supabase } from './config';
import { handleSupabaseError, DatabaseError } from '../errors';

export async function fetchTransactionsForReport(
  booksetId: string,
  startDate: string,
  endDate: string
) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('bookset_id', booksetId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('is_archived', false);

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch report data', undefined, error);
  }
}
