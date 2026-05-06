# Fixed Login Script with Timeout and Error Handling
# This version won't hang and shows clear error messages

Write-Host "🔐 Testing MES API Login..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if backend is accessible
Write-Host "Step 1: Checking backend connection..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3001/health" `
        -Method GET `
        -TimeoutSec 5 `
        -ErrorAction Stop
    
    Write-Host "   ✅ Backend is running!" -ForegroundColor Green
    Write-Host "   Status: $($health.StatusCode)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ Backend is NOT accessible!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Please:" -ForegroundColor Yellow
    Write-Host "   1. Start backend: cd backend && npm start" -ForegroundColor White
    Write-Host "   2. Wait for: '🚀 Server running on http://localhost:3001'" -ForegroundColor White
    Write-Host "   3. Try again" -ForegroundColor White
    exit
}

# Step 2: Try to login
Write-Host "Step 2: Attempting login..." -ForegroundColor Yellow
Write-Host "   URL: http://localhost:3001/api/auth/login" -ForegroundColor Gray
Write-Host "   Username: nodered" -ForegroundColor Gray
Write-Host ""

try {
    # Prepare request body
    $body = @{
        username = "nodered"
        password = "nodered123"
    } | ConvertTo-Json
    
    # Make request with timeout
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    Write-Host "   ✅ Login successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Full Response:" -ForegroundColor Cyan
    $login | ConvertTo-Json -Depth 3
    Write-Host ""
    
    if ($login.data -and $login.data.token) {
        $token = $login.data.token
        Write-Host "   Token (first 30 chars): $($token.Substring(0, [Math]::Min(30, $token.Length)))..." -ForegroundColor Green
        Write-Host ""
        Write-Host "   ✅ You can now use this token for API calls!" -ForegroundColor Green
        
        # Store token in global variable for easy access
        $global:mesToken = $token
        Write-Host ""
        Write-Host "   💡 Token saved in `$global:mesToken variable" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  Warning: No token in response!" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "   ❌ Login failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Error Details:" -ForegroundColor Yellow
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
        
        # Try to read error response
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        } catch {
            # Ignore if can't read response
        }
    }
    
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check backend is running: http://localhost:3001/health" -ForegroundColor White
    Write-Host "   2. Check backend logs for errors" -ForegroundColor White
    Write-Host "   3. Verify credentials: nodered / nodered123" -ForegroundColor White
    Write-Host "   4. Check if auth route is working: http://localhost:3001/api/auth/login" -ForegroundColor White
}

Write-Host ""

