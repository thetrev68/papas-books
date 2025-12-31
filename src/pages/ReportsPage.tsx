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
  TaxLineSummary,
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

  const [reportType, setReportType] = useState<'category' | 'taxLine'>('category');
  const [reportData, setReportData] = useState<CategorySummary[] | null>(null);
  const [taxReportData, setTaxReportData] = useState<TaxLineSummary[] | null>(null);
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
    setFilteredTransactions(null);
    try {
      // 1. Fetch ALL transactions by paginating through all pages
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

      const filtered = filterTransactionsForReport(allTransactions as Transaction[], filter);
      setFilteredTransactions(filtered);

      // 3. Generate appropriate report based on type
      if (reportType === 'taxLine') {
        const taxSummary = generateTaxLineReport(filtered, categories);
        setTaxReportData(taxSummary);
      } else {
        const summary = generateCategoryReport(filtered, categories);
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

    if (reportType === 'taxLine') {
      if (!taxReportData) return;
      csv = exportTaxReportToCsv(taxReportData);
      filename = `tax-report-${startDate}-to-${endDate}.csv`;
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

  const formatMoney = (cents: number) => (cents / 100).toFixed(2);

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
          </div>
          {reportType === 'taxLine' && (
            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-2">
              Only categories with tax line mappings will be included
            </p>
          )}
        </div>

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
    </div>
  );
}
