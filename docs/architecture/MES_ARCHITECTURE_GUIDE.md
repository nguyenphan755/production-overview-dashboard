# MES Equipment Status - Production Architecture Guide

## Architecture Overview

**Target Architecture (Strictly Followed):**

```
PLC / OPC UA → Node-RED → MES REST API → Backend → PostgreSQL → WebSocket → Frontend (React)
```

---

## Key Principles

### ✅ **DO:**
- Node-RED sends data **ONLY** through MES REST API
- All updates go through authenticated API endpoints
- Backend validates and updates PostgreSQL
- Backend broadcasts updates via WebSocket
- Frontend receives real-time updates via WebSocket

### ❌ **DON'T:**
- Node-RED should **NEVER** write directly to PostgreSQL
- Frontend should **NEVER** bypass backend API
- Updates should **NEVER** skip validation

---

## Data Flow

### 1. Industrial Data Source (PLC/OPC UA)
- Simulated in Node-RED for testing
- Real PLC/OPC UA in production
- Generates machine data every 5 seconds

### 2. Node-RED Processing
- Receives/simulates industrial data
- Transforms data format
- Logs in to MES backend to get JWT token
- Sends data via REST API

### 3. MES Backend API
- **Endpoint:** `PUT /api/machines/name/:machineName`
- **Authentication:** JWT Bearer token required
- **Validates:** Data format, field ranges, machine existence
- **Updates:** PostgreSQL database
- **Broadcasts:** WebSocket event to all connected clients

### 4. PostgreSQL Database
- Stores machine data
- Tracks history via timestamps
- Maintains data integrity

### 5. WebSocket Server
- Broadcasts `machine:update` events
- Sends to all connected frontend clients
- Real-time, instant updates

### 6. Frontend (React)
- Connects to WebSocket on mount
- Receives `machine:update` events
- Updates UI instantly (no polling needed)
- Falls back to polling if WebSocket unavailable

---

## API Endpoints

### Authentication

**POST /api/auth/login**
```json
{
  "username": "nodered",
  "password": "nodered123"
}
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "nodered",
    "role": "system"
  },
  "success": true,
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

### Machine Updates

**PUT /api/machines/name/:machineName**
- **Authentication:** Required (Bearer token)
- **Method:** PUT
- **Path:** `/api/machines/name/D-01`

**Request Body:**
```json
{
  "status": "running",
  "lineSpeed": 920,
  "current": 45.2,
  "power": 68.5,
  "powerConsumption": 68.5,
  "temperature": 68,
  "producedLength": 3850,
  "healthScore": 95,
  "vibrationLevel": "Normal",
  "runtimeHours": 160.5
}
```

**Response:**
```json
{
  "data": {
    "id": "D-01",
    "name": "Drawing Line 01",
    "status": "running",
    "lineSpeed": 920,
    "current": 45.2,
    "power": 68.5,
    "temperature": 68,
    "healthScore": 95,
    "vibrationLevel": "Normal",
    "runtimeHours": 160.5,
    "lastUpdated": "2025-01-21T10:00:00.000Z"
  },
  "success": true,
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

**WebSocket Event (Broadcasted):**
```json
{
  "type": "machine:update",
  "data": {
    "id": "D-01",
    "name": "Drawing Line 01",
    "status": "running",
    ...
  },
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

---

## Machine Data Model

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `status` | string | Machine status | `running`, `idle`, `warning`, `error`, `maintenance`, `offline` |
| `healthScore` | number | Health score (0-100) | `95.0` |
| `temperature` | number | Temperature (°C) | `68.0` |
| `powerConsumption` | number | Power consumption (kW) | `68.5` |
| `vibrationLevel` | string | Vibration level | `Normal`, `Elevated`, `High`, `Critical` |
| `runtimeHours` | number | Total runtime hours | `160.5` |
| `lastStatusUpdate` | timestamp | Last status update time | Auto-set by backend |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `lineSpeed` | number | Current line speed |
| `current` | number | Current (A) |
| `producedLength` | number | Produced length (m) |
| `oee` | number | Overall Equipment Effectiveness |

---

## Node-RED Flow

### Flow File: `backend/node-red-mes-flow.json`

**Steps:**
1. **Inject** - Triggers every 5 seconds
2. **Generate Machine Data** - Simulates PLC data
3. **Login to MES** - Gets JWT token
4. **Extract Token** - Stores token globally
5. **Prepare API Request** - Formats data for API
6. **Update Machine via API** - Sends PUT request
7. **Handle Response** - Logs success/error

**Credentials:**
- Username: `nodered`
- Password: `nodered123`

---

## Database Schema

### Migration: `backend/database/migration_add_equipment_fields.sql`

**New Columns Added:**
- `health_score` DECIMAL(5, 2) DEFAULT 100.0
- `vibration_level` VARCHAR(50) DEFAULT 'Normal'
- `runtime_hours` DECIMAL(10, 2) DEFAULT 0
- `last_status_update` TIMESTAMP

**Run Migration:**
```bash
psql -U postgres -d production_dashboard -f backend/database/migration_add_equipment_fields.sql
```

---

## Frontend WebSocket Integration

### Connection
- **URL:** `ws://localhost:3001/ws`
- **Auto-reconnect:** Yes (3 second delay)
- **Event Types:** `machine:update`, `global:update`

### Usage
```typescript
// In React component
useEffect(() => {
  const unsubscribe = apiClient.subscribeToMachineUpdates(machineId, (updatedMachine) => {
    // Update state instantly
    setMachine(updatedMachine);
  });

  return () => unsubscribe();
}, [machineId]);
```

---

## Testing

### Test Node-RED Flow

1. **Import Flow:**
   - Open Node-RED
   - Import `backend/node-red-mes-flow.json`
   - Deploy flow

2. **Verify:**
   - Check Node-RED logs for "Machine X updated successfully"
   - Check backend logs for "Broadcasted machine:update"
   - Check frontend - should update instantly

### Test API Directly

```powershell
# Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
    -Method POST -Body '{"username":"nodered","password":"nodered123"}' `
    -ContentType "application/json"

$token = $login.data.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Update machine
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

---

## Troubleshooting

### Node-RED can't connect to API
- Check backend is running on port 3001
- Verify credentials: `nodered` / `nodered123`
- Check Node-RED logs for errors

### WebSocket not connecting
- Check backend WebSocket server is running
- Verify frontend connects to `ws://localhost:3001/ws`
- Check browser console for WebSocket errors

### Updates not appearing in frontend
- Check WebSocket connection status
- Verify backend is broadcasting events
- Check browser console for WebSocket messages
- Fallback: Polling should still work (1 second interval)

### API returns 401 Unauthorized
- Token expired - Login again
- Wrong credentials - Use `nodered` / `nodered123`
- Missing Authorization header

---

## Summary

✅ **Architecture:** PLC → Node-RED → REST API → Backend → PostgreSQL → WebSocket → Frontend  
✅ **Authentication:** JWT Bearer tokens  
✅ **Real-time:** WebSocket broadcasting  
✅ **Validation:** Backend validates all data  
✅ **Production-ready:** No direct database writes from Node-RED  

This architecture ensures data integrity, security, and real-time updates! 🎯

