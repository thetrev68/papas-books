# Phase 3: Import & Transaction Management (v2)

**Status:** Ready for Implementation
**Dependencies:** Phase 2 (Account & Category Management)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md), [Phase-2-Accounts-Categories.md](Phase-2-Accounts-Categories.md)

---

## Overview

Phase 3 implements the "ingestion engine" for Papa's Books. This is the most critical part of the application for data integrity. The goal is to transform raw, unstructured CSV data from various banks into a standardized, duplicate-free ledger of transactions.

**Key Principles:**

- **Logic-First:** All business logic must exist in pure, testable TypeScript functions in `/src/lib/`.
- **Zero UI Polish:** The interface will be raw HTML inputs/buttons only, serving purely as a harness to trigger and verify the backend logic.
- **Idempotency:** Re-importing the same file must result in **zero** duplicates in the database.
- **Auditability:** Every transaction in the database must be traceable back to a specific source file import batch.
- **Client-Side Processing:** CSV parsing, mapping, and duplicate detection happen in the browser to ensure data privacy and fast feedback loops before hitting the database.
- **Performance Constraints:** Must handle CSV files up to 10MB and 50,000 rows without freezing the browser.

---

## Database Schema & Types

The schema was created in Phase 1. We will use strict TypeScript interfaces to interact with it.

### Database Migration Required

Before implementing Phase 3, ensure the `fingerprint` column exists and is indexed:

```sql
-- Add fingerprint column if not exists (likely already in Phase 1 schema)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS fingerprint TEXT NOT NULL DEFAULT '';

-- Create index for duplicate detection performance
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint
ON transactions(fingerprint);

-- Create index for fetching by account (used in duplicate detection)
CREATE INDEX IF NOT EXISTS idx_transactions_account_fingerprint
ON transactions(accountId, fingerprint);
```

**Why these indexes:**

- `idx_transactions_fingerprint`: Enables fast duplicate lookups when checking if fingerprint exists
- `idx_transactions_account_fingerprint`: Optimizes fetching all fingerprints for a specific account

### 1. The Transaction Record (`transactions` table)

This is the source of truth for the ledger.

```typescript
// src/types/database.ts (Enhancement)

export interface Transaction {
  id: string; // uuid, primary key
  booksetId: string; // uuid, owner
  accountId: string; // uuid, link to account

  // Core Financial Data
  date: string; // ISO 8601 date (YYYY-MM-DD)
  amount: number; // Integer in cents (e.g., -1499 for -$14.99)
  payee: string; // Cleaned name (initially same as originalDescription)
  originalDescription: string; // Raw bank text (immutable)

  // Metadata & Audit
  fingerprint: string; // SHA-256 hash for duplicate detection
  sourceBatchId: string | null; // Link to import_batches
  importDate: string; // ISO timestamp

  // Status Flags
  isReviewed: boolean; // False = "New", True = "Accepted"
  isSplit: boolean; // Phase 5 feature
  reconciled: boolean; // Phase 6 feature

  // Split transaction data (Phase 5)
  lines: any; // JSONB - array of split lines

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Audit trail (set by triggers)
  createdBy: string; // uuid, foreign key to users.id
  lastModifiedBy: string; // uuid, foreign key to users.id
}
```

**Important Notes:**

- `amount` is stored in cents to avoid floating-point precision issues
- `fingerprint` is used for exact duplicate detection
- `originalDescription` is immutable (never edited, used for rule matching)
- `payee` is editable (user-friendly display name)

### 2. The Import Batch (`import_batches` table)

Tracks the history of imports.

```typescript
// src/types/database.ts (Enhancement)

export interface ImportBatch {
  id: string; // uuid, primary key
  booksetId: string; // uuid, foreign key to booksets.id
  accountId: string; // uuid, foreign key to accounts.id
  fileName: string; // Original CSV filename
  importedAt: string; // ISO timestamp
  importedBy: string; // uuid, foreign key to users.id (set by trigger)

  // Statistics
  totalRows: number; // Total rows in CSV (excluding header)
  importedCount: number; // Successfully imported (new transactions)
  duplicateCount: number; // Skipped as duplicates
  errorCount: number; // Failed to parse/validate

  // Audit Snapshot
  csvMappingSnapshot: any; // JSONB - Copy of CsvMapping used for this import

  // Undo support (future feature)
  isUndone: boolean; // If true, transactions should be hidden
  undoneAt: string | null; // When it was undone
  undoneBy: string | null; // uuid, foreign key to users.id
}
```

**Why csvMappingSnapshot:**

- Captures the exact mapping configuration used for this import
- If user changes account's CSV mapping later, we can still understand old imports
- Enables potential "re-process" feature in the future

### 3. The Import Profile (`accounts.csvMapping`)

Stored as JSONB in the database's `accounts` table, this configures how to read a specific bank's CSV.

```typescript
// src/types/import.ts

export type DateFormat = 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM-dd-yyyy';

export type AmountMode = 'signed' | 'separate';

export interface CsvMapping {
  // Column Headers (or indices if no header)
  dateColumn: string; // "Date", "Transaction Date", "Posted Date"
  amountColumn: string; // "Amount" (if amountMode='signed')
  descriptionColumn: string; // "Description", "Memo", "Details"

  // Parsing Rules
  dateFormat: DateFormat; // How to interpret date strings
  hasHeaderRow: boolean; // True = first row is column names

  // Advanced Amount Handling
  amountMode: AmountMode; // 'signed' or 'separate'

  // Used only if amountMode === 'separate'
  inflowColumn?: string; // "Credit", "Deposit" (positive amounts)
  outflowColumn?: string; // "Debit", "Withdrawal" (negative amounts)
}

export type InsertCsvMapping = CsvMapping;
export type UpdateCsvMapping = Partial<CsvMapping>;
```

**Amount Mode Explained:**

- **'signed'**: Single column with positive/negative values (e.g., "-$50.00", "$100.00")
  - Common in: Chase, Bank of America
- **'separate'**: Two columns for debits and credits
  - Common in: American Express, some credit unions
  - Logic: If `inflowColumn` has value, use it as positive; if `outflowColumn` has value, use it as negative

---

## Domain Logic: The Import Pipeline

The import process is a linear pipeline of transformations. Each step is a separate module in `src/lib/import/`.

### Pipeline Overview

```text
File Upload
    ↓
1. Parse: File → RawRow[]
    ↓
2. Map: RawRow[] + CsvMapping → StagedTransaction[]
    ↓
3. Fingerprint: StagedTransaction → StagedTransaction (with hash)
    ↓
4. Deduplicate (Exact): StagedTransaction[] + ExistingFingerprints → ProcessedTransaction[]
    ↓
5. Deduplicate (Fuzzy): ProcessedTransaction[] + ExistingTransactions → ProcessedTransaction[]
    ↓
6. Commit: ProcessedTransaction[] → Database
```

**Key Design Decision:**

All steps except "Commit" are pure functions that run client-side. This ensures:

