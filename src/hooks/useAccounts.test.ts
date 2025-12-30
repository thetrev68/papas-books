/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from './useAccounts';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import { mockAccount } from '../test-utils/fixtures';
import * as accountsLib from '../lib/supabase/accounts';
import { supabase } from '../lib/supabase/config';
import { DatabaseError } from '../lib/errors';
import type { Account } from '../types/database';

// Mock dependencies
vi.mock('../lib/supabase/accounts', () => ({
  fetchAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

// Mock AuthContext
const mockActiveBookset = { id: 'test-bookset-id', name: 'Test Bookset', owner_id: 'user-1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    activeBookset: mockActiveBookset,
  }),
}));

// Create hoisted mocks
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

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should fetch accounts for active bookset', async () => {
      const mockData = [mockAccount(), mockAccount({ id: 'acc-2', name: 'Savings' })];
      vi.mocked(accountsLib.fetchAccounts).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(accountsLib.fetchAccounts).toHaveBeenCalledWith('test-bookset-id');
      expect(result.current.accounts).toEqual(mockData);
    });

    it('should return empty array when no accounts', async () => {
      vi.mocked(accountsLib.fetchAccounts).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accounts).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      vi.mocked(accountsLib.fetchAccounts).mockRejectedValue(error);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });

    it('should set up real-time subscription', () => {
      const wrapper = createQueryWrapper();
      renderHook(() => useAccounts(), { wrapper });

      expect(supabase.channel).toHaveBeenCalledWith('accounts-changes-test-bookset-id');
    });

    it('should clean up subscription on unmount', () => {
      const wrapper = createQueryWrapper();
      const { unmount } = renderHook(() => useAccounts(), { wrapper });

      unmount();

      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });
});

describe('useCreateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create account and invalidate cache on success', async () => {
    const newAccount = mockAccount({ id: undefined as any });
    const createdAccount = mockAccount();

    vi.mocked(accountsLib.createAccount).mockResolvedValue(createdAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    result.current.createAccount(newAccount);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(accountsLib.createAccount).toHaveBeenCalledWith(newAccount);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account created');
  });

  it('should show error message on create failure', async () => {
    const newAccount = mockAccount({ id: undefined as any });
    const dbError = new DatabaseError('Duplicate account name', 'DUPLICATE_ENTRY');

    vi.mocked(accountsLib.createAccount).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    result.current.createAccount(newAccount);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Duplicate account name');
  });

  it('should show generic error for non-DatabaseError', async () => {
    const newAccount = mockAccount({ id: undefined as any });
    vi.mocked(accountsLib.createAccount).mockRejectedValue(new Error('Network error'));

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    result.current.createAccount(newAccount);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Failed to create account');
  });

  it('should support async mutation', async () => {
    const newAccount = mockAccount({ id: undefined as any });
    const createdAccount = mockAccount();

    vi.mocked(accountsLib.createAccount).mockResolvedValue(createdAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    const promise = result.current.createAccountAsync(newAccount);

    const response = await promise;

    expect(response).toEqual(createdAccount);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account created');
  });
});

