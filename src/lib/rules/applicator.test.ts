/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRulesToBatch } from './applicator';
import { supabase } from '../supabase/config';
import { mockTransaction, mockRule, mockPayee } from '../../test-utils/fixtures';
import type { Transaction } from '../../types/database';

// Mock the Supabase client
vi.mock('../supabase/config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock the matcher module
vi.mock('./matcher', () => ({
  findMatchingRules: vi.fn(),
  selectBestRule: vi.fn(),
}));

// Import mocked modules
import { findMatchingRules, selectBestRule } from './matcher';

describe('applyRulesToBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Basic Rule Application', () => {
    it('should apply rule with category to a single transaction', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        original_description: 'WALMART STORE',
        is_reviewed: false,
        reconciled: false,
        lines: [],
      });

      const rule = mockRule({
        id: 'rule-1',
        keyword: 'walmart',
        target_category_id: 'category-groceries',
        payee_id: null,
        is_enabled: true,
      });

      // Mock findMatchingRules to return matches
      (findMatchingRules as any).mockReturnValue([
        { rule, matchedText: 'walmart', confidence: 100 },
      ]);
      (selectBestRule as any).mockReturnValue(rule);

      // Mock transaction update
      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock rule statistics update
      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      // Verify transaction was updated with category
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            {
              category_id: 'category-groceries',
              amount: transaction.amount,
              memo: '',
            },
          ],
          is_reviewed: true,
        })
      );
      expect(mockTransactionQuery.eq).toHaveBeenCalledWith('id', 'txn-1');

      // Verify rule statistics were updated
      expect(mockRuleQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          use_count: rule.use_count + 1,
          last_used_at: expect.any(String),
        })
      );
      expect(mockRuleQuery.eq).toHaveBeenCalledWith('id', 'rule-1');

      // Verify batch result
      expect(result.totalTransactions).toBe(1);
      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.results[0].applied).toBe(true);
    });

    it('should apply rule with payee_id and clear legacy payee text', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        payee: 'OLD PAYEE NAME',
        payee_id: null,
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: 'category-groceries',
        payee_id: 'payee-walmart',
        suggested_payee: null,
      });

      (findMatchingRules as any).mockReturnValue([
        { rule, matchedText: 'walmart', confidence: 100 },
      ]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Verify payee_id is set and legacy payee is cleared
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payee_id: 'payee-walmart',
          payee: null,
        })
      );
    });

    it('should apply legacy suggested_payee when payee_id is null', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        payee: null,
        payee_id: null,
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: 'category-groceries',
        payee_id: null,
        suggested_payee: 'Walmart',
      });

      (findMatchingRules as any).mockReturnValue([
        { rule, matchedText: 'walmart', confidence: 100 },
      ]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Verify legacy suggested_payee is used
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payee: 'Walmart',
        })
      );
    });
  });

  describe('Category Assignment Hierarchy', () => {
    it('should use rule category when available', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: 'category-from-rule',
        payee_id: 'payee-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockPayeeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockPayee({ id: 'payee-1', default_category_id: 'category-from-payee' }),
          error: null,
        }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'payees') return mockPayeeQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Should use rule's category, not payee's default
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            {
              category_id: 'category-from-rule',
              amount: transaction.amount,
              memo: '',
            },
          ],
        })
      );
    });

    it('should use payee default category when rule has no category', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: null, // No category on rule
        payee_id: 'payee-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockPayeeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockPayee({ id: 'payee-1', default_category_id: 'category-from-payee' }),
          error: null,
        }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'payees') return mockPayeeQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Should fetch payee and use its default category
      expect(mockPayeeQuery.select).toHaveBeenCalledWith('*');
      expect(mockPayeeQuery.eq).toHaveBeenCalledWith('id', 'payee-1');
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            {
              category_id: 'category-from-payee',
              amount: transaction.amount,
              memo: '',
            },
          ],
        })
      );
    });

    it('should not set category when rule and payee have no category', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: null,
        payee_id: 'payee-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockPayeeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockPayee({ id: 'payee-1', default_category_id: null }),
          error: null,
        }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'payees') return mockPayeeQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Should not include lines in update (no category to set)
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.not.objectContaining({
          lines: expect.anything(),
        })
      );
      // But should still update payee
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payee_id: 'payee-1',
        })
      );
    });

    it('should handle payee not found gracefully', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        target_category_id: null,
        payee_id: 'nonexistent-payee',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockPayeeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null, // Payee not found
          error: null,
        }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'payees') return mockPayeeQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Should still apply the rule (just without category)
      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payee_id: 'nonexistent-payee',
        })
      );
    });
  });

  describe('Reconciliation Status Checks', () => {
    it('should skip reconciled transactions', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        reconciled: true, // Reconciled
        is_reviewed: false,
      });

      const rule = mockRule({
        target_category_id: 'category-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should not call supabase at all
      expect(supabase.from).not.toHaveBeenCalled();

      // Should report as skipped (counted as error since not "No matching rules")
      expect(result.totalTransactions).toBe(1);
      expect(result.appliedCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.results[0].applied).toBe(false);
      expect(result.results[0].reason).toBe('Transaction is reconciled');
    });

    it('should skip already reviewed transactions by default', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        reconciled: false,
        is_reviewed: true, // Already reviewed
      });

      const rule = mockRule({
        target_category_id: 'category-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should not update transaction
      expect(supabase.from).not.toHaveBeenCalled();

      // Should report as skipped
      expect(result.totalTransactions).toBe(1);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.results[0].applied).toBe(false);
      expect(result.results[0].reason).toBe('Transaction already reviewed');
    });

    it('should apply to reviewed transactions when overrideReviewed is true', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        reconciled: false,
        is_reviewed: true,
      });

      const rule = mockRule({
        target_category_id: 'category-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule], {
        overrideReviewed: true,
      });

      // Should update the transaction
      expect(mockTransactionQuery.update).toHaveBeenCalled();
      expect(result.appliedCount).toBe(1);
    });
  });

  describe('Options: setReviewedFlag', () => {
    it('should set is_reviewed to true by default', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      expect(mockTransactionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_reviewed: true,
        })
      );
    });

    it('should not set is_reviewed when setReviewedFlag is false', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule], {
        setReviewedFlag: false,
      });

      // Should not include is_reviewed in update
      expect(mockTransactionQuery.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          is_reviewed: expect.anything(),
        })
      );
    });
  });

  describe('Usage Statistics Updates', () => {
    it('should increment use_count and update last_used_at', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        id: 'rule-1',
        target_category_id: 'category-1',
        use_count: 5,
        last_used_at: '2024-01-01T00:00:00Z',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch([transaction], [rule]);

      // Verify use_count was incremented
      expect(mockRuleQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          use_count: 6, // 5 + 1
          last_used_at: expect.any(String),
        })
      );

      // Verify last_used_at is recent (within last 5 seconds)
      const updateCall = (mockRuleQuery.update as any).mock.calls[0][0];
      const lastUsedAt = new Date(updateCall.last_used_at);
      const now = new Date();
      expect(now.getTime() - lastUsedAt.getTime()).toBeLessThan(5000);
    });

    it('should not fail rule application if statistics update fails', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Statistics update failed' },
        }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should still report success for transaction update
      expect(result.appliedCount).toBe(1);
      expect(result.results[0].applied).toBe(true);

      // Should log error but not throw
      expect(console.error).toHaveBeenCalledWith(
        'Failed to update rule statistics:',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle transaction update errors gracefully', async () => {
      const transaction = mockTransaction({
        id: 'txn-1',
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed', code: '42501' },
        }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should report as error
      // Note: Supabase errors are not instanceof Error, so they return 'Unknown error'
      expect(result.appliedCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.results[0].applied).toBe(false);
      expect(result.results[0].reason).toBe('Unknown error');
    });

    it('should handle generic errors gracefully', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        }),
      };

      (supabase.from as any).mockReturnValue(mockTransactionQuery);

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should catch and report error
      expect(result.errorCount).toBe(1);
      expect(result.results[0].applied).toBe(false);
      expect(result.results[0].reason).toBe('Unexpected error');
    });

    it('should handle non-Error exceptions', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockImplementation(() => {
          throw 'String error'; // Non-Error exception
        }),
      };

      (supabase.from as any).mockReturnValue(mockTransactionQuery);

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should report generic error message
      expect(result.errorCount).toBe(1);
      expect(result.results[0].reason).toBe('Unknown error');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple transactions sequentially', async () => {
      const transactions = [
        mockTransaction({ id: 'txn-1', original_description: 'WALMART', reconciled: false }),
        mockTransaction({ id: 'txn-2', original_description: 'TARGET', reconciled: false }),
        mockTransaction({ id: 'txn-3', original_description: 'COSTCO', reconciled: false }),
      ];

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch(transactions, [rule]);

      // Should update all 3 transactions
      expect(mockTransactionQuery.update).toHaveBeenCalledTimes(3);
      expect(result.totalTransactions).toBe(3);
      expect(result.appliedCount).toBe(3);
    });

    it('should handle mixed results in batch', async () => {
      const transactions = [
        mockTransaction({ id: 'txn-1', reconciled: false, is_reviewed: false }), // Will match
        mockTransaction({ id: 'txn-2', reconciled: true, is_reviewed: false }), // Reconciled - skip
        mockTransaction({ id: 'txn-3', reconciled: false, is_reviewed: true }), // Reviewed - skip
        mockTransaction({ id: 'txn-4', reconciled: false, is_reviewed: false }), // Will match
      ];

      const rule = mockRule({ target_category_id: 'category-1' });

      // txn-1 and txn-4 match, txn-2 and txn-3 don't match
      (findMatchingRules as any).mockImplementation((txn: Transaction) => {
        if (txn.id === 'txn-1' || txn.id === 'txn-4') {
          return [{ rule, matchedText: '', confidence: 100 }];
        }
        return [];
      });

      (selectBestRule as any).mockImplementation((matches: any[]) =>
        matches.length > 0 ? rule : null
      );

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch(transactions, [rule]);

      expect(result.totalTransactions).toBe(4);
      expect(result.appliedCount).toBe(2); // txn-1 and txn-4
      expect(result.skippedCount).toBe(2); // txn-2 (reconciled) and txn-3 (reviewed)
      expect(result.errorCount).toBe(0);
    });

    it('should track no matching rules as skipped', async () => {
      const transaction = mockTransaction({
        original_description: 'UNKNOWN STORE',
        reconciled: false,
        is_reviewed: false,
      });

      const rule = mockRule({ keyword: 'walmart' });

      // No matches
      (findMatchingRules as any).mockReturnValue([]);
      (selectBestRule as any).mockReturnValue(null);

      const result = await applyRulesToBatch([transaction], [rule]);

      expect(result.totalTransactions).toBe(1);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.results[0].applied).toBe(false);
      expect(result.results[0].reason).toBe('No matching rules');
    });

    it('should log progress for large batches', async () => {
      const transactions = Array(5)
        .fill(null)
        .map((_, i) => mockTransaction({ id: `txn-${i}`, reconciled: false, is_reviewed: false }));

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      await applyRulesToBatch(transactions, [rule]);

      // Should log start and completion
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Rules] Processing 5 transactions')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Rules] Complete: 5 applied, 0 skipped, 0 errors')
      );
    });
  });

  describe('Result Tracking', () => {
    it('should include matchedRule in successful result', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
      });

      const rule = mockRule({
        id: 'rule-1',
        keyword: 'walmart',
        target_category_id: 'category-1',
      });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      expect(result.results[0].matchedRule).toBeDefined();
      expect(result.results[0].matchedRule?.id).toBe('rule-1');
    });

    it('should include previousCategoryId in result', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
        lines: [{ category_id: 'old-category', amount: 5000, memo: '' }],
      });

      const rule = mockRule({ target_category_id: 'new-category' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      expect(result.results[0].previousCategoryId).toBe('old-category');
    });

    it('should handle null previousCategoryId when no lines exist', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
        lines: [],
      });

      const rule = mockRule({ target_category_id: 'new-category' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      expect(result.results[0].previousCategoryId).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transaction batch', async () => {
      const result = await applyRulesToBatch([], [mockRule()]);

      expect(result.totalTransactions).toBe(0);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should handle empty rules array', async () => {
      const transaction = mockTransaction({
        reconciled: false,
        is_reviewed: false,
      });

      (findMatchingRules as any).mockReturnValue([]);
      (selectBestRule as any).mockReturnValue(null);

      const result = await applyRulesToBatch([transaction], []);

      expect(result.skippedCount).toBe(1);
      expect(result.results[0].reason).toBe('No matching rules');
    });

    it('should handle transaction with null lines array', async () => {
      const transaction = mockTransaction({
        is_reviewed: false,
        reconciled: false,
        lines: null as any, // Malformed data
      });

      const rule = mockRule({ target_category_id: 'category-1' });

      (findMatchingRules as any).mockReturnValue([{ rule, matchedText: '', confidence: 100 }]);
      (selectBestRule as any).mockReturnValue(rule);

      const mockTransactionQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockRuleQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'transactions') return mockTransactionQuery;
        if (table === 'rules') return mockRuleQuery;
        return {};
      });

      const result = await applyRulesToBatch([transaction], [rule]);

      // Should handle gracefully
      expect(result.appliedCount).toBe(1);
      expect(result.results[0].previousCategoryId).toBeNull();
    });

    it('should only count enabled rules in logs', async () => {
      const transaction = mockTransaction({ reconciled: false, is_reviewed: false });

      const rules = [
        mockRule({ id: 'rule-1', is_enabled: true }),
        mockRule({ id: 'rule-2', is_enabled: false }),
        mockRule({ id: 'rule-3', is_enabled: true }),
      ];

      (findMatchingRules as any).mockReturnValue([]);
      (selectBestRule as any).mockReturnValue(null);

      await applyRulesToBatch([transaction], rules);

      // Should log 2 active rules (not 3 total)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('with 2 active rules'));
    });
  });
});
