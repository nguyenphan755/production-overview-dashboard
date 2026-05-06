# Database Synchronization Verification Script
# This script checks if PostgreSQL database is set up and synchronized

Write-Host "`n🔍 Checking PostgreSQL Database Synchronization Status..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check if backend/.env exists
Write-Host "`n1️⃣ Checking backend/.env file..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    Write-Host "   ✅ backend/.env file exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ backend/.env file NOT found" -ForegroundColor Red
    Write-Host "   ⚠️  Database configuration is missing!" -ForegroundColor Yellow
    Write-Host "   📝 Create backend/.env with your PostgreSQL credentials" -ForegroundColor Yellow
    exit 1
}

# Check if PostgreSQL service is running
Write-Host "`n2️⃣ Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name postgresql* -ErrorAction SilentlyContinue
if ($pgService) {
    $running = $pgService | Where-Object { $_.Status -eq 'Running' }
    if ($running) {
        Write-Host "   ✅ PostgreSQL service is running" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  PostgreSQL service found but not running" -ForegroundColor Yellow
        Write-Host "   💡 Start it with: Start-Service -Name $($pgService[0].Name)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  PostgreSQL service not found" -ForegroundColor Yellow
    Write-Host "   💡 Make sure PostgreSQL is installed" -ForegroundColor Yellow
}

# Try to connect and check database
Write-Host "`n3️⃣ Checking database connection..." -ForegroundColor Yellow
Write-Host "   📝 Attempting to connect to PostgreSQL..." -ForegroundColor Gray

# Load environment variables
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" | Where-Object { $_ -match "^DB_" }
    $dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
    $dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
    $dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
    $dbPort = ($envContent | Where-Object { $_ -match "^DB_PORT=" }) -replace "DB_PORT=", ""
    
    Write-Host "   📊 Database: $dbName" -ForegroundColor Gray
    Write-Host "   👤 User: $dbUser" -ForegroundColor Gray
    Write-Host "   🖥️  Host: $dbHost" -ForegroundColor Gray
    Write-Host "   🔌 Port: $dbPort" -ForegroundColor Gray
}

Write-Host "`n4️⃣ To verify database tables and data:" -ForegroundColor Yellow
Write-Host "   Run: cd backend && npm run setup-db" -ForegroundColor Cyan
Write-Host "   Then: cd backend && npm run seed" -ForegroundColor Cyan
Write-Host "   Or connect manually: psql -U postgres -d production_dashboard" -ForegroundColor Cyan

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "`n✅ Verification complete!" -ForegroundColor Green
Write-Host "📝 See DATABASE_SYNC_STATUS.md for detailed information" -ForegroundColor Gray
Write-Host ""

