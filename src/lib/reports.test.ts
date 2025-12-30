import { generateCategoryReport, filterTransactionsForReport, exportReportToCsv } from './reports';
import { Transaction, Category } from '../types/database';
import { ReportFilter } from '../types/reconcile';

describe('Reporting Logic', () => {
  const mockTx = (
    id: string,
    amount: number,
    date: string,
    categoryId: string,
    isSplit = false,
    lines: { category_id: string; amount: number }[] = []
  ): Transaction => ({
    id,
    amount,
    bookset_id: 'b1',
    account_id: 'a1',
    date,
    payee: 'Test',
    payee_id: null,
    original_description: 'Test',
    lines: isSplit ? lines : categoryId ? [{ category_id: categoryId, amount, memo: '' }] : [],
    is_split: isSplit,
    is_reviewed: true,
    reconciled: false,
    is_archived: false,
    source_batch_id: null,
    fingerprint: 'fp',
    import_date: '2023-01-01',
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
    created_by: 'u1',
    last_modified_by: 'u1',
  });

  const categories: Category[] = [
    {
      id: 'c1',
      name: 'Food',
      bookset_id: 'b1',
      is_archived: false,
      sort_order: 0,
      created_at: '',
      updated_at: '',
      created_by: '',
      last_modified_by: '',
      tax_line_item: null,
      is_tax_deductible: false,
      parent_category_id: null,
    },
    {
      id: 'c2',
      name: 'Rent',
      bookset_id: 'b1',
      is_archived: false,
      sort_order: 0,
      created_at: '',
      updated_at: '',
      created_by: '',
      last_modified_by: '',
      tax_line_item: null,
      is_tax_deductible: false,
      parent_category_id: null,
    },
  ];

  describe('generateCategoryReport', () => {
    it('should aggregate simple transactions', () => {
      const txs = [
        mockTx('1', 100, '2023-01-01', 'c1'),
        mockTx('2', 200, '2023-01-02', 'c1'),
        mockTx('3', 500, '2023-01-03', 'c2'),
      ];

      const result = generateCategoryReport(txs, categories);

      expect(result).toHaveLength(2);
      const food = result.find((r) => r.categoryId === 'c1');
      const rent = result.find((r) => r.categoryId === 'c2');

      expect(food?.totalAmount).toBe(300);
      expect(food?.transactionCount).toBe(2);
      expect(rent?.totalAmount).toBe(500);
      expect(rent?.transactionCount).toBe(1);
    });

    it('should decompose split transactions', () => {
      const txs = [
        mockTx('1', 100, '2023-01-01', '', true, [
          { category_id: 'c1', amount: 60 },
          { category_id: 'c2', amount: 40 },
        ]),
      ];

      const result = generateCategoryReport(txs, categories);

      expect(result).toHaveLength(2);
      const food = result.find((r) => r.categoryId === 'c1');
      const rent = result.find((r) => r.categoryId === 'c2');

      expect(food?.totalAmount).toBe(60);
      expect(rent?.totalAmount).toBe(40);
    });
  });

  describe('filterTransactionsForReport', () => {
    const txs = [
      mockTx('1', 100, '2023-01-01', 'c1'), // Jan 1
      mockTx('2', 100, '2023-02-01', 'c1'), // Feb 1
      mockTx('3', 100, '2023-01-15', 'c2'), // Jan 15
    ];

    it('should filter by date range', () => {
      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
      };
      const result = filterTransactionsForReport(txs, filter);
      expect(result).toHaveLength(2); // Tx 1 and 3
    });

    it('should filter by category', () => {
      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        categoryId: 'c2',
      };
      const result = filterTransactionsForReport(txs, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });

  describe('exportReportToCsv', () => {
    it('should generate valid CSV', () => {
      const summary = [
        {
          categoryId: 'c1',
          categoryName: 'Food',
          totalAmount: 300,
          transactionCount: 2,
          isIncome: true,
        },
        {
          categoryId: 'c2',
          categoryName: 'Rent',
          totalAmount: 500,
          transactionCount: 1,
          isIncome: true,
        },
      ];

      const csv = exportReportToCsv(summary);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Category,TotalAmount,TransactionCount');
      expect(lines[1]).toBe('Food,300,2');
      expect(lines[2]).toBe('Rent,500,1');
    });
  });

  describe('generateCategoryReport - edge cases', () => {
    it('should handle transactions with empty lines as uncategorized', () => {
      const txs = [mockTx('1', 100, '2023-01-01', '', false, [])];

      const result = generateCategoryReport(txs, categories);

      const uncategorized = result.find((r) => r.categoryId === 'uncategorized');
      expect(uncategorized?.totalAmount).toBe(100);
      expect(uncategorized?.categoryName).toBe('Uncategorized');
    });

    it('should handle unknown category IDs', () => {
      const txs = [mockTx('1', 100, '2023-01-01', 'unknown-cat')];

      const result = generateCategoryReport(txs, categories);

      const unknown = result.find((r) => r.categoryId === 'unknown-cat');
      expect(unknown?.categoryName).toBe('Unknown Category');
    });

    it('should mark negative amounts as expenses (isIncome=false)', () => {
      const txs = [mockTx('1', -100, '2023-01-01', 'c1')];

      const result = generateCategoryReport(txs, categories);

      const food = result.find((r) => r.categoryId === 'c1');
      expect(food?.isIncome).toBe(false);
      expect(food?.totalAmount).toBe(-100);
    });
  });

  describe('filterTransactionsForReport - edge cases', () => {
    const txs = [
      mockTx('1', 100, '2023-01-01', 'c1'),
      mockTx('2', 100, '2023-02-01', 'c1'),
      mockTx('3', 100, '2023-01-15', '', false, []), // Empty lines
    ];

    it('should filter by account IDs', () => {
      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        accountIds: ['a1'],
      };
      const result = filterTransactionsForReport(txs, filter);
      expect(result).toHaveLength(3);
    });

    it('should exclude transactions without matching account ID', () => {
      const txWithDifferentAccount = {
        ...mockTx('4', 100, '2023-01-01', 'c1'),
        account_id: 'a2',
      };
      const allTxs = [...txs, txWithDifferentAccount];

      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        accountIds: ['a1'],
      };
      const result = filterTransactionsForReport(allTxs, filter);
      expect(result).toHaveLength(3);
      expect(result.find((t) => t.id === '4')).toBeUndefined();
    });

    it('should exclude transactions with empty lines when filtering by category', () => {
      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        categoryId: 'c1',
      };
      const result = filterTransactionsForReport(txs, filter);
      expect(result).toHaveLength(2); // Only tx1 and tx2, not tx3 with empty lines
    });

    it('should handle split transactions when filtering by category', () => {
      const splitTx = mockTx('4', 100, '2023-01-01', '', true, [
        { category_id: 'c1', amount: 60 },
        { category_id: 'c2', amount: 40 },
      ]);
      const allTxs = [...txs, splitTx];

      const filter: ReportFilter = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        categoryId: 'c2',
      };
      const result = filterTransactionsForReport(allTxs, filter);
      expect(result.find((t) => t.id === '4')).toBeDefined(); // Split tx has c2
    });
  });
});
