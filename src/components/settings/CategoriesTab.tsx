import { useState } from 'react';
import { useCategories, useDeleteCategory } from '../../hooks/useCategories';
import CategoryFormModal from './CategoryFormModal';
import type { Category } from '../../types/database';

export default function CategoriesTab() {
  const { categories, isLoading, error } = useCategories();
  const { deleteCategory } = useDeleteCategory();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  function handleCreate() {
    setEditingCategory(null);
    setIsFormOpen(true);
  }

  function handleEdit(category: Category) {
    setEditingCategory(category);
    setIsFormOpen(true);
  }

  function handleDelete(id: string) {
    const hasChildren = categories.some((c) => c.parent_category_id === id);
    if (hasChildren) {
      alert(
        'Cannot delete a category that has child categories. Please delete or reassign children first.'
      );
      return;
    }

    if (confirm('Delete this category? It will be archived.')) {
      deleteCategory(id);
    }
  }

  function getCategoryName(categoryId: string | null): string {
    if (!categoryId) return 'None';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={handleCreate}>Create Category</button>
      </div>

      {isLoading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}

      {!isLoading && !error && categories.length === 0 && (
        <div>No categories yet. Create one to get started!</div>
      )}

      {!isLoading && !error && categories.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Tax Deductible</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tax Line Item</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Parent Category</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Sort Order</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{category.name}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  {category.is_tax_deductible ? 'Yes' : 'No'}
                </td>
                <td style={{ padding: '0.5rem' }}>{category.tax_line_item || '-'}</td>
                <td style={{ padding: '0.5rem' }}>
                  {getCategoryName(category.parent_category_id)}
                </td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>{category.sort_order}</td>
                <td style={{ padding: '0.5rem' }}>
                  <button onClick={() => handleEdit(category)} style={{ marginRight: '0.5rem' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(category.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isFormOpen && (
        <CategoryFormModal category={editingCategory} onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  );
}
