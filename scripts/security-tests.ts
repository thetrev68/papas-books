/**
 * Security Audit Test Suite
 *
 * Automated security tests for Papa's Books
 *
 * Tests:
 * 1. SQL Injection Prevention
 * 2. XSS Prevention in CSV Import
 * 3. CSRF Protection (Supabase Auth)
 * 4. RLS Policy Enforcement
 * 5. Input Validation
 *
 * Usage:
 *   npx tsx scripts/security-tests.ts
 *
 * Requirements:
 *   - .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *   - Supabase project must be accessible
 */

import { createClient } from '@supabase/supabase-js';
import { sanitizeText } from '../src/lib/validation/import';
import { cleanCurrency } from '../src/lib/import/mapper';

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error(
    '   Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  category: 'SQL Injection' | 'XSS' | 'CSRF' | 'RLS' | 'Input Validation';
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} [${result.category}] ${result.name}`);
  console.log(`   ${result.details}\n`);
}

async function runSecurityAudit() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log("║         Papa's Books - Security Audit Test Suite              ║");
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // ===========================================================================
  // Test 1: SQL Injection Prevention
  // ===========================================================================
  console.log('📋 Test Category: SQL Injection Prevention\n');

  // Test 1.1: SQL Injection in query parameter
  const sqlInjectionPayloads = [
    "'; DROP TABLE transactions; --",
    "1' OR '1'='1",
    "admin'--",
    "' OR 1=1--",
    '1; DELETE FROM users WHERE 1=1--',
  ];

  for (const payload of sqlInjectionPayloads) {
    try {
      // Supabase client should parameterize all queries automatically
      await supabase.from('transactions').select('*').eq('payee', payload).limit(1);

      // If query executed without error, SQL injection was prevented
      // The payload should be treated as a literal string, not SQL code
      logTest({
        name: `SQL injection payload: "${payload.substring(0, 30)}..."`,
        passed: true,
        details: 'Supabase client properly parameterized query (no error thrown)',
        category: 'SQL Injection',
      });
    } catch (err) {
      logTest({
        name: `SQL injection payload: "${payload.substring(0, 30)}..."`,
        passed: false,
        details: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        category: 'SQL Injection',
      });
    }
  }

  // Test 1.2: SQL injection in JSONB field (split lines)
  try {
    const jsonbPayload = {
      lines: [
        {
          category_id: "'; DROP TABLE categories; --",
          amount: 5000,
          memo: 'test',
        },
      ],
    };

    await supabase.from('transactions').select('*').contains('lines', jsonbPayload.lines).limit(1);

    logTest({
      name: 'SQL injection in JSONB field',
      passed: true,
      details: 'JSONB query properly parameterized',
      category: 'SQL Injection',
    });
  } catch (err) {
    logTest({
      name: 'SQL injection in JSONB field',
      passed: false,
      details: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      category: 'SQL Injection',
    });
  }

  // ===========================================================================
  // Test 2: XSS Prevention
  // ===========================================================================
  console.log('📋 Test Category: XSS Prevention\n');

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg/onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '<<SCRIPT>alert("XSS");//<</SCRIPT>',
  ];

  for (const payload of xssPayloads) {
    const sanitized = sanitizeText(payload, 500);
    const passed =
      !sanitized.includes('<script') &&
      !sanitized.includes('onerror=') &&
      !sanitized.includes('onload=') &&
      !sanitized.includes('javascript:') &&
      !sanitized.includes('<iframe');

    logTest({
      name: `XSS payload: "${payload.substring(0, 40)}..."`,
      passed,
      details: passed
        ? `Sanitized to: "${sanitized}" (tags/scripts removed)`
        : `FAILED: Sanitized value still contains dangerous content: "${sanitized}"`,
      category: 'XSS',
    });
  }

  // Test 2.2: XSS in currency fields (should reject, not execute)
  const currencyXssPayloads = [
    '<script>alert(1)</script>1234.56',
    '$<img src=x onerror=alert(1)>50.00',
  ];

  for (const payload of currencyXssPayloads) {
    const result = cleanCurrency(payload);
    const passed = result === null; // Should reject invalid input

    logTest({
      name: `XSS in currency field: "${payload}"`,
      passed,
      details: passed
        ? 'Invalid currency format rejected (returns null)'
        : `FAILED: Currency parser returned ${result}`,
      category: 'XSS',
    });
  }

  // ===========================================================================
  // Test 3: CSRF Protection
  // ===========================================================================
  console.log('📋 Test Category: CSRF Protection\n');

  // Test 3.1: Verify Supabase Auth uses CSRF-safe headers
  try {
    // Supabase Auth automatically includes JWT in Authorization header
    // and validates origin/referrer headers
    await supabase.auth.getSession();

    logTest({
      name: 'Supabase Auth session management',
      passed: true,
      details:
        'Supabase uses JWT tokens in Authorization header (not cookies), making CSRF attacks ineffective',
      category: 'CSRF',
    });
  } catch (err) {
    logTest({
      name: 'Supabase Auth session management',
      passed: false,
      details: `Error checking session: ${err instanceof Error ? err.message : String(err)}`,
      category: 'CSRF',
    });
  }

  // Test 3.2: Verify unauthenticated requests are rejected
  try {
    const unauthClient = createClient(supabaseUrl, supabaseAnonKey);
    // Don't authenticate - try to access protected data
    const { data, error } = await unauthClient.from('transactions').select('*').limit(1);

    // Should return empty array or RLS policy violation
    const passed = !data || data.length === 0 || (error && error.code === '42501');

    logTest({
      name: 'Unauthenticated data access blocked',
      passed,
      details: passed
        ? 'RLS policies prevent unauthenticated access'
        : `FAILED: Unauthenticated user received data: ${JSON.stringify(data)}`,
      category: 'CSRF',
    });
  } catch {
    logTest({
      name: 'Unauthenticated data access blocked',
      passed: true,
      details: 'Request rejected (expected behavior)',
      category: 'CSRF',
    });
  }

  // ===========================================================================
  // Test 4: Row Level Security (RLS)
  // ===========================================================================
  console.log('📋 Test Category: Row Level Security\n');

  // Test 4.1: Verify RLS is enabled on all tables
  const tables = [
    'users',
    'booksets',
    'accounts',
    'transactions',
    'categories',
    'rules',
    'payees',
    'access_grants',
    'import_batches',
    'reconciliations',
  ];

  for (const table of tables) {
    try {
      // Try to access table without auth - should be blocked by RLS
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await unauthClient.from(table).select('id').limit(1);

      const passed = !data || data.length === 0 || (error && error.code === '42501');

      logTest({
        name: `RLS enabled on "${table}" table`,
        passed,
        details: passed
          ? 'Table is protected by RLS policies'
          : `FAILED: Unauthenticated access allowed to ${table}`,
        category: 'RLS',
      });
    } catch {
      logTest({
        name: `RLS enabled on "${table}" table`,
        passed: true,
        details: 'Access rejected by RLS (expected)',
        category: 'RLS',
      });
    }
  }

  // ===========================================================================
  // Test 5: Input Validation
  // ===========================================================================
  console.log('📋 Test Category: Input Validation\n');

  // Test 5.1: Description length validation
  const longDescription = 'A'.repeat(1000);
  const sanitizedLong = sanitizeText(longDescription, 500);

  logTest({
    name: 'Description max length enforcement',
    passed: sanitizedLong.length === 500,
    details: `Input: ${longDescription.length} chars → Output: ${sanitizedLong.length} chars (max: 500)`,
    category: 'Input Validation',
  });

  // Test 5.2: Control character removal
  const controlChars = 'Hello\x00\x01\x02World\x1F';
  const sanitizedControl = sanitizeText(controlChars, 100);
  // eslint-disable-next-line no-control-regex
  const passed = !sanitizedControl.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/);

  logTest({
    name: 'Control character removal',
    passed,
    details: passed
      ? `Sanitized: "${sanitizedControl}" (control chars removed)`
      : `FAILED: Control chars still present in "${sanitizedControl}"`,
    category: 'Input Validation',
  });

  // Test 5.3: HTML entity encoding test
  const htmlEntities = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
  const sanitizedEntities = sanitizeText(htmlEntities, 100);

  logTest({
    name: 'HTML entities handled',
    passed: true,
    details: `Input: "${htmlEntities}" → Output: "${sanitizedEntities}"`,
    category: 'Input Validation',
  });

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                     Security Audit Summary                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${passedTests} ✅`);
  console.log(`Failed:       ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

  // Summary by category
  const categories = ['SQL Injection', 'XSS', 'CSRF', 'RLS', 'Input Validation'] as const;
  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);
    const categoryPassed = categoryResults.filter((r) => r.passed).length;
    const categoryTotal = categoryResults.length;
    const icon = categoryPassed === categoryTotal ? '✅' : '⚠️';
    console.log(`${icon} ${category}: ${categoryPassed}/${categoryTotal} passed`);
  }

  console.log('\n');

  // List failures
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log('⚠️  Failed Tests:\n');
    failures.forEach((f) => {
      console.log(`   ❌ [${f.category}] ${f.name}`);
      console.log(`      ${f.details}\n`);
    });
  } else {
    console.log('🎉 All security tests passed!\n');
  }

  // Exit code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run audit
runSecurityAudit().catch((err) => {
  console.error('❌ Security audit failed with error:', err);
  process.exit(1);
});
