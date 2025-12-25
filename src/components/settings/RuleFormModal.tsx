import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import { useCreateRule, useUpdateRule } from '../../hooks/useRules';
import { insertRuleSchema, validateRegex } from '../../lib/validation/rules';
import { Rule } from '../../types/database';
import { MatchType, RuleConditions } from '../../types/rules';
import Modal from '../ui/Modal';

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
    <Modal title={rule ? 'Edit Rule' : 'Create Rule'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="rule-keyword" className="block text-sm font-bold text-neutral-500 mb-1">
            Keyword
          </label>
          <input
            id="rule-keyword"
            type="text"
            value={formData.keyword}
            onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
            placeholder="e.g., target, starbucks, amazon"
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          {errors.keyword && <div className="text-danger-700 text-sm mt-1">{errors.keyword}</div>}
        </div>

        <div>
          <label
            htmlFor="rule-match-type"
            className="block text-sm font-bold text-neutral-500 mb-1"
          >
            Match Type
          </label>
          <select
            id="rule-match-type"
            value={formData.matchType}
            onChange={(e) => setFormData({ ...formData, matchType: e.target.value as MatchType })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          >
            <option value="contains">Contains (default)</option>
            <option value="exact">Exact match</option>
            <option value="startsWith">Starts with</option>
            <option value="regex">Regular expression</option>
          </select>
        </div>

        <label className="flex items-center gap-3 p-3 border-2 border-neutral-200 rounded-xl bg-white">
          <input
            type="checkbox"
            checked={formData.caseSensitive}
            onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
            className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300"
          />
          <span className="text-lg font-medium text-neutral-900">Case sensitive</span>
        </label>

        <div>
          <label htmlFor="rule-category" className="block text-sm font-bold text-neutral-500 mb-1">
            Category
          </label>
          <select
            id="rule-category"
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
          {errors.targetCategoryId && (
            <div className="text-danger-700 text-sm mt-1">{errors.targetCategoryId}</div>
          )}
        </div>

        <div>
          <label
            htmlFor="rule-suggested-payee"
            className="block text-sm font-bold text-neutral-500 mb-1"
          >
            Suggested Payee (optional)
          </label>
          <input
            id="rule-suggested-payee"
            type="text"
            value={formData.suggestedPayee}
            onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
            placeholder="e.g., Target, Starbucks"
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
        </div>

        <div>
          <label htmlFor="rule-priority" className="block text-sm font-bold text-neutral-500 mb-1">
            Priority (1-100)
          </label>
          <input
            id="rule-priority"
            type="number"
            min="1"
            max="100"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-brand-700 font-bold hover:underline"
          >
            {showAdvanced ? 'Hide Advanced Conditions' : 'Show Advanced Conditions'}
          </button>
        </div>

        {showAdvanced && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">
                Amount Range (cents)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Min"
                  value={formData.amountMin}
                  onChange={(e) => setFormData({ ...formData, amountMin: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={formData.amountMax}
                  onChange={(e) => setFormData({ ...formData, amountMax: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">
                Description Regex (AND condition)
              </label>
              <input
                type="text"
                placeholder="/pattern/i"
                value={formData.descriptionRegex}
                onChange={(e) => setFormData({ ...formData, descriptionRegex: e.target.value })}
                className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              />
              {errors.descriptionRegex && (
                <div className="text-danger-700 text-sm mt-1">{errors.descriptionRegex}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-500 mb-1">Date Range</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="number"
                  placeholder="Start Month (1-12)"
                  value={formData.startMonth}
                  onChange={(e) => setFormData({ ...formData, startMonth: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
                <input
                  type="number"
                  placeholder="End Month (1-12)"
                  value={formData.endMonth}
                  onChange={(e) => setFormData({ ...formData, endMonth: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Start Day (1-31)"
                  value={formData.startDay}
                  onChange={(e) => setFormData({ ...formData, startDay: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
                <input
                  type="number"
                  placeholder="End Day (1-31)"
                  value={formData.endDay}
                  onChange={(e) => setFormData({ ...formData, endDay: e.target.value })}
                  className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 p-3 border-2 border-neutral-200 rounded-xl bg-white">
          <input
            type="checkbox"
            checked={formData.isEnabled}
            onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
            className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300"
          />
          <span className="text-lg font-medium text-neutral-900">Enabled</span>
        </label>

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="submit"
            disabled={isCreating || isUpdating}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {isCreating || isUpdating ? 'Saving...' : 'Save'}
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
