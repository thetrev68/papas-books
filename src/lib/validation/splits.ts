import { SplitLine } from '../../types/database';
import { supabase } from '../supabase/config';

export async function validateSplitLines(
  lines: SplitLine[],
  booksetId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (lines.length === 0) {
    errors.push('At least one split line is required');
    return { valid: false, errors };
  }

  // Get all valid category IDs for this bookset
  const { data: categories, error } = await supabase
    .from('categories')
    .select('id')
    .eq('bookset_id', booksetId)
    .eq('is_archived', false);

  if (error) {
    errors.push('Failed to validate categories');
    return { valid: false, errors };
  }

  const validCategoryIds = new Set(categories?.map((c) => c.id) || []);

  // Check each split line
  lines.forEach((line, index) => {
    if (!line.category_id) {
      errors.push(`Split line ${index + 1}: Category is required`);
    } else if (!validCategoryIds.has(line.category_id)) {
      errors.push(`Split line ${index + 1}: Category no longer exists`);
    }

    if (line.amount === 0) {
      errors.push(`Split line ${index + 1}: Amount cannot be zero`);
    }
  });

  return { valid: errors.length === 0, errors };
}
