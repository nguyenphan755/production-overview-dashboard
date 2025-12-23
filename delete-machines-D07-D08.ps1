# PowerShell Script: Delete Machines D-07 and D-08
# This script helps you safely delete machines from PostgreSQL

Write-Host "`n🗑️  Deleting Machines D-07 and D-08" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check if backend/.env exists
if (-not (Test-Path "backend\.env")) {
    Write-Host "❌ Error: backend/.env file not found!" -ForegroundColor Red
    Write-Host "   Please configure database connection first." -ForegroundColor Yellow
    exit 1
}

# Load environment variables
$envContent = Get-Content "backend\.env" | Where-Object { $_ -match "^DB_" }
$dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
$dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
$dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
$dbPort = ($envContent | Where-Object { $_ -match "^DB_PORT=" }) -replace "DB_PORT=", ""

if ([string]::IsNullOrEmpty($dbName)) {
    $dbName = "production_dashboard"
}

Write-Host "`n📊 Database: $dbName" -ForegroundColor Gray
Write-Host "👤 User: $dbUser" -ForegroundColor Gray
Write-Host "🖥️  Host: $dbHost" -ForegroundColor Gray

Write-Host "`n⚠️  WARNING: This will permanently delete:" -ForegroundColor Yellow
Write-Host "   - Machines D-07 and D-08" -ForegroundColor Yellow
Write-Host "   - All alarms for these machines" -ForegroundColor Yellow
Write-Host "   - All metrics data for these machines" -ForegroundColor Yellow
Write-Host "   - All energy consumption records" -ForegroundColor Yellow
Write-Host "   - All production orders for these machines" -ForegroundColor Yellow

$confirm = Read-Host "`nAre you sure you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "`n❌ Deletion cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n📝 Running deletion script..." -ForegroundColor Cyan
Write-Host "   Using SQL file: delete-machines-D07-D08.sql" -ForegroundColor Gray

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "`n❌ Error: psql command not found!" -ForegroundColor Red
    Write-Host "   Please install PostgreSQL client tools or use pgAdmin." -ForegroundColor Yellow
    Write-Host "`n   Alternative: Open delete-machines-D07-D08.sql in pgAdmin Query Tool" -ForegroundColor Cyan
    exit 1
}

# Build psql command
$psqlCmd = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f delete-machines-D07-D08.sql"

Write-Host "`n🔐 You will be prompted for PostgreSQL password..." -ForegroundColor Yellow
Write-Host "`nExecuting: $psqlCmd" -ForegroundColor Gray
Write-Host ""

# Execute psql command
Invoke-Expression $psqlCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Script executed successfully!" -ForegroundColor Green
    Write-Host "   Review the output above and run COMMIT; or ROLLBACK; in psql" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Error executing script. Check the output above." -ForegroundColor Red
}

Write-Host ""

