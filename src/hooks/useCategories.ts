import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../lib/supabase/categories';
import type { UpdateCategory } from '../lib/validation/categories';

export function useCategories() {
  const { activeBookset } = useAuth();

  const query = useQuery({
    queryKey: ['categories', activeBookset?.id],
    queryFn: () => fetchCategories(activeBookset!.id),
    enabled: !!activeBookset,
  });

  return {
    categories: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
    },
  });

  return {
    createCategory: mutation.mutate,
    createCategoryAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCategory }) =>
      updateCategory(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
    },
  });

  return {
    updateCategory: (id: string, updates: UpdateCategory) => mutation.mutate({ id, updates }),
    updateCategoryAsync: (id: string, updates: UpdateCategory) =>
      mutation.mutateAsync({ id, updates }),
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();

  const mutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
    },
  });

  return {
    deleteCategory: mutation.mutate,
    deleteCategoryAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
