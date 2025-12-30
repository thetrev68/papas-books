/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from './categories';
import { supabase } from './config';
import { DatabaseError } from '../errors';
import { mockCategory, mockCategoryHierarchy } from '../../test-utils/fixtures';
import type { InsertCategory, UpdateCategory } from '../validation/categories';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('fetchCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch categories for a bookset', async () => {
    const mockData = [mockCategory(), mockCategory({ id: 'category-2', name: 'Groceries' })];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchCategories('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.eq).toHaveBeenCalledWith('is_archived', false);
    expect(mockQuery.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(result).toEqual(mockData);
  });

  it('should return categories sorted by sort_order', async () => {
    const mockData = [
      mockCategory({ id: 'cat-1', sort_order: 0 }),
      mockCategory({ id: 'cat-2', sort_order: 1 }),
      mockCategory({ id: 'cat-3', sort_order: 2 }),
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchCategories('test-bookset-id');

    expect(mockQuery.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(result).toEqual(mockData);
  });

  it('should return empty array when no categories found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchCategories('test-bookset-id');

    expect(result).toEqual([]);
  });

  it('should throw DatabaseError on Supabase error', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(fetchCategories('test-bookset-id')).rejects.toThrow(DatabaseError);
  });
});

describe('createCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new category with all fields', async () => {
    const newCategory: InsertCategory = {
      booksetId: 'test-bookset-id',
      name: 'Office Supplies',
      isTaxDeductible: true,
      taxLineItem: 'Schedule C, Line 18',
      parentCategoryId: null,
      sortOrder: 5,
    };

    const createdCategory = mockCategory({
      name: newCategory.name,
      is_tax_deductible: newCategory.isTaxDeductible,
      tax_line_item: newCategory.taxLineItem,
      sort_order: newCategory.sortOrder,
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createCategory(newCategory);

    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(mockQuery.insert).toHaveBeenCalledWith({
      bookset_id: newCategory.booksetId,
      name: newCategory.name,
      is_tax_deductible: newCategory.isTaxDeductible,
      tax_line_item: newCategory.taxLineItem,
      parent_category_id: null,
      sort_order: 5,
      is_archived: false,
    });
    expect(result).toEqual(createdCategory);
  });

  it('should create category with default values for optional fields', async () => {
    const newCategory: InsertCategory = {
      booksetId: 'test-bookset-id',
      name: 'Simple Category',
      isTaxDeductible: false,
    };

    const createdCategory = mockCategory({
      name: 'Simple Category',
      is_tax_deductible: false,
      tax_line_item: null,
      parent_category_id: null,
      sort_order: 0,
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await createCategory(newCategory);

    expect(mockQuery.insert).toHaveBeenCalledWith({
      bookset_id: newCategory.booksetId,
      name: newCategory.name,
      is_tax_deductible: false,
      tax_line_item: null,
      parent_category_id: null,
      sort_order: 0,
      is_archived: false,
    });
  });

  it('should create child category with parent reference', async () => {
    const newCategory: InsertCategory = {
      booksetId: 'test-bookset-id',
      name: 'Office Expenses',
      isTaxDeductible: true,
      parentCategoryId: 'parent-category-id',
      sortOrder: 1,
    };

    const createdCategory = mockCategory({
      name: 'Office Expenses',
      parent_category_id: 'parent-category-id',
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createCategory(newCategory);

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_category_id: 'parent-category-id',
      })
    );
    expect(result.parent_category_id).toBe('parent-category-id');
  });

  it('should throw DatabaseError on creation failure', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Duplicate name', code: '23505' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const newCategory: InsertCategory = {
      booksetId: 'test-bookset-id',
      name: 'Duplicate',
      isTaxDeductible: false,
    };

    await expect(createCategory(newCategory)).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError on foreign key violation for parent', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Foreign key violation', code: '23503' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const newCategory: InsertCategory = {
      booksetId: 'test-bookset-id',
      name: 'Child Category',
      isTaxDeductible: false,
      parentCategoryId: 'nonexistent-parent-id',
    };

    await expect(createCategory(newCategory)).rejects.toThrow(/in use/);
  });
});

