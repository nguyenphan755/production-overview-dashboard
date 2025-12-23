# API Update Quick Reference

Quick reference guide for updating machine data using 3 methods.

---

## Method 1: SQL (Direct Database) ⚡

**Update Speed:** ~1 second (frontend polls every 5-10s)

### Quick Examples

```sql
-- Update machine status
UPDATE machines SET status = 'running', line_speed = 920, last_updated = NOW() WHERE id = 'D-01';

-- Update metrics
UPDATE machines SET 
  line_speed = 950,
  current = 46.5,
  power = 70.2,
  temperature = 72,
  last_updated = NOW()
WHERE id = 'D-01';

-- Insert metric for trends
INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
VALUES ('D-01', 'speed', 925, 1000, NOW());

-- Create alarm
INSERT INTO alarms (id, machine_id, severity, message, timestamp, acknowledged)
VALUES ('ALM-003', 'D-05', 'warning', 'High temperature', NOW(), FALSE);
```

**See:** `DATA_UPDATE_GUIDE.md` for complete SQL examples

---

## Method 2: REST API (Programmatic) 🚀

**Update Speed:** Instant (if WebSocket) or within polling interval

### API Endpoints

#### Update Machine
```bash
PATCH /api/machines/:machineId
Content-Type: application/json

{
  "status": "running",
  "lineSpeed": 920,
  "current": 45.2,
  "power": 68.5,
  "temperature": 68,
  "oee": 83.6,
  "availability": 94.5,
  "performance": 89.2,
  "quality": 99.1
}
```

#### Insert Metric
```bash
POST /api/machines/:machineId/metrics
Content-Type: application/json

{
  "metricType": "speed",
  "value": 925,
  "targetValue": 1000
}
```

#### Create Alarm
```bash
POST /api/machines/:machineId/alarms
Content-Type: application/json

{
  "severity": "warning",
  "message": "High temperature warning"
}
```

#### Update Order
```bash
PATCH /api/orders/:orderId
Content-Type: application/json

{
  "producedLength": 4500,
  "status": "running"
}
```

### cURL Examples

```bash
# Update machine
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -d '{"lineSpeed": 950, "status": "running"}'

# Insert metric
curl -X POST http://localhost:3001/api/machines/D-01/metrics \
  -H "Content-Type: application/json" \
  -d '{"metricType": "speed", "value": 925, "targetValue": 1000}'

# Create alarm
curl -X POST http://localhost:3001/api/machines/D-05/alarms \
  -H "Content-Type: application/json" \
  -d '{"severity": "warning", "message": "High temperature"}'
```

**See:** `DATA_UPDATE_GUIDE.md` for complete API examples

---

## Method 3: Node-RED (Real-Time Simulation) 🔄

**Update Speed:** Real-time (configurable interval)

### Quick Setup

1. **Install Node:** `node-red-node-postgresql`
2. **Create Flow:**
   - Inject node (repeat: 5 seconds)
   - Function node (generate data)
   - PostgreSQL node (UPDATE query)
3. **Deploy!**

### Function Node Code

```javascript
// Generate machine data
const machines = ['D-01', 'D-02', 'D-03'];
const machineId = machines[Math.floor(Math.random() * machines.length)];

msg.payload = {
  machineId: machineId,
  lineSpeed: 900 + Math.random() * 50,
  current: 43 + Math.random() * 4,
  power: 65 + Math.random() * 5,
  temperature: 68 + Math.random() * 4,
};

return msg;
```

### PostgreSQL Query

```sql
UPDATE machines SET
  line_speed = $1,
  current = $2,
  power = $3,
  temperature = $4,
  last_updated = CURRENT_TIMESTAMP
WHERE id = $5
```

**Parameters:** `["payload.lineSpeed", "payload.current", "payload.power", "payload.temperature", "payload.machineId"]`

**See:** `NODE_RED_SETUP.md` for complete Node-RED guide

---

## Comparison

| Method | Speed | Use Case | Difficulty |
|--------|-------|----------|------------|
| **SQL** | ~1s | Quick testing, bulk updates | ⭐ Easy |
| **API** | Instant | Integration, automation | ⭐⭐ Medium |
| **Node-RED** | Real-time | PLC simulation, continuous | ⭐⭐ Medium |

---

## Testing Your Updates

1. **Make an update** using any method above
2. **Check frontend** - Open http://localhost:5173
3. **Watch Equipment Status tab** - Data should update automatically
4. **Check browser console** - Verify API calls are working

---

## Common Update Scenarios

### Scenario 1: Simulate Production Running
```sql
-- Update all running machines' produced length
UPDATE machines 
SET produced_length = produced_length + (line_speed * 5 / 60),
    last_updated = NOW()
WHERE status = 'running';
```

### Scenario 2: Change Machine Status
```sql
-- Start a stopped machine
UPDATE machines 
SET status = 'running',
    line_speed = 900,
    last_updated = NOW()
WHERE id = 'D-04';
```

### Scenario 3: Insert Continuous Metrics
```sql
-- Insert metrics every 5 minutes (run via cron or Node-RED)
INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
SELECT 
  id,
  'speed',
  line_speed,
  target_speed,
  NOW()
FROM machines
WHERE status = 'running';
```

---

## Next Steps

1. ✅ **Try SQL updates** - Quick and easy for testing
2. ✅ **Set up API endpoints** - For programmatic access
3. ✅ **Configure Node-RED** - For real-time simulation
4. ✅ **Monitor dashboard** - Watch updates in real-time

For detailed examples, see:
- `DATA_UPDATE_GUIDE.md` - Complete guide with all methods
- `NODE_RED_SETUP.md` - Node-RED specific setup
- `API_INTEGRATION.md` - API endpoint documentation

