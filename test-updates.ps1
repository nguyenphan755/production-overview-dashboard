# Test All 3 Methods to Update Machine Data
# Run this script to test Method 2 (API)

Write-Host "🧪 Testing Data Update Methods..." -ForegroundColor Cyan
Write-Host ""

# Method 1: SQL (manual instruction)
Write-Host "1️⃣  Method 1: SQL (Direct Database)" -ForegroundColor Yellow
Write-Host "   To test, run in psql:" -ForegroundColor White
Write-Host "   psql -U postgres -d production_dashboard" -ForegroundColor Gray
Write-Host "   UPDATE machines SET line_speed = 777, last_updated = CURRENT_TIMESTAMP WHERE id = 'D-01';" -ForegroundColor Gray
Write-Host "   Then check frontend at http://localhost:5173 (wait 3 seconds)" -ForegroundColor Gray
Write-Host ""

# Method 2: REST API
Write-Host "2️⃣  Method 2: REST API" -ForegroundColor Yellow
Write-Host "   Testing API update..." -ForegroundColor White

$body = @{
    lineSpeed = 888
    current = 49.0
    power = 72.5
    temperature = 71
} | ConvertTo-Json

try {
    Write-Host "   Sending PATCH request to http://localhost:3001/api/machines/D-01..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/D-01" `
        -Method PATCH `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "   ✅ API Update successful!" -ForegroundColor Green
    Write-Host "   Updated machine: $($response.data.id)" -ForegroundColor Green
    Write-Host "   New line_speed: $($response.data.lineSpeed)" -ForegroundColor Green
    Write-Host "   Check frontend at http://localhost:5173 (wait 3 seconds)" -ForegroundColor Yellow
} catch {
    Write-Host "   ❌ API Update failed!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host "   Make sure backend is running on http://localhost:3001" -ForegroundColor Yellow
}
Write-Host ""

# Method 3: Node-RED (setup instructions)
Write-Host "3️⃣  Method 3: Node-RED (Real-Time Simulation)" -ForegroundColor Yellow
Write-Host "   To set up:" -ForegroundColor White
Write-Host "   1. Install Node-RED: npm install -g node-red" -ForegroundColor Gray
Write-Host "   2. Start Node-RED: node-red" -ForegroundColor Gray
Write-Host "   3. Open http://localhost:1880" -ForegroundColor Gray
Write-Host "   4. Install node-red-node-postgresql" -ForegroundColor Gray
Write-Host "   5. Create flow as described in DATA_UPDATE_GUIDE.md" -ForegroundColor Gray
Write-Host "   6. Deploy and watch frontend update automatically" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Check frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   - Go to Equipment Status tab" -ForegroundColor White
Write-Host "   - Find machine D-01" -ForegroundColor White
Write-Host "   - Should show updated values" -ForegroundColor White
Write-Host ""

