import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Gets a Supabase client for cleanup operations.
 * Uses environment variables from .env.local
 */
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment for cleanup operations'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Deletes test transactions from the database based on original_description patterns.
 * This ensures a clean state for import tests by removing duplicates from previous runs.
 *
 * NOTE: This approach deletes ALL transactions matching these descriptions across ALL imports.
 * For more targeted cleanup, use cleanupImportBatch() instead.
 */
export async function cleanupTestTransactions(descriptions: string[]): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // First, delete transactions matching these descriptions
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('original_description', descriptions);

    if (error) {
      console.error('Failed to cleanup test transactions:', error);
    } else {
      console.log(`Cleaned up transactions matching ${descriptions.length} patterns`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Deletes all transactions and batches from a specific CSV file import.
 */
export async function cleanupImportBatch(fileName: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Find all batches with this file name
    const { data: batches, error: fetchError } = await supabase
      .from('import_batches')
      .select('id')
      .eq('file_name', fileName);

    if (fetchError) {
      console.error('Failed to fetch batches:', fetchError);
      return;
    }

    if (!batches || batches.length === 0) {
      console.log(`No import batches found for: ${fileName}`);
      return;
    }

    // Delete transactions from these batches
    const batchIds = batches.map((b) => b.id);
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .in('source_batch_id', batchIds);

    if (txError) {
      console.error('Failed to delete transactions:', txError);
      return;
    }

    // Delete the batch records
    const { error: batchError } = await supabase.from('import_batches').delete().in('id', batchIds);

    if (batchError) {
      console.error('Failed to delete batches:', batchError);
      return;
    }

    console.log(`Cleaned up ${batches.length} import batch(es) for: ${fileName}`);
  } catch (error) {
    console.error('Batch cleanup error:', error);
  }
}

/**
 * Ensures a test account exists for import tests.
 * Creates one if it doesn't exist, otherwise returns the existing account.
 */
export async function ensureTestAccount(): Promise<{ id: string; name: string }> {
  try {
    const supabase = getSupabaseClient();

    // Try to find existing test account
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('name', 'Test Checking Account')
      .single();

    if (existing) {
      console.log(`Using existing test account: ${existing.name}`);
      return existing;
    }

    // Get any bookset (for testing, we just need one to exist)
    const { data: booksets } = await supabase.from('booksets').select('id').limit(1).single();

    if (!booksets) {
      throw new Error('No booksets found in database - cannot create test account');
    }

    // Create a test account
    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert({
        bookset_id: booksets.id,
        name: 'Test Checking Account',
        type: 'checking',
        balance: 0,
        is_active: true,
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('Failed to create test account:', error);
      throw error;
    }

    console.log(`Created test account: ${newAccount.name}`);
    return newAccount;
  } catch (error) {
    console.error('Ensure test account error:', error);
    throw error;
  }
}

/**
 * Deletes ALL transactions and import batches from the database.
 * WARNING: This is destructive and should only be used in test environments.
 * NOTE: This does NOT delete accounts - accounts should persist across test runs.
 */
export async function cleanupAllTransactions(): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Count transactions before cleanup
    const { count: txCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    const { count: batchCount } = await supabase
      .from('import_batches')
      .select('*', { count: 'exact', head: true });

    // Delete all transactions (using a filter that matches all rows)
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

    if (txError) {
      console.error('Failed to delete all transactions:', txError);
      return;
    }

    // Delete all import batches
    const { error: batchError } = await supabase
      .from('import_batches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

    if (batchError) {
      console.error('Failed to delete all batches:', batchError);
      return;
    }

    console.log(
      `Cleaned up ALL test data: ${txCount ?? 0} transactions, ${batchCount ?? 0} batches`
    );
  } catch (error) {
    console.error('Cleanup all error:', error);
  }
}
