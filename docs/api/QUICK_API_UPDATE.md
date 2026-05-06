# Quick API Update - Simple Version 🚀

## One-Liner Script

Save this as `quick-update.ps1` and run:
```powershell
.\quick-update.ps1 -MachineId "D-01" -LineSpeed 999
```

---

## Manual Quick Commands

### Step 1: Login & Get Token

```powershell
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
```

### Step 2: Find Machine Name by ID

```powershell
# Get machine name from ID (e.g., "D-01" → "Drawing Line 01")
$machines = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Headers $headers
$machineName = ($machines.data | Where-Object { $_.id -eq "D-01" }).name
```

### Step 3: Update Machine

```powershell
# Update by name
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

Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/$machineName" `
    -Method PUT -Headers $headers -Body $updateData
```

**Result:** Frontend updates INSTANTLY via WebSocket! ⚡

---

## Even Simpler: All-in-One

```powershell
# Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body '{"username":"nodered","password":"nodered123"}' -ContentType "application/json"
$token = $login.data.token
Write-Host "✅ Token: $token" -ForegroundColor Green
$headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}

# Find name
$machineName = (Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Headers $headers).data | Where-Object { $_.id -eq "D-01" } | Select-Object -ExpandProperty name

# Update
Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/$machineName" -Method PUT -Headers $headers -Body (@{status="running";lineSpeed=888;current=48.5;power=72.0;temperature=70;healthScore=92;vibrationLevel="Normal";runtimeHours=165.0} | ConvertTo-Json)
```

---

## Use the Helper Script (Easiest!)

```powershell
# Update D-01 with default values
.\quick-update.ps1

# Update D-01 with custom speed
.\quick-update.ps1 -MachineId "D-01" -LineSpeed 999

# Update S-01
.\quick-update.ps1 -MachineId "S-01" -LineSpeed 700 -Current 40
```

---

## Quick Reference

| Machine ID | Machine Name |
|------------|--------------|
| D-01 | Drawing Line 01 |
| D-02 | Drawing Line 02 |
| S-01 | Stranding Unit 01 |
| A-01 | Armoring Line 01 |
| SH-01 | Sheathing Line 01 |

**Note:** API uses `name` field, but you can use `id` with the helper script!

