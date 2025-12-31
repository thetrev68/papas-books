import { StagedTransaction } from './mapper';
import type { Transaction } from '../../types/database';
import { isDateLocked } from '../supabase/taxYearLocks';

export type ImportStatus = 'new' | 'duplicate' | 'fuzzy_duplicate' | 'error';

export interface ProcessedTransaction extends StagedTransaction {
  fingerprint: string; // SHA-256 hash
  status: ImportStatus; // Duplicate detection result
  duplicateOfId?: string; // If duplicate, points to existing transaction ID
  fuzzyMatches?: Transaction[]; // If fuzzy_duplicate, list of potential matches
}

/**
 * Detects exact duplicate transactions using fingerprint matching.
 *
 * Uses Map for O(1) lookup performance.
 *
 * @param incoming - Array of staged transactions with fingerprints
 * @param existingFingerprints - Map of fingerprints already in database
 * @returns Array of ProcessedTransactions with status field
 */
export function detectExactDuplicates(
  incoming: (StagedTransaction & { fingerprint: string })[],
  existingFingerprints: Map<string, string> // Map<fingerprint, transactionId>
): ProcessedTransaction[] {
  return incoming.map((transaction) => {
    const duplicateId = existingFingerprints.get(transaction.fingerprint);

    if (duplicateId) {
      return {
        ...transaction,
        status: 'duplicate',
        duplicateOfId: duplicateId,
      };
    }

    return {
      ...transaction,
      status: 'new',
    };
  });
}

/**
 * Validates import dates against locked tax years
 * Throws an error if any transactions are in locked years
 */
export async function validateImportDates(
  booksetId: string,
  transactions: { date?: string }[]
): Promise<{ valid: boolean; lockedDates: string[] }> {
  const lockedDates: string[] = [];

  for (const tx of transactions) {
    if (!tx.date) continue;
    const locked = await isDateLocked(booksetId, tx.date);
    if (locked) {
      lockedDates.push(tx.date);
    }
  }

  return {
    valid: lockedDates.length === 0,
    lockedDates,
  };
}
