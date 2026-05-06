# Test Login to MES API
# This script tests the login endpoint and shows the response

Write-Host "🔐 Testing MES API Login..." -ForegroundColor Cyan
Write-Host ""

# Check if backend is running first
Write-Host "1. Checking if backend is running..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Backend is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Please start the backend first:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   npm start" -ForegroundColor White
    exit
}

# Try to login
Write-Host "2. Attempting to login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "nodered"
        password = "nodered123"
    } | ConvertTo-Json
    
    Write-Host "   Sending request to: http://localhost:3001/api/auth/login" -ForegroundColor Gray
    Write-Host "   Username: nodered" -ForegroundColor Gray
    Write-Host ""
    
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "   ✅ Login successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Response:" -ForegroundColor Cyan
    Write-Host "   $($login | ConvertTo-Json -Depth 3)" -ForegroundColor White
    Write-Host ""
    
    if ($login.data -and $login.data.token) {
        $token = $login.data.token
        Write-Host "   Token (first 30 chars): $($token.Substring(0, [Math]::Min(30, $token.Length)))..." -ForegroundColor Green
        Write-Host ""
        Write-Host "   ✅ Token received! You can now use it for API calls." -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Warning: No token in response!" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "   ❌ Login failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Error details:" -ForegroundColor Yellow
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "   Response body:" -ForegroundColor Yellow
        Write-Host "   $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Check backend is running on port 3001" -ForegroundColor White
    Write-Host "   - Verify credentials: nodered / nodered123" -ForegroundColor White
    Write-Host "   - Check backend logs for errors" -ForegroundColor White
}

Write-Host ""

