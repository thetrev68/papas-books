import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateCategory, useUpdateCategory, useCategories } from '../../hooks/useCategories';
import { insertCategorySchema } from '../../lib/validation/categories';
import type { Category } from '../../types/database';

interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
}

export default function CategoryFormModal({ category, onClose }: CategoryFormModalProps) {
  const { activeBookset } = useAuth();
  const { categories } = useCategories();
  const { createCategoryAsync, isLoading: isCreating } = useCreateCategory();
  const { updateCategoryAsync, isLoading: isUpdating } = useUpdateCategory();

  const [formData, setFormData] = useState({
    name: category?.name || '',
    isTaxDeductible: category?.isTaxDeductible || false,
    taxLineItem: category?.taxLineItem || '',
    parentCategoryId: category?.parentCategoryId || '',
    sortOrder: category?.sortOrder ?? 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        isTaxDeductible: category.isTaxDeductible,
        taxLineItem: category.taxLineItem || '',
        parentCategoryId: category.parentCategoryId || '',
        sortOrder: category.sortOrder,
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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          borderRadius: '8px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{category ? 'Edit Category' : 'Create Category'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {errors.name && <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.name}</div>}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.isTaxDeductible}
                onChange={(e) => setFormData({ ...formData, isTaxDeductible: e.target.checked })}
              />
              Tax Deductible
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Tax Line Item (optional):
            </label>
            <input
              type="text"
              value={formData.taxLineItem}
              onChange={(e) => setFormData({ ...formData, taxLineItem: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
              placeholder="e.g., Schedule C - Line 7"
            />
            {errors.taxLineItem && (
              <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.taxLineItem}</div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Parent Category (optional):
            </label>
            <select
              value={formData.parentCategoryId}
              onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">None (top-level)</option>
              {categories
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.parentCategoryId && (
              <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.parentCategoryId}</div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Sort Order:</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
              }
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {errors.sortOrder && (
              <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.sortOrder}</div>
            )}
          </div>

          {errors.form && <div style={{ color: 'red', marginBottom: '1rem' }}>{errors.form}</div>}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
