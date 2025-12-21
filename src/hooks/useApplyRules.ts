import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRules } from './useRules';
import { applyRulesToBatch } from '../lib/rules/applicator';
import { supabase } from '../lib/supabase/config';
import { Transaction } from '../types/database';
import { RuleBatchResult } from '../types/rules';

/**
 * Hook for applying rules to transactions.
 *
 * Steps:
 * 1. Fetch specified transactions from database
 * 2. Apply rules using applyRulesToBatch()
 * 3. Invalidate transaction queries to trigger refetch
 *
 * @returns Mutation function, loading state, error, result
 */
export function useApplyRules() {
  const queryClient = useQueryClient();
  const { rules } = useRules();
  const [result, setResult] = useState<RuleBatchResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      // Fetch transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .in('id', transactionIds);

      if (error) throw error;
      if (!transactions) throw new Error('No transactions found');

      // Apply rules
      const batchResult = await applyRulesToBatch(transactions as Transaction[], rules, {
        overrideReviewed: false,
        setReviewedFlag: true, // Mark as reviewed after applying rule
      });

      setResult(batchResult);
      return batchResult;
    },
    onSuccess: () => {
      // Invalidate transaction queries
      // Note: This invalidates all transaction queries, which is safe but broad
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      // Also invalidate account balances potentially?
      // Categories shouldn't change, but balances might if amounts changed (rules don't change amounts though)
      // If we had splits, balances would be same.
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  return {
    applyRules: mutation.mutateAsync,
    isApplying: mutation.isLoading,
    error: mutation.error as Error | null,
    result,
  };
}
