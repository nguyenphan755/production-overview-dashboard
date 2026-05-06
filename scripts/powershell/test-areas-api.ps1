# Test Areas API to verify allMachines field
Write-Host "Testing Areas API..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/areas" -Method Get -TimeoutSec 5
    
    Write-Host "✅ API Response received!" -ForegroundColor Green
    Write-Host ""
    
    foreach ($area in $response.data) {
        Write-Host "Area: $($area.name) ($($area.id))" -ForegroundColor Yellow
        Write-Host "  Total machines: $($area.total)" -ForegroundColor White
        Write-Host "  Running: $($area.running)" -ForegroundColor White
        
        if ($area.allMachines) {
            Write-Host "  ✅ allMachines field exists with $($area.allMachines.Count) machines" -ForegroundColor Green
            Write-Host "  Machines:" -ForegroundColor Cyan
            foreach ($machine in $area.allMachines) {
                Write-Host "    - $($machine.id): $($machine.status) (speed: $($machine.speed))" -ForegroundColor White
            }
        } else {
            Write-Host "  ❌ allMachines field NOT found!" -ForegroundColor Red
            Write-Host "  Only topMachines available: $($area.topMachines.Count) machines" -ForegroundColor Yellow
        }
        Write-Host ""
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure backend is running on http://localhost:3001" -ForegroundColor Yellow
}

