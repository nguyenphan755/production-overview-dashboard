# Quick Login Script - Shows output
# Run this to test login and see the response

Write-Host "🔐 Logging in to MES API..." -ForegroundColor Cyan
Write-Host ""

try {
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
        -ContentType "application/json"
    
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $login | ConvertTo-Json -Depth 3
    Write-Host ""
    
    $token = $login.data.token
    Write-Host "Token (first 30 chars): $($token.Substring(0, [Math]::Min(30, $token.Length)))..." -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ You can now use this token for API calls!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  - Backend is running on http://localhost:3001" -ForegroundColor White
    Write-Host "  - Credentials are correct: nodered / nodered123" -ForegroundColor White
}

