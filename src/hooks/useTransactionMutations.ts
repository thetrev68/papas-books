import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateReviewed,
} from '../lib/supabase/transactions';
import type { Transaction } from '../types/database';
import type { BulkOperation } from '../lib/transactionOperations';

export function useTransactionMutations() {
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => createTransaction(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => updateTransaction(transaction),
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const previousTransactions = queryClient.getQueryData(['transactions']);
      queryClient.setQueryData(['transactions'], (old: Transaction[] = []) => {
        return old.map((tx) => (tx.id === newTransaction.id ? newTransaction : tx));
      });
      return { previousTransactions };
    },
    onError: (_err, _newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (operation: BulkOperation) => {
      if (operation.type === 'markReviewed') {
        return bulkUpdateReviewed(operation.transactionIds, true);
      } else if (operation.type === 'markUnreviewed') {
        return bulkUpdateReviewed(operation.transactionIds, false);
      } else if (operation.type === 'applyRules') {
        // This would be implemented with rules application
        throw new Error('Apply rules bulk operation not implemented yet');
      }
      throw new Error('Unknown bulk operation type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return {
    createTransaction: createTransactionMutation.mutate,
    updateTransaction: updateTransactionMutation.mutate,
    deleteTransaction: deleteTransactionMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    isLoading:
      createTransactionMutation.isPending ||
      updateTransactionMutation.isPending ||
      deleteTransactionMutation.isPending ||
      bulkUpdateMutation.isPending,
  };
}
