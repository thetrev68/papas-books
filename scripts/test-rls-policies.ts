import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env or .env.local manually since dotenv might not be installed
try {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf-8');
      envConfig.split('\n').forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
          process.env[key] = value;
        }
      });
      console.log(`Loaded environment variables from ${file}`);
    }
  }
} catch (e) {
  console.warn('Failed to load env file:', e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

async function testRlsPolicies() {
  console.log('Testing RLS Policies...\n');

  // Test 1: Create two users
  const user1Client = createClient(supabaseUrl, supabaseAnonKey);
  const user2Client = createClient(supabaseUrl, supabaseAnonKey);

  const email1 = `papas_test1_${Date.now()}@gmail.com`;
  const email2 = `papas_test2_${Date.now()}@gmail.com`;
  const password = 'TestPassword123!';

  // Sign up user 1
  const { data: user1, error: user1Error } = await user1Client.auth.signUp({
    email: email1,
    password: password,
  });
  if (user1Error) {
    console.error('Failed to create User 1:', user1Error);
    return;
  }
  console.log('User 1 created:', user1?.user?.id);

  // Sign up user 2
  const { data: user2, error: user2Error } = await user2Client.auth.signUp({
    email: email2,
    password: password,
  });
  if (user2Error) {
    console.error('Failed to create User 2:', user2Error);
    return;
  }
  console.log('User 2 created:', user2?.user?.id);

  // Wait for triggers to create booksets/accounts
  console.log('Waiting for triggers...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Get User 1's bookset
  const { data: bookset1 } = await user1Client
    .from('booksets')
    .select('id')
    .eq('owner_id', user1.user!.id)
    .single();

  if (!bookset1) {
    console.error('User 1 bookset not found');
    return;
  }

  // Get an account for User 1 (should create a default one or we create one)
  // Assuming no default account, let's create one
  const { data: account1, error: accError } = await user1Client
    .from('accounts')
    .insert({
      bookset_id: bookset1.id,
      name: 'User 1 Checking',
      type: 'Asset',
    })
    .select()
    .single();

  if (accError) {
    console.error('Failed to create account for User 1:', accError);
    return;
  }
  console.log('User 1 account created:', account1.id);

  // Test 2: User 1 creates a transaction
  const { data: transaction, error: txError } = await user1Client
    .from('transactions')
    .insert({
      bookset_id: bookset1.id,
      account_id: account1.id,
      date: '2025-01-01',
      amount: 10000,
      payee: 'Test Payee',
      original_description: 'Test',
      fingerprint: `test-fingerprint-${Date.now()}`,
      import_date: new Date().toISOString(),
      lines: [], // Required by schema now
    })
    .select()
    .single();

  if (txError) {
    console.error('Failed to create transaction for User 1:', txError);
    return;
  }

  console.log('User 1 transaction created:', transaction?.id);

  // Test 3: User 2 tries to read User 1's transaction (should fail)
  const { data: user2Transactions } = await user2Client
    .from('transactions')
    .select('*')
    .eq('id', transaction!.id);

  if (user2Transactions && user2Transactions.length > 0) {
    console.error("❌ SECURITY ISSUE: User 2 can read User 1's transaction!");
  } else {
    console.log("✅ User 2 cannot read User 1's transaction (correct)");
  }

  // Test 4: User 2 tries to update User 1's transaction (should fail)
  await user2Client.from('transactions').update({ payee: 'Hacked!' }).eq('id', transaction!.id);

  // Note: update usually doesn't return error on RLS violation, it just updates 0 rows.
  // We need to check if the update actually happened by reading it back as User 1.

  const { data: refetchedTx } = await user1Client
    .from('transactions')
    .select('payee')
    .eq('id', transaction!.id)
    .single();

  if (refetchedTx?.payee === 'Hacked!') {
    console.error("❌ SECURITY ISSUE: User 2 updated User 1's transaction!");
  } else {
    console.log("✅ User 2 cannot update User 1's transaction (correct)");
  }

  // Cleanup (Optional, since we used random emails)
  // await user1Client.from('transactions').delete().eq('id', transaction!.id);
  console.log('\nTest complete.');
}

testRlsPolicies();
