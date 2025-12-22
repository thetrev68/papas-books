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

  if (isLoading) return <div>Loading payees...</div>;

  return (
    <div>
      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2>Payees</h2>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Add Payee
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        >
          <h3>{editingPayee ? 'Edit Payee' : 'Add Payee'}</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Default Category:</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <option value="">No default category</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Aliases:
              <button
                type="button"
                onClick={handleAddAlias}
                style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                Add Alias
              </button>
            </label>
            {formData.aliases.map((alias, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => handleUpdateAlias(index, e.target.value)}
                  placeholder="Alias text"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAlias(index)}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              {editingPayee ? 'Update' : 'Create'} Payee
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Default Category</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Aliases</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payees?.map((payee) => (
            <tr key={payee.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{payee.name}</td>
              <td style={{ padding: '0.5rem' }}>
                {categories?.find((c) => c.id === payee.category_id)?.name || 'None'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {payee.aliases.length > 0 ? payee.aliases.join(', ') : 'None'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <button
                  onClick={() => handleEdit(payee)}
                  style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }}
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
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {payees?.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
          No payees configured yet. Add your first payee to enable payee normalization.
        </p>
      )}
    </div>
  );
}
