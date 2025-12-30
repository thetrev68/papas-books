# CodeQL Security Analysis for Papa's Books

This directory contains custom CodeQL queries and configuration for security analysis of the Papa's Books application.

## Overview

CodeQL is a semantic code analysis engine that treats code as data, allowing you to write queries to find security vulnerabilities, bugs, and code quality issues.

## Custom Queries

We've created custom queries specific to Papa's Books' architecture and security requirements:

### 1. **SupabaseRLSBypass.ql**

- **Severity**: Error
- **Purpose**: Detects queries to Supabase that may bypass Row Level Security
- **What it checks**: Ensures all queries to bookset-scoped tables (accounts, transactions, categories, rules, payees) include a `bookset_id` filter
- **Why it matters**: Missing bookset filters can expose data from other users' booksets

### 2. **DangerousInnerHTML.ql**

- **Severity**: Error
- **Purpose**: Detects XSS vulnerabilities from using `dangerouslySetInnerHTML` with user-controlled data
- **What it checks**: Tracks data flow from user inputs (Supabase queries, form inputs, props) to `dangerouslySetInnerHTML`
- **Why it matters**: Prevents cross-site scripting attacks

### 3. **HardcodedCredentials.ql**

- **Severity**: Error
- **Purpose**: Detects hardcoded Supabase credentials instead of environment variables
- **What it checks**: Looks for Supabase URLs and JWT keys hardcoded in source files
- **Why it matters**: Credentials should never be committed to version control

### 4. **FloatingPointCurrency.ql**

- **Severity**: Warning
- **Purpose**: Detects floating-point arithmetic on currency values
- **What it checks**: Finds multiplication/division operations on variables with currency-related names
- **Why it matters**: Floating-point math causes rounding errors; we use integer cents instead

### 5. **InsecureAuthCheck.ql**

- **Severity**: Warning
- **Purpose**: Detects incomplete authentication checks
- **What it checks**: Ensures protected routes check not just `user` but also `activeBookset` and permissions
- **Why it matters**: User authentication alone doesn't verify bookset access rights

### 6. **CSVInjection.ql**

- **Severity**: Warning
- **Purpose**: Detects CSV injection vulnerabilities in export functionality
- **What it checks**: Tracks user data flowing to CSV exports without sanitization
- **Why it matters**: CSV formulas starting with `=`, `+`, `-`, or `@` can execute code in Excel/Sheets

### 7. **MissingInputValidation.ql**

- **Severity**: Warning
- **Purpose**: Detects form submissions without Zod schema validation
- **What it checks**: Ensures mutations and form handlers use `.parse()` or `.safeParse()`
- **Why it matters**: Input validation prevents malformed data and security issues

### 8. **ReactKeyProp.ql**

- **Severity**: Warning
- **Purpose**: Detects missing or non-unique React keys in list rendering
- **What it checks**: Finds `Array.map()` calls that return JSX without proper keys
- **Why it matters**: Missing/poor keys cause React rendering bugs and performance issues

## Running CodeQL Analysis

### Local Analysis (PowerShell Script)

Use the existing PowerShell script to run CodeQL locally:

```bash
npm run codeql:scan
```

Or with the code quality suite:

```bash
npm run quality -- --codeql
```

#### Environment Variables

You can customize the CodeQL scan with these environment variables:

- `CODEQL_BIN`: Path to CodeQL CLI (default: `codeql`)
- `CODEQL_PACKS`: Path to CodeQL query packs (default: `C:\Tools\codeql-packs`)
- `CODEQL_DB_DIR`: Database output directory (default: `.codeql-db`)
- `CODEQL_SARIF_OUT`: SARIF output file (default: `codeql-results.sarif`)
- `CODEQL_LANGUAGE`: Language to analyze (default: `javascript`)
- `CODEQL_PACK`: Query pack to use (default: `codeql/javascript-queries`)
- `CODEQL_QUERIES`: Custom query path (optional)
- `CODEQL_SOURCE_ROOT`: Source root directory (default: `src`)

Example:

```powershell
$env:CODEQL_QUERIES=".codeql/queries/papas-books-suite.qls"
npm run codeql:scan
```

### GitHub Actions (Automated)

The GitHub Actions workflow (`.github/workflows/codeql-analysis.yml`) automatically runs CodeQL:

- **On push** to `main` or `develop` branches
- **On pull requests** to `main`
- **Weekly schedule** (Mondays at 6:00 AM UTC)
- **Manual trigger** via workflow_dispatch

Results are uploaded to GitHub Security tab under "Code scanning alerts".

## Viewing Results

### Local Results

After running locally, results are saved to:

- **SARIF file**: `codeql-results.sarif` (machine-readable)
- **Console output**: Printed during analysis

View SARIF files in VS Code with the [SARIF Viewer extension](https://marketplace.visualstudio.com/items?itemName=MS-SarifVSCode.sarif-viewer).

### GitHub Results

1. Go to your repository on GitHub
2. Click the **Security** tab
3. Click **Code scanning alerts**
4. Filter by tool: "CodeQL"

## Writing Custom Queries

### Query Structure

CodeQL queries are written in QL language. Basic structure:

```ql
/**
 * @name Query Name
 * @description What this query detects
 * @kind problem
 * @problem.severity error|warning|recommendation
 * @id unique-id
 * @tags security, correctness, etc.
 */

import javascript

from <class> <variable>
where <conditions>
select <variable>, "Message describing the issue"
```

### Common Classes

- `MethodCallExpr`: Method calls (e.g., `supabase.from('accounts')`)
- `CallExpr`: Function calls
- `VarAccess`: Variable references
- `StringLiteral`: String literals
- `IfStmt`: If statements
- `DataFlow::Node`: Data flow tracking

### Testing Queries

1. Create a test file in `src/` with code that should trigger the query
2. Run CodeQL with custom queries
3. Verify the issue is detected
4. Fix the code or refine the query

## Suppressing False Positives

If a query produces false positives, you can:

1. **Add a comment** in the code:

   ```typescript
   // codeql[js/sql-injection] - False positive: input is sanitized
   const query = buildQuery(userInput);
   ```

2. **Update the query** to exclude specific patterns
3. **Configure in `codeql-config.yml`** to exclude specific query IDs

## Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [CodeQL for JavaScript](https://codeql.github.com/docs/codeql-language-guides/codeql-for-javascript/)
- [Writing CodeQL Queries](https://codeql.github.com/docs/writing-codeql-queries/)
- [CodeQL Query Examples](https://github.com/github/codeql/tree/main/javascript/ql/src)

## Maintenance

### Updating Standard Queries

GitHub regularly updates CodeQL queries. To update:

```bash
codeql pack download codeql/javascript-queries
```

### Adding New Custom Queries

1. Create a new `.ql` file in `.codeql/queries/custom/`
2. Follow the query structure above
3. Test thoroughly
4. Update this README with query documentation

### CI/CD Integration

The workflow is already integrated with GitHub Actions. For other CI systems:

1. Install CodeQL CLI
2. Run `codeql database create`
3. Run `codeql database analyze`
4. Upload results to your security dashboard
