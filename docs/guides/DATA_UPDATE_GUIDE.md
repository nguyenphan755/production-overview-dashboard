# Data Update Guide - 3 Methods to Update Machine Data

This guide shows you how to update machine data in the Production Dashboard using three different methods.

---

## Method 1: Via SQL (Direct Database Updates)

**Best for:** Quick testing, manual updates, bulk changes  
**Update Speed:** Changes appear after ~1 second (frontend polls every 5-10 seconds)

### Connect to PostgreSQL

```bash
psql -U postgres -d production_dashboard
```

### Update Machine Status

```sql
-- Change machine status to running
UPDATE machines 
SET status = 'running', 
    line_speed = 920,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';

-- Change machine status to error
UPDATE machines 
SET status = 'error',
    line_speed = 0,
    power = 0,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-08';
```

### Update Machine Metrics

```sql
-- Update speed and production length
UPDATE machines 
SET line_speed = 950,
    produced_length = 4200,
    current = 46.5,
    power = 70.2,
    temperature = 72,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';

-- Update OEE metrics
UPDATE machines 
SET oee = 85.5,
    availability = 95.2,
    performance = 90.1,
    quality = 99.3,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';
```

### Update Production Order

```sql
-- Update order progress
UPDATE production_orders 
SET produced_length = 4500,
    status = CASE 
        WHEN produced_length >= target_length THEN 'completed'
        ELSE 'running'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'PO-2024-156';

-- Complete an order
UPDATE production_orders 
SET end_time = CURRENT_TIMESTAMP,
    status = 'completed',
    duration = '4h 15m',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'PO-2024-156';
```

### Insert Real-Time Metrics

```sql
-- Insert speed metric (for trends)
INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
VALUES ('D-01', 'speed', 925, 1000, CURRENT_TIMESTAMP);

-- Insert temperature metric
INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
VALUES ('D-01', 'temperature', 69, CURRENT_TIMESTAMP);

-- Insert current metric
INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
VALUES ('D-01', 'current', 45.8, CURRENT_TIMESTAMP);

-- Insert power metric
INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
VALUES ('D-01', 'power', 68.9, CURRENT_TIMESTAMP);

-- Insert multi-zone temperature
INSERT INTO machine_metrics (machine_id, metric_type, value, zone_number, timestamp)
VALUES 
    ('SH-01', 'multi_zone_temp', 148, 1, CURRENT_TIMESTAMP),
    ('SH-01', 'multi_zone_temp', 161, 2, CURRENT_TIMESTAMP),
    ('SH-01', 'multi_zone_temp', 169, 3, CURRENT_TIMESTAMP),
    ('SH-01', 'multi_zone_temp', 155, 4, CURRENT_TIMESTAMP);
```

### Create/Update Alarm

```sql
-- Create new alarm
INSERT INTO alarms (id, machine_id, severity, message, timestamp, acknowledged)
VALUES ('ALM-003', 'D-05', 'warning', 'High temperature warning', CURRENT_TIMESTAMP, FALSE);

-- Acknowledge alarm
UPDATE alarms 
SET acknowledged = TRUE 
WHERE id = 'ALM-001';
```

### Bulk Updates

```sql
-- Update all machines in an area
UPDATE machines 
SET status = 'running',
    line_speed = 900,
    last_updated = CURRENT_TIMESTAMP
WHERE area = 'drawing' AND status != 'error';

-- Update all running machines' produced length (simulate production)
UPDATE machines 
SET produced_length = produced_length + (line_speed * 5 / 60), -- 5 minutes of production
    last_updated = CURRENT_TIMESTAMP
WHERE status = 'running';
```

**Note:** Frontend polls the API every 5-10 seconds, so changes will appear within that timeframe.

---

## Method 2: Via REST API (Instant Updates)

**Best for:** Programmatic updates, integration with other systems  
**Update Speed:** Instant (if WebSocket enabled) or within polling interval

### API Endpoints for Updates

#### Update Machine Status

```bash
# Using curl
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "lineSpeed": 920,
    "producedLength": 3850
  }'
```

#### Update Machine Metrics

