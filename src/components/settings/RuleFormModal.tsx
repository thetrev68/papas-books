import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import { useCreateRule, useUpdateRule } from '../../hooks/useRules';
import { insertRuleSchema, validateRegex } from '../../lib/validation/rules';
import { Rule } from '../../types/database';
import { MatchType, RuleConditions } from '../../types/rules';

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

  // Parse existing conditions
  const existingConditions = (rule?.conditions as RuleConditions) || {};

  // Initialize form data
  const [formData, setFormData] = useState({
    keyword: rule?.keyword || initialValues?.keyword || '',
    matchType: rule?.match_type || 'contains',
    caseSensitive: rule?.case_sensitive ?? false,
    targetCategoryId: rule?.target_category_id || '',
    suggestedPayee: rule?.suggested_payee || initialValues?.suggestedPayee || '',
    priority: rule?.priority ?? 50,
    isEnabled: rule?.is_enabled ?? true,
    // Advanced Conditions
    amountMin: existingConditions.amountMin?.toString() || '',
    amountMax: existingConditions.amountMax?.toString() || '',
    descriptionRegex: existingConditions.descriptionRegex || '',
    startMonth: existingConditions.dateRange?.startMonth?.toString() || '',
    endMonth: existingConditions.dateRange?.endMonth?.toString() || '',
    startDay: existingConditions.dateRange?.startDay?.toString() || '',
    endDay: existingConditions.dateRange?.endDay?.toString() || '',
  });

  const [showAdvanced, setShowAdvanced] = useState(
    !!(
      existingConditions.amountMin ||
      existingConditions.amountMax ||
      existingConditions.descriptionRegex ||
      existingConditions.dateRange
    )
  );

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

    // Validate description regex if provided
    if (formData.descriptionRegex) {
      const regexValidation = validateRegex(formData.descriptionRegex);
      if (!regexValidation.valid) {
        setErrors({ descriptionRegex: regexValidation.error! });
        return;
      }
    }

    // Build conditions object
    const conditions: RuleConditions = {};
    if (formData.amountMin) conditions.amountMin = parseInt(formData.amountMin);
    if (formData.amountMax) conditions.amountMax = parseInt(formData.amountMax);
    if (formData.descriptionRegex) conditions.descriptionRegex = formData.descriptionRegex;

    if (formData.startMonth || formData.endMonth || formData.startDay || formData.endDay) {
      conditions.dateRange = {};
      if (formData.startMonth) conditions.dateRange.startMonth = parseInt(formData.startMonth);
      if (formData.endMonth) conditions.dateRange.endMonth = parseInt(formData.endMonth);
      if (formData.startDay) conditions.dateRange.startDay = parseInt(formData.startDay);
      if (formData.endDay) conditions.dateRange.endDay = parseInt(formData.endDay);
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
      conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
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
          {/* ... Basic Fields ... */}
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
          </div>

          {/* Advanced Conditions Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'blue',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showAdvanced ? 'Hide Advanced Conditions' : 'Show Advanced Conditions'}
            </button>
          </div>

          {showAdvanced && (
            <div
              style={{
                background: '#f9f9f9',
                padding: '10px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                <label className="block text-sm font-medium">Amount Range (cents):</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={formData.amountMin}
                    onChange={(e) => setFormData({ ...formData, amountMin: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={formData.amountMax}
                    onChange={(e) => setFormData({ ...formData, amountMax: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Description Regex (AND condition):
                </label>
                <input
                  type="text"
                  placeholder="/pattern/i"
                  value={formData.descriptionRegex}
                  onChange={(e) => setFormData({ ...formData, descriptionRegex: e.target.value })}
                  style={{ width: '100%', padding: '6px' }}
                />
                {errors.descriptionRegex && (
                  <div style={{ color: 'red', fontSize: '0.8em' }}>{errors.descriptionRegex}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Date Range:</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                  <input
                    type="number"
                    placeholder="Start Month (1-12)"
                    value={formData.startMonth}
                    onChange={(e) => setFormData({ ...formData, startMonth: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                  <input
                    type="number"
                    placeholder="End Month (1-12)"
                    value={formData.endMonth}
                    onChange={(e) => setFormData({ ...formData, endMonth: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    placeholder="Start Day (1-31)"
                    value={formData.startDay}
                    onChange={(e) => setFormData({ ...formData, startDay: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                  <input
                    type="number"
                    placeholder="End Day (1-31)"
                    value={formData.endDay}
                    onChange={(e) => setFormData({ ...formData, endDay: e.target.value })}
                    style={{ width: '50%', padding: '6px' }}
                  />
                </div>
              </div>
            </div>
          )}

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
