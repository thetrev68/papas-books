import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { usePayees } from '../hooks/usePayees';
import { fetchReportTransactions } from '../lib/supabase/reports';
import {
  generateCategoryReport,
  filterTransactionsForReport,
  exportReportToCsv,
  generateTaxLineReport,
  exportTaxReportToCsv,
  generateCpaExport,
  exportCpaExportToCsv,
  generateQuarterlyReport,
  exportQuarterlyReportToCsv,
  generateYearComparison,
  exportYearComparisonToCsv,
  TaxLineSummary,
  QuarterlySummary,
  YearComparisonRow,
} from '../lib/reports';
import { CategorySummary, ReportFilter } from '../types/reconcile';
import { Transaction, Category } from '../types/database';

export default function ReportsPage() {
  const { activeBookset } = useAuth();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { payees } = usePayees();

  // Helper to process categories with parent:child format
  const sortedCategories = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const getRoot = (cat: Category): Category => {
      let current = cat;
      const seen = new Set<string>();
      while (current.parent_category_id && categoryMap.has(current.parent_category_id)) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        current = categoryMap.get(current.parent_category_id)!;
      }
      return current;
    };

    const getFullName = (cat: Category) => {
      if (!cat.parent_category_id) return cat.name;
      const parent = categoryMap.get(cat.parent_category_id);
      return parent ? `${parent.name}: ${cat.name}` : cat.name;
    };

    return [...categories]
      .sort((a, b) => {
        const rootA = getRoot(a);
        const rootB = getRoot(b);
        const isIncomeA = rootA.name === 'Income';
        const isIncomeB = rootB.name === 'Income';

        if (isIncomeA && !isIncomeB) return -1;
        if (!isIncomeA && isIncomeB) return 1;

        return getFullName(a).localeCompare(getFullName(b));
      })
      .map((cat) => ({
        ...cat,
        displayName: getFullName(cat),
      }));
  }, [categories]);

  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [reportType, setReportType] = useState<'category' | 'taxLine' | 'quarterly' | 'comparison'>(
    'category'
  );
  const [reportData, setReportData] = useState<CategorySummary[] | null>(null);
  const [taxReportData, setTaxReportData] = useState<TaxLineSummary[] | null>(null);
  const [quarterlyData, setQuarterlyData] = useState<QuarterlySummary[] | null>(null);
  const [comparisonData, setComparisonData] = useState<YearComparisonRow[] | null>(null);
  const [compareStartDate, setCompareStartDate] = useState(new Date().getFullYear() - 1 + '-01-01');
  const [compareEndDate, setCompareEndDate] = useState(new Date().getFullYear() - 1 + '-12-31');
  const [taxRate, setTaxRate] = useState<number>(0.25); // 25% default
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const pageSize = 1000;

  const handleRunReport = async () => {
    if (!activeBookset) return;
    setIsLoading(true);
    setError(null);
    setReportData(null);
    setTaxReportData(null);
    setQuarterlyData(null);
    setComparisonData(null);
    setFilteredTransactions(null);
    try {
      // 1. Fetch ALL transactions for current period
      let allTransactions: Transaction[] = [];
      let currentPage = 1;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, total } = await fetchReportTransactions({
          booksetId: activeBookset.id,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
          startDate,
          endDate,
          page: currentPage,
          pageSize,
        });

        allTransactions = [...allTransactions, ...data];
        totalCount = total;
        hasMore = allTransactions.length < total;
        currentPage++;
      }

      // 2. Filter in memory for category (if needed)
      const filter: ReportFilter = {
        startDate,
        endDate,
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        categoryId: selectedCategoryId || undefined,
      };

      const filteredCurrent = filterTransactionsForReport(allTransactions as Transaction[], filter);
      setFilteredTransactions(filteredCurrent);

      // 3. If comparison mode, fetch comparison period data
      if (reportType === 'comparison') {
        // Fetch comparison period transactions
        let compareTransactions: Transaction[] = [];
        let comparePage = 1;
        let compareHasMore = true;

        while (compareHasMore) {
          const { data, total } = await fetchReportTransactions({
            booksetId: activeBookset.id,
            accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
            startDate: compareStartDate,
            endDate: compareEndDate,
            page: comparePage,
            pageSize,
          });

          compareTransactions = [...compareTransactions, ...data];
          compareHasMore = compareTransactions.length < total;
          comparePage++;
        }

        // Filter comparison transactions (use same account/category filters)
        const compareFilter: ReportFilter = {
          startDate: compareStartDate,
          endDate: compareEndDate,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
          categoryId: selectedCategoryId || undefined,
        };

        const filteredCompare = filterTransactionsForReport(
          compareTransactions as Transaction[],
          compareFilter
        );

        // Generate comparison report
        const comparisonSummary = generateYearComparison(
          filteredCurrent,
          filteredCompare,
          categories
        );
        setComparisonData(comparisonSummary);
      } else if (reportType === 'taxLine') {
        const taxSummary = generateTaxLineReport(filteredCurrent, categories);
        setTaxReportData(taxSummary);
      } else if (reportType === 'quarterly') {
        const quarterlySummary = generateQuarterlyReport(filteredCurrent, taxRate);
        setQuarterlyData(quarterlySummary);
      } else {
        const summary = generateCategoryReport(filteredCurrent, categories);
        setReportData(summary);
      }
      setTotalTransactions(totalCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    let csv: string;
    let filename: string;

    if (reportType === 'comparison') {
      if (!comparisonData) return;

      // Extract years from date ranges for labels
      const currentYear = new Date(startDate).getFullYear();
      const compareYear = new Date(compareStartDate).getFullYear();

      // Use full date ranges if not full years
      const currentLabel =
        startDate.endsWith('-01-01') && endDate.endsWith('-12-31')
          ? String(currentYear)
          : `${startDate} to ${endDate}`;

      const compareLabel =
        compareStartDate.endsWith('-01-01') && compareEndDate.endsWith('-12-31')
          ? String(compareYear)
          : `${compareStartDate} to ${compareEndDate}`;

      csv = exportYearComparisonToCsv(comparisonData, currentLabel, compareLabel);
      filename = `year-comparison-${currentYear}-vs-${compareYear}.csv`;
    } else if (reportType === 'taxLine') {
      if (!taxReportData) return;
      csv = exportTaxReportToCsv(taxReportData);
      filename = `tax-report-${startDate}-to-${endDate}.csv`;
    } else if (reportType === 'quarterly') {
      if (!quarterlyData) return;
      csv = exportQuarterlyReportToCsv(quarterlyData);
      const year = new Date(startDate).getFullYear();
      filename = `quarterly-tax-${year}.csv`;
    } else {
      if (!reportData) return;
      csv = exportReportToCsv(reportData);
      filename = `category-report-${startDate}-to-${endDate}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleExportCpa = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      setError('No transactions to export. Please run a report first.');
      return;
    }

    try {
      const exportRows = generateCpaExport(filteredTransactions, categories, accounts, payees);

      if (exportRows.length === 0) {
        setError('No data to export.');
        return;
      }

      const csv = exportCpaExportToCsv(exportRows);

      // Create filename with date range
      const filename = `cpa-export-${startDate}-to-${endDate}.csv`;

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        'Failed to generate CPA export: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions;
    const values: string[] = [];
    for (let i = 0; i < options.length; i++) {
      values.push(options[i].value);
    }
    setSelectedAccountIds(values);
  };

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-neutral-900 dark:text-gray-100">Reports</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <label className="flex flex-col gap-2 font-bold text-neutral-600 dark:text-gray-400">
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-3 border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600 dark:text-gray-400">
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-3 border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600 dark:text-gray-400">
            Accounts (Hold Ctrl/Cmd)
            <select
              multiple
              value={selectedAccountIds}
              onChange={handleAccountChange}
              className="h-24 p-2 border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600 dark:text-gray-400">
            Category
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="p-3 border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="">All Categories</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Report Type Selection */}
        <div className="mt-6 p-6 bg-neutral-50 dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700">
          <label className="block text-sm font-bold text-neutral-700 dark:text-gray-300 mb-2">
            Group By
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportType"
                value="category"
                checked={reportType === 'category'}
                onChange={() => setReportType('category')}
                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-gray-300">Category</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportType"
                value="taxLine"
                checked={reportType === 'taxLine'}
                onChange={() => setReportType('taxLine')}
                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-gray-300">Tax Line Item</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportType"
                value="quarterly"
                checked={reportType === 'quarterly'}
                onChange={() => setReportType('quarterly')}
                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-gray-300">
                Quarterly Estimated Tax
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportType"
                value="comparison"
                checked={reportType === 'comparison'}
                onChange={() => setReportType('comparison')}
                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-gray-300">
                Year-Over-Year Comparison
              </span>
            </label>
          </div>
          {reportType === 'taxLine' && (
            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-2">
              Only categories with tax line mappings will be included
            </p>
          )}
          {reportType === 'quarterly' && (
            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-2">
              Shows income, expenses, and estimated tax by quarter (Q1-Q4) for tax planning
            </p>
          )}
          {reportType === 'comparison' && (
            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-2">
              Compare spending and income across two time periods to identify trends
            </p>
          )}
        </div>

        {/* Comparison Period Date Range (only show for comparison report) */}
        {reportType === 'comparison' && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-neutral-200 dark:border-gray-700 mb-6 mt-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100 mb-4">
              Comparison Periods
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Period */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-3">
                  Current Period
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Start Date
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="p-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      End Date
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="p-2 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    />
                  </label>
                </div>
              </div>

              {/* Comparison Period */}
              <div className="bg-neutral-50 dark:bg-gray-900/50 p-4 rounded-lg border border-neutral-200 dark:border-gray-700">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-gray-100 mb-3">
                  Compare Against
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-neutral-700 dark:text-gray-400">
                      Start Date
                    </span>
                    <input
                      type="date"
                      value={compareStartDate}
                      onChange={(e) => setCompareStartDate(e.target.value)}
                      className="p-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-neutral-700 dark:text-gray-400">
                      End Date
                    </span>
                    <input
                      type="date"
                      value={compareEndDate}
                      onChange={(e) => setCompareEndDate(e.target.value)}
                      className="p-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-3">
              Tip: Use the same date ranges (e.g., Jan-Dec) for meaningful year-over-year
              comparisons
            </p>
          </div>
        )}

        {/* Tax Rate Input (only show for quarterly report) */}
        {reportType === 'quarterly' && (
          <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-neutral-200 dark:border-gray-700">
            <label className="block text-sm font-bold text-neutral-700 dark:text-gray-300 mb-2">
              Estimated Tax Rate
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={taxRate * 100}
                onChange={(e) => setTaxRate(Number(e.target.value) / 100)}
                className="w-24 px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-lg bg-neutral-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-gray-300">%</span>
              <span className="text-xs text-neutral-500 dark:text-gray-400 ml-2">
                (Federal + State combined rate)
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-2">
              Typical rates: 25-30% for self-employed individuals. Consult a tax professional for
              your specific rate.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => handleRunReport()}
            disabled={isLoading}
            className="px-8 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Running...' : 'Run Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 border border-red-200 rounded-xl mb-6 font-bold">
          {error}
        </div>
      )}

      {/* Category Report */}
      {reportType === 'category' && reportData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Help Text for CPA Export */}
          {filteredTransactions && filteredTransactions.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">
                CPA Export Format
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Exports detailed transaction data with one row per line item. Split transactions are
                flattened for easy import into tax software. Includes: Date, Account, Payee,
                Description, Category, Tax Line, Amount, and Memo.
              </p>
            </div>
          )}

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 flex justify-end gap-4">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Report CSV
            </button>
            <button
              onClick={handleExportCpa}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!filteredTransactions || filteredTransactions.length === 0}
            >
              Export for CPA
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 rounded-lg font-bold text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700 dark:bg-gray-900"
            >
              Export PDF (Print)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700">
                <tr>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400">Category</th>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400 text-right">
                    Tx Count
                  </th>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400 text-right">
                    Total Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
                {reportData.map((row) => (
                  <tr
                    key={row.categoryId}
                    className="hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                  >
                    <td className="p-4 font-medium">{row.categoryName}</td>
                    <td className="p-4 text-right text-neutral-600 dark:text-gray-400">
                      {row.transactionCount}
                    </td>
                    <td className="p-4 text-right font-bold text-neutral-900 dark:text-gray-100">
                      {formatMoney(row.totalAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-100 dark:bg-gray-900 font-bold border-t-2 border-neutral-300 dark:border-gray-600">
                  <td className="p-4 text-neutral-900 dark:text-gray-100">TOTAL</td>
                  <td className="p-4 text-right text-neutral-900 dark:text-gray-100">
                    {reportData.reduce((sum, r) => sum + r.transactionCount, 0)}
                  </td>
                  <td className="p-4 text-right text-neutral-900 dark:text-gray-100">
                    {formatMoney(reportData.reduce((sum, r) => sum + r.totalAmount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-t border-neutral-200 dark:border-gray-700">
            <div className="text-sm text-neutral-600 dark:text-gray-400 text-center">
              Report generated from {totalTransactions.toLocaleString()} total transactions
            </div>
          </div>
        </div>
      )}

      {/* Tax Line Report */}
      {reportType === 'taxLine' && taxReportData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Help Text for CPA Export */}
          {filteredTransactions && filteredTransactions.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">
                CPA Export Format
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Exports detailed transaction data with one row per line item. Split transactions are
                flattened for easy import into tax software. Includes: Date, Account, Payee,
                Description, Category, Tax Line, Amount, and Memo.
              </p>
            </div>
          )}

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 flex justify-end gap-4">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Report CSV
            </button>
            <button
              onClick={handleExportCpa}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!filteredTransactions || filteredTransactions.length === 0}
            >
              Export for CPA
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 rounded-lg font-bold text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700 dark:bg-gray-900"
            >
              Export PDF (Print)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700">
                <tr>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400">
                    Tax Line Item
                  </th>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400">Categories</th>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400 text-right">
                    Tx Count
                  </th>
                  <th className="p-4 font-bold text-neutral-600 dark:text-gray-400 text-right">
                    Total Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
                {taxReportData.map((row, idx) => (
                  <tr
                    key={row.taxLineItem}
                    className={
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-neutral-50 dark:bg-gray-900'
                    }
                  >
                    <td className="p-4 font-medium text-neutral-900 dark:text-gray-100">
                      {row.taxLineItem}
                    </td>
                    <td className="p-4 text-sm text-neutral-600 dark:text-gray-400">
                      {row.categoryNames.join(', ')}
                    </td>
                    <td className="p-4 text-right text-neutral-600 dark:text-gray-400">
                      {row.transactionCount}
                    </td>
                    <td
                      className={`p-4 text-right font-bold font-mono ${
                        row.isIncome
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-neutral-900 dark:text-gray-100'
                      }`}
                    >
                      ${formatMoney(row.totalAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-100 dark:bg-gray-900 font-bold border-t-2 border-neutral-300 dark:border-gray-600">
                  <td className="p-4 text-neutral-900 dark:text-gray-100" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="p-4 text-right text-neutral-900 dark:text-gray-100">
                    {taxReportData.reduce((sum, r) => sum + r.transactionCount, 0)}
                  </td>
                  <td className="p-4 text-right text-neutral-900 dark:text-gray-100 font-mono">
                    ${formatMoney(taxReportData.reduce((sum, r) => sum + r.totalAmount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-t border-neutral-200 dark:border-gray-700">
            <div className="text-sm text-neutral-600 dark:text-gray-400 text-center">
              Report generated from {totalTransactions.toLocaleString()} total transactions
            </div>
          </div>
        </div>
      )}

      {/* Quarterly Estimated Tax Report */}
      {reportType === 'quarterly' && quarterlyData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-gray-700 bg-neutral-50 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100">
              Quarterly Estimated Tax Summary
            </h3>
            <p className="text-sm text-neutral-600 dark:text-gray-400 mt-1">
              Income, expenses, and estimated tax by quarter for tax year{' '}
              {quarterlyData[0]?.year || new Date(startDate).getFullYear()}
            </p>
          </div>

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 flex justify-end gap-4">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Report CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 rounded-lg font-bold text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700"
            >
              Export PDF (Print)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Quarter
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Income
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Expenses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Net Income
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Est. Tax ({(taxRate * 100).toFixed(0)}%)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-400 uppercase tracking-wider">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-gray-700">
                {quarterlyData.map((q, idx) => (
                  <tr
                    key={q.quarter}
                    className={
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-neutral-50 dark:bg-gray-900'
                    }
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-neutral-900 dark:text-gray-100">
                        {q.quarterLabel}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-gray-400">
                        {q.dateRange}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-green-600 dark:text-green-400">
                      ${formatMoney(q.totalIncome)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600 dark:text-red-400">
                      ${formatMoney(q.totalExpenses)}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm text-right font-mono font-semibold ${
                        q.netIncome >= 0
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      ${formatMoney(q.netIncome)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-brand-700 dark:text-brand-400">
                      ${formatMoney(q.estimatedTax)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-neutral-600 dark:text-gray-400">
                      {q.transactionCount}
                      <div className="text-xs text-neutral-400 dark:text-gray-500">
                        {q.incomeTransactionCount}↑ {q.expenseTransactionCount}↓
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-100 dark:bg-gray-900 border-t-2 border-neutral-300 dark:border-gray-600">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-gray-100">
                    Annual Total
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-green-600 dark:text-green-400">
                    ${formatMoney(quarterlyData.reduce((sum, q) => sum + q.totalIncome, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-red-600 dark:text-red-400">
                    ${formatMoney(quarterlyData.reduce((sum, q) => sum + q.totalExpenses, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-neutral-900 dark:text-gray-100">
                    ${formatMoney(quarterlyData.reduce((sum, q) => sum + q.netIncome, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-brand-700 dark:text-brand-400">
                    ${formatMoney(quarterlyData.reduce((sum, q) => sum + q.estimatedTax, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-neutral-900 dark:text-gray-100">
                    {quarterlyData.reduce((sum, q) => sum + q.transactionCount, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Help text below table */}
          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This is an estimate only. Actual tax liability depends on
              deductions, credits, and other factors. Consult a tax professional for personalized
              advice.
            </p>
          </div>
        </div>
      )}

      {/* Year-Over-Year Comparison Report */}
      {reportType === 'comparison' && comparisonData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-neutral-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-gray-700 bg-neutral-50 dark:bg-gray-900/50">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100">
              Year-Over-Year Comparison
            </h3>
            <p className="text-sm text-neutral-600 dark:text-gray-400 mt-1">
              Comparing{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {startDate} to {endDate}
              </span>{' '}
              against{' '}
              <span className="font-semibold text-neutral-700 dark:text-gray-300">
                {compareStartDate} to {compareEndDate}
              </span>
            </p>
          </div>

          <div className="p-4 bg-neutral-50 dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 flex justify-end gap-4">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Report CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 rounded-lg font-bold text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700"
            >
              Export PDF (Print)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-gray-900/50 border-b border-neutral-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-neutral-700 dark:text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-600 dark:text-gray-400 uppercase tracking-wider">
                    Compare
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-300 uppercase tracking-wider">
                    Variance $
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-300 uppercase tracking-wider">
                    Variance %
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-700 dark:text-gray-300 uppercase tracking-wider">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-gray-700">
                {comparisonData.map((row, idx) => {
                  // Determine variance color
                  // For expenses (negative amounts): Increase (more negative) is bad (red)
                  // For income (positive amounts): Increase (more positive) is good (green)
                  const isIncrease = row.varianceAmount > 0;
                  const isDecrease = row.varianceAmount < 0;

                  let varianceColorClass = 'text-neutral-900 dark:text-gray-100';
                  if (row.isIncome) {
                    // Income: increase is green, decrease is red
                    if (isIncrease) varianceColorClass = 'text-green-600 dark:text-green-400';
                    if (isDecrease) varianceColorClass = 'text-red-600 dark:text-red-400';
                  } else {
                    // Expense: increase is red, decrease is green
                    if (isIncrease) varianceColorClass = 'text-red-600 dark:text-red-400'; // More expense
                    if (isDecrease) varianceColorClass = 'text-green-600 dark:text-green-400'; // Less expense
                  }

                  return (
                    <tr
                      key={row.categoryId}
                      className={
                        idx % 2 === 0
                          ? 'bg-white dark:bg-gray-800'
                          : 'bg-neutral-50 dark:bg-gray-900/30'
                      }
                    >
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-gray-100">
                        {row.categoryName}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-blue-700 dark:text-blue-400 font-semibold">
                        {formatMoney(row.currentAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-neutral-600 dark:text-gray-400">
                        {formatMoney(row.compareAmount)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-mono font-semibold ${varianceColorClass}`}
                      >
                        {row.varianceAmount > 0 ? '+' : ''}
                        {formatMoney(row.varianceAmount)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-semibold ${varianceColorClass}`}
                      >
                        {row.varianceAmount > 0 ? '+' : ''}
                        {row.variancePercent.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-neutral-600 dark:text-gray-400">
                        <div className="flex flex-col items-end">
                          <div>{row.currentTransactionCount}</div>
                          <div className="text-xs text-neutral-400 dark:text-gray-500">
                            vs {row.compareTransactionCount}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-neutral-100 dark:bg-gray-900 border-t-2 border-neutral-300 dark:border-gray-600">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-gray-100">
                    Total
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-blue-700 dark:text-blue-400">
                    {formatMoney(comparisonData.reduce((sum, r) => sum + r.currentAmount, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-neutral-700 dark:text-gray-300">
                    {formatMoney(comparisonData.reduce((sum, r) => sum + r.compareAmount, 0))}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right font-mono text-neutral-900 dark:text-gray-100">
                    {formatMoney(comparisonData.reduce((sum, r) => sum + r.varianceAmount, 0))}
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-neutral-900 dark:text-gray-100">
                    {comparisonData.reduce((sum, r) => sum + r.currentTransactionCount, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Help text below table */}
          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Color Guide:</strong> For expenses, green means spending decreased (good), red
              means spending increased (attention needed). For income, green means income increased
              (good), red means income decreased (attention needed).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
