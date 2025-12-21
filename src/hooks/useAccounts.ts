import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../lib/supabase/accounts';
import type { UpdateAccount } from '../lib/validation/accounts';

export function useAccounts() {
  const { activeBookset } = useAuth();

  const query = useQuery({
    queryKey: ['accounts', activeBookset?.id],
    queryFn: () => fetchAccounts(activeBookset!.id),
    enabled: !!activeBookset,
  });

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
    },
  });

  return {
    createAccount: mutation.mutate,
    createAccountAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateAccount }) =>
      updateAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
    },
  });

  return {
    updateAccount: (id: string, updates: UpdateAccount) => mutation.mutate({ id, updates }),
    updateAccountAsync: (id: string, updates: UpdateAccount) =>
      mutation.mutateAsync({ id, updates }),
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
    },
  });

  return {
    deleteAccount: mutation.mutate,
    deleteAccountAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
