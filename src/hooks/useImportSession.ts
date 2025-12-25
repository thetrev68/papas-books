import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { previewCsv, parseFullCsv, type ParseResult } from '../lib/import/parser';
import { mapRowsToTransactions, type StagedTransaction } from '../lib/import/mapper';
import { addFingerprints } from '../lib/import/fingerprint';
import { detectExactDuplicates, type ProcessedTransaction } from '../lib/import/reconciler';
import { detectFuzzyDuplicates } from '../lib/import/fuzzy-matcher';
import {
  fetchExistingFingerprints,
  fetchExistingTransactions,
  commitImportBatch,
} from '../lib/supabase/import';
import { updateAccountMapping } from '../lib/supabase/accounts';
import { fetchRules } from '../lib/supabase/rules';
import { applyRulesToBatch } from '../lib/rules/applicator';
import { fetchPayees, createPayee } from '../lib/supabase/payees';
import { guessPayee } from '../lib/payee/payeeGuesser';
import { supabase } from '../lib/supabase/config';
import { MAX_PAYEE_LENGTH } from '../lib/validation/import';
import type { CsvMapping } from '../types/import';
import type { RuleBatchResult, Rule } from '../types/rules';
import type { Transaction } from '../types/database';

type ImportStep = 'upload' | 'mapping' | 'review' | 'importing' | 'complete' | 'error';

interface ImportSessionState {
  // Wizard step
  step: ImportStep;

  // File upload
  file: File | null;
  selectedAccountId: string | null;

  // Parsing
  rawPreview: ParseResult | null;
  rawData: ParseResult | null;

  // Mapping
  mapping: CsvMapping | null;
  stagedTransactions: StagedTransaction[];

  // Duplicate detection
  processedTransactions: ProcessedTransaction[];
  stats: {
    total: number;
    new: number;
    exact_duplicates: number;
    fuzzy_duplicates: number;
    errors: number;
  };

  // Rule Application
  applyRulesOnImport: boolean;
  ruleApplicationResult: RuleBatchResult | null;

  // Import result
  importResult: {
    batchId: string;
    transactionIds: string[];
  } | null;

  // Error state
  error: string | null;
}

export interface UseImportSessionResult {
  // State
  state: ImportSessionState;

  // Actions
  selectAccount: (accountId: string) => void;
  uploadFile: (file: File) => Promise<void>;
  updateMapping: (mapping: CsvMapping) => void;
  applyMapping: (mapping?: CsvMapping) => Promise<void>;
  checkDuplicates: () => Promise<void>;
  commit: () => Promise<void>;
  reset: () => void;
  setApplyRulesOnImport: (value: boolean) => void;

  // Loading flags
  isProcessing: boolean;
}

const initialState: ImportSessionState = {
  step: 'upload',
  file: null,
  selectedAccountId: null,
  rawPreview: null,
  rawData: null,
  mapping: null,
  stagedTransactions: [],
  processedTransactions: [],
  stats: { total: 0, new: 0, exact_duplicates: 0, fuzzy_duplicates: 0, errors: 0 },
  applyRulesOnImport: true,
  ruleApplicationResult: null,
  importResult: null,
  error: null,
};

