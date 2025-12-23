# Setup Instructions - MES Equipment Status System

## Quick Start

Follow these steps to set up the complete MES system with the production architecture.

---

## 1. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install:
- `express` - Web server
- `pg` - PostgreSQL client
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `jsonwebtoken` - JWT authentication
- `ws` - WebSocket server

---

## 2. Configure Backend Environment

Create `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=root

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-in-production
```

---

## 3. Run Database Migration

Add the new equipment status fields to the database:

```bash
psql -U postgres -d production_dashboard -f backend/database/migration_add_equipment_fields.sql
```

Or manually:

```sql
-- Connect to database
psql -U postgres -d mes_db

-- Run migration
\i backend/database/migration_add_equipment_fields.sql
```

This adds:
- `health_score` - Machine health score (0-100)
- `vibration_level` - Vibration level (Normal, Elevated, High, Critical)
- `runtime_hours` - Total runtime hours
- `last_status_update` - Last status update timestamp

---

## 4. Start Backend Server

```bash
cd backend
npm start
```

You should see:
```
🚀 Server running on http://localhost:3001
📊 API endpoints available at http://localhost:3001/api
💚 Health check: http://localhost:3001/health
🔌 WebSocket server available at ws://localhost:3001/ws
```

---

## 5. Configure Frontend

Ensure `.env` in project root exists:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=true
```

---

## 6. Start Frontend

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

---

## 7. Set Up Node-RED Flow

### Option A: Import Flow File

1. Open Node-RED in browser (usually `http://localhost:1880`)
2. Click **Menu** → **Import**
3. Select `backend/node-red-mes-flow.json`
4. Click **Deploy**

### Option B: Manual Setup

1. Create new flow tab: "MES Machine Updates via REST API"
2. Add nodes:
   - **Inject** (Every 5s)
   - **Function** (Generate Machine Data)
   - **HTTP Request** (Login to MES)
   - **Function** (Extract Token)
   - **Function** (Prepare API Request)
   - **HTTP Request** (Update Machine via API)
   - **Function** (Handle Response)

3. Configure:
   - Login URL: `http://localhost:3001/api/auth/login`
   - Update URL: `http://localhost:3001/api/machines/name/{machineName}`
   - Credentials: `nodered` / `nodered123`

---

## 8. Test the System

### Test 1: API Authentication

```powershell
# Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
    -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
    -ContentType "application/json"

Write-Host "Token: $($login.data.token)"
```

### Test 2: Update Machine via API

```powershell
$token = $login.data.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$updateData = @{
    status = "running"
    healthScore = 95
    temperature = 70.0
    powerConsumption = 45.0
    vibrationLevel = "Normal"
    runtimeHours = 157.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/machines/name/D-01" `
    -Method PUT -Headers $headers -Body $updateData
```

**Expected:**
- Backend logs: `✅ Machine D-01 updated via API by nodered`
- Backend logs: `📡 Broadcasted machine:update to X client(s)`
- Frontend updates instantly (no refresh needed)

### Test 3: Node-RED Flow

1. Deploy Node-RED flow
2. Check Node-RED logs for "Machine X updated successfully"
3. Check backend logs for WebSocket broadcasts
4. Check frontend - should update every 5 seconds

---

## 9. Verify WebSocket Connection

### Browser Console (F12)

You should see:
```
✅ WebSocket connected
```

### Backend Logs

You should see:
```
✅ WebSocket client connected
📡 Broadcasted machine:update to 1 client(s)
```

---

## Troubleshooting

### Backend won't start

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```powershell
# Find process using port 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess

# Kill process (replace PID)
Stop-Process -Id <PID>
```

### Database connection failed

**Error:** `password authentication failed`

**Solution:**
- Check `backend/.env` has correct `DB_PASSWORD`
- Verify PostgreSQL is running
- Test connection: `psql -U postgres -d mes_db`

### WebSocket not connecting

**Check:**
1. Backend WebSocket server is running
2. Frontend `.env` has `VITE_USE_MOCK_DATA=false`
3. Browser console shows WebSocket connection
4. No CORS errors

### Node-RED can't login

**Check:**
1. Backend is running on port 3001
2. Credentials: `nodered` / `nodered123`
3. Node-RED can reach `http://localhost:3001`
4. Check Node-RED logs for errors

### Updates not appearing in frontend

**Check:**
1. WebSocket is connected (browser console)
2. Backend is broadcasting (backend logs)
3. Polling fallback is working (check Network tab)
4. Machine name matches exactly (case-sensitive)

---

## Architecture Verification

✅ **Node-RED** → Sends data via REST API (not direct DB)  
✅ **Backend** → Validates and updates PostgreSQL  
✅ **Backend** → Broadcasts via WebSocket  
✅ **Frontend** → Receives updates via WebSocket  
✅ **Frontend** → Falls back to polling if WebSocket unavailable  

---

## Next Steps

1. ✅ Backend running on port 3001
2. ✅ Frontend running on port 5173
3. ✅ Database migration completed
4. ✅ Node-RED flow deployed
5. ✅ Test API authentication
6. ✅ Test machine updates
7. ✅ Verify WebSocket connection
8. ✅ Monitor real-time updates

---

## Production Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Use environment-specific database credentials
- [ ] Enable HTTPS/WSS for WebSocket
- [ ] Set up proper user authentication (not hardcoded)
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and logging
- [ ] Test with real PLC/OPC UA data
- [ ] Load test WebSocket connections

---

## Summary

✅ **Complete architecture implemented**  
✅ **JWT authentication**  
✅ **WebSocket real-time updates**  
✅ **Node-RED integration via REST API**  
✅ **Production-ready data flow**  

The system is ready for testing! 🎯

