import { useState, useRef, useMemo, Fragment, useEffect } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ExpandedState,
  type RowSelectionState,
  type Table,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction } from '../../types/database';
import PayeeSelectCell from './PayeeSelectCell';
import { useAccounts } from '../../hooks/useAccounts';
import { usePayees } from '../../hooks/usePayees';
import { useTaxYearLocks } from '../../hooks/useTaxYearLocks';
import { useToast } from '../GlobalToastProvider';
import { useSortedCategories } from '../../lib/categoryUtils';

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

interface WorkbenchTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
  onBulkUpdateCategory: (transactionIds: string[], categoryId: string) => void;
  onCreateRule: (transaction: Transaction) => void;
  onCreatePayee?: (name: string) => void;
  onShowHistory?: (transaction: Transaction) => void;
}

function WorkbenchTable({
  transactions,
  onEdit,
  onSplit,
  onDelete,
  onReview,
  onUpdatePayee,
  onUpdateCategory,
  onBulkUpdateCategory,
  onCreateRule,
  onCreatePayee,
  onShowHistory,
}: WorkbenchTableProps) {
  const { showConfirm } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { accounts } = useAccounts();
  const { payees } = usePayees();
  const { isDateLocked } = useTaxYearLocks();

  const columnHelper = createColumnHelper<Transaction>();

  // Helper to process categories - memoized with stable reference
  const sortedCategories = useSortedCategories();

  function getAccountName(accountId: string): string {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : `Account ${accountId}`;
  }

  function getCategoryName(categoryId: string): string {
    const cat = sortedCategories.find((c) => c.id === categoryId);
    return cat ? cat.displayName : 'Uncategorized';
  }

  // Memoize columns to prevent re-creation on every render
  const columns = useMemo(
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
    ]
  );

  // Bulk action handlers
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
            setRowSelection({});
          },
          confirmText: 'Update',
          cancelText: 'Cancel',
          variant: 'warning',
        }
      );
    } else {
      onBulkUpdateCategory(selectedIds, categoryId);
      setRowSelection({});
    }
  };

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      expanded,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) => {
      // Only allow selection of unlocked, non-reconciled transactions
      return !isDateLocked(row.original.date) && !row.original.reconciled;
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.is_split,
    getRowId: (row) => row.id, // Use transaction ID for stable row identity
  });

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Taller rows
    overscan: 5,
    // Measure actual row heights dynamically
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div>
      {/* Search Filter */}
      <div className="mb-4">
        <input
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search..."
          className="w-full md:w-96 p-4 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
        />
      </div>

      {/* Bulk Action Toolbar */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="mb-4 bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-300 dark:border-brand-700 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Selection Count */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-900 dark:text-brand-100 text-lg">
                {Object.keys(rowSelection).length} transaction
                {Object.keys(rowSelection).length === 1 ? '' : 's'} selected
              </span>
              <button
                onClick={() => setRowSelection({})}
                className="text-sm text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 underline"
              >
                Clear
              </button>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap items-center gap-3">
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
      )}

      {/* Desktop Table */}
      <div
        ref={parentRef}
        className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-300px)] overflow-y-auto"
      >
        <table className="w-full text-left border-collapse">
          <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-3 text-xs font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-800 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-sm">
            {paddingTop > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {items.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              const locked = isDateLocked(row.original.date);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors group ${
                      locked ? 'bg-red-50 dark:bg-red-950 opacity-60' : ''
                    }`}
                    data-index={virtualRow.index}
                    ref={(node) => virtualizer.measureElement(node)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr
                      className="bg-neutral-50 dark:bg-gray-900 shadow-inner"
                      ref={(node) => virtualizer.measureElement(node)}
                    >
                      <td colSpan={columns.length} className="p-4">
                        <div className="ml-12 pl-4 border-l-4 border-brand-300 dark:border-brand-600">
                          <h4 className="text-sm font-bold text-neutral-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                            Split Details
                          </h4>
                          <div className="space-y-2">
                            {row.original.lines.map((line, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-lg border border-neutral-200 dark:border-gray-700"
                              >
                                <span
                                  className="text-brand-700 dark:text-brand-400 w-1/3 truncate"
                                  title={getCategoryName(line.category_id)}
                                >
                                  {getCategoryName(line.category_id)}
                                </span>
                                <span
                                  className={`font-mono w-32 text-right ${line.amount >= 0 ? 'text-success-700 dark:text-green-500' : 'text-neutral-900 dark:text-gray-100'}`}
                                >
                                  {line.amount >= 0 ? '+' : ''}
                                  {(Math.abs(line.amount) / 100).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                <span className="text-neutral-600 dark:text-gray-400 text-sm italic flex-1">
                                  {line.memo || 'No memo'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {table.getRowModel().rows.map((row) => {
          const t = row.original;
          const currentCategoryId = t.lines[0]?.category_id || '';
          return (
            <div
              key={row.id}
              className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border-l-8 ${t.is_reviewed ? 'border-success-500 dark:border-green-600' : 'border-neutral-300 dark:border-gray-600'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-neutral-500 dark:text-gray-400 font-semibold">
                  {new Date(t.date).toLocaleDateString()}
                </span>
                <span
                  className={`text-xl font-bold ${t.amount >= 0 ? 'text-success-700 dark:text-green-500' : 'text-danger-700 dark:text-red-500'}`}
                >
                  {t.amount >= 0 ? '+' : ''}$
                  {(Math.abs(t.amount) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-xl font-medium text-neutral-900 dark:text-gray-100 mb-1 truncate">
                <PayeeSelectCell
                  value={t.payee || ''}
                  payees={payees}
                  onSave={(newValue) => onUpdatePayee(t.id, newValue)}
                  onCancel={() => setEditingPayee(null)}
                  isEditing={editingPayee === t.id}
                  setIsEditing={(editing) => setEditingPayee(editing ? t.id : null)}
                  onCreatePayee={onCreatePayee}
                />
              </div>

              <div
                className="text-sm text-neutral-500 dark:text-gray-400 italic mb-3 truncate"
                title={t.original_description}
              >
                {t.original_description}
              </div>

              <div className="mb-4">
                {t.is_split ? (
                  <div className="p-3 bg-brand-50 dark:bg-brand-900 rounded-lg border border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-200 font-bold">
                    {t.lines.length} Split Lines
                  </div>
                ) : (
                  <select
                    value={currentCategoryId}
                    onChange={(e) => onUpdateCategory(t.id, e.target.value)}
                    className="w-full bg-brand-50 dark:bg-gray-700 border border-brand-200 dark:border-gray-600 text-brand-900 dark:text-gray-100 py-2 px-3 rounded-lg font-bold"
                  >
                    <option value="">Uncategorized</option>
                    {sortedCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onReview(t)}
                  className={`flex-1 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    t.is_reviewed
                      ? 'bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 border border-success-700 dark:border-green-700'
                      : 'bg-brand-600 text-white shadow-md'
                  }`}
                >
                  {t.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
                </button>
                <button
                  onClick={() => onEdit(t)}
                  className="p-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 rounded-xl text-neutral-600 dark:text-gray-300"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WorkbenchTable;
