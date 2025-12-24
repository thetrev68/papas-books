import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
 * Lists all booksets and their accounts
 */
async function listBooksets() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log("║   Papa's Books - Bookset & Account Finder                   ║");
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Fetch all booksets
  const { data: booksets, error: booksetsError } = await supabase
    .from('booksets')
    .select('id, name, business_type, created_at')
    .order('created_at', { ascending: false });

  if (booksetsError) {
    console.error('❌ Error fetching booksets:', booksetsError.message);
    process.exit(1);
  }

  if (!booksets || booksets.length === 0) {
    console.log('⚠️  No booksets found in the database.\n');
    console.log('Please create a bookset by signing up in the app first.\n');
    process.exit(0);
  }

  console.log(`📚 Found ${booksets.length} bookset(s):\n`);

  for (const bookset of booksets) {
    console.log(`┌─ ${bookset.name}`);
    console.log(`│  ID: ${bookset.id}`);
    console.log(`│  Type: ${bookset.business_type || 'Not set'}`);
    console.log(`│  Created: ${new Date(bookset.created_at).toLocaleDateString()}`);

    // Fetch accounts for this bookset
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('bookset_id', bookset.id)
      .eq('is_archived', false)
      .order('name');

    if (accountsError) {
      console.log(`│  ⚠️  Error fetching accounts: ${accountsError.message}`);
    } else if (!accounts || accounts.length === 0) {
      console.log('│  ⚠️  No accounts found');
    } else {
      console.log(`│  Accounts (${accounts.length}):`);
      accounts.forEach((account, index) => {
        const isLast = index === accounts.length - 1;
        const prefix = isLast ? '└──' : '├──';
        console.log(`│  ${prefix} ${account.name} (${account.type})`);
        console.log(`│      ID: ${account.id}`);
      });
    }
    console.log('└────────────────────────────────────────────────────────────\n');
  }

  // Show usage instructions
  if (booksets.length > 0 && booksets[0]) {
    const firstBookset = booksets[0];
    const { data: firstAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('bookset_id', firstBookset.id)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (firstAccount) {
      console.log('💡 To seed test data, run:');
      console.log(
        `   npx tsx scripts/seed-large-dataset.ts ${firstBookset.id} ${firstAccount.id} 10000\n`
      );

      console.log('Or add to .env.local:');
      console.log(`   BOOKSET_ID=${firstBookset.id}`);
      console.log(`   ACCOUNT_ID=${firstAccount.id}`);
      console.log('   TOTAL_TRANSACTIONS=10000\n');
      console.log('   Then run: npx tsx scripts/seed-large-dataset.ts\n');
    }
  }
}

// Run the script
listBooksets().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
