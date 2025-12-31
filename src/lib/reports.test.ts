import {
  generateCategoryReport,
  filterTransactionsForReport,
  exportReportToCsv,
  generateTaxLineReport,
  exportTaxReportToCsv,
  generateCpaExport,
  exportCpaExportToCsv,
  generateQuarterlyReport,
  exportQuarterlyReportToCsv,
  QuarterlySummary,
  getCategoryFullName,
  generateYearComparison,
  exportYearComparisonToCsv,
} from './reports';
import { Transaction, Category, Account, Payee } from '../types/database';
import { ReportFilter } from '../types/reconcile';

describe('Reporting Logic', () => {
  const mockTx = (
    id: string,
    amount: number,
    date: string,
    categoryId: string,
    isSplit = false,
    lines: { category_id: string; amount: number; memo?: string }[] = []
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

  describe('generateTaxLineReport', () => {
    const categoriesWithTaxLines: Category[] = [
      {
        id: 'cat1',
        name: 'Advertising',
        tax_line_item: 'Schedule C Line 8',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: true,
        parent_category_id: null,
      },
      {
        id: 'cat2',
        name: 'Office Supplies',
        tax_line_item: 'Schedule C Line 18',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: true,
        parent_category_id: null,
      },
      {
        id: 'cat3',
        name: 'Uncategorized',
        tax_line_item: null,
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: false,
        parent_category_id: null,
      },
    ];

    it('should group transactions by tax_line_item', () => {
      const txs = [
        mockTx('1', -5000, '2023-01-01', 'cat1'),
        mockTx('2', -3000, '2023-01-02', 'cat1'),
        mockTx('3', -2000, '2023-01-03', 'cat2'),
        mockTx('4', -1000, '2023-01-04', 'cat3'), // Should be excluded (no tax line)
      ];

      const result = generateTaxLineReport(txs, categoriesWithTaxLines);

      expect(result).toHaveLength(2); // Only cat1 and cat2 have tax lines
      expect(result[0]).toMatchObject({
        taxLineItem: 'Schedule C Line 18',
        totalAmount: -2000,
        transactionCount: 1,
        categoryNames: ['Office Supplies'],
      });
      expect(result[1]).toMatchObject({
        taxLineItem: 'Schedule C Line 8',
        totalAmount: -8000,
        transactionCount: 2,
        categoryNames: ['Advertising'],
      });
    });

    it('should handle split transactions', () => {
      const categoriesForSplit: Category[] = [
        {
          id: 'cat1',
          name: 'Advertising',
          tax_line_item: 'Schedule C Line 8',
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: true,
          parent_category_id: null,
        },
        {
          id: 'cat2',
          name: 'Meals',
          tax_line_item: 'Schedule C Line 24b',
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: true,
          parent_category_id: null,
        },
      ];

      const txs = [
        mockTx('1', -10000, '2023-01-01', '', true, [
          { category_id: 'cat1', amount: -6000 },
          { category_id: 'cat2', amount: -4000 },
        ]),
      ];

      const result = generateTaxLineReport(txs, categoriesForSplit);

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.taxLineItem === 'Schedule C Line 8')).toMatchObject({
        totalAmount: -6000,
        transactionCount: 1,
        categoryNames: ['Advertising'],
      });
      expect(result.find((r) => r.taxLineItem === 'Schedule C Line 24b')).toMatchObject({
        totalAmount: -4000,
        transactionCount: 1,
        categoryNames: ['Meals'],
      });
    });

    it('should group multiple categories with the same tax line', () => {
      const multiCategoryTaxLine: Category[] = [
        {
          id: 'cat1',
          name: 'Facebook Ads',
          tax_line_item: 'Schedule C Line 8',
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: true,
          parent_category_id: null,
        },
        {
          id: 'cat2',
          name: 'Google Ads',
          tax_line_item: 'Schedule C Line 8',
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: true,
          parent_category_id: null,
        },
      ];

      const txs = [
        mockTx('1', -5000, '2023-01-01', 'cat1'),
        mockTx('2', -3000, '2023-01-02', 'cat2'),
      ];

      const result = generateTaxLineReport(txs, multiCategoryTaxLine);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        taxLineItem: 'Schedule C Line 8',
        totalAmount: -8000,
        transactionCount: 2,
      });
      expect(result[0].categoryNames).toEqual(['Facebook Ads', 'Google Ads']);
    });

    it('should handle income transactions', () => {
      const incomeCategory: Category[] = [
        {
          id: 'cat1',
          name: 'Sales Revenue',
          tax_line_item: 'Schedule C Line 1',
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: false,
          parent_category_id: null,
        },
      ];

      const txs = [mockTx('1', 10000, '2023-01-01', 'cat1')];

      const result = generateTaxLineReport(txs, incomeCategory);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        taxLineItem: 'Schedule C Line 1',
        totalAmount: 10000,
        transactionCount: 1,
        isIncome: true,
      });
    });

    it('should return empty array when no categories have tax lines', () => {
      const noTaxLineCategories: Category[] = [
        {
          id: 'cat1',
          name: 'Misc',
          tax_line_item: null,
          bookset_id: 'b1',
          is_archived: false,
          sort_order: 0,
          created_at: '',
          updated_at: '',
          created_by: '',
          last_modified_by: '',
          is_tax_deductible: false,
          parent_category_id: null,
        },
      ];

      const txs = [mockTx('1', -1000, '2023-01-01', 'cat1')];

      const result = generateTaxLineReport(txs, noTaxLineCategories);

      expect(result).toHaveLength(0);
    });

    it('should skip transactions with no lines', () => {
      const txs = [mockTx('1', -1000, '2023-01-01', '', false, [])];

      const result = generateTaxLineReport(txs, categoriesWithTaxLines);

      expect(result).toHaveLength(0);
    });
  });

  describe('exportTaxReportToCsv', () => {
    it('should export tax report to CSV with proper formatting', () => {
      const summary = [
        {
          taxLineItem: 'Schedule C Line 8',
          totalAmount: -8000,
          transactionCount: 2,
          isIncome: false,
          categoryNames: ['Advertising', 'Marketing'],
        },
        {
          taxLineItem: 'Schedule C Line 18',
          totalAmount: -2500,
          transactionCount: 1,
          isIncome: false,
          categoryNames: ['Office Supplies'],
        },
      ];

      const csv = exportTaxReportToCsv(summary);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Tax Line Item,Total Amount,Transaction Count,Categories');
      expect(lines[1]).toBe('"Schedule C Line 8",-80.00,2,"Advertising; Marketing"');
      expect(lines[2]).toBe('"Schedule C Line 18",-25.00,1,"Office Supplies"');
    });

    it('should handle amounts with proper decimal formatting', () => {
      const summary = [
        {
          taxLineItem: 'Schedule C Line 1',
          totalAmount: 125050, // $1,250.50
          transactionCount: 5,
          isIncome: true,
          categoryNames: ['Sales'],
        },
      ];

      const csv = exportTaxReportToCsv(summary);
      const lines = csv.split('\n');

      expect(lines[1]).toBe('"Schedule C Line 1",1250.50,5,"Sales"');
    });

    it('should handle empty category names', () => {
      const summary = [
        {
          taxLineItem: 'Schedule C Line 8',
          totalAmount: -1000,
          transactionCount: 1,
          isIncome: false,
          categoryNames: [],
        },
      ];

      const csv = exportTaxReportToCsv(summary);
      const lines = csv.split('\n');

      expect(lines[1]).toBe('"Schedule C Line 8",-10.00,1,""');
    });
  });

  describe('generateCpaExport', () => {
    const accounts: Account[] = [
      {
        id: 'acc1',
        name: 'Business Checking',
        bookset_id: 'b1',
        type: 'Asset',
        opening_balance: 0,
        opening_balance_date: '2023-01-01',
        last_reconciled_date: null,
        last_reconciled_balance: 0,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        is_archived: false,
        created_by: 'u1',
        last_modified_by: 'u1',
      },
    ];

    const payees: Payee[] = [
      {
        id: 'payee1',
        name: 'Starbucks',
        bookset_id: 'b1',
        default_category_id: null,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        created_by: 'u1',
        last_modified_by: 'u1',
      },
      {
        id: 'payee2',
        name: 'Amazon',
        bookset_id: 'b1',
        default_category_id: null,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        created_by: 'u1',
        last_modified_by: 'u1',
      },
    ];

    const categoriesWithTax: Category[] = [
      {
        id: 'cat1',
        name: 'Meals',
        tax_line_item: 'Schedule C Line 24b',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: true,
        parent_category_id: null,
      },
      {
        id: 'cat2',
        name: 'Office Supplies',
        tax_line_item: 'Schedule C Line 18',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: true,
        parent_category_id: null,
      },
      {
        id: 'cat3',
        name: 'Software',
        tax_line_item: 'Schedule C Line 18',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        is_tax_deductible: true,
        parent_category_id: null,
      },
    ];

    it('should export simple transaction', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'cat1'),
          account_id: 'acc1',
          original_description: 'Coffee Shop',
          payee: null,
          payee_id: 'payee1',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2024-01-15',
        accountName: 'Business Checking',
        payeeName: 'Starbucks',
        description: 'Coffee Shop',
        categoryName: 'Meals',
        taxLineItem: 'Schedule C Line 24b',
        amount: '-50.00',
        memo: '',
      });
    });

    it('should flatten split transactions', () => {
      const transactions = [
        {
          ...mockTx('1', -10000, '2024-01-15', '', true, [
            { category_id: 'cat2', amount: -6000, memo: 'Office supplies' },
            { category_id: 'cat3', amount: -4000, memo: 'Software' },
          ]),
          account_id: 'acc1',
          original_description: 'Amazon Purchase',
          payee: null,
          payee_id: 'payee2',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        categoryName: 'Office Supplies',
        amount: '-60.00',
        memo: 'Office supplies',
      });
      expect(result[1]).toMatchObject({
        categoryName: 'Software',
        amount: '-40.00',
        memo: 'Software',
      });
    });

    it('should handle uncategorized transactions', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', '', false, []),
          account_id: 'acc1',
          original_description: 'Unknown Charge',
          payee: 'Unknown',
          payee_id: null,
        },
      ];

      const result = generateCpaExport(transactions, [], [], []);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        categoryName: 'Uncategorized',
        taxLineItem: '',
        payeeName: 'Unknown',
        amount: '-50.00',
      });
    });

    it('should use payee_id over legacy payee field', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'cat1'),
          account_id: 'acc1',
          original_description: 'Coffee',
          payee: 'Legacy Payee Name',
          payee_id: 'payee1',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].payeeName).toBe('Starbucks'); // From payee_id, not legacy field
    });

    it('should fall back to legacy payee field when payee_id is null', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'cat1'),
          account_id: 'acc1',
          original_description: 'Coffee',
          payee: 'Legacy Payee',
          payee_id: null,
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].payeeName).toBe('Legacy Payee');
    });

    it('should handle unknown account gracefully', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'cat1'),
          account_id: 'unknown-account',
          payee_id: 'payee1',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].accountName).toBe('Unknown Account');
    });

    it('should handle unknown category gracefully', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'unknown-cat'),
          account_id: 'acc1',
          payee_id: 'payee1',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].categoryName).toBe('Uncategorized');
      expect(result[0].taxLineItem).toBe('');
    });

    it('should handle missing payee_id and payee gracefully', () => {
      const transactions = [
        {
          ...mockTx('1', -5000, '2024-01-15', 'cat1'),
          account_id: 'acc1',
          payee: null,
          payee_id: null,
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].payeeName).toBe('');
    });

    it('should format positive amounts correctly', () => {
      const transactions = [
        {
          ...mockTx('1', 10000, '2024-01-15', 'cat1'),
          account_id: 'acc1',
          payee_id: 'payee1',
        },
      ];

      const result = generateCpaExport(transactions, categoriesWithTax, accounts, payees);

      expect(result[0].amount).toBe('100.00');
    });
  });

  describe('exportCpaExportToCsv', () => {
    it('should export CPA data to CSV with proper formatting', () => {
      const rows = [
        {
          date: '2024-01-15',
          accountName: 'Business Checking',
          payeeName: 'Starbucks',
          description: 'Coffee Shop',
          categoryName: 'Meals',
          taxLineItem: 'Schedule C Line 24b',
          amount: '-50.00',
          memo: '',
        },
        {
          date: '2024-01-16',
          accountName: 'Business Checking',
          payeeName: 'Amazon',
          description: 'Office supplies',
          categoryName: 'Office Supplies',
          taxLineItem: 'Schedule C Line 18',
          amount: '-60.00',
          memo: 'Paper and pens',
        },
      ];

      const csv = exportCpaExportToCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Date,Account,Payee,Description,Category,Tax Line,Amount,Memo');
      expect(lines[1]).toBe(
        '2024-01-15,Business Checking,Starbucks,Coffee Shop,Meals,Schedule C Line 24b,-50.00,'
      );
      expect(lines[2]).toBe(
        '2024-01-16,Business Checking,Amazon,Office supplies,Office Supplies,Schedule C Line 18,-60.00,Paper and pens'
      );
    });

    it('should escape CSV special characters', () => {
      const rows = [
        {
          date: '2024-01-15',
          accountName: 'Checking',
          payeeName: 'Smith, John',
          description: 'He said "hello"',
          categoryName: 'Meals',
          taxLineItem: 'Schedule C Line 24b',
          amount: '-50.00',
          memo: 'Line 1\nLine 2',
        },
      ];

      const csv = exportCpaExportToCsv(rows);

      // Should properly escape comma in payee, quotes in description, and newline in memo
      expect(csv).toContain('"Smith, John"');
      expect(csv).toContain('"He said ""hello"""');
      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('should handle empty values', () => {
      const rows = [
        {
          date: '2024-01-15',
          accountName: 'Checking',
          payeeName: '',
          description: 'Unknown',
          categoryName: 'Uncategorized',
          taxLineItem: '',
          amount: '-50.00',
          memo: '',
        },
      ];

      const csv = exportCpaExportToCsv(rows);
      const lines = csv.split('\n');

      expect(lines[1]).toBe('2024-01-15,Checking,,Unknown,Uncategorized,,-50.00,');
    });
  });

  describe('generateQuarterlyReport', () => {
    // Helper to create mock transaction for quarterly tests
    const mockQuarterlyTx = (id: string, date: string, amount: number): Transaction => ({
      id,
      bookset_id: 'test-bookset',
      account_id: 'test-account',
      date, // ISO format: "2024-01-15"
      amount, // In cents
      payee_id: null,
      payee: null,
      original_description: 'Test',
      is_split: false,
      is_reviewed: false,
      is_archived: false,
      reconciled: false,
      lines: [{ category_id: 'test-cat', amount, memo: '' }], // Must have at least one line
      created_by: 'user',
      last_modified_by: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_batch_id: null,
      fingerprint: 'fp',
      import_date: '2024-01-01',
    });

    it('should correctly assign transactions to quarters', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000), // Q1 income
        mockQuarterlyTx('2', '2024-02-01', -5000), // Q1 expense
        mockQuarterlyTx('3', '2024-04-10', 20000), // Q2 income
        mockQuarterlyTx('4', '2024-07-01', 15000), // Q3 income
        mockQuarterlyTx('5', '2024-10-31', -8000), // Q4 expense
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        quarter: 1,
        year: 2024,
        totalIncome: 10000,
        totalExpenses: 5000,
        transactionCount: 2,
      });
      expect(result[1]).toMatchObject({
        quarter: 2,
        totalIncome: 20000,
        totalExpenses: 0,
        transactionCount: 1,
      });
      expect(result[2]).toMatchObject({
        quarter: 3,
        totalIncome: 15000,
        totalExpenses: 0,
        transactionCount: 1,
      });
      expect(result[3]).toMatchObject({
        quarter: 4,
        totalIncome: 0,
        totalExpenses: 8000,
        transactionCount: 1,
      });
    });

    it('should calculate net income correctly', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000), // $100 income
        mockQuarterlyTx('2', '2024-01-20', -3000), // $30 expense
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].netIncome).toBe(7000); // $70 net
    });

    it('should calculate estimated tax at specified rate', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000), // $100 income
        mockQuarterlyTx('2', '2024-01-20', -3000), // $30 expense
      ];

      const result = generateQuarterlyReport(transactions, 0.3); // 30% rate

      expect(result[0].netIncome).toBe(7000); // $70 net
      expect(result[0].estimatedTax).toBe(2100); // $70 * 0.30 = $21
    });

    it('should clamp negative tax to zero (net loss)', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 5000), // $50 income
        mockQuarterlyTx('2', '2024-01-20', -8000), // $80 expense
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].netIncome).toBe(-3000); // -$30 net (loss)
      expect(result[0].estimatedTax).toBe(0); // No tax on loss
    });

    it('should handle empty quarters gracefully', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000), // Only Q1
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result).toHaveLength(4);
      expect(result[0].transactionCount).toBe(1);
      expect(result[1].transactionCount).toBe(0);
      expect(result[2].transactionCount).toBe(0);
      expect(result[3].transactionCount).toBe(0);

      expect(result[1].totalIncome).toBe(0);
      expect(result[1].totalExpenses).toBe(0);
      expect(result[1].netIncome).toBe(0);
      expect(result[1].estimatedTax).toBe(0);
    });

    it('should skip transactions without lines', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000),
        {
          ...mockQuarterlyTx('2', '2024-01-20', 5000),
          lines: [], // No lines (uncategorized)
        },
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].transactionCount).toBe(1); // Only first transaction counted
      expect(result[0].totalIncome).toBe(10000);
    });

    it('should handle transactions on quarter boundaries', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-03-31', 10000), // Last day of Q1
        mockQuarterlyTx('2', '2024-04-01', 20000), // First day of Q2
        mockQuarterlyTx('3', '2024-06-30', 15000), // Last day of Q2
        mockQuarterlyTx('4', '2024-07-01', 5000), // First day of Q3
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].totalIncome).toBe(10000); // Q1: March 31
      expect(result[1].totalIncome).toBe(35000); // Q2: April 1 + June 30
      expect(result[2].totalIncome).toBe(5000); // Q3: July 1
    });

    it('should count income and expense transactions separately', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-05', 10000), // Income
        mockQuarterlyTx('2', '2024-01-10', 8000), // Income
        mockQuarterlyTx('3', '2024-01-15', -3000), // Expense
        mockQuarterlyTx('4', '2024-01-20', -2000), // Expense
        mockQuarterlyTx('5', '2024-01-25', -1000), // Expense
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].transactionCount).toBe(5);
      expect(result[0].incomeTransactionCount).toBe(2);
      expect(result[0].expenseTransactionCount).toBe(3);
    });

    it('should skip zero-amount transactions', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000), // Income
        mockQuarterlyTx('2', '2024-01-20', 0), // Zero (transfer?)
        mockQuarterlyTx('3', '2024-01-25', -5000), // Expense
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].transactionCount).toBe(3); // All counted
      expect(result[0].incomeTransactionCount).toBe(1);
      expect(result[0].expenseTransactionCount).toBe(1);
      expect(result[0].totalIncome).toBe(10000);
      expect(result[0].totalExpenses).toBe(5000);
    });

    it('should generate correct quarter labels and date ranges', () => {
      const transactions = [
        mockQuarterlyTx('1', '2024-01-15', 10000),
        mockQuarterlyTx('2', '2024-04-15', 10000),
        mockQuarterlyTx('3', '2024-07-15', 10000),
        mockQuarterlyTx('4', '2024-10-15', 10000),
      ];

      const result = generateQuarterlyReport(transactions, 0.25);

      expect(result[0].quarterLabel).toBe('Q1 2024');
      expect(result[0].dateRange).toBe('Jan 1 - Mar 31, 2024');

      expect(result[1].quarterLabel).toBe('Q2 2024');
      expect(result[1].dateRange).toBe('Apr 1 - Jun 30, 2024');

      expect(result[2].quarterLabel).toBe('Q3 2024');
      expect(result[2].dateRange).toBe('Jul 1 - Sep 30, 2024');

      expect(result[3].quarterLabel).toBe('Q4 2024');
      expect(result[3].dateRange).toBe('Oct 1 - Dec 31, 2024');
    });

    it('should handle different tax rates', () => {
      const transactions = [mockQuarterlyTx('1', '2024-01-15', 10000)]; // $100 income

      const result10 = generateQuarterlyReport(transactions, 0.1); // 10%
      const result25 = generateQuarterlyReport(transactions, 0.25); // 25%
      const result40 = generateQuarterlyReport(transactions, 0.4); // 40%

      expect(result10[0].estimatedTax).toBe(1000); // $10
      expect(result25[0].estimatedTax).toBe(2500); // $25
      expect(result40[0].estimatedTax).toBe(4000); // $40
    });

    it('should use default tax rate of 25% when not specified', () => {
      const transactions = [mockQuarterlyTx('1', '2024-01-15', 10000)]; // $100 income

      const result = generateQuarterlyReport(transactions); // No rate specified

      expect(result[0].estimatedTax).toBe(2500); // $100 * 0.25 = $25
    });
  });

  describe('exportQuarterlyReportToCsv', () => {
    it('should export quarterly data to CSV format', () => {
      const summary: QuarterlySummary[] = [
        {
          quarter: 1,
          year: 2024,
          quarterLabel: 'Q1 2024',
          dateRange: 'Jan 1 - Mar 31, 2024',
          totalIncome: 10000,
          totalExpenses: 3000,
          netIncome: 7000,
          estimatedTax: 1750,
          transactionCount: 5,
          incomeTransactionCount: 3,
          expenseTransactionCount: 2,
        },
        {
          quarter: 2,
          year: 2024,
          quarterLabel: 'Q2 2024',
          dateRange: 'Apr 1 - Jun 30, 2024',
          totalIncome: 15000,
          totalExpenses: 5000,
          netIncome: 10000,
          estimatedTax: 2500,
          transactionCount: 8,
          incomeTransactionCount: 5,
          expenseTransactionCount: 3,
        },
      ];

      const csv = exportQuarterlyReportToCsv(summary);

      expect(csv).toContain(
        'Quarter,Date Range,Total Income,Total Expenses,Net Income,Estimated Tax,Transaction Count'
      );
      expect(csv).toContain('"Q1 2024","Jan 1 - Mar 31, 2024",100.00,30.00,70.00,17.50,5');
      expect(csv).toContain('"Q2 2024","Apr 1 - Jun 30, 2024",150.00,50.00,100.00,25.00,8');
    });

    it('should format amounts as decimals with two places', () => {
      const summary: QuarterlySummary[] = [
        {
          quarter: 1,
          year: 2024,
          quarterLabel: 'Q1 2024',
          dateRange: 'Jan 1 - Mar 31, 2024',
          totalIncome: 12345, // $123.45
          totalExpenses: 6789, // $67.89
          netIncome: 5556, // $55.56
          estimatedTax: 1389, // $13.89
          transactionCount: 10,
          incomeTransactionCount: 6,
          expenseTransactionCount: 4,
        },
      ];

      const csv = exportQuarterlyReportToCsv(summary);

      expect(csv).toContain('123.45,67.89,55.56,13.89');
    });

    it('should handle negative net income', () => {
      const summary: QuarterlySummary[] = [
        {
          quarter: 1,
          year: 2024,
          quarterLabel: 'Q1 2024',
          dateRange: 'Jan 1 - Mar 31, 2024',
          totalIncome: 5000,
          totalExpenses: 8000,
          netIncome: -3000, // Loss
          estimatedTax: 0, // Clamped to 0
          transactionCount: 5,
          incomeTransactionCount: 2,
          expenseTransactionCount: 3,
        },
      ];

      const csv = exportQuarterlyReportToCsv(summary);

      expect(csv).toContain('50.00,80.00,-30.00,0.00,5');
    });
  });

  describe('getCategoryFullName', () => {
    it('should return category name when no parent', () => {
      const category: Category = {
        id: 'c1',
        name: 'Expenses',
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
      };

      const result = getCategoryFullName(category, [category]);

      expect(result).toBe('Expenses');
    });

    it('should return parent:child format when parent exists', () => {
      const parent: Category = {
        id: 'c1',
        name: 'Business',
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
      };

      const child: Category = {
        id: 'c2',
        name: 'Travel',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        tax_line_item: null,
        is_tax_deductible: false,
        parent_category_id: 'c1',
      };

      const result = getCategoryFullName(child, [parent, child]);

      expect(result).toBe('Business: Travel');
    });

    it('should return child name when parent not found in list', () => {
      const child: Category = {
        id: 'c2',
        name: 'Travel',
        bookset_id: 'b1',
        is_archived: false,
        sort_order: 0,
        created_at: '',
        updated_at: '',
        created_by: '',
        last_modified_by: '',
        tax_line_item: null,
        is_tax_deductible: false,
        parent_category_id: 'c1',
      };

      const result = getCategoryFullName(child, [child]);

      expect(result).toBe('Travel');
    });
  });

  describe('generateYearComparison', () => {
    it('should compare transactions between two periods', () => {
      const currentTxs = [
        mockTx('1', 10000, '2024-01-15', 'c1'), // $100 Food
        mockTx('2', 20000, '2024-02-20', 'c2'), // $200 Rent
      ];

      const compareTxs = [
        mockTx('3', 5000, '2023-01-15', 'c1'), // $50 Food
        mockTx('4', 20000, '2023-02-20', 'c2'), // $200 Rent
      ];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result).toHaveLength(2);

      // Food comparison
      const foodRow = result.find((r) => r.categoryId === 'c1');
      expect(foodRow).toBeDefined();
      expect(foodRow?.currentAmount).toBe(10000);
      expect(foodRow?.compareAmount).toBe(5000);
      expect(foodRow?.varianceAmount).toBe(5000);
      expect(foodRow?.variancePercent).toBe(100); // (5000 / 5000) * 100

      // Rent comparison
      const rentRow = result.find((r) => r.categoryId === 'c2');
      expect(rentRow).toBeDefined();
      expect(rentRow?.currentAmount).toBe(20000);
      expect(rentRow?.compareAmount).toBe(20000);
      expect(rentRow?.varianceAmount).toBe(0);
      expect(rentRow?.variancePercent).toBe(0);
    });

    it('should handle new categories in current period', () => {
      const currentTxs = [mockTx('1', 10000, '2024-01-15', 'c1')];
      const compareTxs: Transaction[] = [];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result).toHaveLength(1);
      expect(result[0].currentAmount).toBe(10000);
      expect(result[0].compareAmount).toBe(0);
      expect(result[0].variancePercent).toBe(100); // New category = 100%
    });

    it('should handle categories only in comparison period', () => {
      const currentTxs: Transaction[] = [];
      const compareTxs = [mockTx('1', 10000, '2023-01-15', 'c1')];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result).toHaveLength(1);
      expect(result[0].currentAmount).toBe(0);
      expect(result[0].compareAmount).toBe(10000);
      expect(result[0].varianceAmount).toBe(-10000);
      expect(result[0].variancePercent).toBe(-100);
    });

    it('should calculate negative variance correctly', () => {
      const currentTxs = [mockTx('1', 5000, '2024-01-15', 'c1')]; // $50
      const compareTxs = [mockTx('2', 15000, '2023-01-15', 'c1')]; // $150

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result[0].varianceAmount).toBe(-10000);
      expect(result[0].variancePercent).toBeCloseTo(-66.67, 1);
    });

    it('should handle zero amounts in both periods', () => {
      const currentTxs: Transaction[] = [];
      const compareTxs: Transaction[] = [];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result).toHaveLength(0);
    });

    it('should sort results alphabetically by category name', () => {
      const currentTxs = [
        mockTx('1', 10000, '2024-01-15', 'c2'), // Rent
        mockTx('2', 20000, '2024-02-20', 'c1'), // Food
      ];
      const compareTxs = [
        mockTx('3', 5000, '2023-01-15', 'c2'),
        mockTx('4', 15000, '2023-02-20', 'c1'),
      ];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result[0].categoryName).toBe('Food');
      expect(result[1].categoryName).toBe('Rent');
    });

    it('should include transaction counts', () => {
      const currentTxs = [
        mockTx('1', 10000, '2024-01-15', 'c1'),
        mockTx('2', 5000, '2024-02-20', 'c1'),
        mockTx('3', 8000, '2024-03-10', 'c1'),
      ];
      const compareTxs = [
        mockTx('4', 12000, '2023-01-15', 'c1'),
        mockTx('5', 9000, '2023-02-20', 'c1'),
      ];

      const result = generateYearComparison(currentTxs, compareTxs, categories);

      expect(result[0].currentTransactionCount).toBe(3);
      expect(result[0].compareTransactionCount).toBe(2);
    });
  });

  describe('exportYearComparisonToCsv', () => {
    it('should export year comparison to CSV format', () => {
      const summary = [
        {
          categoryId: 'c1',
          categoryName: 'Food',
          currentAmount: 10000,
          compareAmount: 8000,
          varianceAmount: 2000,
          variancePercent: 25,
          currentTransactionCount: 5,
          compareTransactionCount: 4,
          isIncome: false,
        },
        {
          categoryId: 'c2',
          categoryName: 'Rent',
          currentAmount: 20000,
          compareAmount: 20000,
          varianceAmount: 0,
          variancePercent: 0,
          currentTransactionCount: 2,
          compareTransactionCount: 2,
          isIncome: false,
        },
      ];

      const csv = exportYearComparisonToCsv(summary, '2024', '2023');

      expect(csv).toContain('Category,2024,2023,Variance $,Variance %,2024 Txns,2023 Txns');
      expect(csv).toContain('"Food",100.00,80.00,20.00,25.0%,5,4');
      expect(csv).toContain('"Rent",200.00,200.00,0.00,0.0%,2,2');
    });

    it('should handle negative variance', () => {
      const summary = [
        {
          categoryId: 'c1',
          categoryName: 'Travel',
          currentAmount: 5000,
          compareAmount: 10000,
          varianceAmount: -5000,
          variancePercent: -50,
          currentTransactionCount: 2,
          compareTransactionCount: 5,
          isIncome: false,
        },
      ];

      const csv = exportYearComparisonToCsv(summary, '2024', '2023');

      expect(csv).toContain('"Travel",50.00,100.00,-50.00,-50.0%,2,5');
    });

    it('should quote category names with commas', () => {
      const summary = [
        {
          categoryId: 'c1',
          categoryName: 'Business: Travel, Meals',
          currentAmount: 10000,
          compareAmount: 8000,
          varianceAmount: 2000,
          variancePercent: 25,
          currentTransactionCount: 3,
          compareTransactionCount: 2,
          isIncome: false,
        },
      ];

      const csv = exportYearComparisonToCsv(summary, '2024', '2023');

      expect(csv).toContain('"Business: Travel, Meals",100.00,80.00,20.00,25.0%,3,2');
    });
  });
});