```bash
curl -X PATCH http://localhost:3001/api/machines/D-01/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "lineSpeed": 950,
    "current": 46.5,
    "power": 70.2,
    "temperature": 72,
    "oee": 85.5,
    "availability": 95.2,
    "performance": 90.1,
    "quality": 99.3
  }'
```

#### Insert Metric Data Point

```bash
curl -X POST http://localhost:3001/api/machines/D-01/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricType": "speed",
    "value": 925,
    "targetValue": 1000
  }'
```

#### Update Production Order

```bash
curl -X PATCH http://localhost:3001/api/orders/PO-2024-156 \
  -H "Content-Type: application/json" \
  -d '{
    "producedLength": 4500,
    "status": "running"
  }'
```

#### Create Alarm

```bash
curl -X POST http://localhost:3001/api/machines/D-05/alarms \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "warning",
    "message": "High temperature warning"
  }'
```

### Using JavaScript/Fetch

```javascript
// Update machine status
async function updateMachine(machineId, data) {
  const response = await fetch(`http://localhost:3001/api/machines/${machineId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return await response.json();
}

// Example usage
updateMachine('D-01', {
  status: 'running',
  lineSpeed: 920,
  producedLength: 3850,
  current: 45.2,
  power: 68.5,
  temperature: 68,
});
```

### Using Python

```python
import requests

def update_machine(machine_id, data):
    url = f"http://localhost:3001/api/machines/{machine_id}"
    response = requests.patch(url, json=data)
    return response.json()

