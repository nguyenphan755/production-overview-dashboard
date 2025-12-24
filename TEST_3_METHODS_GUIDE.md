# Complete Guide: Test All 3 Methods to Push Data to MES

## Prerequisites

Before starting, ensure:

✅ **Backend is running:**
```powershell
cd backend
npm start
```
Should see: `🚀 Server running on http://localhost:3001`

✅ **Frontend is running:**
```powershell
npm run dev
```
Should see: `Local: http://localhost:5173/`

✅ **Database is connected:**
- Check backend logs for: `✅ Connected to PostgreSQL database`

✅ **Open frontend in browser:**
- Go to: `http://localhost:5173`
- Navigate to **Equipment Status** tab
- Note the current values for machine **D-01**

---

## Method 1: Via SQL (Direct Database) 📊

### Step 1: Connect to PostgreSQL

```powershell
psql -U postgres -d production_dashboard
```

### Step 2: Check Current Values

```sql
SELECT id, name, status, line_speed, current, power, temperature 
FROM machines 
WHERE id = 'D-01';
```

**Note the current values** (you'll compare later)

### Step 3: Update Machine Data

```sql
UPDATE machines 
SET 
    status = 'running',
    line_speed = 999,
    current = 50.0,
    power = 75.0,
    temperature = 75,
    health_score = 95,
    vibration_level = 'Normal',
    runtime_hours = 160.5,
    last_updated = CURRENT_TIMESTAMP,
    last_status_update = CURRENT_TIMESTAMP
WHERE id = 'D-01';
```

**Expected output:**
```
UPDATE 1
```

### Step 4: Verify Update

```sql
SELECT id, name, status, line_speed, current, power, temperature, health_score
FROM machines 
WHERE id = 'D-01';
```

### Step 5: Exit PostgreSQL

```sql
\q
```

### Step 6: Check Frontend

1. **Wait 1-2 seconds** (frontend polls every 1 second)
2. **Refresh** `http://localhost:5173` if needed
3. **Go to Equipment Status tab**
4. **Find machine D-01**
5. **Verify values updated:**
   - Line Speed: **999**
   - Current: **50.0**
   - Power: **75.0**
   - Temperature: **75**

### Step 7: Check Browser Console (F12)

You should see:
```
🔄 Machines changed: ... X machines
```

---

## Method 2: Via REST API (Authenticated) 🔌

### ⚡ Quick Version (Simple & Fast)

**For quick testing, use this simplified version:**

```powershell

# Pass to powershell
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

# Find machine name by ID (e.g., "D-01" → "Drawing Line 01")
$machines = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Headers $headers
$machineName = ($machines.data | Where-Object { $_.id -eq "D-01" }).name

# Update
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

**Or use the helper script:**
```powershell
.\quick-update.ps1 -MachineId "D-01" -LineSpeed 999
```

**Result:** Frontend updates INSTANTLY via WebSocket! ⚡

---

### 📖 Detailed Version (With Error Handling)

### Step 1: Login to Get JWT Token

```powershell
# Login with error handling and timeout
Write-Host "Logging in..." -ForegroundColor Yellow

try {
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST `
        -Body '{"username":"nodered","password":"nodered123"}' `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    # Show response
    Write-Host "Response:" -ForegroundColor Cyan
    $login | ConvertTo-Json
    
    # Extract token
    $token = $login.data.token
    Write-Host "✅ Logged in! Token: $($token.Substring(0,20))..." -ForegroundColor Green
    
} catch {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check backend is running: http://localhost:3001/health" -ForegroundColor White
    Write-Host "2. Check backend logs for errors" -ForegroundColor White
    Write-Host "3. Verify credentials: nodered / nodered123" -ForegroundColor White
}
```

**Expected output:**
```
Logging in...
Response:
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "nodered",
    "role": "system"
  },
  "success": true,
  "timestamp": "2025-01-21T10:00:00.000Z"
}
✅ Logged in! Token: eyJhbGciOiJIUzI1NiIs...
```

### Step 2: Set Headers

```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
```

### Step 3: Check Available Machines (IMPORTANT!)

**First, check what machines exist in your database:**

```powershell
# Get all machines
$machines = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Method GET

# Show machine names
$machines.data | ForEach-Object {
    Write-Host "ID: $($_.id) | Name: $($_.name)" -ForegroundColor Cyan
}
```

**Or run the helper script:**
```powershell
.\check-machines.ps1
```

**Note:** Use the exact `name` field (not `id`) for the API endpoint!

### Step 4: Update Machine via API (by Name)

```powershell
# Prepare update data
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

