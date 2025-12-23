# Corrected Machine Update Script
# Uses the correct machine NAME (not ID)

Write-Host "🔧 Updating Machine via API..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "Step 1: Logging in..." -ForegroundColor Yellow
try {
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST `
        -Body '{"username":"nodered","password":"nodered123"}' `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $token = $login.data.token
    Write-Host "   ✅ Logged in!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "   ❌ Login failed: $_" -ForegroundColor Red
    exit
}

# Step 2: Set headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 3: Update machine
# IMPORTANT: Use the machine NAME, not ID!
# Machine ID: D-01
# Machine NAME: "Drawing Line 01" ← Use this!

Write-Host "Step 2: Updating machine..." -ForegroundColor Yellow
Write-Host "   Using machine NAME: 'Drawing Line 01'" -ForegroundColor Gray
Write-Host ""

$updateData = @{
    status = "running"
    lineSpeed = 888
    current = 48.5
    power = 72.0
    temperature = 70
    healthScore = 92
    vibrationLevel = "Normal"
    runtimeHours = 165.0
} | ConvertTo-Json

try {
    # Use the exact machine NAME (URL encoded)
    $machineName = "Drawing Line 01"
    $encodedName = [System.Web.HttpUtility]::UrlEncode($machineName)
    
    $result = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/$encodedName" `
        -Method PUT `
        -Headers $headers `
        -Body $updateData `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    Write-Host "   ✅ Machine updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Updated Machine:" -ForegroundColor Cyan
    Write-Host "   Name: $($result.data.name)" -ForegroundColor White
    Write-Host "   Status: $($result.data.status)" -ForegroundColor White
    Write-Host "   Line Speed: $($result.data.lineSpeed)" -ForegroundColor White
    Write-Host "   Current: $($result.data.current)" -ForegroundColor White
    Write-Host "   Power: $($result.data.power)" -ForegroundColor White
    Write-Host "   Temperature: $($result.data.temperature)" -ForegroundColor White
    Write-Host ""
    Write-Host "   📊 Check frontend: http://localhost:5173" -ForegroundColor Yellow
    Write-Host "      Should update INSTANTLY via WebSocket!" -ForegroundColor Yellow
    
} catch {
    Write-Host "   ❌ Update failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*not found*") {
        Write-Host ""
        Write-Host "   💡 Tip: Run .\check-machines.ps1 to see available machine names" -ForegroundColor Yellow
    }
}

Write-Host ""