# Example usage
update_machine('D-01', {
    'status': 'running',
    'lineSpeed': 920,
    'producedLength': 3850,
})
```

---

## Method 3: Via Node-RED (Real-Time Industrial Data Simulation)

**Best for:** Simulating real PLC/industrial data, continuous updates  
**Update Speed:** Real-time (configurable interval)

### Node-RED Flow Setup

#### Step 1: Install Required Nodes

In Node-RED, install these nodes:
- `node-red-contrib-postgresql` (for PostgreSQL connection)
- `node-red-node-http-request` (if needed)

#### Step 2: Create PostgreSQL Connection

1. Add **PostgreSQL** node
2. Configure connection:
   - **Server:** `localhost`
   - **Port:** `5432`
   - **Database:** `production_dashboard`
   - **User:** `postgres`
   - **Password:** Your PostgreSQL password

#### Step 3: Create Update Flow

**Flow 1: Continuous Machine Data Updates**

```json
[
  {
    "id": "inject-1",
    "type": "inject",
    "name": "Update Every 5s",
    "props": [{"p": "payload"}],
    "repeat": "5",
    "crontab": "",
    "once": false,
    "x": 100,
    "y": 100
  },
  {
    "id": "function-1",
    "type": "function",
    "name": "Generate Machine Data",
    "func": "// Simulate real-time machine data\nconst machines = ['D-01', 'D-02', 'D-03', 'S-01', 'S-02', 'SH-01', 'SH-02'];\nconst machineId = machines[Math.floor(Math.random() * machines.length)];\n\n// Generate realistic variations\nconst baseSpeed = {\n  'D-01': 920, 'D-02': 875, 'D-03': 885,\n  'S-01': 650, 'S-02': 680,\n  'SH-01': 450, 'SH-02': 425\n};\n\nconst speed = baseSpeed[machineId] + (Math.random() - 0.5) * 20;\nconst current = 40 + (Math.random() - 0.5) * 5;\nconst power = 65 + (Math.random() - 0.5) * 5;\nconst temp = 68 + (Math.random() - 0.5) * 4;\n\nmsg.payload = {\n  machineId: machineId,\n  lineSpeed: Math.max(0, Math.round(speed)),\n  current: parseFloat(current.toFixed(1)),\n  power: parseFloat(power.toFixed(1)),\n  temperature: Math.round(temp),\n  producedLength: Math.floor(Math.random() * 100) + 3800 // Increment\n};\n\nreturn msg;",
    "x": 300,
    "y": 100
  },
  {
    "id": "postgres-1",
    "type": "postgres",
    "name": "Update Machine",
    "query": "UPDATE machines SET\n  line_speed = $1,\n  current = $2,\n  power = $3,\n  temperature = $4,\n  produced_length = $5,\n  last_updated = CURRENT_TIMESTAMP\nWHERE id = $6",
    "params": "[\"payload.lineSpeed\", \"payload.current\", \"payload.power\", \"payload.temperature\", \"payload.producedLength\", \"payload.machineId\"]",
    "x": 500,
    "y": 100
  }
]
```

**Flow 2: Insert Metrics for Trends**

```json
[
  {
    "id": "inject-2",
    "type": "inject",
    "name": "Every 5 Minutes",
    "props": [{"p": "payload"}],
    "repeat": "300",
    "crontab": "",
    "once": false,
    "x": 100,
    "y": 200
  },
  {
    "id": "function-2",
    "type": "function",
    "name": "Generate Metrics",
    "func": "const machines = ['D-01', 'D-02', 'S-01', 'SH-01'];\nconst machineId = machines[Math.floor(Math.random() * machines.length)];\n\n// Get current machine speed from database (you'd query this first)\nconst baseSpeed = 900;\nconst speed = baseSpeed + (Math.random() - 0.5) * 30;\n\nmsg.payload = {\n  machineId: machineId,\n  metricType: 'speed',\n  value: Math.max(0, Math.round(speed)),\n  targetValue: 1000\n};\n\nreturn msg;",
    "x": 300,
    "y": 200
  },
  {
    "id": "postgres-2",
    "type": "postgres",
    "name": "Insert Metric",
    "query": "INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)\nVALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)",
    "params": "[\"payload.machineId\", \"payload.metricType\", \"payload.value\", \"payload.targetValue\"]",
    "x": 500,
    "y": 200
  }
]
```

**Flow 3: Simulate OPC UA / PLC Data**

```json
[
  {
    "id": "opcua-1",
    "type": "opcua-client",
    "name": "PLC Connection",
    "endpoint": "opc.tcp://plc-address:4840",
    "x": 100,
    "y": 300
  },
  {
    "id": "function-3",
    "type": "function",
    "name": "Map PLC to Database",
    "func": "// Map OPC UA data to database format\nconst machineId = msg.topic; // e.g., 'D-01'\nconst plcData = msg.payload;\n\nmsg.payload = {\n  machineId: machineId,\n  lineSpeed: plcData.speed || 0,\n  current: plcData.current || 0,\n  power: plcData.power || 0,\n  temperature: plcData.temp || 0,\n  producedLength: plcData.length || 0,\n  status: plcData.running ? 'running' : 'stopped'\n};\n\nreturn msg;",
    "x": 300,
    "y": 300
  },
  {
    "id": "postgres-3",
    "type": "postgres",
    "name": "Update from PLC",
    "query": "UPDATE machines SET\n  line_speed = $1,\n  current = $2,\n  power = $3,\n  temperature = $4,\n  produced_length = $5,\n  status = $6,\n  last_updated = CURRENT_TIMESTAMP\nWHERE id = $7",
    "params": "[\"payload.lineSpeed\", \"payload.current\", \"payload.power\", \"payload.temperature\", \"payload.producedLength\", \"payload.status\", \"payload.machineId\"]",
    "x": 500,
    "y": 300
  }
]
```

### Node-RED Function Node Examples

**Example 1: Simulate Multiple Machines**

```javascript
// Update multiple machines in sequence
const machines = [
  { id: 'D-01', speed: 920, current: 45.2, power: 68.5, temp: 68 },
  { id: 'D-02', speed: 875, current: 43.8, power: 65.2, temp: 72 },
  { id: 'S-01', speed: 650, current: 38.5, power: 52.3, temp: 65 },
];

const messages = machines.map(m => ({
  payload: {
    machineId: m.id,
    lineSpeed: m.speed + (Math.random() - 0.5) * 10,
    current: m.current + (Math.random() - 0.5) * 2,
    power: m.power + (Math.random() - 0.5) * 3,
    temperature: m.temp + (Math.random() - 0.5) * 2,
  }
}));

return messages;
```

**Example 2: Calculate OEE and Update**

```javascript
// Calculate OEE from machine data
const machineId = msg.payload.machineId;
const lineSpeed = msg.payload.lineSpeed;
const targetSpeed = msg.payload.targetSpeed || 1000;