describe('useUpdateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform optimistic update and confirm on success', async () => {
    const accountId = 'acc-1';
    const updates = { name: 'Updated Checking' };
    const updatedAccount = mockAccount({ id: accountId, name: 'Updated Checking' });

    vi.mocked(accountsLib.updateAccount).mockResolvedValue(updatedAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    // Pre-populate cache
    const queryClient = (wrapper({}) as any).props.client;
    const initialAccounts = [mockAccount({ id: accountId, name: 'Original Checking' })];
    queryClient.setQueryData(['accounts', 'test-bookset-id'], initialAccounts);

    result.current.updateAccount(accountId, updates);

    // Check optimistic update
    await waitFor(() => {
      const cached = queryClient.getQueryData(['accounts', 'test-bookset-id']) as Account[];
      const updatedAcc = cached.find((acc) => acc.id === accountId);
      expect(updatedAcc?.name).toBe('Updated Checking');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(accountsLib.updateAccount).toHaveBeenCalledWith(accountId, updates);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account updated');
  });

  it('should rollback on error', async () => {
    const accountId = 'acc-1';
    const updates = { name: 'Updated Checking' };
    const dbError = new DatabaseError('Concurrent edit detected', 'CONCURRENT_EDIT');

    vi.mocked(accountsLib.updateAccount).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    // Pre-populate cache
    const queryClient = (wrapper({}) as any).props.client;
    const initialAccounts = [mockAccount({ id: accountId, name: 'Original Checking' })];
    queryClient.setQueryData(['accounts', 'test-bookset-id'], initialAccounts);

    result.current.updateAccount(accountId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should rollback to original data
    const cached = queryClient.getQueryData(['accounts', 'test-bookset-id']) as Account[];
    const rolledBackAcc = cached.find((acc) => acc.id === accountId);
    expect(rolledBackAcc?.name).toBe('Original Checking');
    expect(mockShowError).toHaveBeenCalledWith('Concurrent edit detected');
  });

  it('should invalidate queries after settled', async () => {
    const accountId = 'acc-1';
    const updates = { name: 'Updated' };
    const updatedAccount = mockAccount({ id: accountId, name: 'Updated' });

    vi.mocked(accountsLib.updateAccount).mockResolvedValue(updatedAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['accounts', 'test-bookset-id'], [mockAccount({ id: accountId })]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.updateAccount(accountId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'test-bookset-id'] });
  });

  it('should support async mutation', async () => {
    const accountId = 'acc-1';
    const updates = { name: 'Updated' };
    const updatedAccount = mockAccount({ id: accountId, name: 'Updated' });

    vi.mocked(accountsLib.updateAccount).mockResolvedValue(updatedAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['accounts', 'test-bookset-id'], [mockAccount({ id: accountId })]);

    const promise = result.current.updateAccountAsync(accountId, updates);

    const response = await promise;

    expect(response).toEqual(updatedAccount);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account updated');
  });

  it('should handle multiple field updates', async () => {
    const accountId = 'acc-1';
    const updates = {
      name: 'Updated Name',
      opening_balance: 500000,
      csv_mapping: { dateColumn: 'Date', amountColumn: 'Amount', descriptionColumn: 'Desc' },
    };
    const updatedAccount = mockAccount({ id: accountId, ...updates });

    vi.mocked(accountsLib.updateAccount).mockResolvedValue(updatedAccount);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['accounts', 'test-bookset-id'], [mockAccount({ id: accountId })]);

    result.current.updateAccount(accountId, updates);

    await waitFor(() => {
      const cached = queryClient.getQueryData(['accounts', 'test-bookset-id']) as Account[];
      const updatedAcc = cached.find((acc) => acc.id === accountId);
      expect(updatedAcc?.name).toBe('Updated Name');
      expect(updatedAcc?.opening_balance).toBe(500000);
    });
  });
});

describe('useDeleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete account and invalidate cache on success', async () => {
    const accountId = 'acc-to-delete';
    vi.mocked(accountsLib.deleteAccount).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    result.current.deleteAccount(accountId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(accountsLib.deleteAccount).toHaveBeenCalledWith(accountId);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account deleted');
  });

  it('should show error message on delete failure', async () => {
    const accountId = 'nonexistent-id';
    const dbError = new DatabaseError('Account has transactions', 'FOREIGN_KEY_VIOLATION');

    vi.mocked(accountsLib.deleteAccount).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    result.current.deleteAccount(accountId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Account has transactions');
  });

  it('should support async mutation', async () => {
    const accountId = 'acc-to-delete';
    vi.mocked(accountsLib.deleteAccount).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    const promise = result.current.deleteAccountAsync(accountId);

    await promise;

    expect(accountsLib.deleteAccount).toHaveBeenCalledWith(accountId);
    expect(mockShowSuccess).toHaveBeenCalledWith('Account deleted');
  });

  it('should invalidate cache after delete', async () => {
    const accountId = 'acc-to-delete';
    vi.mocked(accountsLib.deleteAccount).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.deleteAccount(accountId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'test-bookset-id'] });
  });
});
