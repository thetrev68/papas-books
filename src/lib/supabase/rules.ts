import { supabase } from './config';
import { Rule } from '../../types/database';
import { InsertRule, UpdateRule } from '../../types/rules';
import { handleSupabaseError, DatabaseError } from '../errors';

/**
 * Fetches all rules for a bookset.
 *
 * Filters:
 * - By booksetId (RLS enforces this, but explicit for clarity)
 * - Includes both enabled and disabled rules (UI will filter)
 *
 * Sorting:
 * - By priority descending (highest priority first)
 *
 * @param booksetId - Bookset UUID
 * @returns Array of rules
 */
export async function fetchRules(booksetId: string): Promise<Rule[]> {
  try {
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('bookset_id', booksetId)
      .order('priority', { ascending: false });

    if (error) {
      handleSupabaseError(error);
    }
    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch rules', undefined, error);
  }
}

/**
 * Creates a new rule.
 *
 * Defaults:
 * - useCount: 0
 * - lastUsedAt: null
 *
 * Database triggers set:
 * - createdBy, createdAt, lastModifiedBy, updatedAt
 *
 * @param rule - Rule data
 * @returns Created rule with all fields
 */
export async function createRule(rule: InsertRule): Promise<Rule> {
  try {
    const { data, error } = await supabase
      .from('rules')
      .insert({
        bookset_id: rule.booksetId,
        keyword: rule.keyword.toLowerCase(), // Store in lowercase for case-insensitive matching
        match_type: rule.matchType,
        case_sensitive: rule.caseSensitive,
        target_category_id: rule.targetCategoryId,
        suggested_payee: rule.suggestedPayee || null,
        priority: rule.priority,
        is_enabled: rule.isEnabled,
        use_count: 0,
        last_used_at: null,
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to create rule', undefined, error);
  }
}

/**
 * Updates an existing rule.
 *
 * Note: If updating keyword, convert to lowercase for consistency.
 *
 * Database triggers update:
 * - lastModifiedBy, updatedAt
 *
 * @param id - Rule UUID
 * @param updates - Partial rule data
 * @returns Updated rule
 */
export async function updateRule(
  id: string,
  updates: UpdateRule,
  options?: { skipVersionCheck?: boolean }
): Promise<Rule> {
  try {
    const dbUpdates: Record<string, unknown> = {};

    // Normalize keyword if provided
    if (updates.keyword !== undefined) {
      dbUpdates.keyword = updates.keyword.toLowerCase();
    }

    if (updates.matchType !== undefined) dbUpdates.match_type = updates.matchType;
    if (updates.caseSensitive !== undefined) dbUpdates.case_sensitive = updates.caseSensitive;
    if (updates.targetCategoryId !== undefined)
      dbUpdates.target_category_id = updates.targetCategoryId;
    if (updates.suggestedPayee !== undefined)
      dbUpdates.suggested_payee = updates.suggestedPayee || null;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.isEnabled !== undefined) dbUpdates.is_enabled = updates.isEnabled;

    let query = supabase.from('rules').update(dbUpdates).eq('id', id);

    // Optimistic locking: only update if updated_at hasn't changed
    if (!options?.skipVersionCheck && updates.updatedAt) {
      query = query.eq('updated_at', updates.updatedAt);
    }

    const { data, error } = await query.select().single();

    if (error) {
      // Check if no rows were updated (version conflict)
      if (error.code === 'PGRST116') {
        throw new DatabaseError(
          'This rule was modified by another user. Please reload and try again.',
          'CONCURRENT_EDIT',
          error
        );
      }
      handleSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError(
        'This rule was modified by another user. Please reload and try again.',
        'CONCURRENT_EDIT'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update rule', undefined, error);
  }
}

/**
 * Deletes a rule.
 *
 * Hard delete (not soft delete).
 *
 * @param id - Rule UUID
 */
export async function deleteRule(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('rules').delete().eq('id', id);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete rule', undefined, error);
  }
}
