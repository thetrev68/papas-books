#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CODEQL_BIN="${CODEQL_BIN:-/mnt/c/Tools/codeql/codeql}"
CODEQL_PACKS="${CODEQL_PACKS:-/mnt/c/Tools/codeql-packs}"
DB_DIR="${CODEQL_DB_DIR:-"$ROOT_DIR/.codeql-db"}"
SARIF_OUT="${CODEQL_SARIF_OUT:-"$ROOT_DIR/codeql-results.sarif"}"
LANGUAGE="${CODEQL_LANGUAGE:-javascript}"
BUILD_CMD="${CODEQL_BUILD_CMD:-}"
QUERY_PACK="${CODEQL_PACK:-codeql/javascript-queries}"
QUERY_PATH="${CODEQL_QUERIES:-}"
SOURCE_ROOT="${CODEQL_SOURCE_ROOT:-"$ROOT_DIR/src"}"

if [[ -d "$DB_DIR" ]]; then
  echo "Removing existing CodeQL database at $DB_DIR"
  rm -rf "$DB_DIR"
fi

CREATE_ARGS=(database create "$DB_DIR" --language="$LANGUAGE" --source-root="$SOURCE_ROOT")
if [[ -n "$BUILD_CMD" ]]; then
  CREATE_ARGS+=(--command "$BUILD_CMD")
fi

echo "Creating CodeQL database..."
"$CODEQL_BIN" "${CREATE_ARGS[@]}"

ANALYZE_ARGS=(database analyze "$DB_DIR" --format=sarifv2.1.0 --output="$SARIF_OUT")
if [[ -d "$CODEQL_PACKS" ]]; then
  ANALYZE_ARGS+=(--search-path "$CODEQL_PACKS")
fi

if [[ -n "$QUERY_PATH" ]]; then
  ANALYZE_ARGS+=("$QUERY_PATH")
else
  ANALYZE_ARGS+=("$QUERY_PACK")
fi

echo "Running CodeQL analysis..."
"$CODEQL_BIN" "${ANALYZE_ARGS[@]}"

echo "Done. SARIF output: $SARIF_OUT"
