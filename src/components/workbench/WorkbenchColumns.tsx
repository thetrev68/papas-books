import { useRef, useEffect, useMemo } from 'react';
import { createColumnHelper, type Table } from '@tanstack/react-table';
import type { Transaction, Payee } from '../../types/database';
import type { CategoryWithDisplayName } from '../../lib/categoryUtils';
import PayeeSelectCell from './PayeeSelectCell';

/**
 * Header checkbox component for "select all" functionality.
 * Extracted to avoid calling useRef inside useMemo callback (React Hook rule).
 */
function SelectAllCheckbox({ table }: { table: Table<Transaction> }) {
  const ref = useRef<HTMLInputElement>(null);

  // Handle indeterminate state
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = table.getIsSomeRowsSelected();
    }
  }, [table.getIsSomeRowsSelected()]);

  return (
    <div className="flex items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className="w-5 h-5 text-brand-600 dark:text-brand-500 rounded border-neutral-300 dark:border-gray-600 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer bg-white dark:bg-gray-700"
        title="Select all"
      />
    </div>
  );
}

interface ColumnOptions {
  sortedCategories: CategoryWithDisplayName[];
  payees: Payee[];
  editingPayee: string | null;
  isDateLocked: (date: string) => boolean;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onCreateRule: (transaction: Transaction) => void;
  onCreatePayee?: (name: string) => void;
  onShowHistory?: (transaction: Transaction) => void;
  setEditingPayee: (id: string | null) => void;
  getAccountName: (accountId: string) => string;
}

/**
 * Creates column definitions for the WorkbenchTable.
 * Extracted to reduce component complexity and improve maintainability.
 */
export function useWorkbenchColumns(options: ColumnOptions) {
  const {
    sortedCategories,
    payees,
    editingPayee,
    isDateLocked,
    onUpdatePayee,
    onUpdateCategory,
    onEdit,
    onSplit,
    onDelete,
    onReview,
    onCreateRule,
    onCreatePayee,
    onShowHistory,
    setEditingPayee,
    getAccountName,
  } = options;

  const columnHelper = createColumnHelper<Transaction>();

  return useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => <SelectAllCheckbox table={table} />,
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date) || row.original.reconciled;
          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                disabled={locked}
                onChange={row.getToggleSelectedHandler()}
                className="w-5 h-5 text-brand-600 dark:text-brand-500 rounded border-neutral-300 dark:border-gray-600 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-white dark:bg-gray-700"
                title={locked ? 'Cannot select locked/reconciled transaction' : 'Select'}
              />
            </div>
          );
        },
        size: 50,
      }),
      columnHelper.display({
        id: 'lock-indicator',
        header: '',
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date);
          return locked ? (
            <span className="text-red-600 text-lg" title="Locked (tax year filed)">
              🔒
            </span>
          ) : null;
        },
        size: 30,
      }),
      columnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => (
          <span className="text-neutral-900 dark:text-gray-100">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
        ),
        sortingFn: 'datetime',
      }),
      columnHelper.accessor('payee', {
        header: 'Payee',
        cell: (info) => (
          <PayeeSelectCell
            value={info.getValue() || ''}
            payees={payees}
            onSave={(newValue) => onUpdatePayee(info.row.original.id, newValue)}
            onCancel={() => setEditingPayee(null)}
            isEditing={editingPayee === info.row.original.id}
            setIsEditing={(editing) => setEditingPayee(editing ? info.row.original.id : null)}
            onCreatePayee={onCreatePayee}
          />
        ),
      }),
      columnHelper.accessor('original_description', {
        header: 'Description',
        cell: (info) => (
          <span
            className="text-neutral-600 dark:text-gray-400 italic block truncate max-w-[200px]"
            title={info.getValue()}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('amount', {
        header: () => <div className="text-right">Amount</div>,
        cell: (info) => {
          const amount = info.getValue();
          const colorClass =
            amount >= 0
              ? 'text-success-700 dark:text-green-500'
              : 'text-neutral-900 dark:text-gray-100';
          return (
            <div className={`text-right ${colorClass}`}>
              $
              {(Math.abs(amount) / 100).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          );
        },
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date);
          if (row.original.is_split) {
            return (
              <div>
                <button
                  onClick={row.getToggleExpandedHandler()}
                  className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  {row.getIsExpanded() ? '▼' : '▶'} Split ({row.original.lines.length})
                </button>
              </div>
            );
          } else {
            const currentCategoryId = row.original.lines[0]?.category_id || '';
            return (
              <select
                value={currentCategoryId}
                onChange={(e) => onUpdateCategory(row.original.id, e.target.value)}
                disabled={locked}
                className="w-full bg-brand-50 dark:bg-gray-700 border border-brand-200 dark:border-gray-600 text-brand-900 dark:text-gray-100 py-1 px-2 pr-8 rounded hover:bg-brand-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <option value="">Uncategorized</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </option>
                ))}
              </select>
            );
          }
        },
      }),
      columnHelper.accessor('account_id', {
        header: 'Account',
        cell: (info) => (
          <span className="text-xs text-neutral-700 dark:text-gray-300 bg-neutral-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {getAccountName(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('is_reviewed', {
        header: 'Reviewed',
        cell: (info) => {
          const locked = isDateLocked(info.row.original.date);
          return (
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={info.getValue()}
                onChange={() => onReview(info.row.original)}
                disabled={locked}
                className="w-5 h-5 text-brand-600 dark:text-brand-500 rounded focus:ring-brand-500 dark:focus:ring-brand-700 border-neutral-300 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700"
              />
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const locked = isDateLocked(row.original.date);
          return (
            <div className="flex gap-1 justify-center">
              <button
                onClick={() => onEdit(row.original)}
                disabled={locked}
                className="p-1 text-neutral-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={locked ? 'Locked (tax year filed)' : 'Edit'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
              <button
                onClick={() => onSplit(row.original)}
                disabled={locked}
                className="p-1 text-neutral-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={locked ? 'Locked (tax year filed)' : 'Split'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  ></path>
                </svg>
              </button>
              <button
                onClick={() => onCreateRule(row.original)}
                className="p-1 text-neutral-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                title="Create Rule"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  ></path>
                </svg>
              </button>
              <button
                onClick={() => onDelete(row.original)}
                disabled={locked}
                className="p-1 text-neutral-600 dark:text-gray-400 hover:text-danger-700 dark:hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={locked ? 'Locked (tax year filed)' : 'Delete'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-2.14-1.928L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
              {onShowHistory && (
                <button
                  onClick={() => onShowHistory(row.original)}
                  className="p-1 text-neutral-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  title="View History"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [
      sortedCategories,
      payees,
      onUpdatePayee,
      onUpdateCategory,
      editingPayee,
      onEdit,
      onSplit,
      onCreateRule,
      onDelete,
      onReview,
      onCreatePayee,
      onShowHistory,
      isDateLocked,
      setEditingPayee,
      getAccountName,
    ]
  );
}
