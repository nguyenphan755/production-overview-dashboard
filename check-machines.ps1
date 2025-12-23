# Check what machines exist in the database
# This helps you find the correct machine name to update

Write-Host "🔍 Checking machines in database..." -ForegroundColor Cyan
Write-Host ""

try {
    # Get all machines from API
    $machines = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" `
        -Method GET `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    if ($machines.data -and $machines.data.Count -gt 0) {
        Write-Host "✅ Found $($machines.data.Count) machine(s):" -ForegroundColor Green
        Write-Host ""
        
        foreach ($machine in $machines.data) {
            Write-Host "   ID: $($machine.id)" -ForegroundColor Cyan
            Write-Host "   Name: $($machine.name)" -ForegroundColor White
            Write-Host "   Status: $($machine.status)" -ForegroundColor Yellow
            Write-Host "   Area: $($machine.area)" -ForegroundColor Gray
            Write-Host ""
        }
        
        Write-Host "💡 Use the 'name' field (not 'id') for API updates" -ForegroundColor Yellow
        Write-Host "   Example: /api/machines/name/Drawing Line 01" -ForegroundColor Gray
        
    } else {
        Write-Host "⚠️  No machines found in database!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   You need to seed the database first:" -ForegroundColor Yellow
        Write-Host "   cd backend" -ForegroundColor White
        Write-Host "   npm run seed" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get machines!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  - Backend is running on http://localhost:3001" -ForegroundColor White
    Write-Host "  - Database is connected" -ForegroundColor White
}

