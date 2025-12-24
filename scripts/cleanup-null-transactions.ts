import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const booksetId = process.env.BOOKSET_ID || process.argv[2];

if (!supabaseUrl || !supabaseKey || !booksetId) {
  console.error('Error: Missing required configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupNullTransactions() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log("║   Papa's Books - Cleanup NULL Transactions                  ║");
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Count NULL transactions
  const { count: nullCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('bookset_id', booksetId)
    .is('created_by', null);

  const { count: totalCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('bookset_id', booksetId);

  console.log(`📊 Transaction Summary:`);
  console.log(`   Total transactions: ${totalCount}`);
  console.log(`   With NULL created_by: ${nullCount}`);
  console.log(`   With valid created_by: ${(totalCount || 0) - (nullCount || 0)}\n`);

  if (nullCount === 0) {
    console.log('✅ No cleanup needed - all transactions have valid created_by!\n');
    return;
  }

  console.log(`⚠️  WARNING: This will DELETE ${nullCount} transactions with NULL created_by.`);
  console.log('   These transactions are invisible in the app due to RLS policies.\n');

  // In a real interactive script, you'd ask for confirmation
  // For now, we'll just proceed
  console.log('🗑️  Deleting NULL transactions...\n');

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('bookset_id', booksetId)
    .is('created_by', null);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Cleanup Complete                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Deleted ${nullCount} transactions with NULL created_by\n`);
  console.log('💡 Now run the seed script to generate properly tracked transactions:');
  console.log('   npx tsx scripts/seed-large-dataset.ts\n');
}

cleanupNullTransactions().catch(console.error);
