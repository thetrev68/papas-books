import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/config';
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../lib/supabase/accounts';
import type { UpdateAccount } from '../lib/validation/accounts';
import type { Account } from '../types/database';
import { useToast } from '../components/GlobalToastProvider';
import { DatabaseError } from '../lib/errors';

export function useAccounts() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['accounts', activeBookset?.id],
    queryFn: () => fetchAccounts(activeBookset!.id),
    enabled: !!activeBookset,
  });

  useEffect(() => {
    if (!activeBookset) return;

    const channel = supabase
      .channel(`accounts-changes-${activeBookset.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `bookset_id=eq.${activeBookset.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBookset?.id, queryClient]);

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
      showSuccess('Account created');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to create account';
      showError(message);
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
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateAccount }) =>
      updateAccount(id, updates),
    // Optimistic update
    onMutate: async ({ id, updates }) => {
      if (!activeBookset?.id) return;

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['accounts', activeBookset.id] });

      // Snapshot current data
      const previousAccounts = queryClient.getQueryData(['accounts', activeBookset.id]);

      // Optimistically update cache
      queryClient.setQueryData(['accounts', activeBookset.id], (old: Account[] = []) => {
        return old.map((account) => (account.id === id ? { ...account, ...updates } : account));
      });

      // Return context with snapshot
      return { previousAccounts };
    },
    // On error, rollback
    onError: (error, _variables, context) => {
      if (context?.previousAccounts && activeBookset?.id) {
        queryClient.setQueryData(['accounts', activeBookset.id], context.previousAccounts);
      }
      const message = error instanceof DatabaseError ? error.message : 'Failed to update account';
      showError(message);
    },
    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
    },
    onSuccess: () => {
      showSuccess('Account updated');
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
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeBookset?.id] });
      showSuccess('Account deleted');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to delete account';
      showError(message);
    },
  });

  return {
    deleteAccount: mutation.mutate,
    deleteAccountAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
