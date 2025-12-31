import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateReviewed,
  bulkUpdateCategory,
} from '../lib/supabase/transactions';
import type { Transaction } from '../types/database';
import type { BulkOperation } from '../lib/transactionOperations';
import { useToast } from '../components/GlobalToastProvider';
import { DatabaseError } from '../lib/errors';

export function useTransactionMutations(booksetId: string) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const createTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => createTransaction(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
      showSuccess('Transaction created');
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to create transaction';
      showError(message);
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => updateTransaction(transaction),
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', booksetId] });
      const previousTransactions = queryClient.getQueryData(['transactions', booksetId]);
      queryClient.setQueryData(['transactions', booksetId], (old: Transaction[] = []) => {
        return old.map((tx) => (tx.id === newTransaction.id ? newTransaction : tx));
      });
      return { previousTransactions };
    },
    onError: (error, _newTransaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions', booksetId], context.previousTransactions);
      }
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to update transaction';
      showError(message);
    },
    onSuccess: () => {
      showSuccess('Transaction updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });
      showSuccess('Transaction deleted');
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to delete transaction';
      showError(message);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (operation: BulkOperation) => {
      if (operation.type === 'markReviewed') {
        await bulkUpdateReviewed(operation.transactionIds, true);
        return undefined;
      } else if (operation.type === 'markUnreviewed') {
        await bulkUpdateReviewed(operation.transactionIds, false);
        return undefined;
      } else if (operation.type === 'updateCategory') {
        return await bulkUpdateCategory(operation.transactionIds, operation.categoryId);
      } else if (operation.type === 'applyRules') {
        // This would be implemented with rules application
        throw new Error('Apply rules bulk operation not implemented yet');
      }
      throw new Error('Unknown bulk operation type');
    },
    onSuccess: (result, operation) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', booksetId] });

      // Show specific success message for category updates
      if (operation.type === 'updateCategory' && result) {
        const { updatedCount, skippedCount } = result;
        if (updatedCount > 0) {
          showSuccess(
            `Updated ${updatedCount} transaction${updatedCount === 1 ? '' : 's'}` +
              (skippedCount > 0 ? ` (${skippedCount} skipped - locked or reconciled)` : '')
          );
        } else {
          showError('No transactions were updated (all are locked or reconciled)');
        }
      } else {
        showSuccess('Transactions updated');
      }
    },
    onError: (error) => {
      const message =
        error instanceof DatabaseError ? error.message : 'Failed to update transactions';
      showError(message);
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
