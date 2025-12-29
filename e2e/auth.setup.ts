import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const storageStatePath = path.resolve('e2e/.auth/state.json');
const failureHtmlPath = path.resolve('e2e/.auth/login-failure.html');

export default async function globalSetup() {
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!email || !password) {
    return;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Required for Playwright auth setup.'
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new Error(error?.message || 'Supabase login failed without a session.');
    }

    // Ensure test account exists for E2E tests
    await ensureTestAccount(supabase);

    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, session, user]) => {
        localStorage.setItem(key, JSON.stringify(session));
        if (user) {
          localStorage.setItem(`${key}-user`, JSON.stringify(user));
        }
      },
      [storageKey, data.session, data.user]
    );
    const page = await context.newPage();
    await page.goto(`${baseURL}/app/dashboard`, { waitUntil: 'domcontentloaded' });

    // Wait for the app to initialize and redirect to dashboard
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 90000 });
    await page.waitForSelector('h1:has-text("Dashboard"), h2:has-text("Dashboard")', {
      timeout: 30000,
    });

    // Navigate to a blank page to clear any route state before saving storage
    await page.goto('about:blank');

    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });
    await browser.close();
  } catch (error) {
    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await fs.writeFile(failureHtmlPath, String(error));
    throw error;
  }
}

/**
 * Ensures a test account exists for import tests.
 * Creates one if it doesn't exist, otherwise returns the existing account.
 * Also ensures the current user has an active bookset configured.
 */
async function ensureTestAccount(supabase: ReturnType<typeof createClient>): Promise<void> {
  try {
    // Get current user to ensure they have a bookset
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Check if user has a bookset
    const { data: userProfile } = await supabase
      .from('users')
      .select('active_bookset_id, own_bookset_id')
      .eq('id', user.id)
      .single();

    if (!userProfile || !userProfile.own_bookset_id) {
      console.log(
        'User does not have a bookset. This should have been created automatically on signup.'
      );
      console.log('You may need to sign up through the app UI to properly initialize the user.');
      throw new Error('User bookset not found - user may not be properly initialized');
    }

    const booksetId = userProfile.active_bookset_id || userProfile.own_bookset_id;
    console.log(`Using bookset: ${booksetId}`);

    // Try to find existing test account
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('name', 'Test Checking Account')
      .eq('bookset_id', booksetId)
      .single();

    if (existing) {
      console.log(`Using existing test account: ${existing.name}`);
      return;
    }

    // Create a test account
    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert({
        bookset_id: booksetId,
        name: 'Test Checking Account',
        type: 'Asset',
        opening_balance: 0,
        is_archived: false,
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('Failed to create test account:', error);
      throw error;
    }

    console.log(`Created test account: ${newAccount.name}`);
  } catch (error) {
    console.error('Ensure test account error:', error);
    throw error;
  }
}