- Fast feedback (no server round-trips)
- Data privacy (CSV never leaves user's browser)
- Easy testing (no database required for unit tests)

---

## Module 1: Parser Engine

**File:** `src/lib/import/parser.ts`

**Dependencies:** `papaparse` (install via `npm install papaparse @types/papaparse`)

**Objective:** Safely parse CSV files with validation and error handling.

### Installation

```bash
npm install papaparse @types/papaparse
```

### Types

```typescript
import Papa from 'papaparse';

export interface ParseResult {
  data: Record<string, string>[]; // Array of objects (if header) or string arrays (if no header)
  meta: {
    fields?: string[]; // Detected column headers
  };
  errors: Papa.ParseError[]; // Parsing errors (malformed rows, etc.)
}

export interface ParseOptions {
  preview?: number; // Max rows to parse (for preview mode)
  hasHeaderRow?: boolean; // Whether to treat first row as headers
}
```

### Constraints

```typescript
// Constants for validation
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ROWS = 50000; // 50,000 rows
```

### Functions

#### Function: `previewCsv(file: File, options?: ParseOptions): Promise<ParseResult>`

**Purpose:** Parse the first 5 rows of a CSV for preview and column detection.

**Parameters:**

- `file`: File object from `<input type="file">`
- `options`: Optional parsing configuration

**Returns:** `Promise<ParseResult>`

**Validation:**

- Checks file size < 10MB
- Rejects non-CSV file types (based on extension)

**Implementation concept:**

```typescript
export async function previewCsv(file: File, options?: ParseOptions): Promise<ParseResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }

  // Validate file type
  if (!file.name.endsWith('.csv')) {
    throw new Error('Only CSV files are supported.');
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      preview: 5, // Only parse first 5 rows
      header: options?.hasHeaderRow ?? true,
      skipEmptyLines: true, // Ignore blank rows
      complete: (results) => {
        resolve({
          data: results.data as Record<string, string>[],
          meta: {
            fields: results.meta.fields,
          },
          errors: results.errors,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}
```

**Why these settings:**

- `preview: 5`: Only parse first 5 rows for quick feedback
- `header: true`: Assumes first row is column names (can be overridden)
- `skipEmptyLines: true`: Prevents blank rows from causing errors

#### Function: `parseFullCsv(file: File, options?: ParseOptions): Promise<ParseResult>`

**Purpose:** Parse the entire CSV file.

**Parameters:**

- `file`: File object
- `options`: Optional parsing configuration

**Returns:** `Promise<ParseResult>`

**Validation:**

- Checks file size < 10MB
- Checks total rows < 50,000

**Implementation concept:**

```typescript
export async function parseFullCsv(file: File, options?: ParseOptions): Promise<ParseResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: options?.hasHeaderRow ?? true,
      skipEmptyLines: true,
      complete: (results) => {
        // Validate row count
        if (results.data.length > MAX_ROWS) {
          reject(
            new Error(`File has too many rows (${results.data.length}). Maximum is ${MAX_ROWS}.`)
          );
          return;
        }

        resolve({
          data: results.data as Record<string, string>[],
          meta: {
            fields: results.meta.fields,
          },
          errors: results.errors,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}
```

**Error Handling:**

If `results.errors.length > 0`, the function should still resolve but include errors in the result. The caller can decide whether to proceed or abort.

---

## Module 2: Mapping Engine

**File:** `src/lib/import/mapper.ts`

**Dependencies:** `date-fns` (install via `npm install date-fns`)

**Objective:** Transform raw CSV rows into strongly-typed transaction objects.

### Installation

```bash
npm install date-fns
```

### Types

```typescript
import { CsvMapping } from '../../types/import';

export interface StagedTransaction {
  // Valid fields (only present if parsing succeeded)
  date?: string; // ISO YYYY-MM-DD
  amount?: number; // Cents (integer)
  description?: string; // Raw description text

  // Validation state
  isValid: boolean; // True if all required fields parsed successfully
  errors: string[]; // Human-readable error messages

  // Source data for debugging
  rawRow: any; // Original CSV row (object or array)
  rowIndex: number; // Row number in CSV (0-based, excluding header)
}
```

### Currency Cleaning Utilities

```typescript
/**
 * Cleans currency strings and converts to cents.
 *
 * Examples:
 * - "$1,234.56" → 123456
 * - "1234.56" → 123456
 * - "($50.00)" → -5000  (parentheses indicate negative)
 * - "-$25.99" → -2599
 * - "1,234" → 123400     (assumes whole dollars if no decimal)
 *
 * @param raw - Raw currency string from CSV
 * @returns Amount in cents (integer), or null if invalid
 */
export function cleanCurrency(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;

  // Trim whitespace
  let cleaned = raw.trim();

  // Detect negative via parentheses: "($50.00)"
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = cleaned.slice(1, -1); // Remove parentheses
  }

  // Remove currency symbols and commas
  cleaned = cleaned.replace(/[$,]/g, '');

  // Parse as float
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  // Convert to cents
  const cents = Math.round(parsed * 100);

  // Apply negative sign if parentheses were used
  return isNegativeParens ? -cents : cents;
}
```

**Why Math.round:**

Floating-point multiplication can produce values like `123.99999999`, rounding ensures we get `124`.

### Date Parsing Utilities

```typescript
import { parse, isValid as isValidDate } from 'date-fns';

/**
 * Parses a date string using the specified format.
 *
 * @param raw - Raw date string from CSV
 * @param format - DateFormat enum value (e.g., 'MM/dd/yyyy')
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDate(raw: string, format: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const parsed = parse(raw.trim(), format, new Date());

  if (!isValidDate(parsed)) return null;

  // Return ISO date string (YYYY-MM-DD)
  return parsed.toISOString().split('T')[0];
}
```

**Why date-fns:**

- Handles various date formats reliably
- `parse()` function uses format string (e.g., 'MM/dd/yyyy')
- Returns `Invalid Date` if parsing fails (checked with `isValid()`)

### Main Mapping Function

```typescript
/**
 * Transforms a single raw CSV row into a StagedTransaction.
 *
 * Handles:
 * - Date parsing using specified format
 * - Currency cleaning (remove $, commas, parentheses)
 * - Amount mode logic (signed vs. separate columns)
 * - Validation and error collection
 *
 * @param row - Raw CSV row (object if header=true, array if header=false)
 * @param mapping - CsvMapping configuration
 * @param rowIndex - Row number (for error reporting)
 * @returns StagedTransaction with isValid flag and errors array
 */
export function mapRowToTransaction(
  row: any,
  mapping: CsvMapping,
  rowIndex: number
): StagedTransaction {
  const errors: string[] = [];
  let date: string | undefined;
  let amount: number | undefined;
  let description: string | undefined;

  // Extract raw values from row
  const rawDate = row[mapping.dateColumn];
  const rawDescription = row[mapping.descriptionColumn];

  // Parse date
  const parsedDate = parseDate(rawDate, mapping.dateFormat);
  if (!parsedDate) {
    errors.push(`Invalid date: "${rawDate}" (expected format: ${mapping.dateFormat})`);
  } else {
    date = parsedDate;
  }

  // Parse amount (depends on amountMode)
  if (mapping.amountMode === 'signed') {
    const rawAmount = row[mapping.amountColumn];
    const parsedAmount = cleanCurrency(rawAmount);

    if (parsedAmount === null) {
      errors.push(`Invalid amount: "${rawAmount}"`);
    } else {
      amount = parsedAmount;
    }
  } else if (mapping.amountMode === 'separate') {
    // Separate debit/credit columns
    const rawInflow = mapping.inflowColumn ? row[mapping.inflowColumn] : '';
    const rawOutflow = mapping.outflowColumn ? row[mapping.outflowColumn] : '';

    const inflow = cleanCurrency(rawInflow);
    const outflow = cleanCurrency(rawOutflow);

    // Logic: Use inflow as positive, outflow as negative
    if (inflow !== null && inflow !== 0) {
      amount = inflow;
    } else if (outflow !== null && outflow !== 0) {
      amount = -Math.abs(outflow); // Ensure negative
    } else {
      errors.push('Missing amount in both inflow and outflow columns');
    }
  }

  // Extract description (no parsing needed)
  if (rawDescription && typeof rawDescription === 'string') {
    description = rawDescription.trim();
  } else {
    errors.push('Missing description');
  }

  return {
    date,
    amount,
    description,
    isValid: errors.length === 0,
    errors,
    rawRow: row,
    rowIndex,
  };
}
```

**Why this approach:**

- Collects all errors instead of failing on first error (better UX)
- Returns partial data even if invalid (useful for debugging in UI)
- Validates all required fields (date, amount, description)

### Batch Mapping Function

```typescript
/**
 * Maps an array of raw CSV rows to staged transactions.
 *
 * @param rows - Array of raw CSV rows
 * @param mapping - CsvMapping configuration
 * @returns Array of StagedTransactions
 */
export function mapRowsToTransactions(rows: any[], mapping: CsvMapping): StagedTransaction[] {
  return rows.map((row, index) => mapRowToTransaction(row, mapping, index));
}
```

---

## Module 3: Fingerprinting

**File:** `src/lib/import/fingerprint.ts`

**Dependencies:** None (uses built-in Web Crypto API)

**Objective:** Generate deterministic SHA-256 hashes for duplicate detection.

### Algorithm

The fingerprint is a SHA-256 hash of normalized transaction data:

```text
HashInput = ISO_Date + "|" + Amount_Cents + "|" + Normalized_Description
```

### Normalization Rules

To ensure identical transactions produce identical hashes:

1. **Trim** leading/trailing whitespace
2. **Convert** to lowercase
3. **Replace** multiple spaces with single space
4. **Remove** leading/trailing special characters (optional - keep simple for Phase 3)

### Implementation

```typescript
/**
 * Normalizes a description string for consistent fingerprinting.
 *
 * Rules:
 * - Trim whitespace
 * - Convert to lowercase
 * - Replace multiple spaces with single space
 *
 * @param description - Raw description text
 * @returns Normalized description
 */
export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Generates a SHA-256 hash of transaction core data.
 *
 * Hash input format: "YYYY-MM-DD|amount_cents|normalized_description"
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @param amount - Amount in cents (integer)
 * @param description - Raw description text
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function generateFingerprint(
  date: string,
  amount: number,
  description: string
): Promise<string> {
  // Build hash input string
  const normalized = normalizeDescription(description);
  const hashInput = `${date}|${amount}|${normalized}`;

  // Convert string to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);

  // Generate SHA-256 hash
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}
```

**Why SHA-256:**

- Cryptographically strong (collision-resistant)
- Deterministic (same input always produces same output)
- Fast (native browser implementation)
- Standard hex output (64 characters)

**Why normalize description:**

- Prevents duplicates from being missed due to case differences
- Handles extra whitespace variations
- Banks sometimes change spacing or case in exports

### Batch Fingerprinting Function

```typescript
/**
 * Adds fingerprints to an array of staged transactions.
 *
 * @param transactions - Array of StagedTransactions (must be valid)
 * @returns Promise<StagedTransaction[]> - Same array with fingerprint property added
 */
export async function addFingerprints(
  transactions: StagedTransaction[]
): Promise<(StagedTransaction & { fingerprint: string })[]> {
  const withFingerprints = await Promise.all(
    transactions
      .filter((t) => t.isValid) // Only fingerprint valid transactions
      .map(async (t) => ({
        ...t,
        fingerprint: await generateFingerprint(t.date!, t.amount!, t.description!),
      }))
  );

  return withFingerprints;
}
```

---

## Module 4: Deduplication (Exact Match)

**File:** `src/lib/import/reconciler.ts`

**Dependencies:** None

**Objective:** Detect exact duplicate transactions using fingerprint matching.

### Types

```typescript
import { Transaction } from '../../types/database';
import { StagedTransaction } from './mapper';

export type ImportStatus = 'new' | 'duplicate' | 'fuzzy_duplicate' | 'error';

export interface ProcessedTransaction extends StagedTransaction {
  fingerprint: string; // SHA-256 hash
  status: ImportStatus; // Duplicate detection result
  duplicateOfId?: string; // If duplicate, points to existing transaction ID
  fuzzyMatches?: Transaction[]; // If fuzzy_duplicate, list of potential matches
}
```

### Exact Duplicate Detection

```typescript
/**
 * Detects exact duplicate transactions using fingerprint matching.
 *
 * Uses Set for O(1) lookup performance.
 *
 * @param incoming - Array of staged transactions with fingerprints
 * @param existingFingerprints - Set of fingerprints already in database
 * @returns Array of ProcessedTransactions with status field
 */
export function detectExactDuplicates(
  incoming: (StagedTransaction & { fingerprint: string })[],
  existingFingerprints: Map<string, string> // Map<fingerprint, transactionId>
): ProcessedTransaction[] {
  return incoming.map((transaction) => {
    const duplicateId = existingFingerprints.get(transaction.fingerprint);

    if (duplicateId) {
      return {
        ...transaction,
        status: 'duplicate',
        duplicateOfId: duplicateId,
      };
    }

    return {
      ...transaction,
      status: 'new',
    };
  });
}
```

**Why Map instead of Set:**

- We need both the fingerprint AND the transaction ID
- Map allows us to store `{ fingerprint → transactionId }`
- Enables UI to show "Duplicate of transaction #123"

---

## Module 5: Fuzzy Duplicate Detection

**File:** `src/lib/import/fuzzy-matcher.ts`

**Dependencies:** None

**Objective:** Detect potential duplicates that don't exactly match (per Implementation Plan requirement).

### Fuzzy Matching Rules

From Implementation Plan Phase 3:

> Fuzzy duplicate detection (±3 day window, amount matching)

**Algorithm:**

1. For each "new" transaction (not exact duplicate)
2. Search existing transactions for matches where:
   - Amount is identical (exact match in cents)
   - Date is within ±3 days
   - Description similarity > 80% (optional - Phase 3 uses exact amount + date window)

### Types

```typescript
export interface FuzzyMatchOptions {
  dateWindowDays: number; // Default: 3
  requireExactAmount: boolean; // Default: true
}
```

### Implementation

```typescript
import { Transaction } from '../../types/database';
import { ProcessedTransaction } from './reconciler';

/**
 * Finds potential duplicate transactions using fuzzy matching.
 *
 * Fuzzy match criteria:
 * - Amount must match exactly (in cents)
 * - Date must be within ±N days (default: 3)
 *
 * @param transaction - Processed transaction (status='new')
 * @param existing - Array of existing transactions from database
 * @param options - Fuzzy matching configuration
 * @returns Array of potentially matching transactions
 */
export function findFuzzyMatches(
  transaction: ProcessedTransaction,
  existing: Transaction[],
  options: FuzzyMatchOptions = { dateWindowDays: 3, requireExactAmount: true }
): Transaction[] {
  if (!transaction.date || transaction.amount === undefined) {
    return [];
  }

  const transactionDate = new Date(transaction.date);
  const matches: Transaction[] = [];

  for (const existingTxn of existing) {
    // Check amount match
    if (options.requireExactAmount && existingTxn.amount !== transaction.amount) {
      continue;
    }

    // Check date window
    const existingDate = new Date(existingTxn.date);
    const daysDiff = Math.abs(
      (transactionDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff <= options.dateWindowDays) {
      matches.push(existingTxn);
    }
  }

  return matches;
}

/**
 * Applies fuzzy duplicate detection to all "new" transactions.
 *
 * @param processed - Array of ProcessedTransactions from exact duplicate detection
 * @param existing - Array of all existing transactions for the account
 * @param options - Fuzzy matching configuration
 * @returns Array with fuzzy_duplicate status applied where matches found
 */
export function detectFuzzyDuplicates(
  processed: ProcessedTransaction[],
  existing: Transaction[],
  options?: FuzzyMatchOptions
): ProcessedTransaction[] {
  return processed.map((txn) => {
    // Only check transactions that aren't already exact duplicates or errors
    if (txn.status !== 'new') {
      return txn;
    }

    const fuzzyMatches = findFuzzyMatches(txn, existing, options);

    if (fuzzyMatches.length > 0) {
      return {
        ...txn,
        status: 'fuzzy_duplicate',
        fuzzyMatches,
      };
    }

    return txn;
  });
}
```

**Why separate fuzzy matching:**

- Exact duplicates are definitive (auto-skip)
- Fuzzy duplicates need user review (show warning in UI)
- User can decide whether to import fuzzy matches

**UI Treatment:**

- **Exact duplicates**: Silently skip, show in "Duplicates" table
- **Fuzzy duplicates**: Show in "Needs Review" section with warning and potential matches
- **New**: Show in "Ready to Import" table

---

## Data Access Layer (Supabase)

New functions needed in `src/lib/supabase/`.

### File: `src/lib/supabase/import.ts`

**Purpose:** Database operations for transaction import.

#### Function: `fetchExistingFingerprints(accountId: string): Promise<Map<string, string>>`

**Purpose:** Fetch all fingerprints for an account to check for duplicates.

**Optimization:** Only fetch `id` and `fingerprint` columns (not full transaction data).

**Returns:** `Map<fingerprint, transactionId>`

**Implementation concept:**

```typescript
import { supabase } from './config';

/**
 * Fetches all transaction fingerprints for an account.
 *
 * Used for duplicate detection (O(1) lookups via Map).
 *
 * @param accountId - Account UUID
 * @returns Map<fingerprint, transactionId>
 */
export async function fetchExistingFingerprints(accountId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, fingerprint')
    .eq('accountId', accountId)
    .not('fingerprint', 'is', null); // Exclude transactions without fingerprints

  if (error) throw error;

  // Build Map for O(1) lookups
  const fingerprintMap = new Map<string, string>();
  data?.forEach((txn) => {
    fingerprintMap.set(txn.fingerprint, txn.id);
  });

  return fingerprintMap;
}
```

**Why Map:**

- O(1) lookup performance (vs O(n) for array search)
- Stores both fingerprint and transaction ID
- TypeScript provides type safety for Map operations

#### Function: `fetchExistingTransactions(accountId: string, dateRange?: { start: string, end: string }): Promise<Transaction[]>`

**Purpose:** Fetch full transaction data for fuzzy duplicate detection.

**Parameters:**

- `accountId`: Account UUID
- `dateRange`: Optional date range to limit query (optimization for large datasets)

**Returns:** `Promise<Transaction[]>`

**Implementation concept:**

```typescript
/**
 * Fetches all transactions for an account (for fuzzy matching).
 *
 * @param accountId - Account UUID
 * @param dateRange - Optional date range filter (start/end ISO dates)
 * @returns Array of transactions
 */
export async function fetchExistingTransactions(
  accountId: string,
  dateRange?: { start: string; end: string }
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('accountId', accountId)
    .order('date', { ascending: false });

  // Apply date range filter if provided
  if (dateRange) {
    query = query.gte('date', dateRange.start).lte('date', dateRange.end);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}
```

**Optimization:**

For fuzzy matching, only fetch transactions within ±1 month of the import date range to reduce data transfer.

#### Function: `commitImportBatch(batch: Omit<ImportBatch, 'id' | 'importedBy'>, transactions: Omit<Transaction, 'id' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'updatedAt'>[]): Promise<{ batchId: string; transactionIds: string[] }>`

**Purpose:** Atomically create import batch and insert transactions.

**Parameters:**

- `batch`: Import batch metadata (without ID)
- `transactions`: Array of transactions to insert (without audit fields)

**Returns:** `Promise<{ batchId: string; transactionIds: string[] }>`

**Error Handling:**

- If batch insert fails, throw error (no transactions inserted)
- If transaction insert fails, batch remains but with `errorCount` updated
- Use Supabase RPC or sequential operations (Supabase JS doesn't support true transactions)

**Implementation concept:**

```typescript
/**
 * Creates an import batch and inserts transactions.
 *
 * Steps:
 * 1. Insert import_batches record
 * 2. Get batch ID
 * 3. Add batch ID to all transactions
 * 4. Bulk insert transactions
 *
 * @param batch - Import batch metadata
 * @param transactions - Array of transactions to insert
 * @returns Promise with batch ID and transaction IDs
 */
export async function commitImportBatch(
  batch: Omit<ImportBatch, 'id' | 'importedBy'>,
  transactions: Omit<
    Transaction,
    'id' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'updatedAt'
  >[]
): Promise<{ batchId: string; transactionIds: string[] }> {
  // Step 1: Create import batch
  const { data: batchData, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      booksetId: batch.booksetId,
      accountId: batch.accountId,
      fileName: batch.fileName,
      importedAt: new Date().toISOString(),
      totalRows: batch.totalRows,
      importedCount: batch.importedCount,
      duplicateCount: batch.duplicateCount,
      errorCount: batch.errorCount,
      csvMappingSnapshot: batch.csvMappingSnapshot,
      isUndone: false,
    })
    .select()
    .single();

  if (batchError) throw batchError;

  const batchId = batchData.id;

  // Step 2: Add batch ID to transactions
  const transactionsWithBatch = transactions.map((txn) => ({
    ...txn,
    sourceBatchId: batchId,
    importDate: new Date().toISOString(),
    isReviewed: false,
    isSplit: false,
    reconciled: false,
    lines: [{ categoryId: null, amount: txn.amount, memo: null }], // Default single-line
  }));

  // Step 3: Bulk insert transactions
  const { data: txnData, error: txnError } = await supabase
    .from('transactions')
    .insert(transactionsWithBatch)
    .select('id');

  if (txnError) {
    // Log error but don't fail (batch record exists)
    console.error('Failed to insert transactions:', txnError);
    throw txnError;
  }

  return {
    batchId,
    transactionIds: txnData?.map((t) => t.id) || [],
  };
}
```

**Why this approach:**

- Creates batch first (audit trail exists even if transactions fail)
- Bulk insert is fast (single query for all transactions)
- Returns IDs for confirmation UI
- Database triggers handle `createdBy`, `createdAt`, etc.

---

### File: `src/lib/supabase/accounts.ts` (Update)

**Purpose:** Add function to update account CSV mapping.

#### Function: `updateAccountMapping(accountId: string, mapping: CsvMapping): Promise<void>`

**Purpose:** Save CSV mapping configuration to account record.

**Parameters:**

- `accountId`: Account UUID
- `mapping`: CsvMapping object

**Returns:** `Promise<void>`

**Implementation concept:**

```typescript
import { CsvMapping } from '../../types/import';

/**
 * Updates the CSV mapping configuration for an account.
 *
 * @param accountId - Account UUID
 * @param mapping - CSV mapping configuration
 */
export async function updateAccountMapping(accountId: string, mapping: CsvMapping): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ csvMapping: mapping })
    .eq('id', accountId);

  if (error) throw error;
}
```

**Why JSONB:**

- Flexible schema (can add fields to CsvMapping without migration)
- Queryable (can search by specific mapping properties if needed)
- Validated by Zod schema before saving

---

## State Management (Hooks)

We need a robust hook to manage the multi-step import wizard state.

### File: `src/hooks/useImportSession.ts`

**Purpose:** Manage import wizard state machine and orchestrate import pipeline.

### State Machine

```typescript
type ImportStep = 'upload' | 'mapping' | 'review' | 'importing' | 'complete' | 'error';

interface ImportSessionState {
  // Wizard step
  step: ImportStep;

  // File upload
  file: File | null;
  selectedAccountId: string | null;

  // Parsing
  rawPreview: ParseResult | null;
  rawData: ParseResult | null;

  // Mapping
  mapping: CsvMapping | null;
  stagedTransactions: StagedTransaction[];

  // Duplicate detection
  processedTransactions: ProcessedTransaction[];
  stats: {
    total: number;
    new: number;
    exact_duplicates: number;
    fuzzy_duplicates: number;
    errors: number;
  };

  // Import result
  importResult: {
    batchId: string;
    transactionIds: string[];
  } | null;

  // Error state
  error: string | null;
}
```

### Hook Interface

```typescript
export interface UseImportSessionResult {
  // State
  state: ImportSessionState;

  // Actions
  selectAccount: (accountId: string) => void;
  uploadFile: (file: File) => Promise<void>;
  updateMapping: (mapping: CsvMapping) => void;
  applyMapping: () => void;
  checkDuplicates: () => Promise<void>;
  commit: () => Promise<void>;
  reset: () => void;

  // Loading flags
  isProcessing: boolean;
}
```

### Implementation Concept

```typescript
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { previewCsv, parseFullCsv } from '../lib/import/parser';
import { mapRowsToTransactions } from '../lib/import/mapper';
import { addFingerprints } from '../lib/import/fingerprint';
import { detectExactDuplicates } from '../lib/import/reconciler';
import { detectFuzzyDuplicates } from '../lib/import/fuzzy-matcher';
import {
  fetchExistingFingerprints,
  fetchExistingTransactions,
  commitImportBatch,
} from '../lib/supabase/import';
import { updateAccountMapping } from '../lib/supabase/accounts';

export function useImportSession(): UseImportSessionResult {
  const { activeBookset } = useAuth();
  const [state, setState] = useState<ImportSessionState>({
    step: 'upload',
    file: null,
    selectedAccountId: null,
    rawPreview: null,
    rawData: null,
    mapping: null,
    stagedTransactions: [],
    processedTransactions: [],
    stats: { total: 0, new: 0, exact_duplicates: 0, fuzzy_duplicates: 0, errors: 0 },
    importResult: null,
    error: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Action: Select account
  const selectAccount = (accountId: string) => {
    setState((prev) => ({ ...prev, selectedAccountId: accountId }));
  };

  // Action: Upload file and preview
  const uploadFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const preview = await previewCsv(file, { hasHeaderRow: true });
      setState((prev) => ({
        ...prev,
        file,
        rawPreview: preview,
        step: 'mapping',
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to parse CSV',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Update mapping configuration
  const updateMapping = (mapping: CsvMapping) => {
    setState((prev) => ({ ...prev, mapping }));
  };

  // Action: Apply mapping and parse full file
  const applyMapping = async () => {
    if (!state.file || !state.mapping) return;

    setIsProcessing(true);
    try {
      const parsed = await parseFullCsv(state.file, {
        hasHeaderRow: state.mapping.hasHeaderRow,
      });

      const staged = mapRowsToTransactions(parsed.data, state.mapping);

      const errorCount = staged.filter((t) => !t.isValid).length;

      setState((prev) => ({
        ...prev,
        rawData: parsed,
        stagedTransactions: staged,
        stats: { ...prev.stats, total: staged.length, errors: errorCount },
        step: 'review',
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to apply mapping',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Check for duplicates
  const checkDuplicates = async () => {
    if (!state.selectedAccountId || state.stagedTransactions.length === 0) return;

    setIsProcessing(true);
    try {
      // Add fingerprints
      const withFingerprints = await addFingerprints(state.stagedTransactions);

      // Fetch existing fingerprints
      const existingFingerprints = await fetchExistingFingerprints(state.selectedAccountId);

      // Detect exact duplicates
      let processed = detectExactDuplicates(withFingerprints, existingFingerprints);

      // Fetch existing transactions for fuzzy matching
      const existingTransactions = await fetchExistingTransactions(state.selectedAccountId);

      // Detect fuzzy duplicates
      processed = detectFuzzyDuplicates(processed, existingTransactions);

      // Calculate stats
      const stats = {
        total: processed.length,
        new: processed.filter((t) => t.status === 'new').length,
        exact_duplicates: processed.filter((t) => t.status === 'duplicate').length,
        fuzzy_duplicates: processed.filter((t) => t.status === 'fuzzy_duplicate').length,
        errors: processed.filter((t) => !t.isValid).length,
      };

      setState((prev) => ({
        ...prev,
        processedTransactions: processed,
        stats,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check duplicates',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Commit import
  const commit = async () => {
    if (!state.selectedAccountId || !activeBookset || !state.file || !state.mapping) return;

    setIsProcessing(true);
    setState((prev) => ({ ...prev, step: 'importing' }));

    try {
      // Filter only "new" transactions
      const toImport = state.processedTransactions.filter((t) => t.status === 'new' && t.isValid);

      // Build transaction objects
      const transactions = toImport.map((t) => ({
        booksetId: activeBookset.id,
        accountId: state.selectedAccountId!,
        date: t.date!,
        amount: t.amount!,
        payee: t.description!,
        originalDescription: t.description!,
        fingerprint: t.fingerprint,
      }));

      // Build batch object
      const batch = {
        booksetId: activeBookset.id,
        accountId: state.selectedAccountId,
        fileName: state.file.name,
        totalRows: state.stats.total,
        importedCount: toImport.length,
        duplicateCount: state.stats.exact_duplicates + state.stats.fuzzy_duplicates,
        errorCount: state.stats.errors,
        csvMappingSnapshot: state.mapping,
      };

      // Commit to database
      const result = await commitImportBatch(batch, transactions);

      // Save mapping to account (for next import)
      await updateAccountMapping(state.selectedAccountId, state.mapping);

      setState((prev) => ({
        ...prev,
        importResult: result,
        step: 'complete',
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to commit import',
        step: 'error',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Reset wizard
  const reset = () => {
    setState({
      step: 'upload',
      file: null,
      selectedAccountId: null,
      rawPreview: null,
      rawData: null,
      mapping: null,
      stagedTransactions: [],
      processedTransactions: [],
      stats: { total: 0, new: 0, exact_duplicates: 0, fuzzy_duplicates: 0, errors: 0 },
      importResult: null,
      error: null,
    });
  };

  return {
    state,
    selectAccount,
    uploadFile,
    updateMapping,
    applyMapping,
    checkDuplicates,
    commit,
    reset,
    isProcessing,
  };
}
```

**State Transitions:**

```text
upload → (file selected) → mapping
mapping → (mapping applied) → review
review → (duplicates checked) → review (with stats)
review → (commit clicked) → importing → complete
any → (error) → error
complete/error → (reset) → upload
```

---

## Functional Harness (The "UI")

Since we are avoiding UI polish, we will create a simple HTML form-based interface.

**File:** `src/pages/ImportPage.tsx`

**Purpose:** Multi-step wizard for CSV import.

### Structure

```typescript
function ImportPage() {
  const { state, selectAccount, uploadFile, updateMapping, applyMapping, checkDuplicates, commit, reset, isProcessing } = useImportSession();
  const { accounts } = useAccounts();

  return (
    <div>
      <h1>Import Transactions</h1>

      {/* Step 1: Account Selection & File Upload */}
      {state.step === 'upload' && (
        <section>
          <h2>1. Select Account & Upload CSV</h2>

          <div>
            <label>Account:</label>
            <select onChange={(e) => selectAccount(e.target.value)} value={state.selectedAccountId || ''}>
              <option value="">-- Select Account --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>CSV File:</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadFile(e.target.files[0]);
                }
              }}
              disabled={!state.selectedAccountId || isProcessing}
            />
          </div>

          {isProcessing && <div>Processing...</div>}
        </section>
      )}

      {/* Step 2: Mapping Configuration */}
      {state.step === 'mapping' && state.rawPreview && (
        <section>
          <h2>2. Configure CSV Mapping</h2>

          <div>
            <h3>Preview (first 5 rows):</h3>
            <pre>{JSON.stringify(state.rawPreview.data, null, 2)}</pre>
          </div>

          <MappingForm
            preview={state.rawPreview}
            mapping={state.mapping}
            onUpdate={updateMapping}
            onApply={applyMapping}
            isProcessing={isProcessing}
          />
        </section>
      )}

      {/* Step 3: Review & Commit */}
      {state.step === 'review' && (
        <section>
          <h2>3. Review Transactions</h2>

          <div>
            <h3>Preview (first 5 mapped):</h3>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Valid</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {state.stagedTransactions.slice(0, 5).map((t, i) => (
                  <tr key={i}>
                    <td>{t.rowIndex + 1}</td>
                    <td>{t.date || 'N/A'}</td>
                    <td>{t.amount !== undefined ? `$${(t.amount / 100).toFixed(2)}` : 'N/A'}</td>
                    <td>{t.description || 'N/A'}</td>
                    <td>{t.isValid ? '✓' : '✗'}</td>
                    <td style={{ color: 'red' }}>{t.errors.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button onClick={checkDuplicates} disabled={isProcessing}>
              Check for Duplicates
            </button>
          </div>

          {state.stats.total > 0 && (
            <div>
              <h3>Import Statistics:</h3>
              <ul>
                <li>Total rows: {state.stats.total}</li>
                <li>New transactions: {state.stats.new}</li>
                <li>Exact duplicates (skip): {state.stats.exact_duplicates}</li>
                <li>Fuzzy duplicates (review): {state.stats.fuzzy_duplicates}</li>
                <li>Errors: {state.stats.errors}</li>
              </ul>
            </div>
          )}

          {state.stats.new > 0 && (
            <div>
              <button onClick={commit} disabled={isProcessing}>
                Import {state.stats.new} Transactions
              </button>
            </div>
          )}

          {state.stats.fuzzy_duplicates > 0 && (
            <div style={{ background: 'yellow', padding: '10px' }}>
              <strong>Warning:</strong> {state.stats.fuzzy_duplicates} potential duplicates detected (same amount, date within ±3 days).
              Review manually after import.
            </div>
          )}
        </section>
      )}

      {/* Step 4: Importing */}
      {state.step === 'importing' && (
        <section>
          <h2>Importing...</h2>
          <div>Please wait while transactions are being saved to the database.</div>
        </section>
      )}

      {/* Step 5: Complete */}
      {state.step === 'complete' && state.importResult && (
        <section>
          <h2>Import Complete!</h2>
          <div>
            <p>Successfully imported {state.stats.new} transactions.</p>
            <p>Batch ID: {state.importResult.batchId}</p>
          </div>
          <button onClick={reset}>Import Another File</button>
        </section>
      )}

      {/* Error State */}
      {state.step === 'error' && (
        <section>
          <h2>Error</h2>
          <div style={{ color: 'red' }}>{state.error}</div>
          <button onClick={reset}>Start Over</button>
        </section>
      )}
    </div>
  );
}
```

### Mapping Form Component

**File:** `src/components/import/MappingForm.tsx`

**Purpose:** Form for configuring CSV column mapping.

```typescript
interface MappingFormProps {
  preview: ParseResult;
  mapping: CsvMapping | null;
  onUpdate: (mapping: CsvMapping) => void;
  onApply: () => void;
  isProcessing: boolean;
}

function MappingForm({ preview, mapping, onUpdate, onApply, isProcessing }: MappingFormProps) {
  const [formData, setFormData] = useState<CsvMapping>({
    dateColumn: mapping?.dateColumn || '',
    amountColumn: mapping?.amountColumn || '',
    descriptionColumn: mapping?.descriptionColumn || '',
    dateFormat: mapping?.dateFormat || 'MM/dd/yyyy',
    hasHeaderRow: mapping?.hasHeaderRow ?? true,
    amountMode: mapping?.amountMode || 'signed',
    inflowColumn: mapping?.inflowColumn || '',
    outflowColumn: mapping?.outflowColumn || '',
  });

  const columns = preview.meta.fields || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    onApply();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Date Column:</label>
        <select value={formData.dateColumn} onChange={(e) => setFormData({ ...formData, dateColumn: e.target.value })}>
          <option value="">-- Select --</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div>
        <label>Description Column:</label>
        <select value={formData.descriptionColumn} onChange={(e) => setFormData({ ...formData, descriptionColumn: e.target.value })}>
          <option value="">-- Select --</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div>
        <label>Amount Mode:</label>
        <select value={formData.amountMode} onChange={(e) => setFormData({ ...formData, amountMode: e.target.value as AmountMode })}>
          <option value="signed">Single Column (Signed)</option>
          <option value="separate">Separate Debit/Credit Columns</option>
        </select>
      </div>

      {formData.amountMode === 'signed' && (
        <div>
          <label>Amount Column:</label>
          <select value={formData.amountColumn} onChange={(e) => setFormData({ ...formData, amountColumn: e.target.value })}>
            <option value="">-- Select --</option>
            {columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
      )}

      {formData.amountMode === 'separate' && (
        <>
          <div>
            <label>Inflow Column (Credits):</label>
            <select value={formData.inflowColumn || ''} onChange={(e) => setFormData({ ...formData, inflowColumn: e.target.value })}>
              <option value="">-- Select --</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>

          <div>
            <label>Outflow Column (Debits):</label>
            <select value={formData.outflowColumn || ''} onChange={(e) => setFormData({ ...formData, outflowColumn: e.target.value })}>
              <option value="">-- Select --</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
        </>
      )}

      <div>
        <label>Date Format:</label>
        <select value={formData.dateFormat} onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value as DateFormat })}>
          <option value="MM/dd/yyyy">MM/dd/yyyy (e.g., 01/31/2024)</option>
          <option value="dd/MM/yyyy">dd/MM/yyyy (e.g., 31/01/2024)</option>
          <option value="yyyy-MM-dd">yyyy-MM-dd (e.g., 2024-01-31)</option>
          <option value="MM-dd-yyyy">MM-dd-yyyy (e.g., 01-31-2024)</option>
        </select>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.hasHeaderRow}
            onChange={(e) => setFormData({ ...formData, hasHeaderRow: e.target.checked })}
          />
          First row is header
        </label>
      </div>

      <button type="submit" disabled={isProcessing}>
        Apply Mapping & Parse File
      </button>
    </form>
  );
}
```

**Why this approach:**

- Shows detected columns in dropdowns (auto-populated from preview)
- Conditional fields (only show amount column for 'signed' mode)
- Date format examples (helps user choose correct format)
- Checkbox for header row (toggles parser behavior)

---

## Bank Profile Presets

**File:** `src/lib/import/bank-profiles.ts`

**Purpose:** Pre-configured mappings for common banks.

```typescript
import { CsvMapping } from '../../types/import';

export const BANK_PROFILES: Record<string, CsvMapping> = {
  CHASE_CHECKING: {
    dateColumn: 'Posting Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },

  AMEX: {
    dateColumn: 'Date',
    amountColumn: '', // Not used in separate mode
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'separate',
    inflowColumn: 'Credits',
    outflowColumn: 'Charges',
  },

  BANK_OF_AMERICA: {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },

  WELLS_FARGO: {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },
};

/**
 * Gets a bank profile by name.
 *
 * @param bankName - Bank profile identifier
 * @returns CsvMapping or undefined
 */
export function getBankProfile(bankName: string): CsvMapping | undefined {
  return BANK_PROFILES[bankName];
}

/**
 * Lists all available bank profiles.
 *
 * @returns Array of bank names
 */
export function listBankProfiles(): string[] {
  return Object.keys(BANK_PROFILES);
}
```

**UI Integration (Optional):**

Add a "Quick Setup" dropdown in `MappingForm`:

```typescript
<select onChange={(e) => {
  const profile = getBankProfile(e.target.value);
  if (profile) {
    setFormData(profile);
  }
}}>
  <option value="">-- Quick Setup (Optional) --</option>
  {listBankProfiles().map(name => (
    <option key={name} value={name}>{name.replace(/_/g, ' ')}</option>
  ))}
</select>
```

---

## Validation Schemas (Zod)

**File:** `src/lib/validation/import.ts`

**Purpose:** Runtime validation for CSV mapping configuration.

```typescript
import { z } from 'zod';

export const csvMappingSchema = z
  .object({
    dateColumn: z.string().min(1, 'Date column is required'),
    amountColumn: z.string().optional(), // Only required if amountMode='signed'
    descriptionColumn: z.string().min(1, 'Description column is required'),
    dateFormat: z.enum(['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM-dd-yyyy']),
    hasHeaderRow: z.boolean(),
    amountMode: z.enum(['signed', 'separate']),
    inflowColumn: z.string().optional(),
    outflowColumn: z.string().optional(),
  })
  .refine(
    (data) => {
      // If signed mode, amountColumn is required
      if (data.amountMode === 'signed') {
        return !!data.amountColumn;
      }
      return true;
    },
    {
      message: 'Amount column is required for signed mode',
      path: ['amountColumn'],
    }
  )
  .refine(
    (data) => {
      // If separate mode, both inflow and outflow are required
      if (data.amountMode === 'separate') {
        return !!data.inflowColumn && !!data.outflowColumn;
      }
      return true;
    },
    {
      message: 'Both inflow and outflow columns are required for separate mode',
      path: ['inflowColumn'],
    }
  );

export type ValidatedCsvMapping = z.infer<typeof csvMappingSchema>;
```

**Why refinements:**

- Validates conditional requirements (amountColumn only for 'signed' mode)
- Provides helpful error messages
- Runs before applying mapping (prevents invalid configurations)

**Usage in Hook:**

```typescript
// In useImportSession, before applying mapping:
const validation = csvMappingSchema.safeParse(mapping);
if (!validation.success) {
  setState((prev) => ({
    ...prev,
    error: validation.error.errors[0].message,
    step: 'error',
  }));
  return;
}
```

---

## Error Handling Strategy

### File Size & Row Limits

**Enforced in:**

- `parser.ts`: `MAX_FILE_SIZE` (10MB), `MAX_ROWS` (50,000)

**Error Messages:**

- "File too large. Maximum size is 10MB."
- "File has too many rows (52,000). Maximum is 50,000."

### Parse Errors

**Scenario:** Malformed CSV (missing quotes, inconsistent columns)

**Handling:**

- PapaParse returns `results.errors` array
- Show first 5 errors in UI:

  ```typescript
  {parseResult.errors.slice(0, 5).map(err => (
    <div key={err.row}>Row {err.row}: {err.message}</div>
  ))}
  ```

**User Action:** Fix CSV or skip problematic rows (Phase 3: abort import if errors)

### Mapping Errors

**Scenario:** Invalid date format, unparseable currency, missing columns

**Handling:**

- Each `StagedTransaction` has `isValid` and `errors` array
- Show validation errors in review table
- Only import transactions where `isValid === true`

**User Action:** Adjust mapping or fix data in CSV

### Database Errors

**Scenario:** RLS policy violation, network failure, constraint violation

**Handling:**

- Catch errors in `commitImportBatch()`
- Show error message in UI
- Batch record created but transactions not inserted (audit trail preserved)

**User Action:** Check permissions, retry import

### Rollback Strategy

**Question:** If bulk insert fails halfway (e.g., 50 of 100 transactions inserted), what happens?

**Phase 3 Approach:**

- Supabase doesn't support true transactions via JS client
- Accept partial imports (50 transactions succeed, 50 fail)
- Import batch record shows `importedCount: 50`, `errorCount: 50`
- User can re-run import (exact duplicates will be skipped)

**Future Enhancement (Phase 8):**

- Use Supabase RPC with PostgreSQL transactions
- All-or-nothing import (rollback on any failure)

---

## Performance Optimizations

### 1. Lazy Fingerprinting

**Problem:** Generating 10,000 SHA-256 hashes can take 2-3 seconds.

**Solution:** Only fingerprint valid transactions (skip invalid ones).

```typescript
const toFingerprint = staged.filter((t) => t.isValid);
const withFingerprints = await addFingerprints(toFingerprint);
```

### 2. Indexed Database Queries

**Problem:** Fetching fingerprints for large accounts (50,000+ transactions) is slow.

**Solution:** Use database index on `(accountId, fingerprint)`.

```sql
CREATE INDEX idx_transactions_account_fingerprint
ON transactions(accountId, fingerprint);
```

### 3. Batch Insert Performance

**Problem:** Inserting 10,000 transactions one-by-one is slow.

**Solution:** Use Supabase bulk insert (single query).

```typescript
await supabase.from('transactions').insert(transactionsArray);
```

**Expected Performance:**

- 1,000 transactions: ~500ms
- 10,000 transactions: ~2s
- 50,000 transactions: ~10s (max allowed)

### 4. Fuzzy Matching Optimization

**Problem:** Comparing each incoming transaction against 50,000 existing transactions is O(n²).

**Solution:** Filter existing transactions by date range first.

```typescript
// Only fetch transactions within ±1 month of import date range
const minDate = getMinDate(stagedTransactions);
const maxDate = getMaxDate(stagedTransactions);
const existing = await fetchExistingTransactions(accountId, {
  start: addDays(minDate, -30),
  end: addDays(maxDate, 30),
});
```

**Performance Gain:**

- Before: 10,000 incoming × 50,000 existing = 500M comparisons
- After: 10,000 incoming × ~5,000 existing (within date range) = 50M comparisons

---

## Implementation Steps (Detailed)

### Phase 3.1: Core Utilities (Days 1-3)

1. **Install Dependencies**

   ```bash
   npm install papaparse @types/papaparse date-fns
   ```

2. **Create Directory Structure**

   ```text
   src/lib/import/
   ├── parser.ts
   ├── parser.test.ts
   ├── mapper.ts
   ├── mapper.test.ts
   ├── fingerprint.ts
   ├── fingerprint.test.ts
   ├── reconciler.ts
   ├── reconciler.test.ts
   ├── fuzzy-matcher.ts
   ├── fuzzy-matcher.test.ts
   └── bank-profiles.ts
   ```

3. **Implement & Test Parser (Day 1)**
   - Write `parser.ts` with `previewCsv` and `parseFullCsv`
   - Write `parser.test.ts` with unit tests:
     - Should parse valid CSV
     - Should handle empty lines
     - Should reject files > 10MB
     - Should reject files > 50,000 rows
     - Should detect headers correctly

4. **Implement & Test Mapper (Day 2)**
   - Write `mapper.ts` with `cleanCurrency`, `parseDate`, `mapRowToTransaction`
   - Write `mapper.test.ts` with unit tests:
     - Should parse "1/15/2024" with "MM/dd/yyyy"
     - Should parse "15/1/2024" with "dd/MM/yyyy"
     - Should clean "$1,234.56" to 123456
     - Should clean "($50.00)" to -5000
     - Should handle separate debit/credit columns
     - Should return `isValid: false` for garbage data

5. **Implement & Test Fingerprint (Day 2)**
   - Write `fingerprint.ts` with `normalizeDescription`, `generateFingerprint`
   - Write `fingerprint.test.ts` with unit tests:
     - Should produce identical hash for identical inputs
     - Should ignore case ("Target" == "target")
     - Should ignore extra whitespace (" Target " == "Target")
     - Should produce different hash for different dates

6. **Implement & Test Deduplication (Day 3)**
   - Write `reconciler.ts` with `detectExactDuplicates`
   - Write `fuzzy-matcher.ts` with `findFuzzyMatches`, `detectFuzzyDuplicates`
   - Write tests:
     - Should mark transaction as 'duplicate' if fingerprint exists
     - Should mark as 'new' if fingerprint is unique
     - Should detect fuzzy matches within ±3 days
     - Should require exact amount match for fuzzy detection

### Phase 3.2: Database Integration (Days 4-5)

1. **Run Database Migration**
   - Execute migration script to add `fingerprint` column and indexes

2. **Create `src/lib/supabase/import.ts`**
   - Implement `fetchExistingFingerprints`
   - Implement `fetchExistingTransactions`
   - Implement `commitImportBatch`
   - Test with Supabase local development environment

3. **Update `src/lib/supabase/accounts.ts`**
   - Implement `updateAccountMapping`
   - Test JSONB column update

### Phase 3.3: State Management (Day 6)

1. **Create `src/hooks/useImportSession.ts`**
   - Implement state machine
   - Implement all actions (uploadFile, applyMapping, checkDuplicates, commit)
   - Add loading states and error handling

2. **Create `src/lib/validation/import.ts`**
   - Implement Zod schema for CSV mapping
   - Add refinements for conditional validation

### Phase 3.4: UI Implementation (Days 7-8)

1. **Update `src/pages/ImportPage.tsx`**
   - Implement wizard steps (upload, mapping, review, complete)
   - Wire up `useImportSession` hook
   - Add loading indicators and error messages

2. **Create `src/components/import/MappingForm.tsx`**
   - Implement form fields for mapping configuration
   - Add bank profile quick setup dropdown
   - Validate form before submission

3. **Test Full Flow**
   - Upload CSV
   - Configure mapping
   - Review parsed transactions
   - Check duplicates
   - Commit import
   - Verify in Supabase dashboard

---

## Testing Plan (Comprehensive)

### Unit Tests

#### Parser Tests (`src/lib/import/parser.test.ts`)

```typescript
describe('previewCsv', () => {
  it('should parse valid CSV with headers', async () => {
    const file = new File(['Date,Amount,Description\n1/1/2024,$100,Test'], 'test.csv');
    const result = await previewCsv(file);
    expect(result.data).toHaveLength(1);
    expect(result.meta.fields).toEqual(['Date', 'Amount', 'Description']);
  });

  it('should reject files larger than 10MB', async () => {
    const largeFile = new File([new Array(11 * 1024 * 1024).join('a')], 'large.csv');
    await expect(previewCsv(largeFile)).rejects.toThrow('File too large');
  });

  it('should handle empty lines', async () => {
    const file = new File(['Date,Amount\n\n1/1/2024,$100\n\n'], 'test.csv');
    const result = await previewCsv(file);
    expect(result.data).toHaveLength(1); // Empty lines skipped
  });
});

describe('parseFullCsv', () => {
  it('should reject files with more than 50,000 rows', async () => {
    const rows = Array(50001).fill('1/1/2024,$100,Test').join('\n');
    const file = new File(['Date,Amount,Description\n' + rows], 'large.csv');
    await expect(parseFullCsv(file)).rejects.toThrow('too many rows');
  });
});
```

#### Mapper Tests (`src/lib/import/mapper.test.ts`)

```typescript
describe('cleanCurrency', () => {
  it('should clean "$1,234.56" to 123456', () => {
    expect(cleanCurrency('$1,234.56')).toBe(123456);
  });

  it('should clean "($50.00)" to -5000', () => {
    expect(cleanCurrency('($50.00)')).toBe(-5000);
  });

  it('should handle whole dollars', () => {
    expect(cleanCurrency('$1,234')).toBe(123400);
  });

  it('should return null for invalid input', () => {
    expect(cleanCurrency('invalid')).toBeNull();
  });
});

describe('parseDate', () => {
  it('should parse "1/15/2024" with "MM/dd/yyyy"', () => {
    expect(parseDate('1/15/2024', 'MM/dd/yyyy')).toBe('2024-01-15');
  });

  it('should parse "15/1/2024" with "dd/MM/yyyy"', () => {
    expect(parseDate('15/1/2024', 'dd/MM/yyyy')).toBe('2024-01-15');
  });

  it('should return null for invalid date', () => {
    expect(parseDate('invalid', 'MM/dd/yyyy')).toBeNull();
  });
});

describe('mapRowToTransaction', () => {
  it('should map valid row with signed amount', () => {
    const row = { Date: '1/15/2024', Amount: '$100.00', Description: 'Test' };
    const mapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.date).toBe('2024-01-15');
    expect(result.amount).toBe(10000);
    expect(result.description).toBe('Test');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle separate debit/credit columns', () => {
    const row = { Date: '1/15/2024', Credit: '$100.00', Debit: '', Description: 'Test' };
    const mapping = {
      dateColumn: 'Date',
      amountColumn: '',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'separate' as AmountMode,
      inflowColumn: 'Credit',
      outflowColumn: 'Debit',
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.amount).toBe(10000);
  });

  it('should return errors for invalid data', () => {
    const row = { Date: 'invalid', Amount: 'bad', Description: 'Test' };
    const mapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

#### Fingerprint Tests (`src/lib/import/fingerprint.test.ts`)

```typescript
describe('normalizeDescription', () => {
  it('should trim whitespace', () => {
    expect(normalizeDescription('  Target  ')).toBe('target');
  });

  it('should convert to lowercase', () => {
    expect(normalizeDescription('TARGET')).toBe('target');
  });

  it('should replace multiple spaces', () => {
    expect(normalizeDescription('Target   Store')).toBe('target store');
  });
});

describe('generateFingerprint', () => {
  it('should produce identical hash for identical inputs', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'Target');
    expect(hash1).toBe(hash2);
  });

  it('should ignore case differences', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'TARGET');
    expect(hash1).toBe(hash2);
  });

  it('should ignore extra whitespace', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, '  Target  ');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different amounts', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 20000, 'Target');
    expect(hash1).not.toBe(hash2);
  });
});
```

#### Deduplication Tests (`src/lib/import/reconciler.test.ts`, `fuzzy-matcher.test.ts`)

```typescript
describe('detectExactDuplicates', () => {
  it('should mark transaction as duplicate if fingerprint exists', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map([['abc123', 'txn-id-123']]);

    const result = detectExactDuplicates(incoming, existing);

    expect(result[0].status).toBe('duplicate');
    expect(result[0].duplicateOfId).toBe('txn-id-123');
  });

  it('should mark transaction as new if fingerprint is unique', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map();

    const result = detectExactDuplicates(incoming, existing);

    expect(result[0].status).toBe('new');
  });
});

