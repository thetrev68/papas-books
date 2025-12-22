import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import { useCreateRule, useUpdateRule } from '../../hooks/useRules';
import { insertRuleSchema, validateRegex } from '../../lib/validation/rules';
import { Rule } from '../../types/database';
import { MatchType } from '../../types/rules';

interface RuleFormModalProps {
  rule: Rule | null; // null = creating, non-null = editing
  initialValues?: {
    keyword?: string;
    suggestedPayee?: string;
  };
  onClose: () => void;
}

export default function RuleFormModal({ rule, initialValues, onClose }: RuleFormModalProps) {
  const { activeBookset } = useAuth();
  const { createRule, isLoading: isCreating } = useCreateRule();
  const { updateRule, isLoading: isUpdating } = useUpdateRule();
  const { categories } = useCategories();

  // Initialize form data with mapping from snake_case (DB) to camelCase (Form)
  const [formData, setFormData] = useState({
    keyword: rule?.keyword || initialValues?.keyword || '',
    matchType: rule?.match_type || 'contains',
    caseSensitive: rule?.case_sensitive ?? false,
    targetCategoryId: rule?.target_category_id || '',
    suggestedPayee: rule?.suggested_payee || initialValues?.suggestedPayee || '',
    priority: rule?.priority ?? 50,
    isEnabled: rule?.is_enabled ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate regex if matchType is 'regex'
    if (formData.matchType === 'regex') {
      const regexValidation = validateRegex(formData.keyword);
      if (!regexValidation.valid) {
        setErrors({ keyword: regexValidation.error! });
        return;
      }
    }

    // Validate with Zod
    const validation = insertRuleSchema.safeParse({
      booksetId: activeBookset!.id,
      keyword: formData.keyword,
      matchType: formData.matchType,
      caseSensitive: formData.caseSensitive,
      targetCategoryId: formData.targetCategoryId,
      suggestedPayee: formData.suggestedPayee || undefined,
      priority: formData.priority,
      isEnabled: formData.isEnabled,
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

    // Submit
    const submitPromise = rule ? updateRule(rule.id, validation.data) : createRule(validation.data);

    submitPromise
      .then(() => onClose())
      .catch((err) => {
        console.error('Failed to save rule:', err);
        // Ideally show error to user, but for now we just log it
        // as the mutation hook exposes error state we could use in parent or here if we used hook differently
      });
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
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '20px',
          maxWidth: '500px',
          width: '100%',
          borderRadius: '8px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2>{rule ? 'Edit Rule' : 'Create Rule'}</h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Keyword:</label>
            <input
              type="text"
              value={formData.keyword}
              onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              placeholder="e.g., target, starbucks, amazon"
              style={{ width: '100%', padding: '8px' }}
            />
            {errors.keyword && (
              <div style={{ color: 'red', fontSize: '0.8em' }}>{errors.keyword}</div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Match Type:</label>
            <select
              value={formData.matchType}
              onChange={(e) => setFormData({ ...formData, matchType: e.target.value as MatchType })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="contains">Contains (default)</option>
              <option value="exact">Exact match</option>
              <option value="startsWith">Starts with</option>
              <option value="regex">Regular expression</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.caseSensitive}
                onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
              />
              Case sensitive
            </label>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Category:</label>
            <select
              value={formData.targetCategoryId}
              onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">-- Select Category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.targetCategoryId && (
              <div style={{ color: 'red', fontSize: '0.8em' }}>{errors.targetCategoryId}</div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Suggested Payee (optional):
            </label>
            <input
              type="text"
              value={formData.suggestedPayee}
              onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
              placeholder="e.g., Target, Starbucks"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Priority (1-100):</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })
              }
              style={{ width: '100%', padding: '8px' }}
            />
            {errors.priority && (
              <div style={{ color: 'red', fontSize: '0.8em' }}>{errors.priority}</div>
            )}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              style={{ padding: '8px 16px' }}
            >
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
