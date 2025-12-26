import { useState, useEffect } from 'react';
import { useImportSession } from '../hooks/useImportSession';
import { useAccounts } from '../hooks/useAccounts';
import { MappingForm } from '../components/import/MappingForm';
import { useAuth } from '../context/AuthContext';
import { listImportBatches, undoImportBatch } from '../lib/supabase/import';
import { ImportBatch } from '../types/database';
import { useToast } from '../components/GlobalToastProvider';

export default function ImportPage() {
  const {
    state,
    selectAccount,
    uploadFile,
    updateMapping,
    applyMapping,
    checkDuplicates,
    commit,
    reset,
    setApplyRulesOnImport,
    isProcessing,
  } = useImportSession();
  const { accounts } = useAccounts();
  const { activeBookset } = useAuth();
  const { showError } = useToast();

  // Recent Batches State
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    if (activeBookset) {
      loadBatches();
    }
  }, [activeBookset, state.importResult]); // Reload when import completes

  async function loadBatches() {
    if (!activeBookset) return;
    setLoadingBatches(true);
    try {
      const data = await listImportBatches(activeBookset.id);
      setBatches(data);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleUndo(batchId: string) {
    if (
      !confirm(
        'Are you sure you want to undo this import? This will archive all transactions in the batch.'
      )
    )
      return;
    try {
      console.log('Attempting to undo batch:', batchId);
      await undoImportBatch(batchId);
      loadBatches();
      alert('Import undone successfully.');
    } catch (err) {
      console.error('Failed to undo batch:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      alert('Failed to undo batch: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-neutral-900">Import Transactions</h1>

      {/* Step 1: Account Selection & File Upload */}
      {state.step === 'upload' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8">
          <h2 className="text-xl font-bold mb-6 text-neutral-800">
            1. Select Account & Upload CSV
          </h2>

          <div className="mb-6">
            <label className="block text-base font-bold text-neutral-600 mb-2">Account:</label>
            <select
              onChange={(e) => selectAccount(e.target.value)}
              value={state.selectedAccountId || ''}
              className="w-full p-4 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="">-- Select Account --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-base font-bold text-neutral-600 mb-2">CSV File:</label>
            <input
              type="file"
              accept=".csv"
              onClick={(e) => {
                if (!state.selectedAccountId) {
                  e.preventDefault();
                  showError('Please select an account first');
                }
              }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadFile(e.target.files[0]);
                }
              }}
              disabled={isProcessing}
              className="w-full p-4 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>

          {isProcessing && (
            <div className="text-brand-600 font-bold text-lg animate-pulse">Processing...</div>
          )}
        </section>
      )}

      {/* Step 2: Mapping Configuration */}
      {state.step === 'mapping' && state.rawPreview && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8">
          <h2 className="text-xl font-bold mb-6 text-neutral-800">2. Configure CSV Mapping</h2>

          <div className="mb-6">
            <h3 className="text-lg font-bold mb-2 text-neutral-600">Preview (first 5 rows):</h3>
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <pre className="bg-neutral-50 p-4 text-xs">
                {JSON.stringify(state.rawPreview.data.slice(0, 5), null, 2)}
              </pre>
            </div>
          </div>

          <MappingForm
            preview={state.rawPreview}
            mapping={state.mapping}
            onUpdate={updateMapping}
            onApply={(mapping) => applyMapping(mapping)}
            isProcessing={isProcessing}
          />
          <div className="mt-4 border-t pt-4">
            <button
              onClick={reset}
              disabled={isProcessing}
              className="text-neutral-500 hover:text-neutral-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Review & Commit */}
      {state.step === 'review' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8">
          <h2 className="text-xl font-bold mb-6 text-neutral-800">3. Review Transactions</h2>

          <div className="mb-6">
            <h3 className="text-lg font-bold mb-2 text-neutral-600">Preview (first 10 mapped):</h3>
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Row</th>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Description</th>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Valid</th>
                    <th className="px-4 py-3 text-left font-bold text-neutral-600">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {state.stagedTransactions.slice(0, 10).map((t, i) => (
                    <tr key={i} className={!t.isValid ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">{t.rowIndex + 1}</td>
                      <td className="px-4 py-3">{t.date || 'N/A'}</td>
                      <td className="px-4 py-3">
                        {t.amount !== undefined ? `$${(t.amount / 100).toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3">{t.description || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">{t.isValid ? '✓' : '✗'}</td>
                      <td className="px-4 py-3 text-red-600 text-sm font-bold">
                        {t.errors.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6 flex gap-4">
            <button
              onClick={checkDuplicates}
              disabled={isProcessing}
              className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            >
              Check for Duplicates
            </button>
            <button
              onClick={reset}
              disabled={isProcessing}
              className="px-6 py-3 bg-white text-neutral-600 font-bold rounded-xl border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            >
              Start Over
            </button>
          </div>

          {state.stats.total > 0 && (
            <div className="mb-6 bg-neutral-50 p-6 rounded-xl border border-neutral-200">
              <h3 className="text-lg font-bold mb-4 text-neutral-800">Import Statistics:</h3>
              <ul className="space-y-2 text-lg">
                <li>
                  Total rows: <span className="font-bold">{state.stats.total}</span>
                </li>
                <li className="text-success-700 font-medium">
                  New transactions: <span className="font-bold">{state.stats.new}</span>
                </li>
                <li className="text-neutral-500">
                  Exact duplicates (will skip):{' '}
                  <span className="font-bold">{state.stats.exact_duplicates}</span>
                </li>
                <li className="text-yellow-600">
                  Fuzzy duplicates (review):{' '}
                  <span className="font-bold">{state.stats.fuzzy_duplicates}</span>
                </li>
                <li className="text-danger-700">
                  Errors: <span className="font-bold">{state.stats.errors}</span>
                </li>
              </ul>
            </div>
          )}

          {state.stats.fuzzy_duplicates > 0 && (
            <div className="mb-6 bg-yellow-50 border-l-8 border-yellow-400 p-6 rounded-r-xl">
              <strong className="block text-yellow-800 text-lg mb-1">Warning</strong>
              <span className="text-yellow-700 font-medium">
                {state.stats.fuzzy_duplicates} potential duplicates detected (same amount, date
                within ±3 days). Review manually after import.
              </span>
            </div>
          )}

          {state.stats.new > 0 && (
            <div className="flex flex-col gap-6">
              <div className="mb-4">
                <label className="flex items-center gap-4 p-4 border-2 border-neutral-200 rounded-xl bg-white cursor-pointer hover:border-brand-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={state.applyRulesOnImport}
                    onChange={(e) => setApplyRulesOnImport(e.target.checked)}
                    className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300"
                  />
                  <span className="text-lg font-medium text-neutral-900">
                    Automatically apply rules after import
                  </span>
                </label>
              </div>
              <div>
                <button
                  onClick={commit}
                  disabled={isProcessing}
                  className="w-full md:w-auto px-8 py-4 bg-success-700 text-white font-bold text-xl rounded-xl shadow-lg hover:bg-success-800 disabled:opacity-50 transition-all"
                >
                  Import {state.stats.new} Transactions
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 4: Importing */}
      {state.step === 'importing' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8">
          <h2 className="text-xl font-bold mb-4 text-neutral-800">Importing...</h2>
          <div className="text-lg text-neutral-600 animate-pulse">
            Please wait while transactions are being saved to the database.
          </div>
        </section>
      )}

      {/* Step 5: Complete */}
      {state.step === 'complete' && state.importResult && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8 border-l-8 border-success-700">
          <h2 className="text-2xl font-bold mb-4 text-success-700">Import Complete!</h2>
          <div className="space-y-2 mb-6 text-lg">
            <p>
              Successfully imported <span className="font-bold">{state.stats.new}</span>{' '}
              transactions.
            </p>
            <p className="text-base text-neutral-500">Batch ID: {state.importResult.batchId}</p>
          </div>

          {state.ruleApplicationResult && (
            <div className="mb-6 p-6 bg-neutral-50 rounded-xl border border-neutral-200">
              <h3 className="font-bold mb-2 text-neutral-800">Rule Application Results:</h3>
              <ul className="space-y-1 text-base">
                <li>Applied: {state.ruleApplicationResult.appliedCount}</li>
                <li>Skipped: {state.ruleApplicationResult.skippedCount}</li>
                {state.ruleApplicationResult.errorCount > 0 && (
                  <li className="text-danger-700 font-bold">
                    Errors: {state.ruleApplicationResult.errorCount}
                  </li>
                )}
              </ul>
            </div>
          )}

          <button
            onClick={reset}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
          >
            Import Another File
          </button>
        </section>
      )}

      {/* Error State */}
      {state.step === 'error' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 mb-8 border-l-8 border-danger-700">
          <h2 className="text-2xl font-bold mb-4 text-danger-700">Error</h2>
          <div className="text-danger-700 mb-6 font-medium text-lg">{state.error}</div>
          <button
            onClick={reset}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
          >
            Start Over
          </button>
        </section>
      )}

      {/* Recent Imports Section */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h2 className="text-xl font-bold mb-6 text-neutral-800">Recent Imports</h2>
        {loadingBatches ? (
          <p className="text-lg text-neutral-500">Loading...</p>
        ) : batches.length === 0 ? (
          <p className="text-lg text-neutral-500 italic">No recent imports found.</p>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4 text-left font-bold text-neutral-600">Date</th>
                  <th className="p-4 text-left font-bold text-neutral-600">File Name</th>
                  <th className="p-4 text-right font-bold text-neutral-600">Count</th>
                  <th className="p-4 text-center font-bold text-neutral-600">Status</th>
                  <th className="p-4 text-center font-bold text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white text-lg">
                {batches.map((batch) => (
                  <tr
                    key={batch.id}
                    className={
                      batch.is_undone ? 'bg-neutral-50 text-neutral-400' : 'hover:bg-neutral-50'
                    }
                  >
                    <td className="p-4">{new Date(batch.imported_at).toLocaleString()}</td>
                    <td className="p-4 font-medium">{batch.file_name}</td>
                    <td className="p-4 text-right">{batch.imported_count}</td>
                    <td className="p-4 text-center">
                      {batch.is_undone ? (
                        <span className="text-danger-700 font-bold bg-danger-100 px-3 py-1 rounded-full text-sm">
                          Undone
                        </span>
                      ) : (
                        <span className="text-success-700 font-bold bg-success-100 px-3 py-1 rounded-full text-sm">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {!batch.is_undone && (
                        <button
                          onClick={() => handleUndo(batch.id)}
                          className="text-danger-700 font-bold hover:underline"
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
