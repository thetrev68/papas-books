import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateRule } from '../../hooks/useRules';
import { Transaction } from '../../types/database';
import { MatchType } from '../../types/rules';
import { useCategories } from '../../hooks/useCategories';
import Modal from '../ui/Modal';

interface CreateRuleFromTransactionButtonProps {
  transaction: Transaction;
}

export default function CreateRuleFromTransactionButton({
  transaction,
}: CreateRuleFromTransactionButtonProps) {
  const { createRule } = useCreateRule();
  const { activeBookset } = useAuth();
  const { categories } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Extract keyword helper
  function extractKeyword(description: string): string {
    const words = description.trim().toLowerCase().split(/\s+/);
    return words[0] || '';
  }

  // Initial state derived from transaction
  const [formData, setFormData] = useState({
    keyword: extractKeyword(transaction.original_description),
    matchType: 'contains' as MatchType,
    caseSensitive: false,
    targetCategoryId:
      (transaction.lines as Array<{ category_id: string | null }>)?.find(() => true)?.category_id ||
      '',
    suggestedPayee: transaction.payee,
    priority: 50,
    isEnabled: true,
  });

  async function handleCreateRule() {
    if (!activeBookset) return;

    await createRule({
      booksetId: activeBookset.id,
      ...formData,
    });
    setIsFormOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setIsFormOpen(true)}
        className="px-4 py-2 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
      >
        Create Rule
      </button>

      {isFormOpen && (
        <Modal title="Create Rule from Transaction" onClose={() => setIsFormOpen(false)}>
          <p className="text-lg text-neutral-600 mb-4">
            Transaction: {transaction.original_description}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">Keyword</label>
              <input
                type="text"
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">Category</label>
              <select
                value={formData.targetCategoryId}
                onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
                className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">Payee</label>
              <input
                type="text"
                value={formData.suggestedPayee}
                onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
                className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={handleCreateRule}
                className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700"
                type="button"
              >
                Create Rule
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
