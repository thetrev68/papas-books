/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWorkbenchData } from './useWorkbenchData';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import { mockTransaction } from '../test-utils/fixtures';
import * as transactionsLib from '../lib/supabase/transactions';
import * as workbenchManager from '../lib/workbenchDataManager';

// Mock dependencies
vi.mock('../lib/supabase/transactions', () => ({
  fetchTransactions: vi.fn(),
}));

vi.mock('../lib/workbenchDataManager', () => ({
  filterTransactions: vi.fn((transactions) => transactions),
  sortTransactions: vi.fn((transactions) => transactions),
}));

describe('useWorkbenchData', () => {
  const booksetId = 'test-bookset-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default passthrough behavior
    vi.mocked(workbenchManager.filterTransactions).mockImplementation(
      (transactions) => transactions
    );
    vi.mocked(workbenchManager.sortTransactions).mockImplementation((transactions) => transactions);
  });

  describe('data fetching', () => {
    it('should fetch transactions with correct query key', async () => {
      const mockData = [mockTransaction(), mockTransaction({ id: 'tx-2' })];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(transactionsLib.fetchTransactions).toHaveBeenCalledWith(booksetId);
      expect(result.current.transactions).toHaveLength(2);
    });

    it('should return empty array when no data', async () => {
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      vi.mocked(transactionsLib.fetchTransactions).mockRejectedValue(error);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('filtering', () => {
    it('should initialize with default filter', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filter).toEqual({ isReviewed: false });
    });

    it('should call filterTransactions with current filter', async () => {
      const mockData = [
        mockTransaction({ id: 'tx-1', is_reviewed: false }),
        mockTransaction({ id: 'tx-2', is_reviewed: true }),
      ];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(workbenchManager.filterTransactions).toHaveBeenCalledWith(mockData, {
        isReviewed: false,
      });
    });

    it('should update filter and re-filter data', async () => {
      const mockData = [
        mockTransaction({ id: 'tx-1', account_id: 'acc-1' }),
        mockTransaction({ id: 'tx-2', account_id: 'acc-2' }),
      ];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update filter
      act(() => {
        result.current.setFilter({ accountId: 'acc-1' });
      });

      await waitFor(() => {
        expect(result.current.filter).toEqual({
          isReviewed: false,
          accountId: 'acc-1',
        });
      });

      expect(workbenchManager.filterTransactions).toHaveBeenCalledWith(mockData, {
        isReviewed: false,
        accountId: 'acc-1',
      });
    });

    it('should merge partial filter updates', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First update
      act(() => {
        result.current.setFilter({ accountId: 'acc-1' });
      });

      await waitFor(() => {
        expect(result.current.filter.accountId).toBe('acc-1');
      });

      // Second update (should merge)
      act(() => {
        result.current.setFilter({ search: 'walmart' });
      });

      await waitFor(() => {
        expect(result.current.filter).toEqual({
          isReviewed: false,
          accountId: 'acc-1',
          search: 'walmart',
        });
      });
    });

    it('should support all filter types', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setFilter({
          accountId: 'acc-1',
          isReviewed: true,
          dateRange: { start: '2024-01-01', end: '2024-12-31' },
          search: 'amazon',
        });
      });

      await waitFor(() => {
        expect(result.current.filter).toEqual({
          accountId: 'acc-1',
          isReviewed: true,
          dateRange: { start: '2024-01-01', end: '2024-12-31' },
          search: 'amazon',
        });
      });
    });
  });

  describe('sorting', () => {
    it('should initialize with default sort', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sort).toEqual({ by: 'date', order: 'desc' });
    });

    it('should call sortTransactions with current sort', async () => {
      const mockData = [
        mockTransaction({ id: 'tx-1', date: '2024-01-01' }),
        mockTransaction({ id: 'tx-2', date: '2024-01-02' }),
      ];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(mockData, 'date', 'desc');
    });

    it('should update sort and re-sort data', async () => {
      const mockData = [
        mockTransaction({ id: 'tx-1', amount: 1000 }),
        mockTransaction({ id: 'tx-2', amount: 5000 }),
      ];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update sort
      act(() => {
        result.current.setSort('amount', 'asc');
      });

      await waitFor(() => {
        expect(result.current.sort).toEqual({ by: 'amount', order: 'asc' });
      });

      expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(mockData, 'amount', 'asc');
    });

    it('should support all sort types', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test date sort
      act(() => {
        result.current.setSort('date', 'asc');
      });

      await waitFor(() => {
        expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(mockData, 'date', 'asc');
      });

      // Test amount sort
      act(() => {
        result.current.setSort('amount', 'desc');
      });

      await waitFor(() => {
        expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(mockData, 'amount', 'desc');
      });

      // Test payee sort
      act(() => {
        result.current.setSort('payee', 'asc');
      });

      await waitFor(() => {
        expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(mockData, 'payee', 'asc');
      });
    });
  });

  describe('data aggregation', () => {
    it('should apply both filtering and sorting', async () => {
      const mockData = [
        mockTransaction({ id: 'tx-1', is_reviewed: false, date: '2024-01-03' }),
        mockTransaction({ id: 'tx-2', is_reviewed: true, date: '2024-01-02' }),
        mockTransaction({ id: 'tx-3', is_reviewed: false, date: '2024-01-01' }),
      ];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const filteredData = [mockData[0], mockData[2]]; // Only unreviewed
      vi.mocked(workbenchManager.filterTransactions).mockReturnValue(filteredData);

      const sortedData = [mockData[2], mockData[0]]; // Sorted by date asc
      vi.mocked(workbenchManager.sortTransactions).mockReturnValue(sortedData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify filter is applied first
      expect(workbenchManager.filterTransactions).toHaveBeenCalledWith(mockData, {
        isReviewed: false,
      });

      // Verify sort is applied to filtered data
      expect(workbenchManager.sortTransactions).toHaveBeenCalledWith(filteredData, 'date', 'desc');

      expect(result.current.transactions).toEqual(sortedData);
    });

    it('should recalculate when filter changes', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(workbenchManager.filterTransactions).mock.calls.length;

      act(() => {
        result.current.setFilter({ accountId: 'acc-1' });
      });

      await waitFor(() => {
        expect(vi.mocked(workbenchManager.filterTransactions).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it('should recalculate when sort changes', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(workbenchManager.sortTransactions).mock.calls.length;

      act(() => {
        result.current.setSort('amount', 'asc');
      });

      await waitFor(() => {
        expect(vi.mocked(workbenchManager.sortTransactions).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it('should recalculate when data changes', async () => {
      const initialData = [mockTransaction({ id: 'tx-1' })];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(initialData);

      const wrapper = createQueryWrapper();
      const { result, rerender } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(workbenchManager.filterTransactions).mock.calls.length;

      // Update mock data
      const updatedData = [mockTransaction({ id: 'tx-1' }), mockTransaction({ id: 'tx-2' })];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(updatedData);

      // Trigger refetch by invalidating cache
      const queryClient = (wrapper({}) as any).props.client;
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });

      rerender();

      await waitFor(() => {
        expect(vi.mocked(workbenchManager.filterTransactions).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null data gracefully', async () => {
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(null as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toEqual([]);
    });

    it('should handle undefined data gracefully', async () => {
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(undefined as any);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toEqual([]);
    });

    it('should clear filter fields when set to undefined', async () => {
      const mockData = [mockTransaction()];
      vi.mocked(transactionsLib.fetchTransactions).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useWorkbenchData(booksetId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Set filter
      act(() => {
        result.current.setFilter({ accountId: 'acc-1', search: 'test' });
      });

      await waitFor(() => {
        expect(result.current.filter.accountId).toBe('acc-1');
      });

      // Clear search filter
      act(() => {
        result.current.setFilter({ search: undefined });
      });

      await waitFor(() => {
        expect(result.current.filter.search).toBeUndefined();
        expect(result.current.filter.accountId).toBe('acc-1'); // Should keep other filters
      });
    });
  });
});
