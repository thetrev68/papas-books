import { describe, it, expect } from 'vitest';
import { filterTransactions, sortTransactions } from './workbenchDataManager';
import type { Transaction } from '../types/database';

describe('workbenchDataManager', () => {
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      bookset_id: 'bs1',
      account_id: 'acc1',
      date: '2024-01-03',
      payee: 'Starbucks',
      payee_id: null,
      original_description: 'POS PURCHASE STARBUCKS #123',
      amount: -500,
      is_split: false,
      lines: [{ category_id: 'cat1', amount: -500, memo: '' }],
      is_reviewed: true,
      reconciled: false,
      is_archived: false,
      source_batch_id: null,
      import_date: '2024-01-01T00:00:00Z',
      fingerprint: 'fp1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user1',
      last_modified_by: 'user1',
    },
    {
      id: '2',
      bookset_id: 'bs1',
      account_id: 'acc2',
      date: '2024-01-02',
      payee: 'Amazon',
      payee_id: null,
      original_description: 'AMAZON.COM PURCHASE',
      amount: -2500,
      is_split: false,
      lines: [{ category_id: 'cat2', amount: -2500, memo: '' }],
      is_reviewed: false,
      reconciled: false,
      is_archived: false,
      source_batch_id: null,
      import_date: '2024-01-01T00:00:00Z',
      fingerprint: 'fp2',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user1',
      last_modified_by: 'user1',
    },
    {
      id: '3',
      bookset_id: 'bs1',
      account_id: 'acc1',
      date: '2024-01-01',
      payee: 'Salary',
      payee_id: null,
      original_description: 'SALARY DEPOSIT',
      amount: 50000,
      is_split: false,
      lines: [{ category_id: 'cat3', amount: 50000, memo: '' }],
      is_reviewed: false,
      reconciled: false,
      is_archived: false,
      source_batch_id: null,
      import_date: '2024-01-01T00:00:00Z',
      fingerprint: 'fp3',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user1',
      last_modified_by: 'user1',
    },
  ];

  describe('filterTransactions', () => {
    it('filters by account ID', () => {
      const result = filterTransactions(mockTransactions, { accountId: 'acc1' });
      expect(result).toHaveLength(2);
      expect(result.every((tx) => tx.account_id === 'acc1')).toBe(true);
    });

    it('filters by reviewed status', () => {
      const result = filterTransactions(mockTransactions, { isReviewed: false });
      expect(result).toHaveLength(2);
      expect(result.every((tx) => !tx.is_reviewed)).toBe(true);
    });

    it('filters by date range', () => {
      const result = filterTransactions(mockTransactions, {
        dateRange: { start: '2024-01-01', end: '2024-01-02' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-02');
      expect(result[1].date).toBe('2024-01-01');
    });

    it('filters by search in payee', () => {
      const result = filterTransactions(mockTransactions, { search: 'star' });
      expect(result).toHaveLength(1);
      expect(result[0].payee).toBe('Starbucks');
    });

    it('filters by search in description', () => {
      const result = filterTransactions(mockTransactions, { search: 'amazon' });
      expect(result).toHaveLength(1);
      expect(result[0].original_description).toBe('AMAZON.COM PURCHASE');
    });

    it('combines multiple filters', () => {
      const result = filterTransactions(mockTransactions, {
        accountId: 'acc1',
        isReviewed: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });

    it('returns all transactions when no filters applied', () => {
      const result = filterTransactions(mockTransactions, {});
      expect(result).toHaveLength(3);
    });
  });

  describe('sortTransactions', () => {
    it('sorts by date descending (default)', () => {
      const result = sortTransactions(mockTransactions, 'date', 'desc');
      expect(result[0].date).toBe('2024-01-03');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[2].date).toBe('2024-01-01');
    });

    it('sorts by date ascending', () => {
      const result = sortTransactions(mockTransactions, 'date', 'asc');
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[2].date).toBe('2024-01-03');
    });

    it('sorts by amount descending', () => {
      const result = sortTransactions(mockTransactions, 'amount', 'desc');
      expect(result[0].amount).toBe(50000);
      expect(result[1].amount).toBe(-500);
      expect(result[2].amount).toBe(-2500);
    });

    it('sorts by amount ascending', () => {
      const result = sortTransactions(mockTransactions, 'amount', 'asc');
      expect(result[0].amount).toBe(-2500);
      expect(result[1].amount).toBe(-500);
      expect(result[2].amount).toBe(50000);
    });

    it('sorts by payee alphabetically', () => {
      const result = sortTransactions(mockTransactions, 'payee', 'asc');
      expect(result[0].payee).toBe('Amazon');
      expect(result[1].payee).toBe('Salary');
      expect(result[2].payee).toBe('Starbucks');
    });

    it('defaults to date descending when no sort specified', () => {
      const result = sortTransactions(mockTransactions);
      expect(result[0].date).toBe('2024-01-03');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[2].date).toBe('2024-01-01');
    });
  });
});
