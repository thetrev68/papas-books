import { describe, it, expect, vi } from 'vitest';
import {
  exportTransactionsToCsv,
  exportAccountsToCsv,
  exportCategoriesToCsv,
  exportPayeesToCsv,
  exportRulesToCsv,
  exportTaxYearLocksToCsv,
  exportAccessGrantsToCsv,
  downloadCsv,
} from './tableExports';
import type { Transaction, Account, Category, Payee, Rule, TaxYearLock } from '../types/database';
import type { AccessGrant } from '../types/access';

describe('tableExports', () => {
  describe('downloadCsv', () => {
    it('should create a blob and trigger download', () => {
      // Create a real anchor element to use in the test
      const mockLink = document.createElement('a');
      mockLink.click = vi.fn();

      // Spy on document.createElement to return our mock link
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => mockLink);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => mockLink);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      downloadCsv('test,csv,content', 'test.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.download).toBe('test.csv');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Restore mocks
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('exportTransactionsToCsv', () => {
    it('should export simple transactions correctly', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          bookset_id: 'bs1',
          account_id: 'acc1',
          date: '2024-01-15',
          amount: -1500,
          payee: null,
          payee_id: 'payee1',
          original_description: 'Coffee Shop',
          fingerprint: 'fp1',
          source_batch_id: null,
          import_date: '2024-01-16',
          is_reviewed: true,
          is_split: false,
          reconciled: false,
          is_archived: false,
          lines: [{ category_id: 'cat1', amount: -1500 }],
          created_at: '2024-01-16',
          updated_at: '2024-01-16',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const accounts: Account[] = [
        {
          id: 'acc1',
          bookset_id: 'bs1',
          name: 'Checking',
          type: 'Asset',
          opening_balance: 100000,
          opening_balance_date: '2024-01-01',
          last_reconciled_date: null,
          last_reconciled_balance: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const categories: Category[] = [
        {
          id: 'cat1',
          bookset_id: 'bs1',
          name: 'Food',
          tax_line_item: null,
          is_tax_deductible: false,
          parent_category_id: null,
          sort_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const payees: Payee[] = [
        {
          id: 'payee1',
          bookset_id: 'bs1',
          name: 'Starbucks',
          default_category_id: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportTransactionsToCsv(transactions, accounts, categories, payees);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Account');
      expect(lines[0]).toContain('Category');
      expect(lines[1]).toContain('2024-01-15');
      expect(lines[1]).toContain('Checking');
      expect(lines[1]).toContain('Starbucks');
      expect(lines[1]).toContain('Food');
      expect(lines[1]).toContain('-15.00');
      expect(lines[1]).toContain('Yes'); // reviewed
      expect(lines[1]).toContain('No'); // reconciled
    });

    it('should handle split transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          bookset_id: 'bs1',
          account_id: 'acc1',
          date: '2024-01-15',
          amount: -10000,
          payee: null,
          payee_id: null,
          original_description: 'Target',
          fingerprint: 'fp1',
          source_batch_id: null,
          import_date: '2024-01-16',
          is_reviewed: false,
          is_split: true,
          reconciled: false,
          is_archived: false,
          lines: [
            { category_id: 'cat1', amount: -5000, memo: 'Groceries' },
            { category_id: 'cat2', amount: -5000, memo: 'Household' },
          ],
          created_at: '2024-01-16',
          updated_at: '2024-01-16',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const accounts: Account[] = [
        {
          id: 'acc1',
          bookset_id: 'bs1',
          name: 'Credit Card',
          type: 'Liability',
          opening_balance: 0,
          opening_balance_date: '2024-01-01',
          last_reconciled_date: null,
          last_reconciled_balance: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const categories: Category[] = [
        {
          id: 'cat1',
          bookset_id: 'bs1',
          name: 'Groceries',
          tax_line_item: null,
          is_tax_deductible: false,
          parent_category_id: null,
          sort_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
        {
          id: 'cat2',
          bookset_id: 'bs1',
          name: 'Household',
          tax_line_item: null,
          is_tax_deductible: false,
          parent_category_id: null,
          sort_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportTransactionsToCsv(transactions, accounts, categories, []);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('Split Transaction');
      expect(lines[1]).toContain('Groceries: $-50.00 (Groceries)');
      expect(lines[1]).toContain('Household: $-50.00 (Household)');
    });
  });

  describe('exportAccountsToCsv', () => {
    it('should export accounts correctly', () => {
      const accounts: Account[] = [
        {
          id: 'acc1',
          bookset_id: 'bs1',
          name: 'Checking Account',
          type: 'Asset',
          opening_balance: 500000,
          opening_balance_date: '2024-01-01',
          last_reconciled_date: '2024-02-01',
          last_reconciled_balance: 450000,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportAccountsToCsv(accounts);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Type');
      expect(lines[0]).toContain('Opening Balance');
      expect(lines[1]).toContain('Checking Account');
      expect(lines[1]).toContain('Asset');
      expect(lines[1]).toContain('5000.00');
      expect(lines[1]).toContain('2024-01-01');
      expect(lines[1]).toContain('2024-02-01');
      expect(lines[1]).toContain('4500.00');
      expect(lines[1]).toContain('Active');
    });

    it('should handle archived accounts', () => {
      const accounts: Account[] = [
        {
          id: 'acc1',
          bookset_id: 'bs1',
          name: 'Old Account',
          type: 'Liability',
          opening_balance: 0,
          opening_balance_date: '2024-01-01',
          last_reconciled_date: null,
          last_reconciled_balance: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: true,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportAccountsToCsv(accounts);
      expect(csv).toContain('Archived');
      expect(csv).toContain('-');
    });
  });

  describe('exportCategoriesToCsv', () => {
    it('should export categories with parent relationships', () => {
      const parent: Category = {
        id: 'cat1',
        bookset_id: 'bs1',
        name: 'Expenses',
        tax_line_item: null,
        is_tax_deductible: false,
        parent_category_id: null,
        sort_order: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_archived: false,
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const child: Category = {
        id: 'cat2',
        bookset_id: 'bs1',
        name: 'Food',
        tax_line_item: 'Schedule C - Line 8',
        is_tax_deductible: true,
        parent_category_id: 'cat1',
        sort_order: 2,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_archived: false,
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const categories = [parent, child];
      const categoriesMap = new Map(categories.map((c) => [c.id, c]));
      const csv = exportCategoriesToCsv(categories, categoriesMap);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Parent Category');
      expect(lines[0]).toContain('Tax Deductible');
      expect(lines[1]).toContain('Expenses');
      expect(lines[1]).toContain('-');
      expect(lines[2]).toContain('Food');
      expect(lines[2]).toContain('Expenses');
      expect(lines[2]).toContain('Yes');
      expect(lines[2]).toContain('Schedule C - Line 8');
    });
  });

  describe('exportPayeesToCsv', () => {
    it('should export payees with default categories', () => {
      const payees: Payee[] = [
        {
          id: 'payee1',
          bookset_id: 'bs1',
          name: 'Starbucks',
          default_category_id: 'cat1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const categories: Category[] = [
        {
          id: 'cat1',
          bookset_id: 'bs1',
          name: 'Coffee',
          tax_line_item: null,
          is_tax_deductible: false,
          parent_category_id: null,
          sort_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportPayeesToCsv(payees, categories);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Default Category');
      expect(lines[1]).toContain('Starbucks');
      expect(lines[1]).toContain('Coffee');
    });
  });

  describe('exportRulesToCsv', () => {
    it('should export rules with all fields', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          bookset_id: 'bs1',
          keyword: 'starbucks',
          match_type: 'contains',
          case_sensitive: false,
          target_category_id: 'cat1',
          payee_id: 'payee1',
          suggested_payee: null,
          priority: 10,
          is_enabled: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          last_used_at: '2024-01-15',
          use_count: 5,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const categories: Category[] = [
        {
          id: 'cat1',
          bookset_id: 'bs1',
          name: 'Coffee',
          tax_line_item: null,
          is_tax_deductible: false,
          parent_category_id: null,
          sort_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          is_archived: false,
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const payees: Payee[] = [
        {
          id: 'payee1',
          bookset_id: 'bs1',
          name: 'Starbucks',
          default_category_id: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const csv = exportRulesToCsv(rules, categories, payees);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Priority');
      expect(lines[0]).toContain('Keyword');
      expect(lines[0]).toContain('Match Type');
      expect(lines[1]).toContain('10');
      expect(lines[1]).toContain('starbucks');
      expect(lines[1]).toContain('contains');
      expect(lines[1]).toContain('Coffee');
      expect(lines[1]).toContain('Starbucks');
      expect(lines[1]).toContain('Yes');
      expect(lines[1]).toContain('5');
    });
  });

  describe('exportTaxYearLocksToCsv', () => {
    it('should export tax year locks with status', () => {
      const locks: TaxYearLock[] = [
        {
          id: 'lock1',
          bookset_id: 'bs1',
          tax_year: 2023,
          locked_at: '2024-01-01T12:00:00Z',
          locked_by: 'user1',
        },
      ];

      const userMap = new Map([['user1', 'John Doe']]);

      const csv = exportTaxYearLocksToCsv(locks, userMap, 2023);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Tax Year');
      expect(lines[0]).toContain('Status');
      expect(lines[0]).toContain('Locked By');
      expect(lines[1]).toContain('2023');
      expect(lines[1]).toContain('Locked');
      expect(lines[1]).toContain('John Doe');
    });

    it('should handle implicitly locked years', () => {
      const locks: TaxYearLock[] = [
        {
          id: 'lock1',
          bookset_id: 'bs1',
          tax_year: 2020,
          locked_at: '2021-01-01T12:00:00Z',
          locked_by: 'user1',
        },
      ];

      const userMap = new Map([['user1', 'John Doe']]);

      const csv = exportTaxYearLocksToCsv(locks, userMap, 2023);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('Locked by 2023');
    });
  });

  describe('exportAccessGrantsToCsv', () => {
    it('should export access grants', () => {
      const grants: AccessGrant[] = [
        {
          id: 'grant1',
          booksetId: 'bs1',
          userId: 'user2',
          role: 'editor',
          grantedBy: 'user1',
          createdAt: '2024-01-01T12:00:00Z',
          revokedAt: null,
        },
      ];

      const userMap = new Map([
        ['user1', 'John Doe'],
        ['user2', 'jane@example.com'],
      ]);

      const csv = exportAccessGrantsToCsv(grants, userMap);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('User');
      expect(lines[0]).toContain('Role');
      expect(lines[0]).toContain('Granted By');
      expect(lines[1]).toContain('jane@example.com');
      expect(lines[1]).toContain('Editor');
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('Active');
    });

    it('should handle revoked grants', () => {
      const grants: AccessGrant[] = [
        {
          id: 'grant1',
          booksetId: 'bs1',
          userId: 'user2',
          role: 'viewer',
          grantedBy: 'user1',
          createdAt: '2024-01-01T12:00:00Z',
          revokedAt: '2024-02-01T12:00:00Z',
        },
      ];

      const userMap = new Map([
        ['user1', 'admin@example.com'],
        ['user2', 'user@example.com'],
      ]);

      const csv = exportAccessGrantsToCsv(grants, userMap);
      expect(csv).toContain('Revoked');
      expect(csv).toContain('Viewer');
    });
  });
});
