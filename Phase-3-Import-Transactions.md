# Phase 3: Import & Transaction Management

**Status:** Planned
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

---

## Database Schema & Types

The schema was created in Phase 1. We will use strict TypeScript interfaces to interact with it.

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
  payee: string; // Cleaned name (initially same as original_description)
  originalDescription: string; // Raw bank text (immutable)

  // Metadata & Audit
  fingerprint: string; // SHA-256 hash for duplicate detection
  sourceBatchId: string | null; // Link to import_batches
  importDate: string; // ISO timestamp

  // Status Flags
  isReviewed: boolean; // False = "New", True = "Accepted"
  isSplit: boolean; // Phase 4 feature
  reconciled: boolean; // Phase 5 feature

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### 2. The Import Batch (`import_batches` table)

Tracks the history of imports.

```typescript
export interface ImportBatch {
  id: string;
  booksetId: string;
  accountId: string;
  fileName: string;
  importedAt: string;

  // Statistics
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;

  // Audit Snapshot
  csvMappingSnapshot: Record<string, unknown>; // JSON dump of mapping used
}
```

### 3. The Import Profile (`accounts.csv_mapping`)

Stored as JSONB in the database, this configures how to read a specific bank's CSV.

```typescript
// src/types/import.ts

export type DateFormat = 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM-dd-yyyy';

export interface CsvMapping {
  // Column Headers (or indices if no header)
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;

  // Parsing Rules
  dateFormat: DateFormat;
  hasHeaderRow: boolean;

  // Advanced Amount Handling
  // 'signed': One column, negative = outflow
  // 'separate': Debit column and Credit column
  amountMode: 'signed' | 'separate';
  inflowColumn?: string; // Used if amountMode === 'separate'
  outflowColumn?: string; // Used if amountMode === 'separate'
}
```

---

## Domain Logic: The Import Pipeline

The import process is a linear pipeline of transformations. Each step is a separate module in `src/lib/import/`.

### Pipeline Overview

1. **Parse:** `File` -> `RawRow[]`
2. **Map:** `RawRow[]` + `CsvMapping` -> `StagedTransaction[]`
3. **Fingerprint:** `StagedTransaction` -> `StagedTransaction` (with hash)
4. **Deduplicate:** `StagedTransaction[]` + `ExistingDBTransactions[]` -> `ImportPlan`
5. **Commit:** `ImportPlan` -> `Database`

### Module 1: Parser Engine

**File:** `src/lib/import/parser.ts`

**Objective:** wrappers around `papaparse` to safely read files.

```typescript
import Papa from 'papaparse';

export interface ParseResult {
  data: Record<string, string>[]; // Array of objects (if header) or arrays (if no header)
  meta: {
    fields?: string[]; // Detected headers
  };
  errors: Papa.ParseError[];
}

/**
 * Reads the first 5 lines of a CSV to preview columns and detect headers.
 */
export async function previewCsv(file: File): Promise<ParseResult> {
  // Implementation using Papa.parse with preview: 5
}

/**
 * Parses the entire file.
 */
export async function parseFullCsv(file: File): Promise<ParseResult> {
  // Implementation using Papa.parse
}
```

### Module 2: Mapping Engine

**File:** `src/lib/import/mapper.ts`

**Objective:** Transform raw string data into strongly-typed objects using the profile.

```typescript
import { CsvMapping } from '../../types/import';

export interface StagedTransaction {
  // Valid fields (if success)
  date?: string; // ISO YYYY-MM-DD
  amount?: number; // Cents
  description?: string;

  // Validation state
  isValid: boolean;
  errors: string[]; // e.g., "Invalid date", "Missing amount"

  // Source data for debugging
  rawRow: any;
  rowIndex: number;
}

/**
 * Transforms a single raw CSV row into a StagedTransaction.
 * Handles:
 * - Date parsing (date-fns)
 * - Currency cleaning ("$1,200.00" -> 120000)
 * - Negative/Positive logic
 */
export function mapRowToTransaction(
  row: any,
  mapping: CsvMapping,
  rowIndex: number
): StagedTransaction {
  // Logic:
  // 1. Extract raw strings based on mapping.dateColumn, etc.
  // 2. Parse date using mapping.dateFormat
  // 3. Clean amount string (remove '$', ',')
  // 4. If amountMode='separate', combine inflow/outflow logic
  // 5. Validate and return
}
```

### Module 3: Fingerprinting

**File:** `src/lib/import/fingerprint.ts`

**Objective:** Generate a deterministic ID for duplicate detection.

**Algorithm:**

The hash input string must be normalized to prevent slight variations from breaking detection.
`HashInput = ISO_Date + "|" + Amount_Cents + "|" + Normalized_Description`

**Normalization Rules:**

1. Trim leading/trailing whitespace.
2. Convert to lowercase.
3. Replace multiple spaces with single space.
4. Remove special characters that banks might randomly insert? (Maybe keep simple for now).

```typescript
/**
 * Generates a SHA-256 hash of the transaction core data.
 * Returns hex string.
 */
export async function generateFingerprint(
  date: string,
  amount: number,
  description: string
): Promise<string> {
  // Implementation using window.crypto.subtle
}
```

### Module 4: Reconciliation (Deduplication)

**File:** `src/lib/import/reconciler.ts`

**Objective:** Compare staged transactions against what's already in the DB.

```typescript
import { Transaction } from '../../types/database';

export type ImportStatus = 'new' | 'duplicate' | 'error';

export interface ProcessedTransaction extends StagedTransaction {
  fingerprint: string;
  status: ImportStatus;
  duplicateOfId?: string; // If status='duplicate', points to existing DB ID
}

/**
 * Compares incoming transactions against an array of existing transactions.
 * Uses fingerprint for O(1) lookups.
 */
export function detectDuplicates(
  incoming: StagedTransaction[],
  existing: Transaction[]
): ProcessedTransaction[] {
  // Logic:
  // 1. Build Set<string> of existing fingerprints
  // 2. Map incoming -> check Set -> assign status
}
```

