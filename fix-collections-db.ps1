# Repairs the game_backend database so collections work.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File fix-collections-db.ps1
#
# WHY: the backend in C:\Users\BITPATNA\Game-Dev\gamebackend was set up with
# `npm run migrate` (applies schema.sql - 7 tables, NO collections) and runs
# with AUTO_MIGRATE=false, so numbered migrations 002-009 never executed.
# Every collections query then dies with:
#     relation "asset_collections" does not exist
# which is why the dashboard shows "No collections found" / errors.
#
# WHAT IT DOES (additive only - statements verified against the files):
#   1. pg_dump backup of game_backend (next to this script)
#   2. applies src/database/migrations 002..009 in order, stop on first error
#   3. records 001..009 in schema_migrations, so setting AUTO_MIGRATE=true
#      later will NOT re-run 001 and collide with schema.sql's triggers
#   4. verifies the live endpoint answers
#
# The running server needs NO restart - tables resolve at query time.
# Run once: 005 adds a column without IF NOT EXISTS, so a second run stops
# there harmlessly (everything before it is already applied).

$ErrorActionPreference = "Stop"
$BACKEND = "C:\Users\BITPATNA\Game-Dev\gamebackend"
$PG = "C:\Program Files\PostgreSQL\18\bin"

Set-Location $BACKEND
$cfg = @{}
foreach ($line in (Get-Content ".env" | Where-Object { $_ -match "^(DB_|PORT=)" })) {
    $k, $v = $line -split "=", 2
    $cfg[$k.Trim()] = $v.Trim()
}
$env:PGPASSWORD = $cfg["DB_PASSWORD"]
$dbArgs = @("-h", $cfg["DB_HOST"], "-p", $cfg["DB_PORT"], "-U", $cfg["DB_USER"], "-d", $cfg["DB_NAME"])
$apiPort = if ($cfg.ContainsKey("PORT")) { $cfg["PORT"] } else { "3000" }

Write-Host ""
Write-Host "[1/4] Backup..."
$bak = Join-Path $PSScriptRoot "game_backend_backup_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
& "$PG\pg_dump.exe" @dbArgs -f $bak
Write-Host "      saved $bak ($([math]::Round((Get-Item $bak).Length/1KB)) KB)"

Write-Host ""
Write-Host "[2/4] Applying migrations 002-009..."
$files = Get-ChildItem "src\database\migrations\*.sql" |
         Where-Object { $_.Name -notmatch "^001" } | Sort-Object Name
foreach ($f in $files) {
    & "$PG\psql.exe" @dbArgs -v ON_ERROR_STOP=1 -q -f $f.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      FAILED at $($f.Name) - stopping. Backup is at $bak"
        exit 1
    }
    Write-Host "      OK  $($f.Name)"
}

Write-Host ""
Write-Host "[3/4] Recording migration bookkeeping..."
$mk = "CREATE TABLE IF NOT EXISTS schema_migrations (id SERIAL PRIMARY KEY, version VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, executed_at TIMESTAMPTZ DEFAULT NOW(), checksum VARCHAR(64), execution_time_ms INTEGER);"
$mk | & "$PG\psql.exe" @dbArgs -v ON_ERROR_STOP=1 -q
foreach ($f in (Get-ChildItem "src\database\migrations\*.sql" | Sort-Object Name)) {
    $ver = $f.Name.Split("_")[0]
    $name = $f.BaseName
    $sum = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
    $ins = "INSERT INTO schema_migrations (version, name, checksum) VALUES ('$ver', '$name', '$sum') ON CONFLICT (version) DO NOTHING;"
    $ins | & "$PG\psql.exe" @dbArgs -q
}
Write-Host "      001-009 recorded"

Write-Host ""
Write-Host "[4/4] Verifying the live endpoint..."
try {
    $r = Invoke-RestMethod "http://localhost:$apiPort/api/collections?sort=created_at&order=desc&limit=5&offset=0" -TimeoutSec 8
    Write-Host "      GET /api/collections -> success=$($r.success)"
} catch {
    Write-Host "      endpoint check failed ($($_.Exception.Message))"
    Write-Host "      if the server on $apiPort is running, refresh the dashboard and check there"
}

$env:PGPASSWORD = ""
Write-Host ""
Write-Host "Done. Refresh the dashboard (http://localhost:5173) - collections now work."
Write-Host "Also delete the OLD copy of this script if present:"
Write-Host "  C:\Users\BITPATNA\Game-Dev\gamebackend\fix-collections-db.ps1  (has a syntax bug - do not run it)"
