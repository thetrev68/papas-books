import {
  validateSplitTransaction,
  calculateSplitRemainder,
  validateSplitLineAmount,
} from './splitCalculator';
import type { Transaction, SplitLine } from '../types/database';

describe('splitCalculator', () => {
  describe('validateSplitTransaction', () => {
    it('validates non-split transactions as valid', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: false,
        lines: [],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const result = validateSplitTransaction(tx);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates split transactions that sum correctly', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: 6000, memo: 'Part 1' },
          { category_id: 'cat2', amount: 4000, memo: 'Part 2' },
        ],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const result = validateSplitTransaction(tx);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects split amount mismatch', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: 6000, memo: 'Part 1' },
          { category_id: 'cat2', amount: 3000, memo: 'Part 2' }, // Missing $10
        ],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const result = validateSplitTransaction(tx);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Difference: $-10.00');
    });

    it('allows small floating point differences', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: 5000, memo: 'Part 1' },
          { category_id: 'cat2', amount: 4999, memo: 'Part 2' }, // 1 cent difference
        ],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const result = validateSplitTransaction(tx);
      expect(result.isValid).toBe(true);
    });

    it('validates exact 1 cent difference', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 100,
        is_split: true,
        lines: [{ category_id: 'cat1', amount: 99, memo: 'Part 1' }],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const result = validateSplitTransaction(tx);
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateSplitRemainder', () => {
    it('returns 0 for non-split transactions', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: false,
        lines: [],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const remainder = calculateSplitRemainder(tx);
      expect(remainder).toBe(0);
    });

    it('calculates remainder correctly', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: 3000, memo: 'Part 1' },
          { category_id: 'cat2', amount: 4000, memo: 'Part 2' },
        ],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const remainder = calculateSplitRemainder(tx);
      expect(remainder).toBe(3000); // 10000 - 3000 - 4000
    });

    it('handles missing line amounts', () => {
      const tx: Transaction = {
        id: '1',
        bookset_id: 'bs1',
        account_id: 'acc1',
        date: '2024-01-01',
        payee: 'Test Payee',
        payee_id: null,
        original_description: 'Test',
        amount: 10000,
        is_split: true,
        lines: [
          { category_id: 'cat1', amount: 3000, memo: 'Part 1' },
          { category_id: 'cat2', memo: 'Part 2' } as unknown as SplitLine, // Missing amount
        ],
        is_reviewed: false,
        reconciled: false,
        is_archived: false,
        source_batch_id: null,
        import_date: '2024-01-01T00:00:00Z',
        fingerprint: 'fp',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'user1',
        last_modified_by: 'user1',
      };

      const remainder = calculateSplitRemainder(tx);
      expect(remainder).toBe(7000); // 10000 - 3000 - 0
    });
  });

  describe('validateSplitLineAmount', () => {
    it('validates positive amounts', () => {
      const result = validateSplitLineAmount(5000);
      expect(result.isValid).toBe(true);
    });

    it('validates negative amounts', () => {
      const result = validateSplitLineAmount(-5000);
      expect(result.isValid).toBe(true);
    });

    it('validates zero amounts', () => {
      const result = validateSplitLineAmount(0);
      expect(result.isValid).toBe(true);
    });

    it('rejects NaN values', () => {
      const result = validateSplitLineAmount(NaN);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('rejects non-integer values', () => {
      const result = validateSplitLineAmount(50.5);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cents');
    });
  });
});
