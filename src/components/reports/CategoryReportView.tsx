import type { CategorySummary } from '../../types/reconcile';
import type { Transaction } from '../../types/database';

interface CategoryReportViewProps {
  reportData: CategorySummary[];
  filteredTransactions: Transaction[] | null;
  totalTransactions: number;
  onExportCsv: () => void;
  onExportCpa: () => void;
  onExportPdf: () => void;
  formatMoney: (cents: number) => string;
}

/**
 * Category report view showing transaction summaries grouped by category.
 * Extracted from ReportsPage to reduce component complexity.
 */
export default function CategoryReportView({
  reportData,
  filteredTransactions,
  totalTransactions,
  onExportCsv,
  onExportCpa,
  onExportPdf,
  formatMoney,
}: CategoryReportViewProps) {
  return (
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
          onClick={onExportCsv}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
        >
          Export Report CSV
        </button>
        <button
          onClick={onExportCpa}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!filteredTransactions || filteredTransactions.length === 0}
        >
          Export for CPA
        </button>
        <button
          onClick={onExportPdf}
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
  );
}
