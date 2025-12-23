import { useState, useEffect } from 'react';
import AppNav from '../components/AppNav';
import { useImportSession } from '../hooks/useImportSession';
import { useAccounts } from '../hooks/useAccounts';
import { MappingForm } from '../components/import/MappingForm';
import { useAuth } from '../context/AuthContext';
import { listImportBatches, undoImportBatch } from '../lib/supabase/import';
import { ImportBatch } from '../types/database';

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
      await undoImportBatch(batchId);
      loadBatches();
      alert('Import undone successfully.');
    } catch (err) {
      console.error('Failed to undo batch:', err);
      alert('Failed to undo batch: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 className="text-3xl font-bold mb-6">Import Transactions</h1>

        {/* Step 1: Account Selection & File Upload */}
        {state.step === 'upload' && (
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Select Account & Upload CSV</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Account:</label>
              <select
                onChange={(e) => selectAccount(e.target.value)}
                value={state.selectedAccountId || ''}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">-- Select Account --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">CSV File:</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    uploadFile(e.target.files[0]);
                  }
                }}
                disabled={!state.selectedAccountId || isProcessing}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            {isProcessing && <div className="text-blue-600">Processing...</div>}
          </section>
        )}

        {/* Step 2: Mapping Configuration */}
        {state.step === 'mapping' && state.rawPreview && (
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Configure CSV Mapping</h2>

            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Preview (first 5 rows):</h3>
              <div className="overflow-x-auto">
                <pre className="bg-gray-100 p-4 rounded text-xs">
                  {JSON.stringify(state.rawPreview.data.slice(0, 5), null, 2)}
                </pre>
              </div>
            </div>

            <MappingForm
              preview={state.rawPreview}
              mapping={state.mapping}
              onUpdate={updateMapping}
              onApply={applyMapping}
              isProcessing={isProcessing}
            />
          </section>
        )}

        {/* Step 3: Review & Commit */}
        {state.step === 'review' && (
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Review Transactions</h2>

            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Preview (first 10 mapped):</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">Row</th>
                      <th className="border border-gray-300 px-4 py-2">Date</th>
                      <th className="border border-gray-300 px-4 py-2">Amount</th>
                      <th className="border border-gray-300 px-4 py-2">Description</th>
                      <th className="border border-gray-300 px-4 py-2">Valid</th>
                      <th className="border border-gray-300 px-4 py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.stagedTransactions.slice(0, 10).map((t, i) => (
                      <tr key={i} className={!t.isValid ? 'bg-red-50' : ''}>
                        <td className="border border-gray-300 px-4 py-2">{t.rowIndex + 1}</td>
                        <td className="border border-gray-300 px-4 py-2">{t.date || 'N/A'}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {t.amount !== undefined ? `$${(t.amount / 100).toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {t.description || 'N/A'}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {t.isValid ? '✓' : '✗'}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-red-600 text-sm">
                          {t.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-4">
              <button
                onClick={checkDuplicates}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Check for Duplicates
              </button>
            </div>

            {state.stats.total > 0 && (
              <div className="mb-4 bg-gray-50 p-4 rounded">
                <h3 className="text-lg font-medium mb-2">Import Statistics:</h3>
                <ul className="space-y-1">
                  <li>Total rows: {state.stats.total}</li>
                  <li className="text-green-600 font-medium">
                    New transactions: {state.stats.new}
                  </li>
                  <li className="text-gray-600">
                    Exact duplicates (will skip): {state.stats.exact_duplicates}
                  </li>
                  <li className="text-yellow-600">
                    Fuzzy duplicates (review): {state.stats.fuzzy_duplicates}
                  </li>
                  <li className="text-red-600">Errors: {state.stats.errors}</li>
                </ul>
              </div>
            )}

            {state.stats.fuzzy_duplicates > 0 && (
              <div className="mb-4 bg-yellow-50 border border-yellow-400 p-4 rounded">
                <strong>Warning:</strong> {state.stats.fuzzy_duplicates} potential duplicates
                detected (same amount, date within ±3 days). Review manually after import.
              </div>
            )}

            {state.stats.new > 0 && (
              <div className="flex flex-col gap-4">
                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.applyRulesOnImport}
                      onChange={(e) => setApplyRulesOnImport(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Automatically apply rules after import
                  </label>
                </div>
                <div>
                  <button
                    onClick={commit}
                    disabled={isProcessing}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">Importing...</h2>
            <div className="text-gray-600">
              Please wait while transactions are being saved to the database.
            </div>
          </section>
        )}

        {/* Step 5: Complete */}
        {state.step === 'complete' && state.importResult && (
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4 text-green-600">Import Complete!</h2>
            <div className="space-y-2">
              <p>Successfully imported {state.stats.new} transactions.</p>
              <p className="text-sm text-gray-600">Batch ID: {state.importResult.batchId}</p>
            </div>

            {state.ruleApplicationResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                <h3 className="font-semibold mb-2">Rule Application Results:</h3>
                <ul className="space-y-1 text-sm">
                  <li>Applied: {state.ruleApplicationResult.appliedCount}</li>
                  <li>Skipped: {state.ruleApplicationResult.skippedCount}</li>
                  {state.ruleApplicationResult.errorCount > 0 && (
                    <li className="text-red-600">
                      Errors: {state.ruleApplicationResult.errorCount}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <button
              onClick={reset}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Import Another File
            </button>
          </section>
        )}

        {/* Error State */}
        {state.step === 'error' && (
          <section className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Error</h2>
            <div className="text-red-600 mb-4">{state.error}</div>
            <button
              onClick={reset}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Start Over
            </button>
          </section>
        )}

        {/* Recent Imports Section */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Recent Imports</h2>
          {loadingBatches ? (
            <p>Loading...</p>
          ) : batches.length === 0 ? (
            <p className="text-gray-500">No recent imports found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Date</th>
                    <th className="border p-2 text-left">File Name</th>
                    <th className="border p-2 text-right">Count</th>
                    <th className="border p-2 text-center">Status</th>
                    <th className="border p-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className={batch.is_undone ? 'bg-gray-100 text-gray-500' : ''}
                    >
                      <td className="border p-2">{new Date(batch.imported_at).toLocaleString()}</td>
                      <td className="border p-2">{batch.file_name}</td>
                      <td className="border p-2 text-right">{batch.imported_count}</td>
                      <td className="border p-2 text-center">
                        {batch.is_undone ? (
                          <span className="text-red-600 font-semibold">Undone</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </td>
                      <td className="border p-2 text-center">
                        {!batch.is_undone && (
                          <button
                            onClick={() => handleUndo(batch.id)}
                            className="text-red-600 hover:underline"
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
    </div>
  );
}
