import { z } from 'zod';

export const insertRuleSchema = z.object({
  booksetId: z.string().uuid(),
  keyword: z.string().min(1, 'Keyword is required').max(200),
  matchType: z.enum(['contains', 'exact', 'startsWith', 'regex']),
  caseSensitive: z.boolean(),
  targetCategoryId: z.string().uuid('Category is required'),
  suggestedPayee: z.string().max(200).optional(),
  priority: z.number().int().min(1).max(100),
  isEnabled: z.boolean(),
});

// Additional validation: Test regex patterns
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}
