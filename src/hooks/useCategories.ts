import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/config';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../lib/supabase/categories';
import type { UpdateCategory } from '../lib/validation/categories';
import { useToast } from '../components/GlobalToastProvider';
import { DatabaseError } from '../lib/errors';

export function useCategories() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories', activeBookset?.id],
    queryFn: () => fetchCategories(activeBookset!.id),
    enabled: !!activeBookset,
  });

  useEffect(() => {
    if (!activeBookset) return;

    const channel = supabase
      .channel(`categories-changes-${activeBookset.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `bookset_id=eq.${activeBookset.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['categories', activeBookset.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBookset?.id, queryClient]);

  return {
    categories: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { activeBookset } = useAuth();
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
      showSuccess('Category created');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to create category';
      showError(message);
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
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCategory }) =>
      updateCategory(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
      showSuccess('Category updated');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to update category';
      showError(message);
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
  const { showError, showSuccess } = useToast();

  const mutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeBookset?.id] });
      showSuccess('Category deleted');
    },
    onError: (error) => {
      const message = error instanceof DatabaseError ? error.message : 'Failed to delete category';
      showError(message);
    },
  });

  return {
    deleteCategory: mutation.mutate,
    deleteCategoryAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
