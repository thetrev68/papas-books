import type { RowSelectionState } from '@tanstack/react-table';
import type { CategoryWithDisplayName } from '../../lib/categoryUtils';
import { useToast } from '../GlobalToastProvider';

interface WorkbenchToolbarProps {
  rowSelection: RowSelectionState;
  sortedCategories: CategoryWithDisplayName[];
  onBulkUpdateCategory: (transactionIds: string[], categoryId: string) => void;
  onClearSelection: () => void;
  onExport: () => void;
  hasData: boolean;
}

/**
 * Toolbar for bulk actions on selected transactions in the Workbench.
 * Extracted from WorkbenchTable to reduce component complexity.
 */
function WorkbenchToolbar({
  rowSelection,
  sortedCategories,
  onBulkUpdateCategory,
  onClearSelection,
  onExport,
  hasData,
}: WorkbenchToolbarProps) {
  const { showConfirm } = useToast();
  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkCategoryUpdate = (categoryId: string) => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    // Confirm if updating many transactions
    if (selectedIds.length > 10) {
      const category = sortedCategories.find((c) => c.id === categoryId);
      const categoryName = category?.displayName || 'Unknown Category';
      showConfirm(
        `Are you sure you want to update ${selectedIds.length} transactions to "${categoryName}"?\n\nNote: Split transactions will be converted to simple transactions.`,
        {
          onConfirm: () => {
            onBulkUpdateCategory(selectedIds, categoryId);
            onClearSelection();
          },
          confirmText: 'Update',
          cancelText: 'Cancel',
          variant: 'warning',
        }
      );
    } else {
      onBulkUpdateCategory(selectedIds, categoryId);
      onClearSelection();
    }
  };

  // Show export button always, bulk actions only when rows selected
  if (selectedCount === 0) {
    return (
      <div className="mb-4 flex justify-end">
        <button
          onClick={onExport}
          disabled={!hasData}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Export transactions to CSV"
          title={hasData ? 'Export filtered transactions to CSV' : 'No data to export'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export to CSV
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-300 dark:border-brand-700 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-brand-900 dark:text-brand-100 text-lg">
            {selectedCount} transaction{selectedCount === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-sm text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 underline"
          >
            Clear
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Export Button */}
          <button
            onClick={onExport}
            disabled={!hasData}
            className="flex items-center gap-2 px-3 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            aria-label="Export transactions to CSV"
            title="Export filtered transactions to CSV"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </button>

          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="bulk-category-select"
              className="text-sm font-semibold text-brand-800 dark:text-brand-200"
            >
              Set Category:
            </label>
            <select
              id="bulk-category-select"
              className="bg-white dark:bg-gray-700 border-2 border-brand-300 dark:border-brand-600 text-brand-900 dark:text-gray-100 py-2 px-3 pr-8 rounded-lg font-semibold hover:bg-brand-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer min-w-[200px]"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkCategoryUpdate(e.target.value);
                  e.target.value = ''; // Reset select
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Choose category...
              </option>
              {sortedCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Info Message */}
      <p className="text-xs text-brand-700 dark:text-brand-300 mt-3">
        <strong>Note:</strong> Bulk category update will convert split transactions to simple
        transactions. Locked and reconciled transactions will be skipped.
      </p>
    </div>
  );
}

export default WorkbenchToolbar;
