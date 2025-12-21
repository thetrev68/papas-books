import { supabase } from './config';
import type { Category } from '../../types/database';
import type { InsertCategory, UpdateCategory } from '../validation/categories';

export async function fetchCategories(booksetId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('booksetId', booksetId)
    .eq('isArchived', false)
    .order('sortOrder', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(category: InsertCategory): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      booksetId: category.booksetId,
      name: category.name,
      isTaxDeductible: category.isTaxDeductible ?? false,
      taxLineItem: category.taxLineItem ?? null,
      parentCategoryId: category.parentCategoryId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isArchived: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: UpdateCategory): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ isArchived: true }).eq('id', id);

  if (error) throw error;
}
