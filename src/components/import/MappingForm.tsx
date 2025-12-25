import { useState } from 'react';
import type { ParseResult } from '../../lib/import/parser';
import type { CsvMapping, DateFormat, AmountMode } from '../../types/import';
import { getBankProfile, listBankProfiles } from '../../lib/import/bank-profiles';

interface MappingFormProps {
  preview: ParseResult;
  mapping: CsvMapping | null;
  onUpdate: (mapping: CsvMapping) => void;
  onApply: (mapping: CsvMapping) => void;
  isProcessing: boolean;
}

export function MappingForm({
  preview,
  mapping,
  onUpdate,
  onApply,
  isProcessing,
}: MappingFormProps) {
  const [formData, setFormData] = useState<CsvMapping>(
    mapping || {
      dateColumn: '',
      amountColumn: '',
      descriptionColumn: '',
      dateFormat: 'MM/dd/yyyy',
      hasHeaderRow: true,
      amountMode: 'signed',
      inflowColumn: '',
      outflowColumn: '',
    }
  );

  const columns = preview.meta.fields || [];
  const bankProfiles = listBankProfiles();

  const handleBankProfileChange = (profileName: string) => {
    if (!profileName) return;

    const profile = getBankProfile(profileName);
    if (profile) {
      setFormData(profile);
      onUpdate(profile);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    onApply(formData);
  };

  const handleFieldChange = (field: keyof CsvMapping, value: string | boolean) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Quick Setup (Optional)</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2"
          onChange={(e) => handleBankProfileChange(e.target.value)}
          defaultValue=""
        >
          <option value="">-- Select Bank Profile --</option>
          {bankProfiles.map((name) => (
            <option key={name} value={name}>
              {name.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Date Column:</label>
        <select
          value={formData.dateColumn}
          onChange={(e) => handleFieldChange('dateColumn', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          required
        >
          <option value="">-- Select --</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description Column:</label>
        <select
          value={formData.descriptionColumn}
          onChange={(e) => handleFieldChange('descriptionColumn', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          required
        >
          <option value="">-- Select --</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Amount Mode:</label>
        <select
          value={formData.amountMode}
          onChange={(e) => handleFieldChange('amountMode', e.target.value as AmountMode)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="signed">Single Column (Signed)</option>
          <option value="separate">Separate Debit/Credit Columns</option>
        </select>
      </div>

      {formData.amountMode === 'signed' && (
        <div>
          <label className="block text-sm font-medium mb-1">Amount Column:</label>
          <select
            value={formData.amountColumn}
            onChange={(e) => handleFieldChange('amountColumn', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="">-- Select --</option>
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      )}

      {formData.amountMode === 'separate' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Inflow Column (Credits):</label>
            <select
              value={formData.inflowColumn || ''}
              onChange={(e) => handleFieldChange('inflowColumn', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">-- Select --</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Outflow Column (Debits):</label>
            <select
              value={formData.outflowColumn || ''}
              onChange={(e) => handleFieldChange('outflowColumn', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">-- Select --</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Date Format:</label>
        <select
          value={formData.dateFormat}
          onChange={(e) => handleFieldChange('dateFormat', e.target.value as DateFormat)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="MM/dd/yyyy">MM/dd/yyyy (e.g., 01/31/2024)</option>
          <option value="dd/MM/yyyy">dd/MM/yyyy (e.g., 31/01/2024)</option>
          <option value="yyyy-MM-dd">yyyy-MM-dd (e.g., 2024-01-31)</option>
          <option value="MM-dd-yyyy">MM-dd-yyyy (e.g., 01-31-2024)</option>
        </select>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.hasHeaderRow}
            onChange={(e) => handleFieldChange('hasHeaderRow', e.target.checked)}
            className="mr-2"
          />
          First row is header
        </label>
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Apply Mapping & Parse File'}
      </button>
    </form>
  );
}
