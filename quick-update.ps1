# Quick Update Script - Simple and Fast
# Updates machine by ID (e.g., "D-01") - automatically finds the name

param(
    [Parameter(Mandatory=$false)]
    [string]$MachineId = "D-01",
    
    [Parameter(Mandatory=$false)]
    [int]$LineSpeed = 888,
    
    [Parameter(Mandatory=$false)]
    [double]$Current = 48.5,
    
    [Parameter(Mandatory=$false)]
    [double]$Power = 72.0,
    
    [Parameter(Mandatory=$false)]
    [int]$Temperature = 70
)

# Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
    -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
    -ContentType "application/json"

$token = $login.data.token
Write-Host "✅ Logged in! Token: $token" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Find machine name by ID
$machines = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Headers $headers
$machine = $machines.data | Where-Object { $_.id -eq $MachineId }

if (-not $machine) {
    Write-Host "❌ Machine $MachineId not found!" -ForegroundColor Red
    exit
}

# Update
$updateData = @{
    status = "running"
    lineSpeed = $LineSpeed
    current = $Current
    power = $Power
    temperature = $Temperature
    healthScore = 92
    vibrationLevel = "Normal"
    runtimeHours = 165.0
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/$($machine.name)" `
    -Method PUT -Headers $headers -Body $updateData

Write-Host "✅ Updated $($machine.name) (ID: $MachineId)" -ForegroundColor Green
Write-Host "   Speed: $($result.data.lineSpeed) | Current: $($result.data.current) | Power: $($result.data.power)" -ForegroundColor Cyan

