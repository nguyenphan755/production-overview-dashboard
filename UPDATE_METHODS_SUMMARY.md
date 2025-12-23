# 3 Methods to Update Machine Data - Complete Summary

## Overview

The Equipment Status tab displays machine data from the `machines` table. You can update this data using **3 different methods**, each with different use cases and update speeds.

---

## Method 1: Via SQL (Direct Database) 📊

### Characteristics
- **Update Speed:** ~1 second (frontend polls every 5-10 seconds)
- **Best For:** Quick testing, manual updates, bulk changes
- **Difficulty:** ⭐ Easy

### How It Works
1. Connect to PostgreSQL directly
2. Run UPDATE/INSERT SQL statements
3. Frontend automatically picks up changes on next poll

### Quick Example
```sql
UPDATE machines 
SET status = 'running', 
    line_speed = 920,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';
```

### When to Use
- ✅ Quick testing and debugging
- ✅ Manual data corrections
- ✅ Bulk updates to multiple machines
- ✅ One-time data fixes

**Full Guide:** See `DATA_UPDATE_GUIDE.md` - Method 1 section

---

## Method 2: Via REST API (Programmatic) 🔌

### Characteristics
- **Update Speed:** Instant (if WebSocket enabled) or within polling interval
- **Best For:** Integration with other systems, automation, scripts
- **Difficulty:** ⭐⭐ Medium

### How It Works
1. Send HTTP PATCH/POST requests to API endpoints
2. Backend validates and updates database
3. Frontend receives updates via polling or WebSocket

### Quick Example
```bash
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "lineSpeed": 920,
    "current": 45.2,
    "power": 68.5
  }'
```

### Available Endpoints
- `PATCH /api/machines/:machineId` - Update machine
- `POST /api/machines/:machineId/metrics` - Insert metric
- `POST /api/machines/:machineId/alarms` - Create alarm
- `PATCH /api/orders/:orderId` - Update order
- `PATCH /api/alarms/:alarmId` - Acknowledge alarm

### When to Use
- ✅ Integration with external systems
- ✅ Automated scripts and cron jobs
- ✅ Mobile apps or other frontends
- ✅ Real-time updates from other services

**Full Guide:** See `DATA_UPDATE_GUIDE.md` - Method 2 section

---

## Method 3: Via Node-RED (Real-Time Industrial Simulation) 🏭

### Characteristics
- **Update Speed:** Real-time (configurable interval, e.g., every 5 seconds)
- **Best For:** Simulating PLC/industrial data, continuous updates, OPC UA integration
- **Difficulty:** ⭐⭐ Medium

### How It Works
1. Node-RED flow generates/simulates machine data
2. Updates PostgreSQL database via SQL queries
3. Frontend displays real-time changes

### Quick Setup
1. Install `node-red-node-postgresql` node
2. Create flow: Inject → Function → PostgreSQL
3. Deploy and watch data update continuously

### Quick Example Flow
```
[Inject: Every 5s] → [Function: Generate Data] → [PostgreSQL: UPDATE]
```

### When to Use
- ✅ Simulating real PLC/industrial equipment
- ✅ Continuous data updates (every few seconds)
- ✅ OPC UA / MQTT integration
- ✅ Real-time production monitoring simulation
- ✅ Testing real-time dashboard behavior

**Full Guide:** See `NODE_RED_SETUP.md` and `DATA_UPDATE_GUIDE.md` - Method 3 section

---

## Comparison Table

| Feature | SQL | REST API | Node-RED |
|---------|-----|----------|----------|
| **Update Speed** | ~1 second | Instant/Real-time | Real-time |
| **Ease of Use** | ⭐⭐⭐ Very Easy | ⭐⭐ Medium | ⭐⭐ Medium |
| **Best For** | Testing, Manual | Integration | Simulation |
| **Requires** | psql access | API server | Node-RED |
| **Automation** | Manual/Scripts | Scripts/Apps | Automated |
| **Real-time** | Polling | WebSocket/Polling | Continuous |

---

## Recommended Workflow

### For Development/Testing
1. **Start with SQL** - Quick and easy for testing
2. **Use API** - When you need programmatic access
3. **Add Node-RED** - For continuous real-time simulation

### For Production
1. **Node-RED** - Connect to real PLCs/OPC UA
2. **API** - For external system integration
3. **SQL** - For manual corrections when needed

---

## Quick Start Examples

### SQL - Update Machine
```sql
UPDATE machines SET 
  status = 'running',
  line_speed = 920,
  last_updated = NOW()
WHERE id = 'D-01';
```

### API - Update Machine
```bash
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -d '{"status": "running", "lineSpeed": 920}'
```

### Node-RED - Continuous Updates
- Import flow from `backend/node-red-examples.json`
- Deploy and watch data update every 5 seconds

---

## Testing Your Updates

1. **Make an update** using any method
2. **Open frontend:** http://localhost:5173
3. **Go to Equipment Status tab**
4. **Watch the data update** automatically

The frontend polls the API every 5-10 seconds, so changes will appear within that timeframe.

---

## Documentation Files

- **`DATA_UPDATE_GUIDE.md`** - Complete guide with all 3 methods, examples, and code
- **`API_UPDATE_QUICK_REFERENCE.md`** - Quick reference for common operations
- **`NODE_RED_SETUP.md`** - Detailed Node-RED setup instructions
- **`backend/node-red-examples.json`** - Ready-to-import Node-RED flows

---

## Next Steps

1. ✅ **Try Method 1 (SQL)** - Quick test with direct database access
2. ✅ **Try Method 2 (API)** - Test with curl or Postman
3. ✅ **Set up Method 3 (Node-RED)** - For continuous real-time updates
4. ✅ **Monitor dashboard** - Watch all three methods update the frontend

All three methods work together - you can use any combination depending on your needs!

