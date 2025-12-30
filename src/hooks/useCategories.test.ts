/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './useCategories';
import { createQueryWrapper } from '../test-utils/queryWrapper';
import { mockCategory } from '../test-utils/fixtures';
import * as categoriesLib from '../lib/supabase/categories';
import { supabase } from '../lib/supabase/config';
import { DatabaseError } from '../lib/errors';

// Mock dependencies
vi.mock('../lib/supabase/categories', () => ({
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

// Mock AuthContext
const mockActiveBookset = { id: 'test-bookset-id', name: 'Test Bookset', owner_id: 'user-1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    activeBookset: mockActiveBookset,
  }),
}));

// Create hoisted mocks
const { mockShowSuccess, mockShowError } = vi.hoisted(() => ({
  mockShowSuccess: vi.fn(),
  mockShowError: vi.fn(),
}));

// Mock toast provider
vi.mock('../components/GlobalToastProvider', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

// Mock Supabase channel for real-time subscriptions
vi.mock('../lib/supabase/config', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('useCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should fetch categories for active bookset', async () => {
      const mockData = [mockCategory(), mockCategory({ id: 'cat-2', name: 'Office Supplies' })];
      vi.mocked(categoriesLib.fetchCategories).mockResolvedValue(mockData);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useCategories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(categoriesLib.fetchCategories).toHaveBeenCalledWith('test-bookset-id');
      expect(result.current.categories).toEqual(mockData);
    });

    it('should return empty array when no categories', async () => {
      vi.mocked(categoriesLib.fetchCategories).mockResolvedValue([]);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useCategories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.categories).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      vi.mocked(categoriesLib.fetchCategories).mockRejectedValue(error);

      const wrapper = createQueryWrapper();
      const { result } = renderHook(() => useCategories(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });

    it('should set up real-time subscription', () => {
      const wrapper = createQueryWrapper();
      renderHook(() => useCategories(), { wrapper });

      expect(supabase.channel).toHaveBeenCalledWith('categories-changes-test-bookset-id');
    });

    it('should clean up subscription on unmount', () => {
      const wrapper = createQueryWrapper();
      const { unmount } = renderHook(() => useCategories(), { wrapper });

      unmount();

      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });
});

describe('useCreateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create category and invalidate cache on success', async () => {
    const newCategory = mockCategory({ id: undefined as any });
    const createdCategory = mockCategory();

    vi.mocked(categoriesLib.createCategory).mockResolvedValue(createdCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    result.current.createCategory(newCategory);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(categoriesLib.createCategory).toHaveBeenCalledWith(
      newCategory,
      expect.objectContaining({
        client: expect.anything(),
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('Category created');
  });

  it('should show error message on create failure', async () => {
    const newCategory = mockCategory({ id: undefined as any });
    const dbError = new DatabaseError('Duplicate category name', 'DUPLICATE_ENTRY');

    vi.mocked(categoriesLib.createCategory).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    result.current.createCategory(newCategory);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Duplicate category name');
  });

  it('should show generic error for non-DatabaseError', async () => {
    const newCategory = mockCategory({ id: undefined as any });
    vi.mocked(categoriesLib.createCategory).mockRejectedValue(new Error('Network error'));

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    result.current.createCategory(newCategory);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Failed to create category');
  });

  it('should support async mutation', async () => {
    const newCategory = mockCategory({ id: undefined as any });
    const createdCategory = mockCategory();

    vi.mocked(categoriesLib.createCategory).mockResolvedValue(createdCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    const promise = result.current.createCategoryAsync(newCategory);

    const response = await promise;

    expect(response).toEqual(createdCategory);
    expect(mockShowSuccess).toHaveBeenCalledWith('Category created');
  });
});

describe('useUpdateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform optimistic update and confirm on success', async () => {
    const categoryId = 'cat-1';
    const updates = { name: 'Updated Category' };
    const updatedCategory = mockCategory({ id: categoryId, name: 'Updated Category' });

    vi.mocked(categoriesLib.updateCategory).mockResolvedValue(updatedCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    // Pre-populate cache
    const queryClient = (wrapper({}) as any).props.client;
    const initialCategories = [mockCategory({ id: categoryId, name: 'Original Category' })];
    queryClient.setQueryData(['categories', 'test-bookset-id'], initialCategories);

    result.current.updateCategory(categoryId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(categoriesLib.updateCategory).toHaveBeenCalledWith(categoryId, updates);
    expect(mockShowSuccess).toHaveBeenCalledWith('Category updated');
  });

  it('should rollback on error', async () => {
    const categoryId = 'cat-1';
    const updates = { name: 'Updated Category' };
    const dbError = new DatabaseError('Concurrent edit detected', 'CONCURRENT_EDIT');

    vi.mocked(categoriesLib.updateCategory).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    // Pre-populate cache
    const queryClient = (wrapper({}) as any).props.client;
    const initialCategories = [mockCategory({ id: categoryId, name: 'Original Category' })];
    queryClient.setQueryData(['categories', 'test-bookset-id'], initialCategories);

    result.current.updateCategory(categoryId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify error was handled
    expect(mockShowError).toHaveBeenCalledWith('Concurrent edit detected');
  });

  it('should invalidate queries after settled', async () => {
    const categoryId = 'cat-1';
    const updates = { name: 'Updated' };
    const updatedCategory = mockCategory({ id: categoryId, name: 'Updated' });

    vi.mocked(categoriesLib.updateCategory).mockResolvedValue(updatedCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['categories', 'test-bookset-id'], [mockCategory({ id: categoryId })]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.updateCategory(categoryId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['categories', 'test-bookset-id'] });
  });

  it('should support async mutation', async () => {
    const categoryId = 'cat-1';
    const updates = { name: 'Updated' };
    const updatedCategory = mockCategory({ id: categoryId, name: 'Updated' });

    vi.mocked(categoriesLib.updateCategory).mockResolvedValue(updatedCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['categories', 'test-bookset-id'], [mockCategory({ id: categoryId })]);

    const promise = result.current.updateCategoryAsync(categoryId, updates);

    const response = await promise;

    expect(response).toEqual(updatedCategory);
    expect(mockShowSuccess).toHaveBeenCalledWith('Category updated');
  });

  it('should handle hierarchical updates', async () => {
    const categoryId = 'cat-1';
    const updates = {
      name: 'Updated Category',
      parent_category_id: 'parent-cat-id',
      tax_line_item: 'Schedule C Line 1',
      is_tax_deductible: true,
    };
    const updatedCategory = mockCategory({ id: categoryId, ...updates });

    vi.mocked(categoriesLib.updateCategory).mockResolvedValue(updatedCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['categories', 'test-bookset-id'], [mockCategory({ id: categoryId })]);

    result.current.updateCategory(categoryId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(categoriesLib.updateCategory).toHaveBeenCalledWith(categoryId, updates);
  });

  it('should handle sort order updates', async () => {
    const categoryId = 'cat-1';
    const updates = { sort_order: 5 };
    const updatedCategory = mockCategory({ id: categoryId, sort_order: 5 });

    vi.mocked(categoriesLib.updateCategory).mockResolvedValue(updatedCategory);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    queryClient.setQueryData(['categories', 'test-bookset-id'], [mockCategory({ id: categoryId })]);

    result.current.updateCategory(categoryId, updates);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(categoriesLib.updateCategory).toHaveBeenCalledWith(categoryId, updates);
  });
});

describe('useDeleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete category and invalidate cache on success', async () => {
    const categoryId = 'cat-to-delete';
    vi.mocked(categoriesLib.deleteCategory).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    result.current.deleteCategory(categoryId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(categoriesLib.deleteCategory).toHaveBeenCalledWith(
      categoryId,
      expect.objectContaining({
        client: expect.anything(),
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('Category deleted');
  });

  it('should show error message on delete failure', async () => {
    const categoryId = 'nonexistent-id';
    const dbError = new DatabaseError('Category has transactions', 'FOREIGN_KEY_VIOLATION');

    vi.mocked(categoriesLib.deleteCategory).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    result.current.deleteCategory(categoryId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Category has transactions');
  });

  it('should show error when deleting category with children', async () => {
    const categoryId = 'parent-cat-id';
    const dbError = new DatabaseError('Cannot delete category with children', 'HAS_CHILDREN');

    vi.mocked(categoriesLib.deleteCategory).mockRejectedValue(dbError);

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    result.current.deleteCategory(categoryId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockShowError).toHaveBeenCalledWith('Cannot delete category with children');
  });

  it('should support async mutation', async () => {
    const categoryId = 'cat-to-delete';
    vi.mocked(categoriesLib.deleteCategory).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    const promise = result.current.deleteCategoryAsync(categoryId);

    await promise;

    expect(categoriesLib.deleteCategory).toHaveBeenCalledWith(
      categoryId,
      expect.objectContaining({
        client: expect.anything(),
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('Category deleted');
  });

  it('should invalidate cache after delete', async () => {
    const categoryId = 'cat-to-delete';
    vi.mocked(categoriesLib.deleteCategory).mockResolvedValue();

    const wrapper = createQueryWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    const queryClient = (wrapper({}) as any).props.client;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.deleteCategory(categoryId);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['categories', 'test-bookset-id'] });
  });
});
