import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { fetchTransactionsForReport } from '../lib/supabase/reports';
import {
  generateCategoryReport,
  filterTransactionsForReport,
  exportReportToCsv,
} from '../lib/reports';
import { CategorySummary, ReportFilter } from '../types/reconcile';
import { Transaction } from '../types/database';

export default function ReportsPage() {
  const { activeBookset } = useAuth();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [reportData, setReportData] = useState<CategorySummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunReport = async () => {
    if (!activeBookset) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch transactions in date range
      const rawTransactions = await fetchTransactionsForReport(
        activeBookset.id,
        startDate,
        endDate
      );

      // 2. Filter in memory
      const filter: ReportFilter = {
        startDate,
        endDate,
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        categoryId: selectedCategoryId || undefined,
      };

      const filteredTransactions = filterTransactionsForReport(
        rawTransactions as Transaction[],
        filter
      );

      // 3. Aggregate
      const summary = generateCategoryReport(filteredTransactions, categories);
      setReportData(summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const csv = exportReportToCsv(reportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
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
      <h1 className="text-3xl font-bold mb-6 text-neutral-900">Reports</h1>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <label className="flex flex-col gap-2 font-bold text-neutral-600">
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-3 border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600">
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-3 border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600">
            Accounts (Hold Ctrl/Cmd)
            <select
              multiple
              value={selectedAccountIds}
              onChange={handleAccountChange}
              className="h-24 p-2 border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 font-bold text-neutral-600">
            Category
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="p-3 border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleRunReport}
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

      {reportData && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex justify-end gap-4">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-white border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-100"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-white border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-100"
            >
              Export PDF (Print)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-100 border-b-2 border-neutral-200">
                <tr>
                  <th className="p-4 font-bold text-neutral-600">Category</th>
                  <th className="p-4 font-bold text-neutral-600 text-right">Tx Count</th>
                  <th className="p-4 font-bold text-neutral-600 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-lg">
                {reportData.map((row) => (
                  <tr key={row.categoryId} className="hover:bg-neutral-50">
                    <td className="p-4 font-medium">{row.categoryName}</td>
                    <td className="p-4 text-right text-neutral-600">{row.transactionCount}</td>
                    <td className="p-4 text-right font-bold text-neutral-900">
                      {formatMoney(row.totalAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-100 font-bold border-t-2 border-neutral-300">
                  <td className="p-4 text-neutral-900">TOTAL</td>
                  <td className="p-4 text-right text-neutral-900">
                    {reportData.reduce((sum, r) => sum + r.transactionCount, 0)}
                  </td>
                  <td className="p-4 text-right text-neutral-900">
                    {formatMoney(reportData.reduce((sum, r) => sum + r.totalAmount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
