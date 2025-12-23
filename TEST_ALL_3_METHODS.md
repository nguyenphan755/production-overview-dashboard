# Test All 3 Methods - Step by Step Guide

This guide helps you test all 3 methods to update machine data as described in `DATA_UPDATE_GUIDE.md`.

---

## Prerequisites

✅ Backend running on http://localhost:3001  
✅ Frontend running on http://localhost:5173  
✅ PostgreSQL database connected  
✅ Sample data seeded  

---

## Method 1: Via SQL (Direct Database) ✅

### Test SQL Update

1. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres -d production_dashboard
   ```

2. **Update a machine:**
   ```sql
   UPDATE machines 
   SET line_speed = 999,
       current = 50.0,
       power = 75.0,
       temperature = 75,
       last_updated = CURRENT_TIMESTAMP
   WHERE id = 'D-01';
   ```

3. **Wait 3 seconds** (frontend polls every 3 seconds)

4. **Check frontend:**
   - Open http://localhost:5173
   - Go to Equipment Status tab
   - Find D-01 machine
   - Should show: `line_speed = 999`, `current = 50.0`, etc.

5. **Verify in browser console (F12):**
   - Should see: `🔄 Machines updated: ... X machines`
   - Should see: `✅ API Success: /machines`

---

## Method 2: Via REST API (Programmatic) ✅

### Test API Update

1. **Update machine via API (PowerShell):**
   ```powershell
   $body = @{
       lineSpeed = 888
       current = 48.5
       power = 72.0
       temperature = 70
   } | ConvertTo-Json

   Invoke-RestMethod -Uri "http://localhost:3001/api/machines/D-01" `
       -Method PATCH `
       -ContentType "application/json" `
       -Body $body
   ```

2. **Or using curl (if available):**
   ```bash
   curl -X PATCH http://localhost:3001/api/machines/D-01 \
     -H "Content-Type: application/json" \
     -d "{\"lineSpeed\": 888, \"current\": 48.5, \"power\": 72.0, \"temperature\": 70}"
   ```

3. **Wait 3 seconds**

4. **Check frontend:**
   - Should see updated values for D-01

5. **Test insert metric:**
   ```powershell
   $body = @{
       metricType = "speed"
       value = 900
       targetValue = 1000
   } | ConvertTo-Json

   Invoke-RestMethod -Uri "http://localhost:3001/api/machines/D-01/metrics" `
       -Method POST `
       -ContentType "application/json" `
       -Body $body
   ```

6. **Test create alarm:**
   ```powershell
   $body = @{
       severity = "warning"
       message = "Test alarm from API"
   } | ConvertTo-Json

   Invoke-RestMethod -Uri "http://localhost:3001/api/machines/D-01/alarms" `
       -Method POST `
       -ContentType "application/json" `
       -Body $body
   ```

---

## Method 3: Via Node-RED (Real-Time Simulation) 🔄

### Setup Node-RED

1. **Install Node-RED** (if not installed):
   ```bash
   npm install -g node-red
   ```

2. **Start Node-RED:**
   ```bash
   node-red
   ```
   - Opens at: http://localhost:1880

3. **Install PostgreSQL Node:**
   - In Node-RED: Menu → Manage Palette → Install
   - Search: `node-red-node-postgresql`
   - Click Install

4. **Create PostgreSQL Connection:**
   - Drag **PostgreSQL** node to flow
   - Double-click to configure:
     - **Server:** `localhost`
     - **Port:** `5432`
     - **Database:** `production_dashboard`
     - **User:** `postgres`
     - **Password:** `root`
   - Click **Add**

5. **Create Update Flow:**
   - Drag **Inject** node
     - Name: "Every 5s"
     - Repeat: `5` seconds
   - Drag **Function** node
     - Name: "Generate Data"
     - Code: (see below)
   - Drag **PostgreSQL** node
     - Name: "Update Machine"
     - Query: (see below)
   - Connect: Inject → Function → PostgreSQL
   - Click **Deploy**

### Function Node Code:

