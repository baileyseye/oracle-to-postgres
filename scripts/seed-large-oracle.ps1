param(
  [string]$Container = 'oracle-to-postgres-oracle',
  [string]$Service = 'FREEPDB1',
  [string]$DbUser = 'system',
  [string]$DbPassword = 'oracle'
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlPath = Join-Path $scriptDir 'seed-large-oracle.sql'

if (-not (Test-Path $sqlPath)) {
  throw "SQL script not found: $sqlPath"
}

docker cp $sqlPath "${Container}:/tmp/seed-large-oracle.sql"
if ($LASTEXITCODE -ne 0) {
  throw "docker cp failed with exit code $LASTEXITCODE"
}

docker exec $Container bash -lc "sqlplus -s -l $DbUser/$DbPassword@//localhost:1521/$Service @/tmp/seed-large-oracle.sql"
if ($LASTEXITCODE -ne 0) {
  throw "Large dataset seeding failed with exit code $LASTEXITCODE"
}

Write-Host 'Large Oracle dataset is ready: 2,000,000 users and 4,000,000 orders.' -ForegroundColor Green
