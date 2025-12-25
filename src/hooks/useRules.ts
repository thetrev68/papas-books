import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchRules, createRule, updateRule, deleteRule } from '../lib/supabase/rules';
import { UpdateRule } from '../types/rules';
import type { Rule } from '../types/database';
import { useToast } from '../components/GlobalToastProvider';
import { DatabaseError } from '../lib/errors';

/**
 * Fetches all rules for the active bookset.
 *
 * Cache key: ['rules', booksetId]
 * - Invalidated when bookset changes
 * - Invalidated after create/update/delete
 *
 * @returns Rules array, loading state, error
 */
export function useRules() {
  const { activeBookset } = useAuth();

  const query = useQuery({
    queryKey: ['rules', activeBookset?.id],
    queryFn: () => fetchRules(activeBookset!.id),
    enabled: !!activeBookset,
  });

  return {
    rules: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

/**
 * Creates a new rule.
 *
 * On success:
 * - Invalidates rules query to trigger refetch
 *
 * @returns Mutation function, loading state, error
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
      showSuccess('Rule created');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to create rule';
      showError(message);
    },
  });

  return {
    createRule: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

/**
 * Updates an existing rule.
 *
 * Implements optimistic updates for instant UI feedback.
 * On error, rolls back to previous state.
 *
 * @returns Mutation function, loading state, error
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRule }) => updateRule(id, updates),
    // Optimistic update
    onMutate: async ({ id, updates }) => {
      if (!activeBookset?.id) return;

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['rules', activeBookset.id] });

      // Snapshot current data
      const previousRules = queryClient.getQueryData(['rules', activeBookset.id]);

      // Optimistically update cache
      queryClient.setQueryData(['rules', activeBookset.id], (old: Rule[] = []) => {
        return old.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
      });

      // Return context with snapshot
      return { previousRules };
    },
    // On error, rollback
    onError: (error, _variables, context) => {
      if (context?.previousRules && activeBookset?.id) {
        queryClient.setQueryData(['rules', activeBookset.id], context.previousRules);
      }
      const message = error instanceof DatabaseError ? error.message : 'Failed to update rule';
      showError(message);
    },
    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
    },
    onSuccess: () => {
      showSuccess('Rule updated');
    },
  });

  return {
    updateRule: (id: string, updates: UpdateRule) => mutation.mutateAsync({ id, updates }),
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

/**
 * Deletes a rule.
 *
 * @returns Mutation function, loading state, error
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
      showSuccess('Rule deleted');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to delete rule';
      showError(message);
    },
  });

  return {
    deleteRule: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
