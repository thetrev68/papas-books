import { supabase } from './config';
import { handleSupabaseError, DatabaseError } from '../errors';
import { Transaction } from '../../types/database';

export interface ReportFilters {
  booksetId: string;
  accountIds?: string[];
  categoryIds?: string[];
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * @deprecated Use fetchReportTransactions instead. This function is limited to 1000 rows
 * and does not support pagination, which causes incomplete reports for large datasets.
 */
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

export async function fetchReportTransactions(
  filters: ReportFilters
): Promise<{ data: Transaction[]; total: number }> {
  const { booksetId, accountIds, startDate, endDate, page = 1, pageSize = 1000 } = filters;

  try {
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('bookset_id', booksetId)
      .eq('is_archived', false)
      .order('date', { ascending: false });

    if (accountIds && accountIds.length > 0) {
      query = query.in('account_id', accountIds);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      handleSupabaseError(error);
    }

    return {
      data: data || [],
      total: count || 0,
    };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch report data', undefined, error);
  }
}
