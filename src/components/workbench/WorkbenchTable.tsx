import { useState, useRef, useMemo, Fragment } from 'react';
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
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction, Category } from '../../types/database';
import PayeeSelectCell from './PayeeSelectCell';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { usePayees } from '../../hooks/usePayees';

interface WorkbenchTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
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
  onCreateRule,
  onCreatePayee,
  onShowHistory,
}: WorkbenchTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { payees } = usePayees();

  const columnHelper = createColumnHelper<Transaction>();

  // Helper to process categories - memoized with stable reference
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
        // Assume "Income" is the name of the root category for income
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
      columnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => (
          <span className="text-neutral-600 font-medium">
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
            className="text-neutral-500 italic block truncate max-w-[200px]"
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
          const colorClass = amount >= 0 ? 'text-success-700' : 'text-neutral-900';
          return (
            <div className={`font-bold text-right ${colorClass}`}>
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
          if (row.original.is_split) {
            return (
              <div>
                <button
                  onClick={row.getToggleExpandedHandler()}
                  className="text-brand-600 font-bold hover:underline flex items-center gap-1"
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
                className="w-full bg-brand-50 dark:bg-gray-700 border border-brand-200 dark:border-gray-600 text-brand-900 dark:text-gray-100 py-2 px-3 pr-8 rounded-lg font-bold hover:bg-brand-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-700 cursor-pointer"
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
          <span className="text-sm text-neutral-500 dark:text-gray-400 font-medium bg-neutral-100 dark:bg-gray-700 px-2 py-1 rounded">
            {getAccountName(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('is_reviewed', {
        header: 'Reviewed',
        cell: (info) => (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={info.getValue()}
              onChange={() => onReview(info.row.original)}
              className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300 cursor-pointer"
            />
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onEdit(row.original)}
              className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
              title="Edit"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
              title="Split"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
              title="Create Rule"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="p-2 text-neutral-400 hover:text-danger-700 transition-colors"
              title="Delete"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
                title="View History"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        ),
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
    ]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
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
                    className="p-4 text-base font-bold text-neutral-600 dark:text-gray-300 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-800 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
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
          <tbody className="divide-y divide-neutral-200 text-lg">
            {paddingTop > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {items.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              return (
                <Fragment key={row.id}>
                  <tr
                    className="hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors group"
                    data-index={virtualRow.index}
                    ref={(node) => virtualizer.measureElement(node)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-4 align-middle dark:text-gray-200">
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
                                  className="font-bold text-brand-700 w-1/3 truncate"
                                  title={getCategoryName(line.category_id)}
                                >
                                  {getCategoryName(line.category_id)}
                                </span>
                                <span
                                  className={`font-mono font-medium w-32 text-right ${line.amount >= 0 ? 'text-success-700' : 'text-neutral-900'}`}
                                >
                                  {line.amount >= 0 ? '+' : ''}
                                  {(Math.abs(line.amount) / 100).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                <span className="text-neutral-500 text-sm italic flex-1">
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
              <div className="text-xl font-medium text-neutral-900 dark:text-gray-100 mb-3 truncate">
                {t.payee || 'Unknown Payee'}
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