# Update machine by name (use the EXACT name from Step 3)
# Example: If machine name is "Drawing Line 01", use that exactly
$machineName = "Drawing Line 01"  # Change this to match your machine name!

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/$machineName" `
        -Method PUT `
        -Headers $headers `
        -Body $updateData `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    Write-Host "✅ Machine updated!" -ForegroundColor Green
    Write-Host "   Machine: $($result.data.name)" -ForegroundColor Cyan
    Write-Host "   Status: $($result.data.status)" -ForegroundColor Cyan
    Write-Host "   Line Speed: $($result.data.lineSpeed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Update failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*not found*") {
        Write-Host ""
        Write-Host "💡 Machine name not found! Run Step 3 to see available machines." -ForegroundColor Yellow
        Write-Host "   Use the exact name from the list." -ForegroundColor Yellow
    }
}
```

**Common machine names:**
- `Drawing Line 01` (ID: D-01) ← Use "Drawing Line 01" in API
- `Drawing Line 02` (ID: D-02) ← Use "Drawing Line 02" in API
- `Stranding Line 01` (ID: S-01) ← Use "Stranding Line 01" in API
- `Armoring Line 01` (ID: A-01) ← Use "Armoring Line 01" in API
- `Sheathing Line 01` (ID: SH-01) ← Use "Sheathing Line 01" in API

**Important:** The API uses the `name` field, not the `id` field!

**Quick fix for your command:**
```powershell
# Instead of: /api/machines/name/D-01
# Use: /api/machines/name/Drawing Line 01

# URL encode spaces if needed, or use the helper script:
.\update-machine-correct.ps1
```

**Expected output:**
```
✅ Machine updated!
   Machine: Drawing Line 01
   Status: running
   Line Speed: 888
```

### Step 4: Check Backend Logs

You should see:
```
✅ Machine D-01 updated via API by nodered
📡 Broadcasted machine:update to X client(s)
```

### Step 5: Check Frontend

1. **Frontend should update INSTANTLY** (via WebSocket)
2. **No refresh needed!**
3. **Check Equipment Status tab**
4. **Machine D-01 should show:**
   - Line Speed: **888**
   - Current: **48.5**
   - Power: **72.0**
   - Temperature: **70**

### Step 6: Check Browser Console (F12)

You should see:
```
✅ WebSocket connected
```

And when update happens:
```
🔄 Machines changed: ...
```

---

## Method 3: Via Node-RED (Industrial Simulation) 🏭

### ⚡ Simple Version (Matches Your Example Style)

**Import this flow:** `backend/node-red-mes-flow-simple.json`

This flow:
- Logs in automatically to get JWT token
- Generates random machine data (like your example)
- Updates machine D-01 every 5 seconds
- Matches your example code style

**See:** `NODE_RED_SIMPLE_SETUP.md` for detailed setup instructions.

---

### Step 1: Install Node-RED (if not installed)

```powershell
npm install -g node-red
```

### Step 2: Start Node-RED

```powershell
node-red
```

**Expected output:**
```
Welcome to Node-RED
===================
...
Server now running at http://127.0.0.1:1880/
```

### Step 3: Open Node-RED Editor

1. **Open browser:** `http://localhost:1880`
2. **You should see Node-RED flow editor**

### Step 4: Import MES Flow

1. **Click menu** (☰) → **Import**
2. **Click "select a file to import"**
3. **Navigate to:** `backend/node-red-mes-flow.json`
4. **Click "Import"**
5. **Click "Deploy"** (top right)

### Step 5: Verify Flow

You should see a flow with these nodes:
- **Inject** (Every 5s)
- **Generate Machine Data** (Function)
- **Login to MES** (HTTP Request)
- **Extract Token** (Function)
- **Prepare API Request** (Function)
- **Update Machine via API** (HTTP Request)
- **Handle Response** (Function)

### Step 6: Check Node Status

- **"Login to MES"** node should show: `Logged in` (green dot)
- **"Update Machine via API"** node should show: `Updated D-01` (green dot)

### Step 7: Watch Frontend Update

1. **Open frontend:** `http://localhost:5173`
2. **Go to Equipment Status tab**
3. **Watch machine D-01 update every 5 seconds!**
4. **Values will change automatically:**
   - Line Speed: Random variations
   - Current: Random variations
   - Power: Random variations
   - Temperature: Random variations

### Step 8: Check Backend Logs

