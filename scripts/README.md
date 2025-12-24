# Papa's Books - Scripts Directory

This directory contains utility scripts for testing, development, and maintenance tasks.

---

## Performance Testing Scripts

### `seed-large-dataset.ts`

Generates a large dataset of test transactions for performance testing.

**Purpose:** Test application performance with 10,000+ transactions (Task 2.4)

**Usage:**

```bash
# Basic usage
npx tsx scripts/seed-large-dataset.ts <bookset-id> <account-id> [count]

# Example
npx tsx scripts/seed-large-dataset.ts abc123 def456 10000

# Using environment variables
BOOKSET_ID=abc123 ACCOUNT_ID=def456 TOTAL_TRANSACTIONS=10000 npx tsx scripts/seed-large-dataset.ts
```

**Parameters:**

- `bookset-id`: Target bookset UUID
- `account-id`: Target account UUID
- `count`: Number of transactions to generate (default: 10000)

**Environment Variables:**

The script automatically loads environment variables from `.env.local` in the project root.

- `VITE_SUPABASE_URL`: Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key (required)
- `SUPABASE_SERVICE_KEY`: Service role key (optional, faster inserts)
- `BOOKSET_ID`: Target bookset UUID (alternative to CLI arg)
- `ACCOUNT_ID`: Target account UUID (alternative to CLI arg)
- `TOTAL_TRANSACTIONS`: Number to generate (alternative to CLI arg)

**Note:** If you already have a `.env.local` file with your Supabase credentials, the script will automatically use them.

**Features:**

- Generates realistic transaction data with random dates in 2024
- Uses 30+ common merchant names for variety
- Creates proper fingerprints for duplicate detection
- Inserts in batches of 1000 for efficiency
- Shows progress and performance metrics
- 70% transactions marked as reviewed (realistic scenario)

**Example Output:**

```text
╔══════════════════════════════════════════════════════════════╗
║   Papa's Books - Large Dataset Seeding Script              ║
╚══════════════════════════════════════════════════════════════╝

📊 Configuration:
   Bookset ID: abc123
   Account ID: def456
   Target Transactions: 10,000
   Batch Size: 1,000

✅ Verified bookset: "My Business Books"
✅ Verified account: "Checking Account"

🚀 Starting data generation...

   Batch 1/10: 1,000/10,000 (10.0%) - 2.3s elapsed - 435 tx/s
   Batch 2/10: 2,000/10,000 (20.0%) - 4.5s elapsed - 444 tx/s
   ...

╔══════════════════════════════════════════════════════════════╗
║   Dataset Generation Complete                                ║
╚══════════════════════════════════════════════════════════════╝

✅ Total Inserted: 10,000 transactions
⏱️  Total Time: 23.45s
📈 Average Rate: 426 transactions/second
```

---

### `generate-large-csv.ts`

Generates large CSV files for import performance testing.

**Purpose:** Test CSV import with 5,000+ row files (Task 2.4)

**Usage:**

```bash
# Basic usage
npx tsx scripts/generate-large-csv.ts [row-count] [output-path]

# Example
npx tsx scripts/generate-large-csv.ts 5000 test-data-large.csv

# Using environment variables
ROW_COUNT=5000 OUTPUT_PATH=test-data.csv npx tsx scripts/generate-large-csv.ts
```

**Parameters:**

- `row-count`: Number of CSV rows to generate (default: 5000)
- `output-path`: Output filename (default: test-data-large.csv)

**Environment Variables:**

- `ROW_COUNT`: Number of rows (alternative to CLI arg)
- `OUTPUT_PATH`: Output filename (alternative to CLI arg)

**Features:**

- Generates standard CSV format: `Date,Description,Amount`
- Random dates throughout 2024
- Realistic merchant names and transaction amounts
- Progress indicator for large files
- Shows file size in KB and MB

**Example Output:**

```text
╔══════════════════════════════════════════════════════════════╗
║   Papa's Books - Large CSV Generator                        ║
╚══════════════════════════════════════════════════════════════╝

📊 Configuration:
   Row Count: 5,000
   Output: test-data-large.csv

🚀 Generating CSV data...

   Progress: 1,000/5,000 (20.0%)
   Progress: 2,000/5,000 (40.0%)
   ...

╔══════════════════════════════════════════════════════════════╗
║   CSV Generation Complete                                    ║
╚══════════════════════════════════════════════════════════════╝

✅ Generated: 5,000 rows
📁 File: C:\Repos\papas-books\test-data-large.csv
📊 Size: 342 KB (0.33 MB)
```

