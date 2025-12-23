$ErrorActionPreference = "Stop"

$rootDir = (Get-Location).Path

$codeqlBin = if ($env:CODEQL_BIN) { $env:CODEQL_BIN } else { "codeql" }
$codeqlPacks = if ($env:CODEQL_PACKS) { $env:CODEQL_PACKS } else { "C:\Tools\codeql-packs" }
$dbDir = if ($env:CODEQL_DB_DIR) { $env:CODEQL_DB_DIR } else { Join-Path $rootDir ".codeql-db" }
$sarifOut = if ($env:CODEQL_SARIF_OUT) { $env:CODEQL_SARIF_OUT } else { Join-Path $rootDir "codeql-results.sarif" }
$language = if ($env:CODEQL_LANGUAGE) { $env:CODEQL_LANGUAGE } else { "javascript" }
$buildCmd = if ($env:CODEQL_BUILD_CMD) { $env:CODEQL_BUILD_CMD } else { "" }
$queryPack = if ($env:CODEQL_PACK) { $env:CODEQL_PACK } else { "codeql/javascript-queries" }
$queryPath = if ($env:CODEQL_QUERIES) { $env:CODEQL_QUERIES } else { "" }
$sourceRoot = if ($env:CODEQL_SOURCE_ROOT) { $env:CODEQL_SOURCE_ROOT } else { Join-Path $rootDir "src" }

if (Test-Path $dbDir) {
  Write-Host "Removing existing CodeQL database at $dbDir"
  Remove-Item -Recurse -Force $dbDir
}

$createArgs = @("database", "create", $dbDir, "--language=$language", "--source-root=$sourceRoot")
if ($buildCmd) {
  $createArgs += @("--command", $buildCmd)
}

Write-Host "Creating CodeQL database..."
& $codeqlBin @createArgs

$analyzeArgs = @("database", "analyze", $dbDir, "--format=sarifv2.1.0", "--output=$sarifOut")
if (Test-Path $codeqlPacks) {
  $analyzeArgs += @("--search-path", $codeqlPacks)
}

if ($queryPath) {
  $analyzeArgs += @($queryPath)
} else {
  $analyzeArgs += @($queryPack)
}

Write-Host "Running CodeQL analysis..."
& $codeqlBin @analyzeArgs

Write-Host "Done. SARIF output: $sarifOut"