---

## Data Access Layer (Supabase)

New functions needed in `src/lib/supabase/`.

### File: `src/lib/supabase/import.ts`

```typescript
/**
 * Create a batch record and bulk insert transactions in a single transaction (if possible)
 * or sequential steps.
 */
export async function commitImportBatch(
  batch: Omit<ImportBatch, 'id'>,
  transactions: Omit<Transaction, 'id'>[]
): Promise<void> {
  // 1. Insert import_batches record -> get ID
  // 2. Assign batch_id to all transactions
  // 3. Bulk Insert transactions (supabase.from('transactions').insert([...]))
}

/**
 * Fetch transactions for an account within a date range.
 * Used to load the "Existing" set for deduplication.
 * Optimization: Only fetch ID and Fingerprint.
 */
export async function fetchExistingFingerprints(accountId: string): Promise<Set<string>> {
  // Returns Set of fingerprints
}
```

### File: `src/lib/supabase/accounts.ts` (Update)

```typescript
/**
 * Update the CSV mapping preference for an account.
 */
export async function updateAccountMapping(accountId: string, mapping: CsvMapping): Promise<void> {
  // Update jsonb column
}
```

---

## State Management (Hooks)

We need a robust hook to manage the multi-step import wizard state.

### File: `src/hooks/useImportSession.ts`

**State Machine:**

- `step`: 'upload' | 'mapping' | 'review' | 'importing' | 'complete'
- `file`: File | null
- `rawPreview`: ParseResult
- `mapping`: CsvMapping
- `stagedTransactions`: ProcessedTransaction[]
- `stats`: { new: number, dupes: number }

**Exports:**

- `uploadFile(file)`: transitions to 'mapping' (or auto-detects -> 'review')
- `updateMapping(newMapping)`: re-runs `mapRowToTransaction`
- `commit()`: calls `commitImportBatch`

---

## Functional Harness (The "UI")

Since we are avoiding UI polish, we will create a "Workbench" component or use the existing `ImportPage.tsx` purely as a function invoker.

**File:** `src/pages/ImportPage.tsx`

**Structure (Conceptual):**

1. **Section: Account Selection**
   - `<select>` of accounts (from Phase 2).
   - Displays currently saved `csv_mapping` as raw JSON.

2. **Section: File Input**
   - `<input type="file">`
   - `onChange`: calls `parser.previewCsv()`.
   - Displays: First 5 raw rows in a `<pre>` block.

3. **Section: Mapping Configuration**
   - Simple `<input>` fields for `dateColumn`, `amountColumn`, `dateFormat`.
   - "Apply Mapping" button.
   - Displays: Table of first 5 `StagedTransactions` (Date | Amount | Payee | Status).
   - Shows validation errors in red text.

4. **Section: Review & Commit**
   - "Check for Duplicates" button (fetches existing hashes).
   - Displays: "Ready to import X transactions (Y duplicates ignored)."
   - "Execute Import" button.
   - Result: Toast "Success", link to view batch.

---

## Validation Schemas (Zod)

**File:** `src/lib/validation/import.ts`

```typescript
import { z } from 'zod';

export const csvMappingSchema = z.object({
  dateColumn: z.string().min(1),
  amountColumn: z.string().min(1),
  descriptionColumn: z.string().min(1),
  dateFormat: z.enum(['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']),
  hasHeaderRow: z.boolean(),
  // ... other fields
});
```

---

## Implementation Steps

1. **Core Utilities (TDD Approach)**
   - Create `src/lib/import/` directory.
   - Implement `parser.ts` + tests.
   - Implement `mapper.ts` + tests (handle all date formats and currency cleaning).
   - Implement `fingerprint.ts` + tests.
   - Implement `reconciler.ts` + tests (duplicate detection logic).

2. **Database Integration**
   - Create `src/lib/supabase/import.ts`.
   - Implement `fetchExistingFingerprints`.
   - Implement `commitImportBatch`.

3. **State Management**
   - Implement `useImportSession` hook to glue utilities together.

4. **Functional Page**
   - Update `ImportPage.tsx`.
   - Wire up the Account Select (reuse `useAccounts`).
   - Wire up File Input and Mapping form.
   - Wire up Commit button.

---

## Testing Plan (Strict)

### Unit Tests (`src/lib/import/*.test.ts`)

- **Parser:**
  - Should parse valid CSV.
  - Should handle empty lines.
- **Mapper:**
  - Should map column "Date" to `date` property.
  - Should parse "1/15/2024" correctly with "MM/dd/yyyy".
  - Should parse "15/1/2024" correctly with "dd/MM/yyyy".
  - Should clean "$1,234.56" to `123456`.
  - Should clean "($50.00)" to `-5000`.
  - Should return `isValid: false` for garbage data.
- **Fingerprint:**
  - Should produce identical hash for identical inputs.
  - Should ignore case in description ("Target" == "target").
  - Should ignore extra whitespace (" Target " == "Target").
- **Reconciler:**
  - Should mark transaction as 'duplicate' if hash exists in DB set.
  - Should mark as 'new' if hash is unique.

### Integration Manual Test

1. Select Account A.
2. Upload `bank_export_jan.csv`.
3. Set mapping (Date=0, Amount=1, Desc=2).
4. Commit Import (10 transactions).
5. Verify in Supabase Dashboard that 10 rows exist in `transactions`.
6. **Re-upload same file.**
7. Verify 0 "new" transactions found.
8. Commit again (should do nothing).
