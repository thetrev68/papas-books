import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPayees, createPayee, updatePayee, deletePayee } from '../../lib/supabase/payees';
import { fetchCategories } from '../../lib/supabase/categories';
import type { Payee } from '../../types/database';

export default function PayeesTab() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    aliases: [] as string[],
  });

  // Fetch payees
  const { data: payees, isLoading } = useQuery({
    queryKey: ['payees', activeBookset?.id],
    queryFn: () => fetchPayees(activeBookset!.id),
    enabled: !!activeBookset,
  });

  // Fetch categories for dropdown
  const { data: categories } = useQuery({
    queryKey: ['categories', activeBookset?.id],
    queryFn: () => fetchCategories(activeBookset!.id),
    enabled: !!activeBookset,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      createPayee({
        bookset_id: activeBookset!.id,
        name: data.name,
        category_id: data.category_id || undefined,
        aliases: data.aliases,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payee> }) => updatePayee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      setEditingPayee(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePayee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', category_id: '', aliases: [] });
    setShowForm(false);
    setEditingPayee(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPayee) {
      updateMutation.mutate({ id: editingPayee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (payee: Payee) => {
    setEditingPayee(payee);
    setFormData({
      name: payee.name,
      category_id: payee.category_id || '',
      aliases: [...payee.aliases],
    });
    setShowForm(true);
  };

  const handleAddAlias = () => {
    setFormData((prev) => ({
      ...prev,
      aliases: [...prev.aliases, ''],
    }));
  };

  const handleUpdateAlias = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      aliases: prev.aliases.map((alias, i) => (i === index ? value : alias)),
    }));
  };

  const handleRemoveAlias = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) return <div className="text-lg text-neutral-500">Loading payees...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-neutral-900">Payees</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Add Payee
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm space-y-4"
        >
          <h3 className="text-xl font-bold text-neutral-900">
            {editingPayee ? 'Edit Payee' : 'Add Payee'}
          </h3>

          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">
              Default Category
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
              className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="">No default category</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-neutral-500">Aliases</label>
              <button
                type="button"
                onClick={handleAddAlias}
                className="px-3 py-2 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
              >
                Add Alias
              </button>
            </div>
            <div className="space-y-3">
              {formData.aliases.map((alias, index) => (
                <div key={index} className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => handleUpdateAlias(index, e.target.value)}
                    placeholder="Alias text"
                    className="flex-1 min-w-[220px] p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAlias(index)}
                    className="px-4 py-3 bg-danger-100 text-danger-700 font-bold rounded-xl border border-danger-700 hover:bg-danger-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            >
              {editingPayee ? 'Update' : 'Create'} Payee
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-neutral-100 border-b-2 border-neutral-200">
            <tr>
              <th className="p-4 text-base font-bold text-neutral-600">Name</th>
              <th className="p-4 text-base font-bold text-neutral-600">Default Category</th>
              <th className="p-4 text-base font-bold text-neutral-600">Aliases</th>
              <th className="p-4 text-base font-bold text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-lg">
            {payees?.map((payee) => (
              <tr key={payee.id} className="hover:bg-neutral-50">
                <td className="p-4 font-medium text-neutral-900">{payee.name}</td>
                <td className="p-4">
                  {categories?.find((c) => c.id === payee.category_id)?.name || 'None'}
                </td>
                <td className="p-4">
                  {payee.aliases.length > 0 ? payee.aliases.join(', ') : 'None'}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleEdit(payee)}
                    className="px-4 py-2 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete payee "${payee.name}"?`)) {
                        deleteMutation.mutate(payee.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2 bg-danger-100 text-danger-700 font-bold rounded-xl border border-danger-700 hover:bg-danger-200 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payees?.length === 0 && (
        <p className="text-center text-neutral-500 mt-8">
          No payees configured yet. Add your first payee to enable payee normalization.
        </p>
      )}
    </div>
  );
}
