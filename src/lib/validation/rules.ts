import { z } from 'zod';
import { MAX_PAYEE_LENGTH } from './import';

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

// Additional validation: Test regex patterns
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    // For actual SyntaxErrors coming from RegExp, return the specific message
    // (e.g. 'Unterminated character class'). For other errors (including
    // non-Error objects or errors due to mocking/non-constructible RegExp),
    // return a generic message to avoid leaking unexpected messages.
    if (error instanceof Error && error.name === 'SyntaxError') {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Invalid regex pattern' };
  }
}
