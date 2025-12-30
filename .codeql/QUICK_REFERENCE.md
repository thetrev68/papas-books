# CodeQL Quick Reference

## Running CodeQL Scans

### Using npm scripts (Recommended)

```bash
# Run all code quality checks including CodeQL
npm run quality -- --codeql

# Run CodeQL scan only
npm run codeql:scan
```

### Using PowerShell Script Directly

```powershell
# Basic scan with default settings
.\scripts\codeql-scan.ps1

# Use custom query suite
$env:CODEQL_QUERIES=".codeql/queries/papas-books-suite.qls"
.\scripts\codeql-scan.ps1

# Specify custom output location
$env:CODEQL_SARIF_OUT="custom-results.sarif"
.\scripts\codeql-scan.ps1
```

### Using CodeQL CLI Directly

```bash
# Create database
codeql database create .codeql-db --language=javascript --source-root=src

# Run standard security queries
codeql database analyze .codeql-db codeql/javascript-queries:codeql-suites/javascript-security-extended.qls --format=sarif-latest --output=results.sarif

# Run custom queries
codeql database analyze .codeql-db .codeql/queries/papas-books-suite.qls --format=sarif-latest --output=results.sarif

# Run a single query
codeql database analyze .codeql-db .codeql/queries/custom/SupabaseRLSBypass.ql --format=sarif-latest --output=rls-results.sarif
```

## Environment Variables

| Variable             | Default                     | Description                        |
| -------------------- | --------------------------- | ---------------------------------- |
| `CODEQL_BIN`         | `codeql`                    | Path to CodeQL CLI executable      |
| `CODEQL_PACKS`       | `C:\Tools\codeql-packs`     | Path to CodeQL query packs         |
| `CODEQL_DB_DIR`      | `.codeql-db`                | Database output directory          |
| `CODEQL_SARIF_OUT`   | `codeql-results.sarif`      | SARIF results file                 |
| `CODEQL_LANGUAGE`    | `javascript`                | Language to analyze                |
| `CODEQL_PACK`        | `codeql/javascript-queries` | Query pack to use                  |
| `CODEQL_QUERIES`     | _(empty)_                   | Custom query path (overrides pack) |
| `CODEQL_SOURCE_ROOT` | `src`                       | Source code directory              |

## Common Commands

### View Results in Terminal

```bash
# View SARIF results as formatted text
codeql bqrs interpret .codeql-db/results/*.bqrs

# Count results by severity
jq '[.runs[].results[] | .level] | group_by(.) | map({level: .[0], count: length})' codeql-results.sarif
```

### Database Management

```bash
# Upgrade database to latest schema
codeql database upgrade .codeql-db

# Get database info
codeql database info .codeql-db

# Clean up database
rm -rf .codeql-db
```

### Query Development

```bash
# Test a single query
codeql query run .codeql/queries/custom/SupabaseRLSBypass.ql --database=.codeql-db

# Format query file
codeql query format .codeql/queries/custom/SupabaseRLSBypass.ql --in-place

# Compile query (check syntax)
codeql query compile .codeql/queries/custom/SupabaseRLSBypass.ql
```

## Interpreting Results

### Severity Levels

- **Error**: Critical security vulnerabilities or bugs that must be fixed
- **Warning**: Potential issues that should be reviewed
- **Note**: Recommendations and code quality suggestions

### SARIF File Structure

```json
{
  "runs": [
    {
      "results": [
        {
          "ruleId": "papas-books/missing-bookset-filter",
          "level": "error",
          "message": { "text": "Query on table 'transactions' is missing bookset_id filter" },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "src/lib/supabase/transactions.ts" },
                "region": { "startLine": 42 }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Viewing Results in VS Code

1. Install [SARIF Viewer extension](https://marketplace.visualstudio.com/items?itemName=MS-SarifVSCode.sarif-viewer)
2. Open `codeql-results.sarif`
3. Click issues to navigate to source code

## GitHub Integration

### View Results on GitHub

1. Go to repository → **Security** tab
2. Click **Code scanning alerts**
3. Filter by tool: "CodeQL"

### Trigger Workflow Manually

1. Go to repository → **Actions** tab
2. Select "CodeQL Security Analysis"
3. Click "Run workflow"

## Custom Query Tips

### Find All Supabase Queries

```bash
grep -r "supabase.from" src/
```

### Check for Missing Bookset Filters

```bash
# Run the custom query
codeql database analyze .codeql-db .codeql/queries/custom/SupabaseRLSBypass.ql --format=sarif-latest --output=rls-check.sarif

# View results
cat rls-check.sarif | jq '.runs[].results[] | {file: .locations[0].physicalLocation.artifactLocation.uri, line: .locations[0].physicalLocation.region.startLine, message: .message.text}'
```

## Troubleshooting

### "codeql: command not found"

Install CodeQL CLI:

- Download from [GitHub](https://github.com/github/codeql-cli-binaries/releases)
- Add to PATH or set `CODEQL_BIN` environment variable

### "Database is out of date"

```bash
codeql database upgrade .codeql-db
```

### Query Pack Not Found

```bash
# Download standard query packs
codeql pack download codeql/javascript-queries

# Or specify path
$env:CODEQL_PACKS="path/to/codeql-packs"
```

### No Results Found

- Check that source code is in `src/` directory
- Verify query syntax with `codeql query compile`
- Try running with `--verbose` flag for debug output

## Performance Tips

1. **Incremental Analysis**: Reuse existing database when possible
2. **Targeted Scans**: Analyze specific directories with `--source-root`
3. **Parallel Execution**: Use `--threads=0` to use all CPU cores
4. **Query Filtering**: Use custom query suites to run only relevant queries

## Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [JavaScript CodeQL Queries](https://github.com/github/codeql/tree/main/javascript/ql/src)
- [Papa's Books Custom Queries](./.codeql/README.md)
- [Writing CodeQL Queries](https://codeql.github.com/docs/writing-codeql-queries/)
