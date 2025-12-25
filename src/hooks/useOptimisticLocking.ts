import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Represents a database record with versioning via updated_at timestamp.
 * Used for optimistic locking to detect concurrent edits.
 */
export interface VersionedRecord {
  id: string;
  updated_at: string;
  last_modified_by?: string;
}

export interface ConflictData<T> {
  originalRecord: T;
  updatedRecord: T;
  serverRecord: T;
}

/**
 * Optimistic locking hook for detecting concurrent edits.
 *
 * Prevents users from overwriting each other's changes by comparing
 * the updated_at timestamp from the server with the local version.
 *
 * ## How It Works
 *
 * 1. Before updating, fetch the current server version
 * 2. Compare server's updated_at with our local updated_at
 * 3. If different: another user modified it → show conflict modal
 * 4. If same: proceed with update
 *
 * @example
 * ```typescript
 * const {
 *   conflictData,
 *   checkForConflict,
 *   resolveConflict,
 * } = useOptimisticLocking<Transaction>('transactions', booksetId);
 *
 * // Before saving
 * const hasConflict = await checkForConflict(originalTransaction, updatedTransaction);
 *
 * if (hasConflict) {
 *   // Show conflict modal to user
 *   setShowConflictModal(true);
 *   return;
 * }
 *
 * // No conflict - proceed with update
 * mutate(updatedTransaction);
 * ```
 */
export function useOptimisticLocking<T extends VersionedRecord>(
  queryKey: string[],
  enabled = true
) {
  const queryClient = useQueryClient();
  const [conflictData, setConflictData] = useState<ConflictData<T> | null>(null);

  /**
   * Checks if the record has been modified on the server since it was loaded.
   *
   * @param originalRecord - The record as it was when the user started editing
   * @param updatedRecord - The record with the user's changes
   * @returns true if conflict detected, false if safe to proceed
   */
  const checkForConflict = useCallback(
    async (originalRecord: T, updatedRecord: T): Promise<boolean> => {
      if (!enabled) return false;

      try {
        // Fetch current server version from cache
        const cachedData = queryClient.getQueryData<T[]>(queryKey);
        const serverRecord = cachedData?.find((record) => record.id === originalRecord.id);

        if (!serverRecord) {
          // Record not in cache - refetch to be safe
          await queryClient.invalidateQueries({ queryKey });
          return false;
        }

        // Compare timestamps
        if (serverRecord.updated_at !== originalRecord.updated_at) {
          // Conflict detected!
          setConflictData({
            originalRecord,
            updatedRecord,
            serverRecord,
          });
          return true;
        }

        // No conflict
        return false;
      } catch (error) {
        console.error('Error checking for conflicts:', error);
        // On error, allow the update to proceed (fail gracefully)
        return false;
      }
    },
    [queryClient, queryKey, enabled]
  );

  /**
   * Resolves a conflict and returns the chosen strategy.
   *
   * @param strategy - 'overwrite' to save anyway, 'reload' to discard changes
   * @returns The updated record to save (if overwrite) or null (if reload)
   */
  const resolveConflict = useCallback(
    (strategy: 'overwrite' | 'reload'): T | null => {
      if (!conflictData) return null;

      const result = strategy === 'overwrite' ? conflictData.updatedRecord : null;
      setConflictData(null);
      return result;
    },
    [conflictData]
  );

  /**
   * Clears any active conflict state.
   * Useful when the user cancels the edit operation entirely.
   */
  const clearConflict = useCallback(() => {
    setConflictData(null);
  }, []);

  return {
    conflictData,
    checkForConflict,
    resolveConflict,
    clearConflict,
    hasConflict: conflictData !== null,
  };
}
