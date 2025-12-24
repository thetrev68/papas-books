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

async function checkOwnership() {
  console.log('🔍 Checking transaction ownership...\n');

  // Get unique created_by values from transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('created_by')
    .eq('bookset_id', booksetId)
    .limit(1000);

  if (!transactions || transactions.length === 0) {
    console.log('❌ No transactions found');
    return;
  }

  const uniqueUsers = [...new Set(transactions.map((t) => t.created_by))];

  console.log(`📊 Found ${transactions.length} transactions`);
  console.log(`👥 Created by ${uniqueUsers.length} unique user(s):\n`);

  for (const userId of uniqueUsers) {
    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();

    const count = transactions.filter((t) => t.created_by === userId).length;

    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${user?.email || 'Unknown'}`);
    console.log(`   Display Name: ${user?.display_name || 'Not set'}`);
    console.log(`   Transaction count: ${count}\n`);
  }

  // Check bookset owner
  const { data: bookset } = await supabase
    .from('booksets')
    .select('owner_id, name')
    .eq('id', booksetId)
    .single();

  if (bookset) {
    const { data: owner } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', bookset.owner_id)
      .single();

    console.log('📚 Bookset Information:');
    console.log(`   Name: ${bookset.name}`);
    console.log(`   Owner ID: ${bookset.owner_id}`);
    console.log(`   Owner Email: ${owner?.email || 'Unknown'}`);
    console.log(`   Owner Display Name: ${owner?.display_name || 'Not set'}\n`);

    if (!uniqueUsers.includes(bookset.owner_id)) {
      console.log('⚠️  WARNING: Transactions were NOT created by the bookset owner!');
      console.log('   This might cause RLS policy issues when viewing in the app.\n');
    } else {
      console.log(
        '✅ Transactions were created by the bookset owner - RLS should work correctly.\n'
      );
    }
  }
}

checkOwnership().catch(console.error);