---

## Security Testing Scripts

### `test-rls-policies.ts`

Tests Row Level Security policies to verify data isolation between booksets.

**Purpose:** Ensure RLS policies prevent unauthorized access (Task 1.6)

**Usage:**

```bash
npx tsx scripts/test-rls-policies.ts
```

**Note:** Requires email verification to be disabled in Supabase Auth settings, or use of
service role key to auto-confirm test users.

---

## Performance Testing Workflow

### Step 1: Prepare Test Environment

1. **Get your bookset and account IDs:**

   ```sql
   -- Run in Supabase SQL Editor
   SELECT id, name FROM booksets WHERE owner_id = auth.uid();
   SELECT id, name FROM accounts WHERE bookset_id = '<your-bookset-id>';
   ```

2. **Set environment variables:**

   ```bash
   # Windows PowerShell
   $env:VITE_SUPABASE_URL="https://your-project.supabase.co"
   $env:VITE_SUPABASE_ANON_KEY="your-anon-key"
   $env:SUPABASE_SERVICE_KEY="your-service-key"  # Optional

   # Linux/Mac
   export VITE_SUPABASE_URL="https://your-project.supabase.co"
   export VITE_SUPABASE_ANON_KEY="your-anon-key"
   export SUPABASE_SERVICE_KEY="your-service-key"  # Optional
   ```

### Step 2: Generate Test Data

```bash
# Generate 10,000 transactions in database
npx tsx scripts/seed-large-dataset.ts <bookset-id> <account-id> 10000

# Generate 5,000 row CSV file
npx tsx scripts/generate-large-csv.ts 5000 test-data-large.csv
```

### Step 3: Run Performance Tests

Follow the test procedures in [docs/performance-test-results.md](../docs/performance-test-results.md):

1. **Workbench load test:**
   - Clear browser cache
   - Navigate to Workbench
   - Measure load time with DevTools Performance tab

2. **Filtering test:**
   - Apply various filters (date, payee, review status)
   - Measure response times

3. **CSV import test:**
   - Upload `test-data-large.csv`
   - Time each stage of import process

4. **Reports test:**
   - Generate reports with large dataset
   - Verify pagination works correctly

5. **Database query test:**
   - Run EXPLAIN ANALYZE in Supabase SQL Editor
   - Verify indexes are being used

### Step 4: Document Results

Update [docs/performance-test-results.md](../docs/performance-test-results.md) with:

- Actual timing measurements
- Screenshots (if helpful)
- Issues found
- Optimization recommendations

### Step 5: Cleanup (Optional)

```sql
-- Delete test transactions (use with caution!)
DELETE FROM transactions
WHERE bookset_id = '<your-bookset-id>'
  AND account_id = '<your-account-id>'
  AND import_date >= '<test-start-timestamp>';
```

---

## Troubleshooting

### Error: "Missing environment variables"

**Solution:** Set required environment variables:

```bash
$env:VITE_SUPABASE_URL="https://your-project.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Error: "Bookset not found" or "Account not found"

**Solution:** Verify IDs are correct:

```sql
SELECT id, name FROM booksets WHERE owner_id = auth.uid();
SELECT id, name FROM accounts WHERE bookset_id = '<bookset-id>';
```

### Slow insert performance

**Solution:** Use service role key for faster inserts:

```bash
$env:SUPABASE_SERVICE_KEY="your-service-role-key"
```

Service keys bypass RLS and can insert ~2-3x faster.

### Out of memory during CSV generation

**Solution:** Generate smaller files or increase Node.js memory:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npx tsx scripts/generate-large-csv.ts
```

---

## Best Practices

1. **Use dedicated test booksets:**
   - Don't pollute production data with test transactions
   - Create a separate bookset for performance testing

2. **Monitor Supabase quotas:**
   - Database size limits
   - API request limits
   - Check Supabase dashboard during large inserts

3. **Clean up after testing:**
   - Delete test transactions when done
   - Document baseline performance for comparison

4. **Use realistic data:**
   - Scripts generate realistic merchant names and amounts
   - Date distributions match typical usage patterns

5. **Test on target hardware:**
   - Test on devices similar to production users
   - Consider mobile device performance

---

## Contributing

When adding new scripts:

1. Follow existing naming conventions
2. Include detailed comments and error handling
3. Add usage instructions to this README
4. Use TypeScript for type safety
5. Follow project linting rules (`npm run lint`)

---

**Last Updated:** 2025-12-24
