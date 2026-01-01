import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../hooks/useAccounts';
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
import { Transaction } from '../types/database';
import { useSortedCategories } from '../lib/categoryUtils';
import CategoryReportView from '../components/reports/CategoryReportView';
import TaxLineReportView from '../components/reports/TaxLineReportView';
import QuarterlyReportView from '../components/reports/QuarterlyReportView';
import YearComparisonReportView from '../components/reports/YearComparisonReportView';

export default function ReportsPage() {
  const { activeBookset } = useAuth();
  const { accounts } = useAccounts();
  const { payees } = usePayees();

  // Helper to process categories with parent:child format
  const sortedCategories = useSortedCategories();

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
          sortedCategories
        );
        setComparisonData(comparisonSummary);
      } else if (reportType === 'taxLine') {
        const taxSummary = generateTaxLineReport(filteredCurrent, sortedCategories);
        setTaxReportData(taxSummary);
      } else if (reportType === 'quarterly') {
        const quarterlySummary = generateQuarterlyReport(filteredCurrent, taxRate);
        setQuarterlyData(quarterlySummary);
      } else {
        const summary = generateCategoryReport(filteredCurrent, sortedCategories);
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
      const exportRows = generateCpaExport(
        filteredTransactions,
        sortedCategories,
        accounts,
        payees
      );

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
        <CategoryReportView
          reportData={reportData}
          filteredTransactions={filteredTransactions}
          totalTransactions={totalTransactions}
          onExportCsv={handleExportCsv}
          onExportCpa={handleExportCpa}
          onExportPdf={handleExportPdf}
          formatMoney={formatMoney}
        />
      )}

      {/* Tax Line Report */}
      {reportType === 'taxLine' && taxReportData && (
        <TaxLineReportView
          taxReportData={taxReportData}
          filteredTransactions={filteredTransactions}
          totalTransactions={totalTransactions}
          onExportCsv={handleExportCsv}
          onExportCpa={handleExportCpa}
          onExportPdf={handleExportPdf}
          formatMoney={formatMoney}
        />
      )}

      {/* Quarterly Estimated Tax Report */}
      {reportType === 'quarterly' && quarterlyData && (
        <QuarterlyReportView
          quarterlyData={quarterlyData}
          taxRate={taxRate}
          startDate={startDate}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          formatMoney={formatMoney}
        />
      )}

      {/* Year-Over-Year Comparison Report */}
      {reportType === 'comparison' && comparisonData && (
        <YearComparisonReportView
          comparisonData={comparisonData}
          startDate={startDate}
          endDate={endDate}
          compareStartDate={compareStartDate}
          compareEndDate={compareEndDate}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}
