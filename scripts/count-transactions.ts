import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const booksetId = process.env.BOOKSET_ID || process.argv[2];
const accountId = process.env.ACCOUNT_ID || process.argv[3];

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

if (!booksetId || !accountId) {
  console.error('Error: Missing BOOKSET_ID or ACCOUNT_ID');
  console.log('Usage: npx tsx scripts/count-transactions.ts [bookset-id] [account-id]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countTransactions() {
  console.log('Checking transactions...\n');

  // Count with service key (bypasses RLS)
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('bookset_id', booksetId)
    .eq('account_id', accountId);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`📊 Total transactions in database: ${count}`);

  // Get a sample transaction to check fields
  const { data: sample } = await supabase
    .from('transactions')
    .select('id, created_by, source_batch_id, payee, amount')
    .eq('bookset_id', booksetId)
    .eq('account_id', accountId)
    .limit(1)
    .single();

  if (sample) {
    console.log('\n📝 Sample transaction:');
    console.log(`   ID: ${sample.id}`);
    console.log(`   Payee: ${sample.payee}`);
    console.log(`   Amount: $${(sample.amount / 100).toFixed(2)}`);
    console.log(`   created_by: ${sample.created_by || 'NULL (THIS IS THE PROBLEM!)'}`);
    console.log(`   source_batch_id: ${sample.source_batch_id || 'NULL'}`);
  }
}

countTransactions().catch(console.error);