You should see continuous updates:
```
✅ Machine D-01 updated via API by nodered
📡 Broadcasted machine:update to X client(s)
✅ Machine D-02 updated via API by nodered
📡 Broadcasted machine:update to X client(s)
...
```

### Step 9: Stop Node-RED (when done testing)

Press `Ctrl+C` in the Node-RED terminal

---

## Quick Test Script (PowerShell)

Save as `test-all-3-methods.ps1`:

```powershell
Write-Host "🧪 Testing All 3 Methods to Update MES Data" -ForegroundColor Cyan
Write-Host ""

# Method 1: SQL
Write-Host "1️⃣  Method 1: SQL (Direct Database)" -ForegroundColor Yellow
Write-Host "   Run in psql:" -ForegroundColor White
Write-Host "   psql -U postgres -d production_dashboard" -ForegroundColor Gray
Write-Host "   UPDATE machines SET line_speed = 777 WHERE id = 'D-01';" -ForegroundColor Gray
Write-Host ""

# Method 2: API
Write-Host "2️⃣  Method 2: REST API (Authenticated)" -ForegroundColor Yellow
Write-Host "   Testing..." -ForegroundColor White

try {
    # Login
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
        -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
        -ContentType "application/json"
    
    $token = $login.data.token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    # Update
    $updateData = @{
        lineSpeed = 888
        current = 49.0
        power = 72.5
        temperature = 71
        healthScore = 90
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/D-01" `
        -Method PUT -Headers $headers -Body $updateData
    
    Write-Host "   ✅ API Update successful!" -ForegroundColor Green
    Write-Host "   Machine: $($result.data.name)" -ForegroundColor Cyan
    Write-Host "   Line Speed: $($result.data.lineSpeed)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ API Update failed: $_" -ForegroundColor Red
}
Write-Host ""

# Method 3: Node-RED
Write-Host "3️⃣  Method 3: Node-RED (Real-Time Simulation)" -ForegroundColor Yellow
Write-Host "   Setup:" -ForegroundColor White
Write-Host "   1. Start Node-RED: node-red" -ForegroundColor Gray
Write-Host "   2. Open: http://localhost:1880" -ForegroundColor Gray
Write-Host "   3. Import: backend/node-red-mes-flow.json" -ForegroundColor Gray
Write-Host "   4. Deploy and watch frontend update every 5s" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Check frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Equipment Status tab → Machine D-01" -ForegroundColor White
```

**Run:**
```powershell
.\test-all-3-methods.ps1
```

---

## Comparison: What to Expect

| Method | Update Speed | Requires | Best For |
|--------|--------------|----------|----------|
| **SQL** | ~1 second | PostgreSQL access | Quick testing, manual updates |
| **API** | **Instant** (WebSocket) | Backend running, JWT token | Integration, automation |
| **Node-RED** | **Every 5 seconds** | Node-RED installed | Real-time simulation, PLC data |

---

## Troubleshooting

### Method 1 (SQL) - Changes not appearing?

- ✅ Wait 1-2 seconds (polling interval)
- ✅ Check frontend is running
- ✅ Verify database name: `production_dashboard`
- ✅ Check browser console (F12) for errors

### Method 2 (API) - 401 Unauthorized?

- ✅ Check credentials: `nodered` / `nodered123`
- ✅ Token might be expired - login again
- ✅ Check backend is running

### Method 2 (API) - 404 Not Found?

- ✅ Check machine name: `D-01` (case-sensitive)
- ✅ Verify machine exists in database

### Method 3 (Node-RED) - Not updating?

- ✅ Check Node-RED is running
- ✅ Check flow is deployed (Deploy button)
- ✅ Check node status (green dots)
- ✅ Check backend logs for API calls
- ✅ Verify credentials in flow

### WebSocket not connecting?

- ✅ Check backend WebSocket server is running
- ✅ Check browser console (F12) for WebSocket errors
- ✅ Verify `VITE_USE_MOCK_DATA=false` in frontend `.env`

---

## Summary

✅ **Method 1 (SQL):** Quick and easy for testing  
✅ **Method 2 (API):** Instant updates via WebSocket  
✅ **Method 3 (Node-RED):** Continuous real-time simulation  

**All 3 methods work together!** You can use any combination depending on your needs.

---

## Next Steps

1. ✅ Test Method 1 (SQL) - Quick database update
2. ✅ Test Method 2 (API) - Instant WebSocket update
3. ✅ Set up Method 3 (Node-RED) - Continuous simulation
4. ✅ Monitor frontend - Watch all updates in real-time

**Happy testing!** 🎯

