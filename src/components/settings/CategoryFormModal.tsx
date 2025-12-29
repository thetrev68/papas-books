import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateCategory, useUpdateCategory, useCategories } from '../../hooks/useCategories';
import { useOptimisticLocking } from '../../hooks/useOptimisticLocking';
import { insertCategorySchema } from '../../lib/validation/categories';
import type { Category } from '../../types/database';
import Modal from '../ui/Modal';
import { VersionConflictModal } from '../common/VersionConflictModal';

interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
}

export default function CategoryFormModal({ category, onClose }: CategoryFormModalProps) {
  const { activeBookset } = useAuth();
  const { categories } = useCategories();
  const { createCategoryAsync, isLoading: isCreating } = useCreateCategory();
  const { updateCategoryAsync, isLoading: isUpdating } = useUpdateCategory();

  // Optimistic locking for concurrent edit detection
  const { conflictData, checkForConflict, resolveConflict, hasConflict, clearConflict } =
    useOptimisticLocking<Category>(['categories', activeBookset?.id || '']);

  const [formData, setFormData] = useState({
    name: category?.name || '',
    isTaxDeductible: category?.is_tax_deductible || false,
    taxLineItem: category?.tax_line_item || '',
    parentCategoryId: category?.parent_category_id || '',
    sortOrder: category?.sort_order ?? 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        isTaxDeductible: category.is_tax_deductible,
        taxLineItem: category.tax_line_item || '',
        parentCategoryId: category.parent_category_id || '',
        sortOrder: category.sort_order,
      });
    }
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activeBookset) {
      setErrors({ form: 'No active bookset' });
      return;
    }

    if (category && formData.parentCategoryId === category.id) {
      setErrors({ parentCategoryId: 'Category cannot be its own parent' });
      return;
    }

    const validation = insertCategorySchema.safeParse({
      booksetId: activeBookset.id,
      name: formData.name,
      isTaxDeductible: formData.isTaxDeductible,
      taxLineItem: formData.taxLineItem || undefined,
      parentCategoryId: formData.parentCategoryId || null,
      sortOrder: formData.sortOrder,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      if (category) {
        // Build updated category object
        const updatedCategory: Category = {
          ...category,
          name: validation.data.name,
          is_tax_deductible: validation.data.isTaxDeductible,
          tax_line_item: validation.data.taxLineItem ?? null,
          parent_category_id: validation.data.parentCategoryId ?? null,
          sort_order: validation.data.sortOrder ?? category.sort_order,
        };

        // Check for concurrent edits
        const hasConflict = await checkForConflict(category, updatedCategory);
        if (hasConflict) return; // Show conflict modal

        await updateCategoryAsync(category.id, {
          name: validation.data.name,
          isTaxDeductible: validation.data.isTaxDeductible,
          taxLineItem: validation.data.taxLineItem,
          parentCategoryId: validation.data.parentCategoryId,
          sortOrder: validation.data.sortOrder,
        });
      } else {
        await createCategoryAsync(validation.data);
      }
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'An error occurred' });
    }
  }

  const handleConflictResolve = async (strategy: 'overwrite' | 'reload') => {
    const resolvedRecord = resolveConflict(strategy);
    if (strategy === 'overwrite' && resolvedRecord && category) {
      // User chose to keep their changes - force the update
      try {
        await updateCategoryAsync(category.id, {
          name: resolvedRecord.name,
          isTaxDeductible: resolvedRecord.is_tax_deductible,
          taxLineItem: resolvedRecord.tax_line_item || undefined,
          parentCategoryId: resolvedRecord.parent_category_id,
          sortOrder: resolvedRecord.sort_order,
        });
        onClose();
      } catch (error) {
        setErrors({ form: error instanceof Error ? error.message : 'An error occurred' });
      }
    } else if (strategy === 'reload' && conflictData) {
      // User chose to reload - update form with server version
      const serverRecord = conflictData.serverRecord;
      setFormData({
        name: serverRecord.name,
        isTaxDeductible: serverRecord.is_tax_deductible,
        taxLineItem: serverRecord.tax_line_item || '',
        parentCategoryId: serverRecord.parent_category_id || '',
        sortOrder: serverRecord.sort_order,
      });
    }
  };

  return (
    <>
      <Modal title={category ? 'Edit Category' : 'Create Category'} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
            {errors.name && (
              <div className="text-danger-700 dark:text-red-400 mt-1 text-sm">{errors.name}</div>
            )}
          </div>

          <label className="flex items-center gap-3 p-3 border-2 border-neutral-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700">
            <input
              type="checkbox"
              checked={formData.isTaxDeductible}
              onChange={(e) => setFormData({ ...formData, isTaxDeductible: e.target.checked })}
              className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300 dark:border-gray-600"
            />
            <span className="text-lg font-medium text-neutral-900 dark:text-gray-100">
              Tax Deductible
            </span>
          </label>

          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              Tax Line Item (optional)
            </label>
            <input
              type="text"
              value={formData.taxLineItem}
              onChange={(e) => setFormData({ ...formData, taxLineItem: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              placeholder="e.g., Schedule C - Line 7"
            />
            {errors.taxLineItem && (
              <div className="text-danger-700 dark:text-red-400 mt-1 text-sm">
                {errors.taxLineItem}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              Parent Category (optional)
            </label>
            <select
              value={formData.parentCategoryId}
              onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="">None (top-level)</option>
              {categories
                .filter((c) => c.id !== category?.id && c.parent_category_id === null)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.parentCategoryId && (
              <div className="text-danger-700 dark:text-red-400 mt-1 text-sm">
                {errors.parentCategoryId}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
              }
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
            {errors.sortOrder && (
              <div className="text-danger-700 dark:text-red-400 mt-1 text-sm">
                {errors.sortOrder}
              </div>
            )}
          </div>

          {errors.form && (
            <div className="text-danger-700 dark:text-red-400 text-sm">{errors.form}</div>
          )}

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {hasConflict && conflictData && (
        <VersionConflictModal
          isOpen={hasConflict}
          entityType="category"
          entityName={conflictData.updatedRecord.name}
          yourChanges={conflictData.updatedRecord}
          theirChanges={conflictData.serverRecord}
          onResolve={handleConflictResolve}
          onClose={() => clearConflict()}
        />
      )}
    </>
  );
}
