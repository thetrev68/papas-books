import { Transaction, Category } from '../types/database';
import { CategorySummary, ReportExportRow, ReportFilter } from '../types/reconcile';

export interface TaxLineSummary {
  taxLineItem: string;
  totalAmount: number; // In cents
  transactionCount: number;
  isIncome: boolean;
  categoryNames: string[]; // List of categories using this tax line
}

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

/**
 * Generates a tax report by grouping transactions by tax_line_item
 * Categories without tax_line_item are excluded
 */
export function generateTaxLineReport(
  transactions: Transaction[],
  categories: Category[]
): TaxLineSummary[] {
  // 1. Build lookup maps
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const taxLineMap = new Map<string, string>(); // categoryId -> tax_line_item

  categories.forEach((c) => {
    if (c.tax_line_item) {
      taxLineMap.set(c.id, c.tax_line_item);
    }
  });

  // 2. Aggregate by tax line
  const summaryMap = new Map<
    string,
    {
      amount: number;
      count: number;
      categoryIds: Set<string>;
    }
  >();

  const processLine = (catId: string, amount: number) => {
    const taxLine = taxLineMap.get(catId);
    if (!taxLine) return; // Skip categories without tax_line_item mapping

    const current = summaryMap.get(taxLine) || {
      amount: 0,
      count: 0,
      categoryIds: new Set<string>(),
    };

    summaryMap.set(taxLine, {
      amount: current.amount + amount,
      count: current.count + 1,
      categoryIds: current.categoryIds.add(catId),
    });
  };

  // 3. Process all transactions
  for (const tx of transactions) {
    if (tx.is_split && tx.lines && tx.lines.length > 0) {
      // Split transaction: process each line
      tx.lines.forEach((line) => processLine(line.category_id, line.amount));
    } else if (tx.lines && tx.lines.length > 0) {
      // Simple transaction: process first line
      const catId = tx.lines[0].category_id;
      processLine(catId, tx.amount);
    }
    // Skip transactions with no category assignment (lines array empty)
  }

  // 4. Convert to array and add category names
  return Array.from(summaryMap.entries())
    .map(([taxLine, data]) => ({
      taxLineItem: taxLine,
      totalAmount: data.amount,
      transactionCount: data.count,
      isIncome: data.amount > 0,
      categoryNames: Array.from(data.categoryIds)
        .map((id) => categoryMap.get(id)?.name || 'Unknown')
        .sort(),
    }))
    .sort((a, b) => a.taxLineItem.localeCompare(b.taxLineItem));
}

/**
 * Export tax line report to CSV
 */
export function exportTaxReportToCsv(summary: TaxLineSummary[]): string {
  const header = 'Tax Line Item,Total Amount,Transaction Count,Categories';
  const rows = summary.map((r) => {
    const amount = (r.totalAmount / 100).toFixed(2);
    const categories = r.categoryNames.join('; ');
    return `"${r.taxLineItem}",${amount},${r.transactionCount},"${categories}"`;
  });
  return [header, ...rows].join('\n');
}
