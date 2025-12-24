import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL');
  console.error('Required: SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generates a SHA-256 fingerprint for a transaction (Node.js version)
 */
function generateFingerprint(date: string, amount: number, description: string): string {
  const normalized = description.trim().toLowerCase().replace(/\s+/g, ' ');
  const hashInput = `${date}|${amount}|${normalized}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Generates a random date in 2024
 */
function randomDate(): string {
  const start = new Date(2024, 0, 1);
  const end = new Date(2024, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

/**
 * Seeds a large dataset for performance testing
 */
async function seedLargeDataset() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log("║   Papa's Books - Large Dataset Seeding Script              ║");
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get bookset_id and account_id from command line or prompt
  const booksetId = process.env.BOOKSET_ID || process.argv[2];
  const accountId = process.env.ACCOUNT_ID || process.argv[3];
  const totalTransactions = parseInt(
    process.env.TOTAL_TRANSACTIONS || process.argv[4] || '10000',
    10
  );
  const batchSize = 1000;

  if (!booksetId || !accountId) {
    console.error('❌ Error: Missing required arguments\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/seed-large-dataset.ts <bookset_id> <account_id> [count]\n');
    console.log('Or set environment variables:');
    console.log(
      '  BOOKSET_ID=<id> ACCOUNT_ID=<id> TOTAL_TRANSACTIONS=10000 npx tsx scripts/seed-large-dataset.ts\n'
    );
    process.exit(1);
  }

  console.log(`📊 Configuration:`);
  console.log(`   Bookset ID: ${booksetId}`);
  console.log(`   Account ID: ${accountId}`);
  console.log(`   Target Transactions: ${totalTransactions.toLocaleString()}`);
  console.log(`   Batch Size: ${batchSize.toLocaleString()}\n`);

  // Verify bookset and account exist
  const { data: bookset, error: booksetError } = await supabase
    .from('booksets')
    .select('id, name, owner_id')
    .eq('id', booksetId)
    .single();

  if (booksetError || !bookset) {
    console.error(`❌ Bookset not found: ${booksetId}`);
    process.exit(1);
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    console.error(`❌ Account not found: ${accountId}`);
    process.exit(1);
  }

  console.log(`✅ Verified bookset: "${bookset.name}"`);
  console.log(`✅ Verified account: "${account.name}"\n`);

  // Get the bookset owner ID to set as created_by
  const { data: owner } = await supabase
    .from('users')
    .select('id')
    .eq('id', bookset.owner_id)
    .single();

  const ownerId = owner?.id || bookset.owner_id;
  console.log(`👤 Setting created_by to bookset owner: ${ownerId}\n`);

  // Merchant names for realistic data
  const merchants = [
    'STARBUCKS',
    'AMAZON.COM',
    'WALMART',
    'TARGET',
    'COSTCO',
    'WHOLE FOODS',
    'TRADER JOES',
    'SHELL GAS',
    'CHEVRON',
    'AT&T',
    'VERIZON',
    'NETFLIX',
    'SPOTIFY',
    'APPLE.COM',
    'MICROSOFT',
    'GOOGLE',
    'UBER',
    'LYFT',
    'DOORDASH',
    'GRUBHUB',
    'HOME DEPOT',
    'LOWES',
    'BEST BUY',
    'MCDONALDS',
    'CHIPOTLE',
    'PANERA BREAD',
    'SUBWAY',
    'DOMINOS',
    'PIZZA HUT',
    'CVS PHARMACY',
  ];

  const startTime = Date.now();
  let totalInserted = 0;

  console.log('🚀 Starting data generation...\n');

  for (let batch = 0; batch < Math.ceil(totalTransactions / batchSize); batch++) {
    const transactions = [];
    const currentBatchSize = Math.min(batchSize, totalTransactions - totalInserted);

    for (let i = 0; i < currentBatchSize; i++) {
      const date = randomDate();
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const amount = Math.floor(Math.random() * 20000) - 10000; // -$100 to $100 in cents
      const storeNumber = Math.floor(Math.random() * 99999);
      const description = `${merchant} #${storeNumber}`;

      const fingerprint = generateFingerprint(date, amount, description);

      transactions.push({
        bookset_id: booksetId,
        account_id: accountId,
        date,
        amount,
        payee: merchant,
        original_description: description,
        fingerprint,
        import_date: new Date().toISOString(),
        is_reviewed: Math.random() > 0.3, // 70% reviewed
        is_split: false,
        reconciled: false,
        is_archived: false,
        lines: [],
        created_by: ownerId,
        last_modified_by: ownerId,
      });
    }

    // Insert batch
    const { data, error } = await supabase.from('transactions').insert(transactions).select('id');

    if (error) {
      console.error(`❌ Error inserting batch ${batch + 1}:`, error.message);
      break;
    }

    totalInserted += data?.length || 0;
    const progress = ((totalInserted / totalTransactions) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round((totalInserted / (Date.now() - startTime)) * 1000);

    console.log(
      `   Batch ${batch + 1}/${Math.ceil(totalTransactions / batchSize)}: ` +
        `${totalInserted.toLocaleString()}/${totalTransactions.toLocaleString()} ` +
        `(${progress}%) - ${elapsed}s elapsed - ${rate.toLocaleString()} tx/s`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRate = Math.round((totalInserted / (Date.now() - startTime)) * 1000);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Dataset Generation Complete                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Total Inserted: ${totalInserted.toLocaleString()} transactions`);
  console.log(`⏱️  Total Time: ${totalTime}s`);
  console.log(`📈 Average Rate: ${avgRate.toLocaleString()} transactions/second\n`);
  console.log('Next Steps:');
  console.log('  1. Open the app and navigate to the Workbench');
  console.log('  2. Open browser DevTools Console');
  console.log(
    '  3. Run: performance.mark("start"); setTimeout(() => { performance.mark("end"); performance.measure("load", "start", "end"); console.log(performance.getEntriesByName("load")[0].duration + "ms"); }, 0);'
  );
  console.log('  4. Document the load time in docs/performance-test-results.md\n');
}

// Run the script
seedLargeDataset().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