export function useImportSession(): UseImportSessionResult {
  const { activeBookset } = useAuth();
  const [state, setState] = useState<ImportSessionState>(initialState);
  const [isProcessing, setIsProcessing] = useState(false);

  // Action: Select account
  const selectAccount = (accountId: string) => {
    setState((prev) => ({ ...prev, selectedAccountId: accountId }));
  };

  // Action: Set apply rules preference
  const setApplyRulesOnImport = (value: boolean) => {
    setState((prev) => ({ ...prev, applyRulesOnImport: value }));
  };

  // Action: Upload file and preview
  const uploadFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const preview = await previewCsv(file, { hasHeaderRow: true });
      setState((prev) => ({
        ...prev,
        file,
        rawPreview: preview,
        step: 'mapping',
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to parse CSV',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Update mapping configuration
  const updateMapping = (mapping: CsvMapping) => {
    setState((prev) => ({ ...prev, mapping }));
  };

  // Action: Apply mapping and parse full file
  const applyMapping = async (mappingOverride?: CsvMapping) => {
    const mapping = mappingOverride ?? state.mapping;
    if (!state.file || !mapping) return;

    if (mappingOverride) {
      setState((prev) => ({ ...prev, mapping: mappingOverride }));
    }

    setIsProcessing(true);
    try {
      const parsed = await parseFullCsv(state.file, {
        hasHeaderRow: mapping.hasHeaderRow,
      });

      const staged = mapRowsToTransactions(parsed.data, mapping);

      const errorCount = staged.filter((t) => !t.isValid).length;

      setState((prev) => ({
        ...prev,
        rawData: parsed,
        stagedTransactions: staged,
        stats: { ...prev.stats, total: staged.length, errors: errorCount },
        step: 'review',
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to apply mapping',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Check for duplicates
  const checkDuplicates = async () => {
    if (!state.selectedAccountId || state.stagedTransactions.length === 0) return;

    setIsProcessing(true);
    try {
      // Add fingerprints
      const withFingerprints = await addFingerprints(state.stagedTransactions);

      // Fetch existing fingerprints
      const existingFingerprints = await fetchExistingFingerprints(state.selectedAccountId);

      // Detect exact duplicates
      let processed = detectExactDuplicates(withFingerprints, existingFingerprints);

      // Fetch existing transactions for fuzzy matching
      const existingTransactions = await fetchExistingTransactions(state.selectedAccountId);

      // Detect fuzzy duplicates
      processed = detectFuzzyDuplicates(processed, existingTransactions);

      // Calculate stats
      const stats = {
        total: processed.length,
        new: processed.filter((t) => t.status === 'new').length,
        exact_duplicates: processed.filter((t) => t.status === 'duplicate').length,
        fuzzy_duplicates: processed.filter((t) => t.status === 'fuzzy_duplicate').length,
        errors: processed.filter((t) => !t.isValid).length,
      };

      setState((prev) => ({
        ...prev,
        processedTransactions: processed,
        stats,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check duplicates',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Commit import
  const commit = async () => {
    if (!state.selectedAccountId || !activeBookset || !state.file || !state.mapping) return;

    setIsProcessing(true);
    setState((prev) => ({ ...prev, step: 'importing' }));

    try {
      // Filter only "new" transactions
      const toImport = state.processedTransactions.filter((t) => t.status === 'new' && t.isValid);

      // Build transaction objects
      const transactions = toImport.map((t) => ({
        bookset_id: activeBookset.id,
        account_id: state.selectedAccountId!,
        date: t.date!,
        amount: t.amount!,
        payee: t.description!.slice(0, MAX_PAYEE_LENGTH),
        original_description: t.description!,
        fingerprint: t.fingerprint,
        source_batch_id: null, // Will be set by commitImportBatch
        import_date: '', // Will be set by commitImportBatch
        is_reviewed: false,
        is_split: false,
        reconciled: false,
        is_archived: false,
        lines: [], // Will be set by commitImportBatch
      }));

      // Build batch object
      const batch = {
        bookset_id: activeBookset.id,
        account_id: state.selectedAccountId,
        file_name: state.file.name,
        imported_at: new Date().toISOString(),
        total_rows: state.stats.total,
        imported_count: toImport.length,
        duplicate_count: state.stats.exact_duplicates + state.stats.fuzzy_duplicates,
        error_count: state.stats.errors,
        csv_mapping_snapshot: state.mapping,
        is_undone: false,
        undone_at: null,
        undone_by: null,
      };

      // Commit to database
      const result = await commitImportBatch(batch, transactions);

      // Save mapping to account (for next import)
      await updateAccountMapping(state.selectedAccountId, state.mapping);

      // Apply rules if enabled
      let ruleResult: RuleBatchResult | null = null;
      if (state.applyRulesOnImport && result.transactionIds.length > 0) {
        // Fetch the newly created transactions
        const { data: newTransactions } = await supabase
          .from('transactions')
          .select('*')
          .in('id', result.transactionIds);

        // Fetch rules
        const rules = await fetchRules(activeBookset.id);

        if (newTransactions && rules.length > 0) {
          // Apply rules
          ruleResult = await applyRulesToBatch(newTransactions as Transaction[], rules as Rule[], {
            setReviewedFlag: true,
          });
        }
      }

      // Apply payee guessing
      if (result.transactionIds.length > 0) {
        // Fetch existing payees for guessing
        const existingPayees = await fetchPayees(activeBookset.id);

        // Fetch the newly created transactions
        const { data: newTransactions } = await supabase
          .from('transactions')
          .select('*')
          .in('id', result.transactionIds);

        if (newTransactions) {
          // Process each transaction for payee guessing
          for (const transaction of newTransactions as Transaction[]) {
            const guess = guessPayee(transaction.original_description, existingPayees);

            if (guess.payee && guess.confidence >= 80) {
              // High confidence match - update the transaction
              await supabase
                .from('transactions')
                .update({ payee: guess.payee.name })
                .eq('id', transaction.id);
            } else if (guess.suggestedName && guess.confidence >= 60) {
              // Medium confidence - create new payee and update transaction
              try {
                const newPayee = await createPayee({
                  bookset_id: activeBookset.id,
                  name: guess.suggestedName,
                  aliases: [transaction.original_description],
                });

                await supabase
                  .from('transactions')
                  .update({ payee: newPayee.name })
                  .eq('id', transaction.id);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_error) {
                // Payee might already exist, just update the transaction with the suggested name
                await supabase
                  .from('transactions')
                  .update({ payee: guess.suggestedName })
                  .eq('id', transaction.id);
              }
            }
            // Low confidence - leave as original description
          }
        }
      }

      setState((prev) => ({
        ...prev,
        importResult: result,
        ruleApplicationResult: ruleResult,
        step: 'complete',
        error: null,
      }));
    } catch (error) {
      console.error('Commit failed:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to commit import',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Reset wizard
  const reset = () => {
    setState(initialState);
  };

  return {
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
  };
}
