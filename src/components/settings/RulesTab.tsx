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
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={handleCreate}>Create Rule</button>
      </div>

      {isLoading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}

      {!isLoading && !error && rules.length === 0 && (
        <div>No rules defined yet. Create one to automate categorization!</div>
      )}

      {!isLoading && !error && rules.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Priority</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Keyword</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Match Type</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Payee</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Enabled</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Usage</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const category = categories.find((c) => c.id === rule.target_category_id);

              return (
                <tr
                  key={rule.id}
                  style={{ borderBottom: '1px solid #eee', opacity: rule.is_enabled ? 1 : 0.5 }}
                >
                  <td style={{ padding: '0.5rem' }}>{rule.priority}</td>
                  <td style={{ padding: '0.5rem' }}>{rule.keyword}</td>
                  <td style={{ padding: '0.5rem' }}>{rule.match_type}</td>
                  <td style={{ padding: '0.5rem' }}>{category?.name || 'Unknown'}</td>
                  <td style={{ padding: '0.5rem' }}>{rule.suggested_payee || '-'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      onChange={() => handleToggleEnabled(rule)}
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {rule.use_count} times
                    {rule.last_used_at && (
                      <div style={{ fontSize: '0.8em', color: 'gray' }}>
                        Last: {new Date(rule.last_used_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button onClick={() => handleEdit(rule)} style={{ marginRight: '0.5rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(rule.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isFormOpen && <RuleFormModal rule={editingRule} onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
