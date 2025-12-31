import { Transaction, Category, Account, Payee } from '../types/database';
import { CategorySummary, ReportExportRow, ReportFilter } from '../types/reconcile';
import { formatCsvRow } from './csvUtils';

export interface TaxLineSummary {
  taxLineItem: string;
  totalAmount: number; // In cents
  transactionCount: number;
  isIncome: boolean;
  categoryNames: string[]; // List of categories using this tax line
}

export interface CpaExportRow {
  date: string;
  accountName: string;
  payeeName: string;
  description: string;
  categoryName: string;
  taxLineItem: string;
  amount: string; // Formatted as decimal (e.g., "-150.00")
  memo: string;
}

/**
 * Summary of income, expenses, and estimated tax for a single quarter
 */
export interface QuarterlySummary {
  quarter: 1 | 2 | 3 | 4; // Quarter number
  year: number; // Year (e.g., 2024)
  quarterLabel: string; // Display label: "Q1 2024"
  dateRange: string; // Human-readable: "Jan 1 - Mar 31, 2024"
  totalIncome: number; // In cents (sum of all positive amounts)
  totalExpenses: number; // In cents (sum of all negative amounts, stored as positive)
  netIncome: number; // In cents (totalIncome - totalExpenses)
  estimatedTax: number; // In cents (netIncome * taxRate, clamped to 0 if negative)
  transactionCount: number; // Total transactions in quarter
  incomeTransactionCount: number; // Count of income transactions
  expenseTransactionCount: number; // Count of expense transactions
}

/**
 * Comparison of category spending between two periods (typically years)
 */
