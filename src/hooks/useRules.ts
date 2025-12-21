import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchRules, createRule, updateRule, deleteRule } from '../lib/supabase/rules';
import { UpdateRule } from '../types/rules';

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

  const mutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
    },
  });

  return {
    createRule: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    error: mutation.error as Error | null,
  };
}

/**
 * Updates an existing rule.
 *
 * @returns Mutation function, loading state, error
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRule }) => updateRule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
    },
  });

  return {
    updateRule: (id: string, updates: UpdateRule) => mutation.mutateAsync({ id, updates }),
    isLoading: mutation.isLoading,
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

  const mutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', activeBookset?.id] });
    },
  });

  return {
    deleteRule: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    error: mutation.error as Error | null,
  };
}
