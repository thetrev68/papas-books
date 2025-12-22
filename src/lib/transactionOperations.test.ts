import { describe, it, expect } from 'vitest';
import { createManualTransaction } from './transactionOperations';

describe('transactionOperations', () => {
  describe('createManualTransaction', () => {
    it('creates a manual transaction with category', () => {
      const result = createManualTransaction('acc1', '2024-01-15', 'Test Payee', 10000, 'cat1');

      expect(result.account_id).toBe('acc1');
      expect(result.date).toBe('2024-01-15');
      expect(result.payee).toBe('Test Payee');
      expect(result.original_description).toBe('Test Payee');
      expect(result.amount).toBe(10000);
      expect(result.is_split).toBe(true);
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].category_id).toBe('cat1');
      expect(result.lines[0].amount).toBe(10000);
      expect(result.is_reviewed).toBe(false);
      expect(result.reconciled).toBe(false);
      expect(result.is_archived).toBe(false);
    });

    it('creates a manual transaction without category', () => {
      const result = createManualTransaction('acc1', '2024-01-15', 'Test Payee', 10000);

      expect(result.account_id).toBe('acc1');
      expect(result.date).toBe('2024-01-15');
      expect(result.payee).toBe('Test Payee');
      expect(result.amount).toBe(10000);
      expect(result.is_split).toBe(false);
      expect(result.lines).toHaveLength(0);
    });

    it('sets proper timestamps and IDs', () => {
      const result = createManualTransaction('acc1', '2024-01-15', 'Test Payee', 10000, 'cat1');

      expect(result.id).toBeDefined();
      expect(result.bookset_id).toBe(''); // Will be set by caller
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.created_by).toBe(''); // Will be set by caller
      expect(result.last_modified_by).toBe(''); // Will be set by caller
      expect(result.source_batch_id).toBeNull();
      expect(result.fingerprint).toBe(''); // Will be generated
    });

    it('handles negative amounts', () => {
      const result = createManualTransaction('acc1', '2024-01-15', 'Test Payee', -5000, 'cat1');

      expect(result.amount).toBe(-5000);
      expect(result.lines[0].amount).toBe(-5000);
    });

    it('handles zero amounts', () => {
      const result = createManualTransaction('acc1', '2024-01-15', 'Test Payee', 0, 'cat1');

      expect(result.amount).toBe(0);
      expect(result.lines[0].amount).toBe(0);
    });
  });
});
