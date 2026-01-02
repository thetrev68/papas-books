/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTaxYearLocks } from './useTaxYearLocks';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import * as taxYearLocksLib from '../lib/supabase/taxYearLocks';
import type { TaxYearLock } from '../types/database';

// Mock dependencies
vi.mock('../lib/supabase/taxYearLocks', () => ({
  fetchTaxYearLocks: vi.fn(),
  lockTaxYear: vi.fn(),
  unlockTaxYear: vi.fn(),
}));

// Mock AuthContext
const mockActiveBookset = { id: 'test-bookset-id', name: 'Test Bookset', owner_id: 'user-1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    activeBookset: mockActiveBookset,
  }),
}));

// Create hoisted mocks for toast
const { mockShowSuccess, mockShowError } = vi.hoisted(() => ({
  mockShowSuccess: vi.fn(),
  mockShowError: vi.fn(),
}));

// Mock toast provider
vi.mock('../components/GlobalToastProvider', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

const mockTaxYearLock = (year: number, overrides?: Partial<TaxYearLock>): TaxYearLock => ({
  id: `lock-${year}`,
  bookset_id: 'test-bookset-id',
  tax_year: year,
  locked_at: '2024-01-01T00:00:00Z',
  locked_by: 'user-1',
  ...overrides,
});

describe('useTaxYearLocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should fetch tax year locks for active bookset', async () => {
      const mockData = [mockTaxYearLock(2022), mockTaxYearLock(2023)];
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(taxYearLocksLib.fetchTaxYearLocks).toHaveBeenCalledWith('test-bookset-id');
      expect(result.current.locks).toEqual(mockData);
      expect(result.current.lockedYears).toEqual([2022, 2023]);
    });

    it('should calculate max locked year correctly', async () => {
      const mockData = [mockTaxYearLock(2021), mockTaxYearLock(2023), mockTaxYearLock(2022)];
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.maxLockedYear).toBe(2023);
    });

    it('should return null for maxLockedYear when no locks', async () => {
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.maxLockedYear).toBe(null);
      expect(result.current.lockedYears).toEqual([]);
    });

    it('should correctly identify locked dates with cumulative locking', async () => {
      const mockData = [mockTaxYearLock(2023)];
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDateLocked('2023-06-15')).toBe(true); // 2023 is locked
      expect(result.current.isDateLocked('2022-12-31')).toBe(true); // 2022 is also locked (cumulative)
      expect(result.current.isDateLocked('2024-01-01')).toBe(false); // 2024 is not locked
    });

    it('should handle no locked years', async () => {
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDateLocked('2020-01-01')).toBe(false);
      expect(result.current.isDateLocked('2023-06-15')).toBe(false);
      expect(result.current.isDateLocked('2024-01-01')).toBe(false);
    });
  });

  describe('lockYear mutation', () => {
    it('should lock a tax year and show success message', async () => {
      vi.mocked(taxYearLocksLib.lockTaxYear).mockResolvedValue();
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.lockYear(2023);

      await waitFor(() => {
        expect(result.current.isLocking).toBe(false);
      });

      expect(taxYearLocksLib.lockTaxYear).toHaveBeenCalledWith('test-bookset-id', 2023);
      expect(mockShowSuccess).toHaveBeenCalledWith('Tax year 2023 has been locked');
    });

    it('should show error message on lock failure', async () => {
      const error = new Error('Already locked');
      vi.mocked(taxYearLocksLib.lockTaxYear).mockRejectedValue(error);
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.lockYear(2023);

      await waitFor(() => {
        expect(result.current.isLocking).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Failed to lock tax year: Already locked');
    });

    it('should invalidate queries after locking', async () => {
      vi.mocked(taxYearLocksLib.lockTaxYear).mockResolvedValue();
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      const queryClient = (wrapper({ children: null }) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.lockYear(2023);

      await waitFor(() => {
        expect(result.current.isLocking).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taxYearLocks', 'test-bookset-id'] });
    });
  });

  describe('unlockYear mutation', () => {
    it('should unlock a tax year and show success message', async () => {
      vi.mocked(taxYearLocksLib.unlockTaxYear).mockResolvedValue();
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([mockTaxYearLock(2023)]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.unlockYear(2023);

      await waitFor(() => {
        expect(result.current.isUnlocking).toBe(false);
      });

      expect(taxYearLocksLib.unlockTaxYear).toHaveBeenCalledWith('test-bookset-id', 2023);
      expect(mockShowSuccess).toHaveBeenCalledWith('Tax year 2023 has been unlocked');
    });

    it('should show error message on unlock failure', async () => {
      const error = new Error('Not locked');
      vi.mocked(taxYearLocksLib.unlockTaxYear).mockRejectedValue(error);
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.unlockYear(2023);

      await waitFor(() => {
        expect(result.current.isUnlocking).toBe(false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Failed to unlock tax year: Not locked');
    });

    it('should invalidate queries after unlocking', async () => {
      vi.mocked(taxYearLocksLib.unlockTaxYear).mockResolvedValue();
      vi.mocked(taxYearLocksLib.fetchTaxYearLocks).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useTaxYearLocks(), { wrapper });

      const queryClient = (wrapper({ children: null }) as any).props.client;
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.unlockYear(2023);

      await waitFor(() => {
        expect(result.current.isUnlocking).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taxYearLocks', 'test-bookset-id'] });
    });
  });
});
