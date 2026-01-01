import { useState, useRef, Fragment, useEffect } from 'react';
import {
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
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction } from '../../types/database';
import { useAccounts } from '../../hooks/useAccounts';
import { usePayees } from '../../hooks/usePayees';
import { useTaxYearLocks } from '../../hooks/useTaxYearLocks';
import { useSortedCategories } from '../../lib/categoryUtils';
import { useWorkbenchColumns } from './WorkbenchColumns';
import WorkbenchToolbar from './WorkbenchToolbar';
import WorkbenchMobileCard from './WorkbenchMobileCard';

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { accounts } = useAccounts();
  const { payees } = usePayees();
  const { isDateLocked } = useTaxYearLocks();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Use extracted column definitions
  const columns = useWorkbenchColumns({
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
  });

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
    estimateSize: () => 60, // Reduced estimate
    overscan: 5,
    measureElement: (element) => element?.getBoundingClientRect().height,
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
      <WorkbenchToolbar
        rowSelection={rowSelection}
        sortedCategories={sortedCategories}
        onBulkUpdateCategory={onBulkUpdateCategory}
        onClearSelection={() => setRowSelection({})}
      />

      {/* Desktop Table */}
      {!isMobile && (
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
      )}

      {/* Mobile Card View */}
      {isMobile && (
        <div className="md:hidden space-y-4">
          {table.getRowModel().rows.map((row) => (
            <WorkbenchMobileCard
              key={row.id}
              transaction={row.original}
              sortedCategories={sortedCategories}
              payees={payees}
              editingPayee={editingPayee}
              onUpdatePayee={onUpdatePayee}
              onUpdateCategory={onUpdateCategory}
              onReview={onReview}
              onEdit={onEdit}
              onCreatePayee={onCreatePayee}
              setEditingPayee={setEditingPayee}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkbenchTable;