describe('updateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update category with optimistic locking', async () => {
    const updates: UpdateCategory = {
      name: 'Updated Category Name',
      isTaxDeductible: true,
      taxLineItem: 'Schedule C, Line 10',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const updatedCategory = mockCategory({
      name: updates.name,
      is_tax_deductible: updates.isTaxDeductible,
      tax_line_item: updates.taxLineItem,
      updated_at: '2024-01-15T10:30:00Z',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updateCategory('category-id-123', updates);

    expect(mockQuery.update).toHaveBeenCalledWith({
      name: updates.name,
      is_tax_deductible: updates.isTaxDeductible,
      tax_line_item: updates.taxLineItem,
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'category-id-123');
    expect(mockQuery.eq).toHaveBeenCalledWith('updated_at', updates.updatedAt);
    expect(result).toEqual(updatedCategory);
  });

  it('should skip version check when option is set', async () => {
    const updates: UpdateCategory = {
      name: 'Updated Name',
    };

    const updatedCategory = mockCategory({ name: 'Updated Name' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateCategory('category-id-123', updates, { skipVersionCheck: true });

    // Should only have one eq call (for id), not two (id + updated_at)
    expect(mockQuery.eq).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'category-id-123');
  });

  it('should update parent category relationship', async () => {
    const updates: UpdateCategory = {
      parentCategoryId: 'new-parent-id',
    };

    const updatedCategory = mockCategory({ parent_category_id: 'new-parent-id' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateCategory('category-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      parent_category_id: 'new-parent-id',
    });
  });

  it('should update sort order', async () => {
    const updates: UpdateCategory = {
      sortOrder: 10,
    };

    const updatedCategory = mockCategory({ sort_order: 10 });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateCategory('category-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({ sort_order: 10 });
  });

  it('should update tax deductible status and tax line item together', async () => {
    const updates: UpdateCategory = {
      isTaxDeductible: true,
      taxLineItem: 'Schedule A, Line 5',
    };

    const updatedCategory = mockCategory({
      is_tax_deductible: true,
      tax_line_item: 'Schedule A, Line 5',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateCategory('category-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      is_tax_deductible: true,
      tax_line_item: 'Schedule A, Line 5',
    });
  });

  it('should throw CONCURRENT_EDIT error when version conflict occurs', async () => {
    const updates: UpdateCategory = {
      name: 'Updated',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows updated' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateCategory('category-id-123', updates)).rejects.toThrow(DatabaseError);
    await expect(updateCategory('category-id-123', updates)).rejects.toThrow(
      /modified by another user/
    );
  });

  it('should throw CONCURRENT_EDIT when no data returned', async () => {
    const updates: UpdateCategory = {
      name: 'Updated',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateCategory('category-id-123', updates)).rejects.toThrow(
      /modified by another user/
    );
  });

  it('should update only name when other fields are undefined', async () => {
    const updates: UpdateCategory = {
      name: 'Just Name Update',
    };

    const updatedCategory = mockCategory({ name: 'Just Name Update' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateCategory('category-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({ name: 'Just Name Update' });
  });

  it('should handle foreign key violation when setting invalid parent', async () => {
    const updates: UpdateCategory = {
      parentCategoryId: 'nonexistent-parent',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'Foreign key violation' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(
      updateCategory('category-id-123', updates, { skipVersionCheck: true })
    ).rejects.toThrow(/in use/);
  });
});

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete category by setting is_archived', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteCategory('category-id-123');

    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(mockQuery.update).toHaveBeenCalledWith({ is_archived: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'category-id-123');
  });

  it('should throw DatabaseError on deletion failure', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteCategory('nonexistent-id')).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError on permission error', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteCategory('category-id-123')).rejects.toThrow(/do not have permission/);
  });

  it('should successfully delete parent category', async () => {
    const { parent } = mockCategoryHierarchy();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteCategory(parent.id);

    expect(mockQuery.update).toHaveBeenCalledWith({ is_archived: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', parent.id);
  });

  it('should successfully delete child category', async () => {
    const { children } = mockCategoryHierarchy();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteCategory(children[0].id);

    expect(mockQuery.update).toHaveBeenCalledWith({ is_archived: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', children[0].id);
  });
});
