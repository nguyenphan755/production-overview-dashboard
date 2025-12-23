# Node-RED Setup Guide for Real-Time Data Updates

This guide shows you how to set up Node-RED to push real-time machine data to PostgreSQL.

## Prerequisites

1. Node-RED installed and running
2. PostgreSQL database set up (see `POSTGRESQL_SETUP.md`)
3. Backend API running on port 3001

## Step 1: Install Node-RED Nodes

In Node-RED, go to **Menu → Manage Palette → Install** and install:

- `node-red-node-postgresql` - PostgreSQL database connection
- (Optional) `node-red-contrib-opcua` - For OPC UA/PLC connections

## Step 2: Create PostgreSQL Connection

1. Drag a **PostgreSQL** node to the flow
2. Double-click to configure:
   - **Name:** `PostgreSQL Connection`
   - **Server:** `localhost`
   - **Port:** `5432`
   - **Database:** `production_dashboard`
   - **User:** `postgres`
   - **Password:** Your PostgreSQL password
3. Click **Add** to save the connection

## Step 3: Import Example Flows

### Option A: Import from File

1. Copy the JSON from `backend/node-red-examples.json`
2. In Node-RED: **Menu → Import**
3. Paste the JSON
4. Click **Import**

### Option B: Create Manually

Follow the examples below to create flows manually.

## Flow Examples

### Flow 1: Continuous Machine Updates (Every 5 seconds)

**Nodes:**
1. **Inject** node
   - Name: "Every 5s"
   - Repeat: `5` seconds
   
2. **Function** node
   - Name: "Generate Machine Data"
   - Code: (see DATA_UPDATE_GUIDE.md)

3. **PostgreSQL** node
   - Connection: Your PostgreSQL connection
   - Query:
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
   - Parameters: `["payload.lineSpeed", "payload.current", "payload.power", "payload.temperature", "payload.producedLength", "payload.machineId"]`

**Connect:** Inject → Function → PostgreSQL

### Flow 2: Insert Metrics (Every 5 minutes)

**Nodes:**
1. **Inject** node
   - Repeat: `300` seconds (5 minutes)

2. **Function** node
   - Generate metric data

3. **PostgreSQL** node
   - Query:
   ```sql
   INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
   VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
   ```

### Flow 3: OPC UA / PLC Connection

**Nodes:**
1. **OPC UA Client** node
   - Endpoint: `opc.tcp://your-plc-address:4840`
   - Subscribe to machine tags

2. **Function** node
   - Map OPC UA data to database format

3. **PostgreSQL** node
   - Update machines table

## Function Node Code Examples

### Generate Machine Data

```javascript
const machines = ['D-01', 'D-02', 'D-03', 'S-01', 'S-02'];
const machineId = machines[Math.floor(Math.random() * machines.length)];

const baseValues = {
  'D-01': { speed: 920, current: 45.2, power: 68.5, temp: 68 },
  'D-02': { speed: 875, current: 43.8, power: 65.2, temp: 72 },
  'D-03': { speed: 885, current: 44.1, power: 66.8, temp: 70 },
  'S-01': { speed: 650, current: 38.5, power: 52.3, temp: 65 },
  'S-02': { speed: 680, current: 40.2, power: 54.8, temp: 68 },
};

const base = baseValues[machineId] || { speed: 800, current: 40, power: 60, temp: 65 };

msg.payload = {
  machineId: machineId,
  lineSpeed: Math.max(0, Math.round(base.speed + (Math.random() - 0.5) * 20)),
  current: parseFloat((base.current + (Math.random() - 0.5) * 2).toFixed(1)),
  power: parseFloat((base.power + (Math.random() - 0.5) * 3).toFixed(1)),
  temperature: Math.round(base.temp + (Math.random() - 0.5) * 3),
  producedLength: Math.floor(Math.random() * 50) + 3800,
};

return msg;
```

### Calculate and Update OEE

```javascript
const machineId = msg.payload.machineId;
const lineSpeed = msg.payload.lineSpeed;
const targetSpeed = msg.payload.targetSpeed || 1000;

const performance = (lineSpeed / targetSpeed) * 100;
const availability = 90 + Math.random() * 10;
const quality = 95 + Math.random() * 5;
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

### Check Alarm Conditions

```javascript
const machineId = msg.payload.machineId;
const temperature = msg.payload.temperature;
const current = msg.payload.current;

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

return null;
```

## Testing

1. Deploy the flow in Node-RED
2. Watch the debug panel for messages
3. Check PostgreSQL to verify updates
4. Check frontend dashboard - data should update automatically

## Troubleshooting

- **Connection errors:** Verify PostgreSQL credentials
- **No updates:** Check Node-RED debug panel
- **Frontend not updating:** Verify frontend is polling API
- **Query errors:** Check SQL syntax in PostgreSQL node

For more examples, see `DATA_UPDATE_GUIDE.md`.

