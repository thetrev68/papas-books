import type { QuarterlySummary } from '../../lib/reports';

interface QuarterlyReportViewProps {
  quarterlyData: QuarterlySummary[];
  taxRate: number;
  startDate: string;
  onExportCsv: () => void;
  onExportPdf: () => void;
  formatMoney: (cents: number) => string;
}

/**
 * Quarterly estimated tax report view showing income, expenses, and tax estimates by quarter.
 * Extracted from ReportsPage to reduce component complexity.
 */
export default function QuarterlyReportView({
  quarterlyData,
  taxRate,
  startDate,
  onExportCsv,
  onExportPdf,
  formatMoney,
}: QuarterlyReportViewProps) {
  return (
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
          onClick={onExportCsv}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
        >
          Export Report CSV
        </button>
        <button
          onClick={onExportPdf}
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
                  <div className="text-xs text-neutral-500 dark:text-gray-400">{q.dateRange}</div>
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
  );
}
