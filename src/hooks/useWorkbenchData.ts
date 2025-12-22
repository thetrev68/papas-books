import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTransactions } from '../lib/supabase/transactions';
import { filterTransactions, sortTransactions } from '../lib/workbenchDataManager';
import type { Transaction } from '../types/database';
import type { WorkbenchFilter } from '../lib/workbenchDataManager';

export interface WorkbenchState {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  filter: WorkbenchFilter;
  setFilter: (filter: Partial<WorkbenchFilter>) => void;
  sort: { by: 'date' | 'amount' | 'payee'; order: 'asc' | 'desc' };
  setSort: (by: 'date' | 'amount' | 'payee', order: 'asc' | 'desc') => void;
}

export function useWorkbenchData(booksetId: string): WorkbenchState {
  const [filter, setFilter] = useState<WorkbenchFilter>({ isReviewed: false });
  const [sort, setSort] = useState<{ by: 'date' | 'amount' | 'payee'; order: 'asc' | 'desc' }>({
    by: 'date',
    order: 'desc',
  });

  const {
    data: allTransactions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transactions', booksetId],
    queryFn: () => fetchTransactions(booksetId),
  });

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    let result = filterTransactions(allTransactions, filter);
    result = sortTransactions(result, sort.by, sort.order);

    return result;
  }, [allTransactions, filter, sort]);

  return {
    transactions: filteredTransactions,
    isLoading,
    error,
    filter,
    setFilter: (newFilter) => setFilter((prev) => ({ ...prev, ...newFilter })),
    sort,
    setSort: (by, order) => setSort({ by, order }),
  };
}
