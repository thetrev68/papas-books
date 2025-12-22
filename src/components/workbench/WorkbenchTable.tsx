import { useState, useRef } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction } from '../../types/database';
import InlineEditCell from './InlineEditCell';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';

interface WorkbenchTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
  onCreateRule: (transaction: Transaction) => void;
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
}: WorkbenchTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingPayee, setEditingPayee] = useState<string | null>(null);

  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const columnHelper = createColumnHelper<Transaction>();

  function getAccountName(accountId: string): string {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : `Account ${accountId}`;
  }

  const columns = [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      sortingFn: 'datetime',
    }),
    columnHelper.accessor('payee', {
      header: 'Payee',
      cell: (info) => (
        <InlineEditCell
          value={info.getValue() || 'Unknown'}
          onSave={(newValue) => onUpdatePayee(info.row.original.id, newValue)}
          onCancel={() => setEditingPayee(null)}
          isEditing={editingPayee === info.row.original.id}
          setIsEditing={(editing) => setEditingPayee(editing ? info.row.original.id : null)}
        />
      ),
    }),
    columnHelper.accessor('original_description', {
      header: 'Description',
      cell: (info) => (
        <span
          title={info.getValue()}
          style={{
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
          }}
        >
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => {
        const amount = info.getValue();
        const sign = amount >= 0 ? '+' : '';
        return (
          <span style={{ color: amount >= 0 ? 'green' : 'red' }}>
            {sign}${(Math.abs(amount) / 100).toFixed(2)}
          </span>
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
              <button onClick={row.getToggleExpandedHandler()}>
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
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid transparent',
                borderRadius: '4px',
                backgroundColor: 'transparent',
              }}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          );
        }
      },
    }),
    columnHelper.accessor('account_id', {
      header: 'Account',
      cell: (info) => getAccountName(info.getValue()),
    }),
    columnHelper.accessor('is_reviewed', {
      header: 'Reviewed',
      cell: (info) => (
        <input
          type="checkbox"
          checked={info.getValue()}
          onChange={() => onReview(info.row.original)}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => onEdit(row.original)}>Edit</button>
          <button onClick={() => onSplit(row.original)}>Split</button>
          <button onClick={() => onDelete(row.original)}>Delete</button>
          <button onClick={() => onCreateRule(row.original)}>Rule</button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Virtualization for performance
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div>
      {/* Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search all columns..."
          style={{ padding: '4px', width: '200px' }}
        />
      </div>

      {/* Table */}
      <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}
                  >
                    {header.isPlaceholder ? null : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          onClick={header.column.getToggleSortingHandler()}
                          style={{ cursor: 'pointer' }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {items.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: '8px' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
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
    </div>
  );
}

export default WorkbenchTable;
