import type { Transaction } from '../types/database';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FieldValidation {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that split amounts sum to parent amount
 * Handles floating point precision issues
 */
export function validateSplitTransaction(transaction: Transaction): ValidationResult {
  if (!transaction.is_split) {
    return { isValid: true, errors: [] };
  }

  const total = transaction.lines.reduce((sum: number, line) => sum + (line.amount || 0), 0);
  const difference = total - transaction.amount;

  // Allow small floating point errors (less than 1 cent)
  if (Math.abs(difference) > 1) {
    return {
      isValid: false,
      errors: [`Split amounts don't sum to total. Difference: $${(difference / 100).toFixed(2)}`],
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Calculates remainder for split transaction UI
 */
export function calculateSplitRemainder(transaction: Transaction): number {
  if (!transaction.is_split) return 0;

  const allocated = transaction.lines.reduce((sum: number, line) => sum + (line.amount || 0), 0);
  return transaction.amount - allocated;
}

/**
 * Validates split line amount (can be positive or negative)
 */
export function validateSplitLineAmount(amount: number): FieldValidation {
  if (isNaN(amount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }
  if (!Number.isInteger(amount)) {
    return { isValid: false, error: 'Amount must be in cents (no decimals)' };
  }
  return { isValid: true };
}