export interface YearComparisonRow {
  categoryId: string;
  categoryName: string;
  currentAmount: number; // In cents (current period total)
  compareAmount: number; // In cents (comparison period total)
  varianceAmount: number; // In cents (currentAmount - compareAmount)
  variancePercent: number; // Percentage change ((variance / |compareAmount|) * 100)
  currentTransactionCount: number; // Number of transactions in current period
  compareTransactionCount: number; // Number of transactions in comparison period
  isIncome: boolean; // True if category is income-based (positive amounts)
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

/**
 * Generates CPA-ready export with one row per transaction line
 * Split transactions are flattened into multiple rows
 */
export function generateCpaExport(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  payees: Payee[]
): CpaExportRow[] {
  // Build lookup maps for fast access
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const payeeMap = new Map(payees.map((p) => [p.id, p]));

  const rows: CpaExportRow[] = [];

  for (const tx of transactions) {
    const accountName = accountMap.get(tx.account_id)?.name || 'Unknown Account';
    const date = tx.date;
    const description = tx.original_description;

    // Determine payee name
    // Priority: payee_id lookup > legacy payee field > empty
    let payeeName = '';
    if (tx.payee_id) {
      payeeName = payeeMap.get(tx.payee_id)?.name || '';
    } else if (tx.payee) {
      payeeName = tx.payee;
    }

    // Helper to create a row for each line item
    const createRow = (categoryId: string, amount: number, memo?: string): CpaExportRow => {
      const category = categoryMap.get(categoryId);
      const categoryName = category?.name || 'Uncategorized';
      const taxLineItem = category?.tax_line_item || '';

      return {
        date,
        accountName,
        payeeName,
        description,
        categoryName,
        taxLineItem,
        amount: (amount / 100).toFixed(2), // Convert cents to dollars
        memo: memo || '',
      };
    };

    // Process transaction lines
    if (tx.is_split && tx.lines && tx.lines.length > 0) {
      // Split transaction: create one row per line
      for (const line of tx.lines) {
        rows.push(createRow(line.category_id, line.amount, line.memo));
      }
    } else if (tx.lines && tx.lines.length > 0) {
      // Simple transaction: single row with transaction amount
      const categoryId = tx.lines[0].category_id;
      rows.push(createRow(categoryId, tx.amount));
    } else {
      // Uncategorized transaction: still export it
      rows.push({
        date,
        accountName,
        payeeName,
        description,
        categoryName: 'Uncategorized',
        taxLineItem: '',
        amount: (tx.amount / 100).toFixed(2),
        memo: '',
      });
    }
  }

  return rows;
}

/**
 * Converts CPA export rows to CSV format
 */
export function exportCpaExportToCsv(rows: CpaExportRow[]): string {
  const headers = [
    'Date',
    'Account',
    'Payee',
    'Description',
    'Category',
    'Tax Line',
    'Amount',
    'Memo',
  ];

  const headerRow = formatCsvRow(headers);

  const dataRows = rows.map((row) =>
    formatCsvRow([
      row.date,
      row.accountName,
      row.payeeName,
      row.description,
      row.categoryName,
      row.taxLineItem,
      row.amount,
      row.memo,
    ])
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generates quarterly estimated tax report
 * Groups transactions by calendar quarter and calculates income, expenses, and estimated tax
 *
 * @param transactions - All transactions to analyze (should be pre-filtered by date/account)
 * @param taxRate - Estimated tax rate as decimal (e.g., 0.25 = 25%)
 * @returns Array of 4 quarterly summaries, one per quarter, sorted Q1-Q4
 *
 * @example
 * const summary = generateQuarterlyReport(transactions, 0.30); // 30% tax rate
 */
export function generateQuarterlyReport(
  transactions: Transaction[],
  taxRate: number = 0.25
): QuarterlySummary[] {
  // 1. Initialize accumulators for each quarter
  const quarterData: Record<
    1 | 2 | 3 | 4,
    {
      income: number;
      expenses: number;
      totalCount: number;
      incomeCount: number;
      expenseCount: number;
      year: number | null; // Track year for mixed-year datasets
    }
  > = {
    1: { income: 0, expenses: 0, totalCount: 0, incomeCount: 0, expenseCount: 0, year: null },
    2: { income: 0, expenses: 0, totalCount: 0, incomeCount: 0, expenseCount: 0, year: null },
    3: { income: 0, expenses: 0, totalCount: 0, incomeCount: 0, expenseCount: 0, year: null },
    4: { income: 0, expenses: 0, totalCount: 0, incomeCount: 0, expenseCount: 0, year: null },
  };

  // 2. Process transactions
  for (const tx of transactions) {
    // Skip transactions without lines (uncategorized imports, etc.)
    if (!tx.lines || tx.lines.length === 0) {
      continue;
    }

    // Parse date to determine quarter
    // tx.date is in YYYY-MM-DD format, parse as local date to avoid timezone issues
    const [yearStr, monthStr] = tx.date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed (1-12 -> 0-11)
    const quarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;

    // Track year (use first transaction's year for each quarter)
    if (quarterData[quarter].year === null) {
      quarterData[quarter].year = year;
    }

    // Accumulate amounts
    quarterData[quarter].totalCount += 1;

    if (tx.amount > 0) {
      // Income (positive amount)
      quarterData[quarter].income += tx.amount;
      quarterData[quarter].incomeCount += 1;
    } else if (tx.amount < 0) {
      // Expense (negative amount - convert to positive for storage)
      quarterData[quarter].expenses += Math.abs(tx.amount);
      quarterData[quarter].expenseCount += 1;
    }
    // Skip zero-amount transactions (transfers, etc.)
  }

  // 3. Helper to get quarter date range string
  const getQuarterDateRange = (q: 1 | 2 | 3 | 4, year: number): string => {
    const ranges: Record<1 | 2 | 3 | 4, string> = {
      1: `Jan 1 - Mar 31, ${year}`,
      2: `Apr 1 - Jun 30, ${year}`,
      3: `Jul 1 - Sep 30, ${year}`,
      4: `Oct 1 - Dec 31, ${year}`,
    };
    return ranges[q];
  };

  // 4. Convert to summary array
  const currentYear = new Date().getFullYear(); // Fallback if no transactions

  return ([1, 2, 3, 4] as const).map((q) => {
    const data = quarterData[q];
    const year = data.year ?? currentYear;
    const netIncome = data.income - data.expenses;
    const estimatedTax = Math.max(0, Math.round(netIncome * taxRate));

    return {
      quarter: q,
      year,
      quarterLabel: `Q${q} ${year}`,
      dateRange: getQuarterDateRange(q, year),
      totalIncome: data.income,
      totalExpenses: data.expenses,
      netIncome,
      estimatedTax,
      transactionCount: data.totalCount,
      incomeTransactionCount: data.incomeCount,
      expenseTransactionCount: data.expenseCount,
    };
  });
}

/**
 * Export quarterly report to CSV format
 * @param summary - Array of quarterly summaries
 * @returns CSV string with headers and data rows
 */
export function exportQuarterlyReportToCsv(summary: QuarterlySummary[]): string {
  const header =
    'Quarter,Date Range,Total Income,Total Expenses,Net Income,Estimated Tax,Transaction Count';

  const rows = summary.map((q) => {
    const income = (q.totalIncome / 100).toFixed(2);
    const expenses = (q.totalExpenses / 100).toFixed(2);
    const net = (q.netIncome / 100).toFixed(2);
    const tax = (q.estimatedTax / 100).toFixed(2);

    return [
      `"${q.quarterLabel}"`,
      `"${q.dateRange}"`,
      income,
      expenses,
      net,
      tax,
      q.transactionCount,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Generates a year-over-year comparison report by category
 * Compares two sets of transactions (typically different years)
 *
 * @param currentTransactions - Transactions from current period (e.g., 2024)
 * @param compareTransactions - Transactions from comparison period (e.g., 2023)
 * @param categories - All categories for name lookup
 * @returns Array of comparison rows, one per category that appears in either period
 */
export function generateYearComparison(
  currentTransactions: Transaction[],
  compareTransactions: Transaction[],
  categories: Category[]
): YearComparisonRow[] {
  // 1. Generate category summaries for both periods
  const currentSummary = generateCategoryReport(currentTransactions, categories);
  const compareSummary = generateCategoryReport(compareTransactions, categories);

  // 2. Build lookup maps for fast access
  const currentMap = new Map(currentSummary.map((s) => [s.categoryId, s]));
  const compareMap = new Map(compareSummary.map((s) => [s.categoryId, s]));

  // 3. Get union of all category IDs (categories that appear in either period)
  const allCategoryIds = new Set([
    ...currentSummary.map((s) => s.categoryId),
    ...compareSummary.map((s) => s.categoryId),
  ]);

  // 4. Build comparison rows
  const results: YearComparisonRow[] = [];

  for (const catId of allCategoryIds) {
    const current = currentMap.get(catId);
    const compare = compareMap.get(catId);

    // Get category name from whichever summary has it (prefer current)
    const categoryName = current?.categoryName || compare?.categoryName || 'Unknown';

    const currentAmt = current?.totalAmount || 0;
    const compareAmt = compare?.totalAmount || 0;
    const currentCount = current?.transactionCount || 0;
    const compareCount = compare?.transactionCount || 0;

    // Calculate variance
    const varianceAmt = currentAmt - compareAmt;

    // Calculate percentage change
    // For expenses (negative amounts): Use absolute value to get meaningful percentages
    // For income (positive amounts): Direct calculation
    // Handle zero/new categories specially
    let variancePct = 0;
    if (compareAmt !== 0) {
      // Standard case: category existed in both periods
      variancePct = (varianceAmt / Math.abs(compareAmt)) * 100;
    } else if (currentAmt !== 0) {
      // New category this period (didn't exist in comparison period)
      variancePct = 100;
    }
    // else: Category has zero in both periods (shouldn't happen, but handle gracefully)

    // Determine if income category (use current period's data if available)
    const isIncome = current?.isIncome ?? compare?.isIncome ?? false;

    results.push({
      categoryId: catId,
      categoryName,
      currentAmount: currentAmt,
      compareAmount: compareAmt,
      varianceAmount: varianceAmt,
      variancePercent: variancePct,
      currentTransactionCount: currentCount,
      compareTransactionCount: compareCount,
      isIncome,
    });
  }

  // 5. Sort alphabetically by category name
  return results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

/**
 * Export year comparison report to CSV format
 * @param summary - Array of year comparison rows
 * @param currentLabel - Label for current period (e.g., "2024")
 * @param compareLabel - Label for comparison period (e.g., "2023")
 * @returns CSV string with headers and data rows
 */
export function exportYearComparisonToCsv(
  summary: YearComparisonRow[],
  currentLabel: string,
  compareLabel: string
): string {
  const header = `Category,${currentLabel},${compareLabel},Variance $,Variance %,${currentLabel} Txns,${compareLabel} Txns`;

  const rows = summary.map((r) => {
    const current = (r.currentAmount / 100).toFixed(2);
    const compare = (r.compareAmount / 100).toFixed(2);
    const variance = (r.varianceAmount / 100).toFixed(2);
    const pct = r.variancePercent.toFixed(1);

    return [
      `"${r.categoryName}"`,
      current,
      compare,
      variance,
      `${pct}%`,
      r.currentTransactionCount,
      r.compareTransactionCount,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
