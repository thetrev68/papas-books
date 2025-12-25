/**
 * Test Script: Change History Tracking
 *
 * This script verifies that the change_history JSONB column is correctly
 * populated by database triggers when records are updated.
 *
 * Prerequisites:
 * 1. Run supabase/phase9_audit_triggers.sql in Supabase SQL Editor
 * 2. Have a valid user account and bookset with test data
 *
 * Usage:
 *   npx tsx scripts/test-change-history.ts <bookset-id> <transaction-id>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ChangeHistoryEntry {
  timestamp: string;
  user_id: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

async function testChangeHistory() {
  console.log('🧪 Change History Tracking Test\n');

  // Get command line arguments
  const booksetId = process.argv[2];
  const transactionId = process.argv[3];

  if (!booksetId || !transactionId) {
    console.error('❌ Usage: npx tsx scripts/test-change-history.ts <bookset-id> <transaction-id>');
    console.error('\nTo find a transaction ID, run:');
    console.error("  SELECT id FROM transactions WHERE bookset_id = '<your-bookset-id>' LIMIT 1;");
    process.exit(1);
  }

  console.log(`📦 Bookset ID: ${booksetId}`);
  console.log(`📝 Transaction ID: ${transactionId}\n`);

  try {
    // Test 1: Fetch original transaction
    console.log('Test 1: Fetch Original Transaction');
    console.log('─'.repeat(50));

    const { data: originalTx, error: fetchError } = await supabase
      .from('transactions')
      .select('id, payee, amount, change_history')
      .eq('id', transactionId)
      .single();

    if (fetchError) {
      console.error('❌ Failed to fetch transaction:', fetchError.message);
      process.exit(1);
    }

    console.log('✅ Original transaction fetched:');
    console.log(`   Payee: ${originalTx.payee}`);
    console.log(`   Amount: $${(originalTx.amount / 100).toFixed(2)}`);
    console.log(`   Change History Entries: ${originalTx.change_history?.length || 0}\n`);

    // Test 2: Update the transaction
    console.log('Test 2: Update Transaction (Change Payee)');
    console.log('─'.repeat(50));

    const newPayee = `Updated Payee ${Date.now()}`;
    const { data: updatedTx, error: updateError } = await supabase
      .from('transactions')
      .update({ payee: newPayee })
      .eq('id', transactionId)
      .select('id, payee, change_history')
      .single();

    if (updateError) {
      console.error('❌ Failed to update transaction:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Transaction updated:');
    console.log(`   New Payee: ${updatedTx.payee}`);
    console.log(`   Change History Entries: ${updatedTx.change_history?.length || 0}\n`);

    // Test 3: Verify change history was populated
    console.log('Test 3: Verify Change History');
    console.log('─'.repeat(50));

    const changeHistory = updatedTx.change_history as ChangeHistoryEntry[] | null;

    if (!changeHistory || changeHistory.length === 0) {
      console.error('❌ FAIL: change_history is empty!');
      console.error('   This indicates the trigger is not working correctly.');
      process.exit(1);
    }

    // Get the most recent change
    const latestChange = changeHistory[changeHistory.length - 1];

    console.log('✅ Change history populated:');
    console.log(`   Timestamp: ${latestChange.timestamp}`);
    console.log(`   User ID: ${latestChange.user_id}`);
    console.log(`   Changes:`);

    for (const [field, change] of Object.entries(latestChange.changes)) {
      console.log(`     - ${field}:`);
      console.log(`         Old: ${JSON.stringify(change.old)}`);
      console.log(`         New: ${JSON.stringify(change.new)}`);
    }

    // Verify the payee change was tracked
    if (latestChange.changes.payee) {
      console.log('\n✅ PASS: Payee change was tracked correctly');
      console.log(`   Old payee: ${latestChange.changes.payee.old}`);
      console.log(`   New payee: ${latestChange.changes.payee.new}`);
    } else {
      console.error('\n❌ FAIL: Payee change was NOT tracked in change_history');
      process.exit(1);
    }

    // Test 4: Make another update to verify accumulation
    console.log('\nTest 4: Multiple Updates (Verify Accumulation)');
    console.log('─'.repeat(50));

    const newAmount = originalTx.amount + 100; // Add $1.00
    const { data: secondUpdate, error: secondError } = await supabase
      .from('transactions')
      .update({ amount: newAmount })
      .eq('id', transactionId)
      .select('amount, change_history')
      .single();

    if (secondError) {
      console.error('❌ Failed to make second update:', secondError.message);
      process.exit(1);
    }

    const secondHistory = secondUpdate.change_history as ChangeHistoryEntry[];
    console.log('✅ Second update completed:');
    console.log(`   New Amount: $${(secondUpdate.amount / 100).toFixed(2)}`);
    console.log(`   Total Change History Entries: ${secondHistory.length}`);

    if (secondHistory.length < 2) {
      console.error('❌ FAIL: Change history did not accumulate multiple entries');
      process.exit(1);
    }

    const latestAmountChange = secondHistory[secondHistory.length - 1];
    if (latestAmountChange.changes.amount) {
      console.log('✅ PASS: Amount change was tracked:');
      console.log(
        `   Old: $${((latestAmountChange.changes.amount.old as number) / 100).toFixed(2)}`
      );
      console.log(
        `   New: $${((latestAmountChange.changes.amount.new as number) / 100).toFixed(2)}`
      );
    }

    // Test 5: Restore original values
    console.log('\nTest 5: Cleanup (Restore Original Values)');
    console.log('─'.repeat(50));

    const { error: restoreError } = await supabase
      .from('transactions')
      .update({
        payee: originalTx.payee,
        amount: originalTx.amount,
      })
      .eq('id', transactionId);

    if (restoreError) {
      console.error('⚠️  Warning: Failed to restore original values:', restoreError.message);
    } else {
      console.log('✅ Transaction restored to original state');
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Test Summary');
    console.log('═'.repeat(50));
    console.log('✅ All tests passed!');
    console.log('✅ Change history tracking is working correctly');
    console.log('✅ Triggers are properly configured\n');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Unexpected error:', errorMessage);
    process.exit(1);
  }
}

// Run tests
testChangeHistory();