describe('findFuzzyMatches', () => {
  it('should find matches within ±3 days with same amount', () => {
    const transaction = {
      date: '2024-01-15',
      amount: 10000,
      description: 'Target',
      isValid: true,
      errors: [],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new' as ImportStatus,
    };

    const existing = [
      { id: '1', date: '2024-01-13', amount: 10000, description: 'Target Store' } as Transaction,
      { id: '2', date: '2024-01-20', amount: 10000, description: 'Target' } as Transaction, // Too far
    ];

    const matches = findFuzzyMatches(transaction, existing);

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('1');
  });
});
```

### Integration Tests

#### Test: Full Import Flow

**Scenario:**

1. Upload CSV with 10 transactions
2. Configure mapping
3. Apply mapping and parse
4. Check for duplicates (0 exist)
5. Commit import
6. Verify 10 transactions in database
7. **Re-upload same file**
8. Check for duplicates (10 exist)
9. Commit import (0 new transactions)

**Assertions:**

- Import batch created with correct stats
- Transactions have correct fingerprints
- Duplicate detection works
- Re-import creates no duplicates

#### Test: Fuzzy Duplicate Detection

**Scenario:**

1. Manually insert transaction: date=2024-01-15, amount=$100.00
2. Upload CSV with transaction: date=2024-01-17, amount=$100.00 (same amount, 2 days later)
3. Check duplicates
4. Verify status='fuzzy_duplicate'

**Assertions:**

- Fuzzy matcher detects potential duplicate
- User sees warning in UI
- Can choose to import or skip

#### Test: Error Handling

**Scenario:**

1. Upload CSV with invalid dates
2. Apply mapping
3. Verify transactions marked as invalid
4. Verify only valid transactions imported

**Assertions:**

- Invalid transactions excluded from import
- Error messages displayed in UI
- Import succeeds for valid rows

### Manual Testing Checklist

- [ ] Upload CSV file from Chase (signed amount mode)
- [ ] Upload CSV file from Amex (separate debit/credit mode)
- [ ] Configure mapping using bank profile quick setup
- [ ] Manually configure mapping for custom CSV format
- [ ] Preview shows first 5 rows correctly
- [ ] Apply mapping and verify all transactions parse correctly
- [ ] Check duplicates and verify 0 duplicates on first import
- [ ] Commit import and verify transactions in Supabase dashboard
- [ ] Re-upload same file and verify all marked as duplicates
- [ ] Upload file with 10,000 rows and verify performance < 5 seconds
- [ ] Upload file with invalid dates and verify error messages
- [ ] Upload file > 10MB and verify rejection
- [ ] Upload file with > 50,000 rows and verify rejection
- [ ] Test fuzzy duplicate detection with manually created transaction
- [ ] Verify CSV mapping saved to account after import
- [ ] Switch booksets and verify import isolated to correct bookset
- [ ] Test with viewer role (should not be able to import - RLS should block)

---

## Success Criteria

**Phase 3 is complete when:**

1. ✅ User can upload CSV file and preview first 5 rows
2. ✅ User can configure CSV mapping (date, amount, description columns)
3. ✅ Parser handles files up to 10MB and 50,000 rows
4. ✅ Mapper correctly parses dates in all supported formats (MM/dd/yyyy, dd/MM/yyyy, yyyy-MM-dd, MM-dd-yyyy)
5. ✅ Mapper correctly cleans currency strings (handles $, commas, parentheses)
6. ✅ Mapper handles both signed and separate debit/credit columns
7. ✅ Fingerprinting generates consistent SHA-256 hashes
8. ✅ Exact duplicate detection works (fingerprint matching)
9. ✅ Fuzzy duplicate detection works (±3 day window, exact amount match)
10. ✅ Re-importing same file results in 0 new transactions
11. ✅ Import batch record created with correct statistics
12. ✅ Transactions inserted with correct fingerprints
13. ✅ CSV mapping saved to account for reuse
14. ✅ All unit tests pass
15. ✅ Manual "Double Import" test passes (no duplicates created)
16. ✅ Performance test passes (5,000 row CSV imports in < 3 seconds)
17. ✅ Error handling works (file size, row count, invalid data)
18. ✅ RLS policies enforce bookset isolation
19. ✅ Build runs without errors (`npm run build`)
20. ✅ App deployed to Vercel successfully

---

## Notes for LLM-Assisted Development

### When implementing the parser

- Use PapaParse's built-in error handling (don't write custom CSV parser)
- Test with real bank CSV files (Chase, Amex, etc.)
- Handle edge cases: empty lines, extra commas, quoted fields
- Set file size and row limits to prevent browser freeze

### When implementing the mapper

- Use `date-fns` for date parsing (don't write custom date parser)
- Test all date formats with real examples
- Currency cleaning must handle: $, commas, parentheses, negative signs
- Separate amount mode: handle empty cells in debit/credit columns
- Collect all errors instead of failing fast (better UX)

### When implementing fingerprinting

- Use Web Crypto API (built-in, no dependencies)
- Normalize description to prevent false negatives
- Test hash consistency across browsers
- Don't include user-editable fields (like `payee`) in hash

### When implementing duplicate detection

- Exact matching: Use Map for O(1) lookups (not array.find)
- Fuzzy matching: Only check transactions within date range (optimization)
- Show both exact and fuzzy duplicates in UI (different treatments)
- Don't auto-import fuzzy duplicates (require user review)

### When implementing the UI

- Use multi-step wizard (don't show all steps at once)
- Show preview before full parse (fast feedback)
- Display validation errors inline (per-transaction)
- Disable buttons during processing (prevent double-submit)
- Show statistics before commit (transparency)
- Provide "Start Over" button on error (recovery)

### Database considerations

- Index `(accountId, fingerprint)` for fast lookups
- Bulk insert transactions (single query)
- Store CSV mapping as JSONB (flexible schema)
- Audit trail via `import_batches` (undo support in future)
- RLS policies ensure bookset isolation

### Performance tips

- Only fingerprint valid transactions
- Fetch fingerprints only (not full transactions) for exact matching
- Limit date range for fuzzy matching
- Use Web Workers for heavy processing (future enhancement)
- Show progress indicator for long operations

---

## Next Phase Preview

**Phase 4** will implement:

- Rules engine for automatic categorization
- Keyword-based rule matching
- Auto-categorization during import
- Manual "Run Rules" button on Workbench
- "Create Rule from Selection" workflow
- `isReviewed` flag auto-set when rule matches

The transactions imported in Phase 3 will be categorized automatically by rules in Phase 4.

---

## Changes from v1

### Critical Additions

1. **Fuzzy Duplicate Detection** - Addresses Implementation Plan requirement for "±3 day window, amount matching"
2. **Error Handling Strategy** - Comprehensive error recovery and validation
3. **Performance Constraints** - Explicit limits (10MB, 50,000 rows) and optimization strategies
4. **Database Migration** - Index creation for performance
5. **Currency Cleaning Regex** - Detailed implementation with examples
6. **Bank Profile Presets** - Chase, Amex, BofA, Wells Fargo configurations
7. **State Machine Flow** - Detailed state transitions and error states
8. **UI Wireframes** - Complete ImportPage and MappingForm implementations
9. **Integration Test Scenarios** - Step-by-step test cases
10. **Performance Benchmarks** - Expected timing for various file sizes

### Structural Improvements

1. **Comprehensive Testing** - Unit tests, integration tests, manual checklist
2. **Implementation Timeline** - Detailed day-by-day breakdown
3. **Error Messages** - Specific, actionable user-facing messages
4. **Optimization Strategies** - Lazy fingerprinting, indexed queries, batch inserts
5. **Success Criteria** - Expanded from 8 to 20 specific checkpoints

### Documentation Enhancements

1. **Code Examples** - Complete implementation concepts for all functions
2. **Type Definitions** - Full TypeScript interfaces with comments
3. **SQL Migrations** - Executable migration scripts
4. **Validation Logic** - Zod schemas with refinements
5. **LLM Implementation Notes** - Specific guidance for each module

This v2 document is now comprehensive enough for direct LLM implementation without ambiguity.
