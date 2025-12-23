import { Transaction, Category } from '../types/database';
import { CategorySummary, ReportExportRow, ReportFilter } from '../types/reconcile';

export function generateCategoryReport(
  transactions: Transaction[],
  categories: Category[]
): CategorySummary[] {
  const summaryMap = new Map<string, { amount: number; count: number }>();
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  for (const tx of transactions) {
    if (tx.is_split && tx.lines) {
      for (const line of tx.lines) {
        // line.category_id matches SplitLine interface in src/types/database.ts
        const current = summaryMap.get(line.category_id) || { amount: 0, count: 0 };
        summaryMap.set(line.category_id, {
          amount: current.amount + line.amount,
          count: current.count + 1,
        });
      }
    } else {
      const catId = tx.lines?.[0]?.category_id || 'uncategorized';
      // If it's not split, we might want to categorize it if it has a category logic,
      // but standard Transaction doesn't have a direct category_id field on root unless mapped via rules/workbench.
      // Wait, checking Transaction type... it ONLY has lines.
      // If is_split is false, usually lines[0] holds the category info if it was categorized.
      // If lines is empty, it's uncategorized.

      const current = summaryMap.get(catId) || { amount: 0, count: 0 };
      summaryMap.set(catId, {
        amount: current.amount + tx.amount,
        count: current.count + 1,
      });
    }
  }

  const results: CategorySummary[] = [];
  for (const [categoryId, data] of summaryMap.entries()) {
    const category = categoryLookup.get(categoryId);
    // If category is not found (e.g. 'uncategorized'), handle gracefully
    const categoryName = category
      ? category.name
      : categoryId === 'uncategorized'
        ? 'Uncategorized'
        : 'Unknown Category';

    results.push({
      categoryId,
      categoryName,
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0,
    });
  }

  return results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

export function filterTransactionsForReport(
  transactions: Transaction[],
  filter: ReportFilter
): Transaction[] {
  return transactions.filter((tx) => {
    // Date comparison (lexicographical works for ISO YYYY-MM-DD)
    if (tx.date < filter.startDate || tx.date > filter.endDate) return false;

    if (filter.accountIds?.length && !filter.accountIds.includes(tx.account_id)) return false;

    if (filter.categoryId) {
      // Check if ANY line matches the category filter
      // If the transaction is split or not, we look at its lines
      // If it has no lines, it doesn't match a specific category filter (unless looking for uncategorized?)
      if (!tx.lines || tx.lines.length === 0) return false;

      const hasMatchingLine = tx.lines.some((line) => line.category_id === filter.categoryId);
      if (!hasMatchingLine) return false;
    }
    return true;
  });
}

export function exportReportToCsv(summary: CategorySummary[]): string {
  const rows: ReportExportRow[] = summary.map((row) => ({
    categoryName: row.categoryName,
    totalAmount: row.totalAmount,
    transactionCount: row.transactionCount,
  }));

  const header = 'Category,TotalAmount,TransactionCount';
  const lines = rows.map((r) => `${r.categoryName},${r.totalAmount},${r.transactionCount}`);
  return [header, ...lines].join('\n');
}
