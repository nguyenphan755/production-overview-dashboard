# Node-RED Simple Setup - Method 3

## Quick Setup Guide

This guide shows you how to set up Node-RED to send data to MES API, matching your example style.

---

## Step 1: Import Flow

1. **Open Node-RED:** `http://localhost:1880`
2. **Click Menu (☰) → Import**
3. **Select file:** `backend/node-red-mes-flow-simple.json`
4. **Click "Import"**
5. **Click "Deploy"** (top right)

---

## Flow Structure

The flow has 2 paths:

### Path 1: Initial Login + Update (Runs Once)
```
[Trigger Update] → [Login to Get Token] → [Login API] → [Generate Random Data] → [Call API Update] → [API Response]
```

### Path 2: Continuous Updates (Every 5 seconds)
```
[Every 5s] → [Generate Data (Reuse Token)] → [Call API Update] → [API Response]
```

---

## How It Works

1. **First Trigger:** Logs in to get JWT token, then updates machine
2. **Every 5 seconds:** Reuses the token to update machine with random data

---

## Configuration

### Change Update Interval

Edit the **"Every 5s"** inject node:
- Change `repeat` from `5` to any number (seconds)

### Change Machine

Edit the **"Generate Random D-01 Data"** function:
- Change URL: `msg.url = "http://localhost:3001/api/machines/name/Drawing Line 01";`
- For other machines, use their exact name:
  - D-02 → "Drawing Line 02"
  - S-01 → "Stranding Unit 01"
  - A-01 → "Armoring Line 01"
  - SH-01 → "Sheathing Line 01"

### Change Random Data Range

Edit the function node to adjust ranges:

```javascript
// Current ranges:
lineSpeed: randomInt(800, 1000),      // 800-1000
current: randomFloat(40, 50),         // 40.00-50.00
power: randomFloat(60, 80),           // 60.00-80.00
temperature: randomFloat(65, 75),     // 65.00-75.00
healthScore: randomInt(85, 100),      // 85-100
runtimeHours: randomFloat(150, 200)   // 150.00-200.00
```

---

## Test the Flow

1. **Deploy the flow**
2. **Click "Trigger Update"** (runs once, logs in)
3. **Wait 5 seconds** - should auto-update
4. **Check frontend:** `http://localhost:5173`
   - Go to Equipment Status tab
   - Find "Drawing Line 01" (D-01)
   - Watch it update every 5 seconds!

---

## Debug

### Check Node Status

- **Green dot** = Success
- **Yellow dot** = Warning
- **Red dot** = Error

### Check Debug Output

- Click **"API Response"** debug node
- Check sidebar for full API response
- Should see: `{"success": true, "data": {...}}`

### Common Issues

**Token expired:**
- Click "Trigger Update" again to get new token

**Machine not found:**
- Check machine name is correct (use exact name from database)
- Run: `.\check-machines.ps1` to see available machines

**Connection refused:**
- Make sure backend is running on `http://localhost:3001`
- Check URL in function node

---

## Alternative: Use Hardcoded Token (Like Your Example)

If you want to use a hardcoded token (like your example), modify the function:

```javascript
// Instead of login, use hardcoded token
msg.headers = {
    "Authorization": "Bearer YOUR_TOKEN_HERE",
    "Content-Type": "application/json"
};

// Skip login nodes, go directly to generate data
```

**To get a token:**
```powershell
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body '{"username":"nodered","password":"nodered123"}' -ContentType "application/json"
$login.data.token
```

Copy the token and paste it in the function node.

---

## Summary

✅ **Flow imported** - `backend/node-red-mes-flow-simple.json`  
✅ **Auto-login** - Gets token automatically  
✅ **Random data** - Generates realistic machine data  
✅ **Continuous updates** - Every 5 seconds  
✅ **Frontend updates** - Instantly via WebSocket  

**Your frontend will update automatically every 5 seconds!** 🎯

