import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePayees } from './usePayees';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import * as payeesLib from '../lib/supabase/payees';
import type { Payee } from '../types/database';

// Mock dependencies
vi.mock('../lib/supabase/payees', () => ({
  fetchPayees: vi.fn(),
}));

// Mock AuthContext
const mockActiveBookset = { id: 'test-bookset-id', name: 'Test Bookset', owner_id: 'user-1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    activeBookset: mockActiveBookset,
  }),
}));

// Mock Supabase channel for real-time subscriptions
vi.mock('../lib/supabase/config', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

const mockPayee = (overrides?: Partial<Payee>): Payee => ({
  id: 'payee-1',
  bookset_id: 'test-bookset-id',
  name: 'Test Payee',
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user-1',
  last_modified_by: 'user-1',
  ...overrides,
});

describe('usePayees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should fetch payees for active bookset', async () => {
      const mockData = [mockPayee(), mockPayee({ id: 'payee-2', name: 'Second Payee' })];
      vi.mocked(payeesLib.fetchPayees).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => usePayees(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(payeesLib.fetchPayees).toHaveBeenCalledWith('test-bookset-id');
      expect(result.current.payees).toEqual(mockData);
    });

    it('should return empty array when no payees', async () => {
      vi.mocked(payeesLib.fetchPayees).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => usePayees(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.payees).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      vi.mocked(payeesLib.fetchPayees).mockRejectedValue(error);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => usePayees(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });
  });
});