```javascript
// Simulate real-time machine data
const machines = ['D-01', 'D-02', 'D-03', 'S-01', 'S-02', 'SH-01', 'SH-02'];
const machineId = machines[Math.floor(Math.random() * machines.length)];

// Base values for each machine
const baseValues = {
  'D-01': { speed: 920, current: 45.2, power: 68.5, temp: 68 },
  'D-02': { speed: 875, current: 43.8, power: 65.2, temp: 72 },
  'D-03': { speed: 885, current: 44.1, power: 66.8, temp: 70 },
  'S-01': { speed: 650, current: 38.5, power: 52.3, temp: 65 },
  'S-02': { speed: 680, current: 40.2, power: 54.8, temp: 68 },
  'SH-01': { speed: 450, current: 52.3, power: 78.5, temp: 70 },
  'SH-02': { speed: 425, current: 50.8, power: 76.2, temp: 68 },
};

const base = baseValues[machineId] || { speed: 800, current: 40, power: 60, temp: 65 };

// Generate realistic variations (±5%)
msg.payload = {
  machineId: machineId,
  lineSpeed: Math.max(0, Math.round(base.speed + (Math.random() - 0.5) * base.speed * 0.05)),
  current: parseFloat((base.current + (Math.random() - 0.5) * 2).toFixed(1)),
  power: parseFloat((base.power + (Math.random() - 0.5) * 3).toFixed(1)),
  temperature: Math.round(base.temp + (Math.random() - 0.5) * 3),
  producedLength: Math.floor(Math.random() * 50) + 3800, // Increment
};

return msg;
```

### PostgreSQL Query:

```sql
UPDATE machines SET
  line_speed = $1,
  current = $2,
  power = $3,
  temperature = $4,
  produced_length = $5,
  last_updated = CURRENT_TIMESTAMP
WHERE id = $6
```

### Parameters:

```
["payload.lineSpeed", "payload.current", "payload.power", "payload.temperature", "payload.producedLength", "payload.machineId"]
```

6. **Deploy and Watch:**
   - Click **Deploy** button
   - Watch frontend update every 5 seconds
   - Check backend terminal for query logs

---

## Quick Test Script

### Test All Methods at Once

Create `test-updates.ps1`:

```powershell
Write-Host "🧪 Testing All 3 Methods..." -ForegroundColor Cyan

# Method 1: SQL (manual - run in psql)
Write-Host "`n1️⃣  Method 1: SQL" -ForegroundColor Yellow
Write-Host "   Run in psql:"
Write-Host "   UPDATE machines SET line_speed = 777 WHERE id = 'D-01';"

# Method 2: API
Write-Host "`n2️⃣  Method 2: REST API" -ForegroundColor Yellow
$body = @{
    lineSpeed = 888
    current = 49.0
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/machines/D-01" `
        -Method PATCH `
        -ContentType "application/json" `
        -Body $body
    Write-Host "   ✅ API Update successful!" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "   ❌ API Update failed: $_" -ForegroundColor Red
}

# Method 3: Node-RED (manual setup)
Write-Host "`n3️⃣  Method 3: Node-RED" -ForegroundColor Yellow
Write-Host "   Setup Node-RED flow as described above"
Write-Host "   Deploy and watch frontend update automatically"

Write-Host "`n✅ Check frontend at http://localhost:5173" -ForegroundColor Green
Write-Host "   Wait 3-5 seconds for updates to appear" -ForegroundColor Yellow
```

Run it:
```powershell
.\test-updates.ps1
```

---

## Verification Checklist

After testing each method:

- [ ] **Method 1 (SQL):** Data appears in frontend within 3 seconds
- [ ] **Method 2 (API):** API returns success, data appears in frontend
- [ ] **Method 3 (Node-RED):** Continuous updates every 5 seconds

---

## Expected Results

### Method 1 (SQL):
- ✅ Immediate database update
- ✅ Frontend shows changes within 3 seconds
- ✅ Browser console shows polling updates

### Method 2 (API):
- ✅ API returns `{"success": true, "data": {...}}`
- ✅ Frontend shows changes within 3 seconds
- ✅ Can update multiple fields at once

### Method 3 (Node-RED):
- ✅ Continuous updates every 5 seconds
- ✅ Values change automatically
- ✅ Simulates real-time industrial data

---

## Troubleshooting

### Method 1 (SQL) Not Working:
- Check PostgreSQL connection
- Verify `last_updated` is being set
- Check frontend polling (browser console)

### Method 2 (API) Not Working:
- Check backend is running: http://localhost:3001/health
- Verify API endpoint: http://localhost:3001/api/machines/D-01
- Check request format (JSON)

### Method 3 (Node-RED) Not Working:
- Check Node-RED is running: http://localhost:1880
- Verify PostgreSQL node connection
- Check flow is deployed
- Verify query parameters match payload

---

## Next Steps

1. ✅ **Test Method 1** - SQL updates
2. ✅ **Test Method 2** - API updates  
3. ✅ **Set up Method 3** - Node-RED for continuous simulation
4. ✅ **Monitor all methods** - Watch frontend update in real-time

All three methods are now ready to use! 🎉

