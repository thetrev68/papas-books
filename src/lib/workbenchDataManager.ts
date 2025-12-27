import type { Transaction } from '../types/database';

export interface WorkbenchFilter {
  accountId?: string;
  isReviewed?: boolean;
  dateRange?: { start: string; end: string };
  search?: string;
}

/**
 * Filters transactions based on workbench criteria
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: WorkbenchFilter
): Transaction[] {
  return transactions.filter((tx) => {
    // Account filter
    if (filter.accountId && tx.account_id !== filter.accountId) return false;

    // Reviewed filter
    if (filter.isReviewed !== undefined && tx.is_reviewed !== filter.isReviewed) return false;

    // Date range filter
    if (filter.dateRange) {
      const txDate = new Date(tx.date);
      const start = new Date(filter.dateRange.start);
      const end = new Date(filter.dateRange.end);
      if (txDate < start || txDate > end) return false;
    }

    // Search filter (payee or description)
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesPayee = tx.payee?.toLowerCase().includes(searchLower) ?? false;
      const matchesDesc = tx.original_description.toLowerCase().includes(searchLower);
      if (!matchesPayee && !matchesDesc) return false;
    }

    return true;
  });
}

/**
 * Sorts transactions for workbench display
 */
export function sortTransactions(
  transactions: Transaction[],
  sortBy: 'date' | 'amount' | 'payee' = 'date',
  order: 'asc' | 'desc' = 'desc'
): Transaction[] {
  return [...transactions].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === 'amount') {
      comparison = a.amount - b.amount;
    } else if (sortBy === 'payee') {
      comparison = (a.payee || '').localeCompare(b.payee || '');
    }

    return order === 'asc' ? comparison : -comparison;
  });
}
