import { useState } from 'react';
import { useRules, useDeleteRule, useUpdateRule } from '../../hooks/useRules';
import { useCategories } from '../../hooks/useCategories';
import RuleFormModal from './RuleFormModal';
import { Rule } from '../../types/database';

export default function RulesTab() {
  const { rules, isLoading, error } = useRules();
  const { deleteRule } = useDeleteRule();
  const { updateRule } = useUpdateRule();
  const { categories } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  function handleCreate() {
    setEditingRule(null);
    setIsFormOpen(true);
  }

  function handleEdit(rule: Rule) {
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this rule?')) {
      await deleteRule(id);
    }
  }

  async function handleToggleEnabled(rule: Rule) {
    await updateRule(rule.id, { isEnabled: !rule.is_enabled });
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Create Rule
        </button>
      </div>

      {isLoading && <div className="text-lg text-neutral-500">Loading...</div>}
      {error && <div className="text-danger-700">Error: {error.message}</div>}

      {!isLoading && !error && rules.length === 0 && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-lg text-neutral-600">
          No rules defined yet. Create one to automate categorization!
        </div>
      )}

      {!isLoading && !error && rules.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 border-b-2 border-neutral-200">
              <tr>
                <th className="p-4 text-base font-bold text-neutral-600">Priority</th>
                <th className="p-4 text-base font-bold text-neutral-600">Keyword</th>
                <th className="p-4 text-base font-bold text-neutral-600">Match Type</th>
                <th className="p-4 text-base font-bold text-neutral-600">Category</th>
                <th className="p-4 text-base font-bold text-neutral-600">Payee</th>
                <th className="p-4 text-base font-bold text-neutral-600 text-center">Enabled</th>
                <th className="p-4 text-base font-bold text-neutral-600">Usage</th>
                <th className="p-4 text-base font-bold text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-lg">
              {rules.map((rule) => {
                const category = categories.find((c) => c.id === rule.target_category_id);

                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-neutral-50 ${rule.is_enabled ? '' : 'opacity-60'}`}
                  >
                    <td className="p-4">{rule.priority}</td>
                    <td className="p-4 font-medium text-neutral-900">{rule.keyword}</td>
                    <td className="p-4">{rule.match_type}</td>
                    <td className="p-4">{category?.name || 'Unknown'}</td>
                    <td className="p-4">{rule.suggested_payee || '-'}</td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={rule.is_enabled}
                        onChange={() => handleToggleEnabled(rule)}
                        className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300"
                      />
                    </td>
                    <td className="p-4">
                      {rule.use_count} times
                      {rule.last_used_at && (
                        <div className="text-sm text-neutral-500">
                          Last: {new Date(rule.last_used_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-4 py-2 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-4 py-2 bg-danger-100 text-danger-700 font-bold rounded-xl border border-danger-700 hover:bg-danger-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && <RuleFormModal rule={editingRule} onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
