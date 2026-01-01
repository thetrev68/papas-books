import { z } from 'zod';
import { MAX_PAYEE_LENGTH } from './import';
import { validateRegexPattern } from '../rules/safeRegex';

export const insertRuleSchema = z.object({
  booksetId: z.string().uuid(),
  keyword: z.string().min(1, 'Keyword is required').max(200),
  matchType: z.enum(['contains', 'exact', 'startsWith', 'regex']),
  caseSensitive: z.boolean(),
  targetCategoryId: z.string().uuid('Category is required'),
  suggestedPayee: z.string().max(MAX_PAYEE_LENGTH).optional(),
  priority: z.number().int().min(1).max(100),
  isEnabled: z.boolean(),
});

/**
 * Validates regex patterns with ReDoS protection.
 *
 * Uses safe regex validation that checks for:
 * - Pattern syntax errors
 * - Nested quantifiers that could cause catastrophic backtracking
 * - Overly long patterns
 *
 * @param pattern - The regex pattern to validate
 * @returns Object with valid flag and optional error message
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  const result = validateRegexPattern(pattern);
  return {
    valid: result.isValid,
    error: result.error,
  };
}
