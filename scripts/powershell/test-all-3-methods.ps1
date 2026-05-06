# Test All 3 Methods to Update MES Data
# Run this script to test Method 2 (API) and get instructions for Methods 1 & 3

Write-Host "🧪 Testing All 3 Methods to Update MES Data" -ForegroundColor Cyan
Write-Host ""

# Method 1: SQL
Write-Host "1️⃣  Method 1: SQL (Direct Database)" -ForegroundColor Yellow
Write-Host "   To test, run in psql:" -ForegroundColor White
Write-Host "   psql -U postgres -d production_dashboard" -ForegroundColor Gray
Write-Host "   UPDATE machines SET line_speed = 777, last_updated = CURRENT_TIMESTAMP WHERE id = 'D-01';" -ForegroundColor Gray
Write-Host "   Then check frontend at http://localhost:5173 (wait 1-2 seconds)" -ForegroundColor Gray
Write-Host ""

# Method 2: REST API (Authenticated)
Write-Host "2️⃣  Method 2: REST API (Authenticated)" -ForegroundColor Yellow
Write-Host "   Testing API update..." -ForegroundColor White

try {
    # Login to get JWT token
    Write-Host "   Logging in..." -ForegroundColor Gray
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
        -ContentType "application/json"
    
    $token = $login.data.token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    Write-Host "   ✅ Logged in successfully!" -ForegroundColor Green
    
    # Prepare update data
    $updateData = @{
        status = "running"
        lineSpeed = 888
        current = 49.0
        power = 72.5
        temperature = 71
        healthScore = 90
        vibrationLevel = "Normal"
        runtimeHours = 165.0
    } | ConvertTo-Json
    
    # Update machine D-01 by name
    Write-Host "   Updating machine D-01 via API..." -ForegroundColor Gray
    $result = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/D-01" `
        -Method PUT -Headers $headers -Body $updateData
    
    Write-Host "   ✅ API Update successful!" -ForegroundColor Green
    Write-Host "   Machine: $($result.data.name)" -ForegroundColor Cyan
    Write-Host "   Status: $($result.data.status)" -ForegroundColor Cyan
    Write-Host "   Line Speed: $($result.data.lineSpeed)" -ForegroundColor Cyan
    Write-Host "   Current: $($result.data.current)" -ForegroundColor Cyan
    Write-Host "   Power: $($result.data.power)" -ForegroundColor Cyan
    Write-Host "   Temperature: $($result.data.temperature)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   📊 Check frontend at http://localhost:5173" -ForegroundColor Yellow
    Write-Host "      Frontend should update INSTANTLY via WebSocket!" -ForegroundColor Yellow
    
} catch {
    Write-Host "   ❌ API Update failed!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Make sure backend is running on http://localhost:3001" -ForegroundColor White
    Write-Host "   - Check backend logs for errors" -ForegroundColor White
    Write-Host "   - Verify credentials: nodered / nodered123" -ForegroundColor White
}
Write-Host ""

# Method 3: Node-RED
Write-Host "3️⃣  Method 3: Node-RED (Real-Time Industrial Simulation)" -ForegroundColor Yellow
Write-Host "   To set up:" -ForegroundColor White
Write-Host "   1. Install Node-RED: npm install -g node-red" -ForegroundColor Gray
Write-Host "   2. Start Node-RED: node-red" -ForegroundColor Gray
Write-Host "   3. Open http://localhost:1880 in browser" -ForegroundColor Gray
Write-Host "   4. Import flow: backend/node-red-mes-flow.json" -ForegroundColor Gray
Write-Host "   5. Click Deploy" -ForegroundColor Gray
Write-Host "   6. Watch frontend update every 5 seconds automatically!" -ForegroundColor Gray
Write-Host ""
Write-Host "   See TEST_3_METHODS_GUIDE.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   - Method 1 (SQL): Manual database update" -ForegroundColor White
Write-Host "   - Method 2 (API): Instant WebSocket update ✅ Tested" -ForegroundColor White
Write-Host "   - Method 3 (Node-RED): Continuous real-time simulation" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Check frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   → Equipment Status tab → Machine D-01" -ForegroundColor White

