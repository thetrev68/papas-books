import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPayee, updatePayee } from '../../lib/supabase/payees';
import { fetchCategories } from '../../lib/supabase/categories';
import type { Payee } from '../../types/database';
import Modal from '../ui/Modal';

interface PayeeFormModalProps {
  payee?: Payee | null; // If null, create mode
  initialName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PayeeFormModal({
  payee,
  initialName,
  onClose,
  onSuccess,
}: PayeeFormModalProps) {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: initialName || '',
    default_category_id: '',
  });

  useEffect(() => {
    if (payee) {
      setFormData({
        name: payee.name,
        default_category_id: payee.default_category_id || '',
      });
    } else if (initialName) {
      setFormData((prev) => ({ ...prev, name: initialName }));
    }
  }, [payee, initialName]);

  const { data: categories } = useQuery({
    queryKey: ['categories', activeBookset?.id],
    queryFn: () => fetchCategories(activeBookset!.id),
    enabled: !!activeBookset,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      createPayee({
        bookset_id: activeBookset!.id,
        name: data.name,
        default_category_id: data.default_category_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      onSuccess?.();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payee> }) => updatePayee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      onSuccess?.();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payee) {
      updateMutation.mutate({ id: payee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Modal title={payee ? 'Edit Payee' : 'Add Payee'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block text-sm font-bold text-neutral-500 mb-1">Default Category</label>
          <p className="text-sm text-neutral-500 mb-2">
            This category will be automatically applied when this payee is assigned to a transaction
            (unless overridden by a rule).
          </p>
          <select
            value={formData.default_category_id}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, default_category_id: e.target.value }))
            }
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

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {payee ? 'Update' : 'Create'} Payee
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
