import { useState } from 'react';
import { useCategories, useDeleteCategory } from '../../hooks/useCategories';
import CategoryFormModal from './CategoryFormModal';
import AuditHistoryModal from '../audit/AuditHistoryModal';
import type { Category } from '../../types/database';

export default function CategoriesTab() {
  const { categories, isLoading, error } = useCategories();
  const { deleteCategory } = useDeleteCategory();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [historyCategory, setHistoryCategory] = useState<Category | null>(null);

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
      <div className="mb-6">
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Create Category
        </button>
      </div>

      {isLoading && <div className="text-lg text-neutral-500 dark:text-gray-400">Loading...</div>}
      {error && <div className="text-danger-700">Error: {error.message}</div>}

      {!isLoading && !error && categories.length === 0 && (
        <div className="bg-neutral-50 dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-xl p-4 text-lg text-neutral-600 dark:text-gray-400">
          No categories yet. Create one to get started!
        </div>
      )}

      {!isLoading && !error && categories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700">
              <tr>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Name
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400 text-center">
                  Tax Deductible
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Tax Line Item
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Parent Category
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400 text-center">
                  Sort Order
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  <td className="p-4 font-medium text-neutral-900 dark:text-gray-100">
                    {category.name}
                  </td>
                  <td className="p-4 text-center">{category.is_tax_deductible ? 'Yes' : 'No'}</td>
                  <td className="p-4">{category.tax_line_item || '-'}</td>
                  <td className="p-4">{getCategoryName(category.parent_category_id)}</td>
                  <td className="p-4 text-center">{category.sort_order}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleEdit(category)}
                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 font-bold rounded-lg hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900 mr-2 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setHistoryCategory(category)}
                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 font-bold rounded-lg hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900 mr-2 text-sm"
                      title="View History"
                    >
                      History
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="px-3 py-1 bg-danger-100 dark:bg-red-700 text-danger-700 dark:text-white font-bold rounded-lg border border-danger-700 dark:border-red-600 hover:bg-danger-200 dark:hover:bg-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <CategoryFormModal category={editingCategory} onClose={() => setIsFormOpen(false)} />
      )}

      {historyCategory && (
        <AuditHistoryModal
          entityType="category"
          entityId={historyCategory.id}
          entityName={historyCategory.name}
          isOpen={true}
          onClose={() => setHistoryCategory(null)}
        />
      )}
    </div>
  );
}
