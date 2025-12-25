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

    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });
    await browser.close();
  } catch (error) {
    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await fs.writeFile(failureHtmlPath, String(error));
    throw error;
  }
}
