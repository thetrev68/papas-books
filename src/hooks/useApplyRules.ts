import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRules } from './useRules';
import { applyRulesToBatch } from '../lib/rules/applicator';
import { supabase } from '../lib/supabase/config';
import { Transaction } from '../types/database';
import { Rule, RuleBatchResult } from '../types/rules';

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
      // Fetch transactions in batches to avoid URL length limits
      // Supabase has a max URL length, so we batch IDs (safe limit: ~100 per batch)
      const BATCH_SIZE = 100;
      const allTransactions: Transaction[] = [];

      for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
        const batchIds = transactionIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.from('transactions').select('*').in('id', batchIds);

        if (error) throw error;
        if (data) allTransactions.push(...(data as Transaction[]));
      }

      if (allTransactions.length === 0) throw new Error('No transactions found');

      // Apply rules
      const batchResult = await applyRulesToBatch(allTransactions, rules as Rule[], {
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
    isApplying: mutation.isPending,
    error: mutation.error as Error | null,
    result,
  };
}