// Calculate performance
const performance = (lineSpeed / targetSpeed) * 100;

// Simulate availability and quality
const availability = 90 + Math.random() * 10;
const quality = 95 + Math.random() * 5;

// Calculate OEE
const oee = (availability * performance * quality) / 10000;

msg.payload = {
  machineId: machineId,
  oee: parseFloat(oee.toFixed(2)),
  availability: parseFloat(availability.toFixed(2)),
  performance: parseFloat(performance.toFixed(2)),
  quality: parseFloat(quality.toFixed(2)),
};

return msg;
```

**Example 3: Generate Alarms Based on Conditions**

```javascript
const machineId = msg.payload.machineId;
const temperature = msg.payload.temperature;
const current = msg.payload.current;

// Check for alarm conditions
if (temperature > 80) {
  return {
    payload: {
      machineId: machineId,
      severity: 'error',
      message: `High temperature: ${temperature}°C`,
    },
    topic: 'alarm',
  };
}

if (current > 50) {
  return {
    payload: {
      machineId: machineId,
      severity: 'warning',
      message: `High current: ${current}A`,
    },
    topic: 'alarm',
  };
}

return null; // No alarm
```

### Complete Node-RED Flow Example

**File: `node-red-machines-flow.json`**

```json
[
  {
    "id": "flow-1",
    "type": "tab",
    "label": "Machine Data Updates",
    "disabled": false,
    "info": "Updates machine data every 5 seconds"
  },
  {
    "id": "inject-1",
    "type": "inject",
    "z": "flow-1",
    "name": "Every 5s",
    "props": [{"p": "payload"}],
    "repeat": "5",
    "crontab": "",
    "once": false,
    "x": 100,
    "y": 100
  },
  {
    "id": "function-1",
    "type": "function",
    "z": "flow-1",
    "name": "Generate Data",
    "func": "const machines = ['D-01', 'D-02', 'D-03'];\nconst id = machines[Math.floor(Math.random() * machines.length)];\n\nmsg.payload = {\n  machineId: id,\n  lineSpeed: 900 + Math.random() * 50,\n  current: 43 + Math.random() * 4,\n  power: 65 + Math.random() * 5,\n  temperature: 68 + Math.random() * 4,\n};\n\nreturn msg;",
    "x": 300,
    "y": 100
  },
  {
    "id": "postgres-1",
    "type": "postgres",
    "z": "flow-1",
    "name": "Update DB",
    "query": "UPDATE machines SET\n  line_speed = $1,\n  current = $2,\n  power = $3,\n  temperature = $4,\n  last_updated = CURRENT_TIMESTAMP\nWHERE id = $5",
    "params": "[\"payload.lineSpeed\", \"payload.current\", \"payload.power\", \"payload.temperature\", \"payload.machineId\"]",
    "x": 500,
    "y": 100
  }
]
```

**To import:** Copy the JSON above, go to Node-RED menu → Import → Paste and deploy.

---

## Comparison Table

| Method | Speed | Best For | Complexity |
|--------|-------|----------|------------|
| **SQL** | ~1 second | Quick testing, bulk updates | Low |
| **REST API** | Instant (with WebSocket) | Integration, automation | Medium |
| **Node-RED** | Real-time | PLC simulation, continuous updates | Medium-High |

---

## Quick Reference

### SQL Quick Updates

```sql
-- Quick status change
UPDATE machines SET status = 'running', last_updated = NOW() WHERE id = 'D-01';

-- Quick speed update
UPDATE machines SET line_speed = 950, last_updated = NOW() WHERE id = 'D-01';
```

### API Quick Updates

```bash
# Quick update
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -d '{"lineSpeed": 950, "status": "running"}'
```

### Node-RED Quick Setup

1. Install PostgreSQL node
2. Create inject node (repeat: 5 seconds)
3. Create function node (generate data)
4. Create PostgreSQL node (UPDATE query)
5. Deploy!

---

## Next Steps

1. **Test SQL updates** - Try the SQL examples above
2. **Set up API endpoints** - See backend API implementation
3. **Import Node-RED flow** - Use the JSON examples provided
4. **Monitor updates** - Watch the frontend dashboard update in real-time

For API endpoint implementation, see the next section.

