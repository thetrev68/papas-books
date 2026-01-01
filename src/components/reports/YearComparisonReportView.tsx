import type { YearComparisonRow } from '../../lib/reports';

interface YearComparisonReportViewProps {
  comparisonData: YearComparisonRow[];
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
  onExportCsv: () => void;
  onExportPdf: () => void;
  formatMoney: (cents: number) => string;
}

/**
 * Year-over-year comparison report view showing spending and income trends across two periods.
 * Extracted from ReportsPage to reduce component complexity.
 */
export default function YearComparisonReportView({
  comparisonData,
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
  onExportCsv,
  onExportPdf,
  formatMoney,
}: YearComparisonReportViewProps) {
  return (
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
  );
}
