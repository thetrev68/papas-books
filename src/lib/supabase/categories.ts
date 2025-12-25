import { supabase } from './config';
import type { Category } from '../../types/database';
import type { InsertCategory, UpdateCategory } from '../validation/categories';
import { handleSupabaseError, DatabaseError } from '../errors';

export async function fetchCategories(booksetId: string): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('bookset_id', booksetId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true });

    if (error) {
      handleSupabaseError(error);
    }
    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch categories', undefined, error);
  }
}

export async function createCategory(category: InsertCategory): Promise<Category> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        bookset_id: category.booksetId,
        name: category.name,
        is_tax_deductible: category.isTaxDeductible ?? false,
        tax_line_item: category.taxLineItem ?? null,
        parent_category_id: category.parentCategoryId ?? null,
        sort_order: category.sortOrder ?? 0,
        is_archived: false,
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to create category', undefined, error);
  }
}

export async function updateCategory(
  id: string,
  updates: UpdateCategory,
  options?: { skipVersionCheck?: boolean }
): Promise<Category> {
  try {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.isTaxDeductible !== undefined)
      dbUpdates.is_tax_deductible = updates.isTaxDeductible;
    if (updates.taxLineItem !== undefined) dbUpdates.tax_line_item = updates.taxLineItem;
    if (updates.parentCategoryId !== undefined)
      dbUpdates.parent_category_id = updates.parentCategoryId;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

    let query = supabase.from('categories').update(dbUpdates).eq('id', id);

    // Optimistic locking: only update if updated_at hasn't changed
    if (!options?.skipVersionCheck && updates.updatedAt) {
      query = query.eq('updated_at', updates.updatedAt);
    }

    const { data, error } = await query.select().single();

    if (error) {
      // Check if no rows were updated (version conflict)
      if (error.code === 'PGRST116') {
        throw new DatabaseError(
          'This category was modified by another user. Please reload and try again.',
          'CONCURRENT_EDIT',
          error
        );
      }
      handleSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError(
        'This category was modified by another user. Please reload and try again.',
        'CONCURRENT_EDIT'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update category', undefined, error);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('categories').update({ is_archived: true }).eq('id', id);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete category', undefined, error);
  }
}
