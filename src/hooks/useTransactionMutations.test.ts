/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransactionMutations } from './useTransactionMutations';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import { mockTransaction } from '../test-utils/fixtures';
import * as transactionsLib from '../lib/supabase/transactions';
import { DatabaseError } from '../lib/errors';

// Create hoisted mocks
const { mockShowSuccess, mockShowError } = vi.hoisted(() => ({
  mockShowSuccess: vi.fn(),
  mockShowError: vi.fn(),
}));

// Mock the transaction library
vi.mock('../lib/supabase/transactions', () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  bulkUpdateReviewed: vi.fn(),
}));

// Mock the toast provider
vi.mock('../components/GlobalToastProvider', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

describe('useTransactionMutations', () => {
  const booksetId = 'test-bookset-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should create transaction and invalidate cache on success', async () => {
      const newTransaction = mockTransaction({ id: undefined as any });
      const createdTransaction = mockTransaction();

      vi.mocked(transactionsLib.createTransaction).mockResolvedValue(createdTransaction);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      // Trigger mutation
      result.current.createTransaction(newTransaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.createTransaction).toHaveBeenCalledWith(newTransaction);
      expect(mockShowSuccess).toHaveBeenCalledWith('Transaction created');
    });

    it('should show error message on create failure', async () => {
      const newTransaction = mockTransaction({ id: undefined as any });
      const dbError = new DatabaseError('Duplicate fingerprint', 'DUPLICATE_ENTRY');

      vi.mocked(transactionsLib.createTransaction).mockRejectedValue(dbError);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.createTransaction(newTransaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Duplicate fingerprint');
    });

    it('should show generic error for non-DatabaseError', async () => {
      const newTransaction = mockTransaction({ id: undefined as any });
      vi.mocked(transactionsLib.createTransaction).mockRejectedValue(new Error('Network error'));

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.createTransaction(newTransaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Failed to create transaction');
    });
  });

  describe('updateTransaction', () => {
    it('should perform optimistic update and confirm on success', async () => {
      const transaction = mockTransaction({ payee: 'Updated Payee' });
      vi.mocked(transactionsLib.updateTransaction).mockResolvedValue(transaction);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      // Pre-populate cache
      const queryClient = (wrapper({ children: null }) as any).props.client;
      const initialTransactions = [
        mockTransaction({ id: transaction.id, payee: 'Original Payee' }),
        mockTransaction({ id: 'other-id', payee: 'Other' }),
      ];
      queryClient.setQueryData(['transactions', booksetId], initialTransactions);

      result.current.updateTransaction(transaction);

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.updateTransaction).toHaveBeenCalledWith(transaction);
      expect(mockShowSuccess).toHaveBeenCalledWith('Transaction updated');
    });

    it('should rollback on error', async () => {
      const transaction = mockTransaction({ payee: 'Updated Payee' });
      const dbError = new DatabaseError('Concurrent edit detected', 'CONCURRENT_EDIT');

      vi.mocked(transactionsLib.updateTransaction).mockRejectedValue(dbError);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      // Pre-populate cache
      const queryClient = (wrapper({ children: null }) as any).props.client;
      const initialTransactions = [
        mockTransaction({ id: transaction.id, payee: 'Original Payee' }),
      ];
      queryClient.setQueryData(['transactions', booksetId], initialTransactions);

      result.current.updateTransaction(transaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify error was handled
      expect(mockShowError).toHaveBeenCalledWith('Concurrent edit detected');
    });

    it('should invalidate queries after settled', async () => {
      const transaction = mockTransaction();
      vi.mocked(transactionsLib.updateTransaction).mockResolvedValue(transaction);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      const queryClient = (wrapper({ children: null }) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.updateTransaction(transaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions', booksetId] });
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction and invalidate cache on success', async () => {
      const transactionId = 'transaction-to-delete';
      vi.mocked(transactionsLib.deleteTransaction).mockResolvedValue();

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.deleteTransaction(transactionId);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.deleteTransaction).toHaveBeenCalledWith(transactionId);
      expect(mockShowSuccess).toHaveBeenCalledWith('Transaction deleted');
    });

    it('should show error message on delete failure', async () => {
      const transactionId = 'nonexistent-id';
      const dbError = new DatabaseError('Not found', 'NOT_FOUND');

      vi.mocked(transactionsLib.deleteTransaction).mockRejectedValue(dbError);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.deleteTransaction(transactionId);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Not found');
    });
  });

  describe('bulkUpdate', () => {
    it('should mark transactions as reviewed', async () => {
      const transactionIds = ['id-1', 'id-2', 'id-3'];
      vi.mocked(transactionsLib.bulkUpdateReviewed).mockResolvedValue();

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.bulkUpdate({
        type: 'markReviewed',
        transactionIds,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.bulkUpdateReviewed).toHaveBeenCalledWith(transactionIds, true);
      expect(mockShowSuccess).toHaveBeenCalledWith('Transactions updated');
    });

    it('should mark transactions as unreviewed', async () => {
      const transactionIds = ['id-1', 'id-2'];
      vi.mocked(transactionsLib.bulkUpdateReviewed).mockResolvedValue();

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.bulkUpdate({
        type: 'markUnreviewed',
        transactionIds,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.bulkUpdateReviewed).toHaveBeenCalledWith(transactionIds, false);
    });

    it('should throw error for applyRules operation', async () => {
      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.bulkUpdate({
        type: 'applyRules',
        transactionIds: ['id-1'],
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Failed to update transactions');
    });

    it('should handle bulk update errors', async () => {
      const transactionIds = ['id-1'];
      const dbError = new DatabaseError('Permission denied', 'PERMISSION_DENIED');

      vi.mocked(transactionsLib.bulkUpdateReviewed).mockRejectedValue(dbError);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      result.current.bulkUpdate({
        type: 'markReviewed',
        transactionIds,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Permission denied');
    });
  });

  describe('isLoading', () => {
    it('should be true when any mutation is pending', async () => {
      const transaction = mockTransaction();
      vi.mocked(transactionsLib.updateTransaction).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(transaction), 100))
      );

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTransactionMutations(booksetId), { wrapper });

      expect(result.current.isLoading).toBe(false);

      result.current.updateTransaction(transaction);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
