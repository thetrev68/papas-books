/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApplyRules } from './useApplyRules';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import { mockTransaction, mockRule } from '../test-utils/fixtures';
import * as applicator from '../lib/rules/applicator';
import { supabase } from '../lib/supabase/config';
import type { RuleBatchResult } from '../types/rules';

// Mock dependencies
vi.mock('../lib/rules/applicator', () => ({
  applyRulesToBatch: vi.fn(),
}));

vi.mock('./useRules', () => ({
  useRules: () => ({
    rules: [
      mockRule({ id: 'rule-1', keyword: 'walmart', priority: 10 }),
      mockRule({ id: 'rule-2', keyword: 'amazon', priority: 5 }),
    ],
    isLoading: false,
    error: null,
  }),
}));

// Mock Supabase client
vi.mock('../lib/supabase/config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useApplyRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('batch fetching', () => {
    it('should fetch transactions in batches to avoid URL length limits', async () => {
      // Create 250 transaction IDs to force multiple batches
      const transactionIds = Array.from({ length: 250 }, (_, i) => `tx-${i + 1}`);
      const transactions = transactionIds.map((id) => mockTransaction({ id }));

      // Mock Supabase responses for each batch
      let batchCallCount = 0;
      const mockIn = vi.fn().mockImplementation(() => {
        const start = batchCallCount * 100;
        const end = Math.min(start + 100, transactions.length);
        batchCallCount++;
        return Promise.resolve({
          data: transactions.slice(start, end),
          error: null,
        });
      });

      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 250,
        appliedCount: 200,
        skippedCount: 50,
        errorCount: 0,
        results: [],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      const promise = result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });

      const resultData = await promise;

      // Should make 3 batch calls (100 + 100 + 50)
      expect(supabase.from).toHaveBeenCalledTimes(3);
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockSelect).toHaveBeenCalledTimes(3);
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockIn).toHaveBeenCalledTimes(3);

      // Verify batch sizes
      expect(mockIn).toHaveBeenNthCalledWith(1, 'id', transactionIds.slice(0, 100));
      expect(mockIn).toHaveBeenNthCalledWith(2, 'id', transactionIds.slice(100, 200));
      expect(mockIn).toHaveBeenNthCalledWith(3, 'id', transactionIds.slice(200, 250));

      expect(resultData).toEqual(batchResult);
    });

    it('should handle single batch when under 100 transactions', async () => {
      const transactionIds = Array.from({ length: 50 }, (_, i) => `tx-${i + 1}`);
      const transactions = transactionIds.map((id) => mockTransaction({ id }));

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 50,
        appliedCount: 40,
        skippedCount: 10,
        errorCount: 0,
        results: [],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });

      // Should only make 1 batch call
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(mockIn).toHaveBeenCalledWith('id', transactionIds);
    });

    it('should throw error when Supabase fetch fails', async () => {
      const transactionIds = ['tx-1', 'tx-2'];
      const mockIn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: '08000' },
      });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await expect(result.current.applyRules(transactionIds)).rejects.toThrow();

      // Wait for error state to be updated
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should throw error when no transactions found', async () => {
      const transactionIds = ['nonexistent-1', 'nonexistent-2'];
      const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await expect(result.current.applyRules(transactionIds)).rejects.toThrow(
        'No transactions found'
      );
    });
  });

  describe('rule application', () => {
    it('should apply rules with correct options', async () => {
      const transactionIds = ['tx-1', 'tx-2'];
      const transactions = transactionIds.map((id) => mockTransaction({ id }));

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 2,
        appliedCount: 2,
        skippedCount: 0,
        errorCount: 0,
        results: [],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });

      expect(applicator.applyRulesToBatch).toHaveBeenCalledWith(
        transactions,
        expect.arrayContaining([
          expect.objectContaining({ id: 'rule-1', keyword: 'walmart' }),
          expect.objectContaining({ id: 'rule-2', keyword: 'amazon' }),
        ]),
        {
          overrideReviewed: false,
          setReviewedFlag: true,
        }
      );
    });

    it('should store result in state', async () => {
      const transactionIds = ['tx-1'];
      const transactions = [mockTransaction({ id: 'tx-1' })];

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 1,
        appliedCount: 1,
        skippedCount: 0,
        errorCount: 0,
        results: [
          {
            transactionId: 'tx-1',
            applied: true,
            matchedRule: mockRule(),
          },
        ],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      expect(result.current.result).toBeNull();

      await result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.result).toEqual(batchResult);
      });
    });
  });

  describe('query invalidation', () => {
    it('should invalidate transaction queries on success', async () => {
      const transactionIds = ['tx-1'];
      const transactions = [mockTransaction({ id: 'tx-1' })];

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 1,
        appliedCount: 1,
        skippedCount: 0,
        errorCount: 0,
        results: [],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      const queryClient = (wrapper({}) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    });

    it('should invalidate account queries on success', async () => {
      const transactionIds = ['tx-1'];
      const transactions = [mockTransaction({ id: 'tx-1' })];

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const batchResult: RuleBatchResult = {
        totalTransactions: 1,
        appliedCount: 1,
        skippedCount: 0,
        errorCount: 0,
        results: [],
      };

      vi.mocked(applicator.applyRulesToBatch).mockResolvedValue(batchResult);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      const queryClient = (wrapper({}) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] });
    });

    it('should not invalidate on error', async () => {
      const transactionIds = ['tx-1'];
      const mockIn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error', code: '500' },
      });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      const queryClient = (wrapper({}) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await expect(result.current.applyRules(transactionIds)).rejects.toThrow();

      // Should not invalidate on error
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    it('should set isApplying to true while mutation is pending', async () => {
      const transactionIds = ['tx-1'];
      const transactions = [mockTransaction({ id: 'tx-1' })];

      const mockIn = vi.fn().mockResolvedValue({ data: transactions, error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      vi.mocked(applicator.applyRulesToBatch).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  totalTransactions: 1,
                  appliedCount: 1,
                  skippedCount: 0,
                  errorCount: 0,
                  results: [],
                }),
              100
            )
          )
      );

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      expect(result.current.isApplying).toBe(false);

      result.current.applyRules(transactionIds);

      await waitFor(() => {
        expect(result.current.isApplying).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isApplying).toBe(false);
      });
    });

    it('should set error on failure', async () => {
      const transactionIds = ['tx-1'];
      const error = new Error('Application failed');

      const mockIn = vi.fn().mockResolvedValue({
        data: [mockTransaction({ id: 'tx-1' })],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      vi.mocked(applicator.applyRulesToBatch).mockRejectedValue(error);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      expect(result.current.error).toBeNull();

      await expect(result.current.applyRules(transactionIds)).rejects.toThrow('Application failed');

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty transaction ID array', async () => {
      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await expect(result.current.applyRules([])).rejects.toThrow('No transactions found');
    });

    it('should handle partial batch failures gracefully', async () => {
      const transactionIds = Array.from({ length: 150 }, (_, i) => `tx-${i + 1}`);

      let batchCallCount = 0;
      const mockIn = vi.fn().mockImplementation(() => {
        batchCallCount++;
        if (batchCallCount === 1) {
          // First batch succeeds
          return Promise.resolve({
            data: transactionIds.slice(0, 100).map((id) => mockTransaction({ id })),
            error: null,
          });
        } else {
          // Second batch fails
          return Promise.resolve({
            data: null,
            error: { message: 'Timeout', code: '57014' },
          });
        }
      });

      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useApplyRules(), { wrapper });

      await expect(result.current.applyRules(transactionIds)).rejects.toThrow();

      // Should have attempted both batches
      expect(mockIn).toHaveBeenCalledTimes(2);
    });
  });
});
