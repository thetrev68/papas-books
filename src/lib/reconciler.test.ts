import { describe, it, expect } from 'vitest';
import { calculateReconciliation, sumTransactionAmountForReconcile } from './reconciler';
import { Transaction } from '../types/database';

describe('Reconciler Logic', () => {
  const mockTx = (amount: number, id: string): Transaction => ({
    id,
    amount,
    bookset_id: 'b1',
    account_id: 'a1',
    date: '2023-01-01',
    payee: 'Test',
    original_description: 'Test',
    lines: [],
    is_split: false,
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

  describe('calculateReconciliation', () => {
    it('should be balanced when calculated balance matches target', () => {
      const txs = [mockTx(100, '1'), mockTx(-50, '2')]; // Net +50
      const result = calculateReconciliation(1000, txs, 1050);

      expect(result.openingBalance).toBe(1000);
      expect(result.totalDeposits).toBe(100);
      expect(result.totalWithdrawals).toBe(-50);
      expect(result.calculatedEndingBalance).toBe(1050);
      expect(result.difference).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('should show difference when balances do not match', () => {
      const txs = [mockTx(100, '1')]; // Net +100
      const result = calculateReconciliation(1000, txs, 1200); // Target 1200, calculated 1100

      expect(result.calculatedEndingBalance).toBe(1100);
      expect(result.difference).toBe(100); // 1200 - 1100
      expect(result.isBalanced).toBe(false);
    });

    it('should handle negative opening balance', () => {
      const txs = [mockTx(100, '1')];
      const result = calculateReconciliation(-500, txs, -400);

      expect(result.calculatedEndingBalance).toBe(-400);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('sumTransactionAmountForReconcile', () => {
    it('should return simple amount for non-split transaction', () => {
      const tx = mockTx(123, '1');
      expect(sumTransactionAmountForReconcile(tx)).toBe(123);
    });

    it('should sum lines for split transaction', () => {
      const tx: Transaction = {
        ...mockTx(100, '1'), // Main amount is 100, but logic should use lines if is_split
        is_split: true,
        lines: [
          { category_id: 'c1', amount: 60 },
          { category_id: 'c2', amount: 40 },
        ],
      };
      expect(sumTransactionAmountForReconcile(tx)).toBe(100);
    });
  });
});
