# Real-Time OEE (Overall Equipment Effectiveness) Implementation Guide

## Overview

This document describes the real-time OEE calculation and visualization system implemented for the Production Overview Dashboard. OEE is calculated continuously as new machine data arrives from Node-RED or external systems.

**Important Note (Demo Phase):**
- **Availability** is calculated using a **10-minute rolling window** for real-time monitoring
- This approach provides immediate, actionable insights and fast detection of machine downtime
- The calculation logic is designed to be easily switched to shift-based Availability in production

## Architecture

### Data Flow

```
Node-RED / External System
    ↓ (REST API: PUT /api/machines/name/:machineName)
Backend API (Express.js)
    ↓ (Calculate OEE automatically)
PostgreSQL Database
    ↓ (WebSocket Broadcast)
Frontend (React)
    ↓ (Real-time Display)
Dashboard UI
```

## OEE Components

### 1. Availability
**Formula:** `Availability = (Running Time / Planned Production Time) × 100%`

**Calculation (Demo Phase - 10-Minute Rolling Window with Aggregation):**
- **Time Window**: Last 10 minutes (rolling/sliding window)
- **Planned Time**: 600 seconds (fixed 10-minute window)
- **Status Aggregation**: All status durations are aggregated within the window:
  - `running` - Production time
  - `idle`, `warning`, `error`, `stopped`, `setup` - Downtime
- **Downtime Calculation**: Sum of all non-running status durations
- **Running Time**: Planned Time - Downtime
- **Availability**: (Running Time / Planned Time) × 100%
- **Update Frequency**: Continuously recalculated as time progresses
- **Purpose**: Fast detection of machine downtime and real-time monitoring

**Data Source:**
- `machine_status_history` table (tracked via database trigger) - Raw events
- `availability_aggregations` table - Pre-calculated aggregated data for fast queries
- Machine status changes automatically trigger aggregation calculation
- Aggregation table stores durations for all statuses and calculated Availability

**Design Note (Future-Ready):**
- This rolling-window approach is used for **demo and early execution phase**
- The calculation logic is designed to be easily switched to shift-based Availability in production
- Production implementation can replace the rolling time window with shift start and end times
- Availability is **not restricted to a 24-hour calculation** - the window can be configured per use case

### 2. Performance
**Formula:** `Performance = (Actual Speed / Target Speed) × 100%`

**Calculation:**
- **Actual Speed**: Current `line_speed` (m/min)
- **Target Speed**: Rated `target_speed` (m/min)
- **Cap**: Performance cannot exceed 100% (machine cannot run faster than rated speed)

**Data Source:**
- Real-time `line_speed` and `target_speed` from `machines` table

### 3. Quality
**Formula:** `Quality = (OK Length / Total Produced Length) × 100%`

**Calculation:**
- **OK Length**: `produced_length_ok` (good/acceptable production)
- **NG Length**: `produced_length_ng` (rejected/defective production)
- **Total Length**: `produced_length_ok + produced_length_ng` (or `produced_length` if OK/NG not tracked)

**Data Source:**
- `produced_length_ok` and `produced_length_ng` from `machines` table (real-time)
- Fallback: `production_quality` table (aggregated data)
- Final fallback: `produced_length` (assumes all is OK)

### 4. Overall OEE
**Formula:** `OEE = (Availability × Performance × Quality) / 10000`

**Result Range:** 0-100%

## Database Schema

### Machines Table (Enhanced)

```sql
-- Run migration to add OK/NG columns
psql -U postgres -d production_dashboard -f backend/database/migration_add_ok_ng_length.sql
```

**New Columns:**
- `produced_length_ok DECIMAL(12, 2) DEFAULT 0` - OK/Good length in meters
- `produced_length_ng DECIMAL(12, 2) DEFAULT 0` - NG/Rejected length in meters

### OEE Tracking Tables

1. **machine_status_history**: Tracks status changes over time (created by `migration_add_oee_tracking.sql`)
2. **production_quality**: Tracks OK/NG lengths per production order
3. **oee_calculations**: Stores OEE calculation history for trending
4. **availability_aggregations**: Stores pre-calculated availability metrics for fast queries (created by `migration_add_availability_aggregation.sql`)

## Backend Implementation

### OEE Calculator Service

**File:** `backend/services/oeeCalculator.js`

**Key Functions:**
- `calculateAvailability()`: Gets availability from aggregated table (fast) or calculates from status history (fallback)
- `calculatePerformance()`: Calculates performance from speed ratio (real-time)
- `calculateQuality()`: Calculates quality from OK/NG lengths (with fallbacks, real-time)
- `calculateOEE()`: Main function that combines all components

**Availability Synchronization Service** (`backend/services/availabilitySync.js`):
- `syncAllMachinesAvailability()`: Synchronizes availability for all machines across all production lines
- `syncAreaAvailability()`: Synchronizes availability for machines in a specific production area
- `startContinuousSync()`: Starts background service that continuously syncs all machines
- `getSyncStatus()`: Returns synchronization status for all machines
- **Automatic**: Runs continuously every 30 seconds (configurable via `AVAILABILITY_SYNC_INTERVAL` env var)
- **Comprehensive**: Processes all machines to ensure real-time Availability values

**Availability Calculation (Demo Phase):**
- Uses a fixed 10-minute rolling (sliding) time window
- Window: `NOW() - 10 minutes` to `NOW()` (600 seconds)
- Continuously recalculated as time progresses
- Designed for fast detection of machine downtime during operation
- Implementation: Uses `availability_aggregations` table for fast queries
- Aggregation is automatically calculated when machine status changes
- Falls back to direct calculation from `machine_status_history` if aggregation not available

### Real-Time Calculation Trigger

**File:** `backend/routes/machines.js`

OEE is automatically recalculated when any of these fields are updated:
- `lineSpeed` (current speed)
- `targetSpeed` (target speed)
- `producedLength` (total produced length)
- `producedLengthOk` (OK length)
- `producedLengthNg` (NG length)
- `status` (machine status)
- `productionOrderId` (production order change)

**API Endpoints:**
- `PATCH /api/machines/:machineId` - Update machine by ID
- `PUT /api/machines/name/:machineName` - Update machine by name (Node-RED)

### WebSocket Broadcasting

When OEE is recalculated, the updated machine data (including OEE values) is broadcast via WebSocket:
```javascript
broadcast('machine:update', updatedMachine);
```

## Frontend Implementation

### Real-Time OEE Display

**File:** `src/components/tabs/EquipmentDetail.tsx`

**Features:**
- Real-time OEE display with color coding
- Breakdown of Availability, Performance, and Quality
- Progress bars for each component
- Automatic updates via WebSocket or polling

### Color Thresholds

```typescript
function getOEEColor(value: number) {
  if (value >= 85) return '#22C55E'; // Green
  if (value >= 60) return '#F59E0B'; // Yellow
  return '#EF4444'; // Red
}
```

**Thresholds:**
- **Green (≥85%)**: Excellent performance
- **Yellow (60-85%)**: Acceptable performance
- **Red (<60%)**: Needs attention

## Data Update from Node-RED

### Example Node-RED Flow

```javascript
// Function node: Prepare machine update
const machineName = msg.payload.machineName || 'DA13';
const lineSpeed = msg.payload.current_speed || msg.payload.lineSpeed || 920;
const targetSpeed = msg.payload.target_speed || msg.payload.targetSpeed || 1000;
const producedLength = msg.payload.produced_length || msg.payload.producedLength || 0;
const producedLengthOk = msg.payload.produced_length_ok || msg.payload.producedLengthOk || producedLength;
const producedLengthNg = msg.payload.produced_length_ng || msg.payload.producedLengthNg || 0;
const status = msg.payload.machine_status || msg.payload.status || 'running';

msg.payload = {
  machineName: machineName,
  lineSpeed: lineSpeed,
  targetSpeed: targetSpeed,
  producedLength: producedLength,
  producedLengthOk: producedLengthOk,
  producedLengthNg: producedLengthNg,
  status: status
};

return msg;
```

### HTTP Request Node

- **Method:** `PUT`
- **URL:** `http://localhost:3001/api/machines/name/${machineName}`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer ${token}`
- **Body:** Machine data payload

**Example Payload:**
```json
{
  "lineSpeed": 950,
  "targetSpeed": 1000,
  "producedLength": 3850,
  "producedLengthOk": 3800,
  "producedLengthNg": 50,
  "status": "running"
}
```

## Real-Time Updates

### WebSocket Connection

Frontend connects to WebSocket server and listens for `machine:update` events:

```typescript
// In useProductionData.ts or similar hook
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'machine:update') {
      // Update machine data including OEE
      updateMachine(data.payload);
    }
  };
  
  return () => ws.close();
}, []);
```

### Polling (Fallback)

If WebSocket is unavailable, frontend polls the API every 5-10 seconds:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchMachineData(machineId).then(updateMachine);
  }, 5000);
  
  return () => clearInterval(interval);
}, [machineId]);
```

## OEE Calculation Period

### Availability (Demo Phase)

**10-Minute Rolling Window with Aggregated Calculations:**
- **Period Start**: 10 minutes ago (`NOW() - INTERVAL '10 minutes'`)
- **Period End**: Current time (`NOW()`)
- **Window Duration**: 600 seconds (fixed)
- **Update**: Continuously recalculated as time progresses
- **Purpose**: Provides immediate, actionable insights for real-time monitoring
- **Performance**: Uses pre-calculated aggregation table for fast queries

**Aggregation Method:**
- All machine status events are synchronized to `machine_status_history` table
- Aggregated durations are calculated and stored in `availability_aggregations` table
- Calculation formula:
  - **Planned Time** = 10 minutes (600 seconds)
  - **Downtime** = idle + warning + error + stopped + setup durations
  - **Running Time** = Planned Time - Downtime
  - **Availability** = (Running Time / Planned Time) × 100%

**Key Characteristics:**
- Fast detection of machine downtime during operation
- Real-time visualization in the MES dashboard
- Each refresh recalculates Availability based on status changes within the most recent 10-minute window
- Designed for demo and early execution phase

### Performance & Quality

**Performance:**
- Calculated in real-time from current speed vs target speed
- No time window required (instantaneous calculation)

**Quality:**
- Calculated from current OK/NG lengths
- Can be per production order or cumulative
- No time window required (uses current production data)

### Future Production Implementation

**Shift-Based Availability (Production):**
- **Period Start**: Shift start time
- **Period End**: Current time (or shift end time)
- OEE resets when a new shift starts
- Can be configured per shift schedule

**Per Production Order (Alternative):**
- **Period Start**: Production order `start_time`
- **Period End**: Current time (`NOW()`)
- OEE resets when a new production order starts

## Performance Optimization

### Caching

- OEE calculations are cached in the `machines` table
- Recalculated only when relevant fields change
- History stored in `oee_calculations` table for trending

### Database Indexes

```sql
CREATE INDEX idx_machine_status_history_machine_id ON machine_status_history(machine_id);
CREATE INDEX idx_machine_status_history_status_start ON machine_status_history(status_start_time);
CREATE INDEX idx_oee_calculations_machine_timestamp ON oee_calculations(machine_id, calculation_timestamp DESC);
```

### Async Operations

- OEE history storage is non-blocking (async)
- WebSocket broadcasts happen immediately after calculation
- Database updates don't block API responses

## Continuous Synchronization

### Automatic Synchronization

The system automatically synchronizes **all related machine and production data** into the `availability_aggregations` table:

1. **Database Trigger**: Automatically calculates aggregation when machine status changes
   - Includes production order context
   - Handles all status transitions
   - Ensures immediate updates
2. **Background Service**: Continuously syncs all machines every 30 seconds (configurable)
   - Processes all machines across all production lines
   - Includes production order information
   - Retries failed machines automatically
   - Comprehensive data synchronization
3. **Comprehensive Coverage**: 
   - All machines across all production lines
   - All production orders and their relationships
   - All status durations (running, idle, warning, error, stopped, setup)
   - Real-time Availability calculations

### Configuration

Set environment variables in `.env`:

```bash
# Availability sync interval in seconds (default: 30)
AVAILABILITY_SYNC_INTERVAL=30

# Availability window size in minutes (default: 10)
AVAILABILITY_WINDOW_MINUTES=10
```

### Manual Synchronization

You can manually trigger synchronization via API:

```bash
# Sync all machines (with automatic retry for failed machines)
curl -X POST http://localhost:3001/api/availability/sync/all \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"windowMinutes": 10, "retryFailed": true}'

# Sync specific area
curl -X POST http://localhost:3001/api/availability/sync/area/drawing \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"windowMinutes": 10}'

# Check sync status
curl http://localhost:3001/api/availability/sync/status
```

### Sync Status

Check synchronization status for all machines:

```bash
GET /api/availability/sync/status
```

Returns:
- Machine ID and name
- Latest availability percentage
- Window end time
- Calculated timestamp
- Sync status: `current`, `recent`, or `stale`

## Setup Instructions

### 1. Run Database Migrations

```bash
# Run OEE tracking tables migration
psql -U postgres -d production_dashboard -f backend/database/migration_add_oee_tracking.sql

# Run OK/NG length columns migration
psql -U postgres -d production_dashboard -f backend/database/migration_add_ok_ng_length.sql

# Run availability aggregation table migration
psql -U postgres -d production_dashboard -f backend/database/migration_add_availability_aggregation.sql
```

### 2. Verify Tables Exist

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('machine_status_history', 'production_quality', 'oee_calculations', 'availability_aggregations');

-- Check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'machines' 
AND column_name IN ('produced_length_ok', 'produced_length_ng');

-- Verify availability aggregations table structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'availability_aggregations'
ORDER BY ordinal_position;
```

### 3. Test OEE Calculation

```bash
# Update machine speed (should trigger OEE recalculation)
curl -X PATCH http://localhost:3001/api/machines/D-01 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"lineSpeed": 950, "targetSpeed": 1000}'

# Update machine with OK/NG lengths
curl -X PUT http://localhost:3001/api/machines/name/DA13 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "producedLengthOk": 3800,
    "producedLengthNg": 50,
    "producedLength": 3850
  }'
```

## Troubleshooting

### OEE Not Updating

1. Check if relevant fields are being updated
2. Verify database trigger is active: `SELECT * FROM machine_status_history LIMIT 1;`
3. Check backend logs for OEE calculation errors
4. Verify WebSocket connection is active

### Incorrect OEE Values

1. Verify `target_speed` is set correctly
2. Check `produced_length_ok` and `produced_length_ng` values
3. Review `machine_status_history` for status tracking
4. Check calculation period (order start time vs 24h window)

### Performance Issues

1. Check database indexes are created
2. Review `oee_calculations` table size (archive old data if needed)
3. Optimize status history queries (limit time range)
4. Consider caching OEE values for read-heavy scenarios

## API Reference

### Update Machine (Triggers OEE Calculation)

**PUT** `/api/machines/name/:machineName`

**Request Body:**
```json
{
  "lineSpeed": 950,
  "targetSpeed": 1000,
  "producedLength": 3850,
  "producedLengthOk": 3800,
  "producedLengthNg": 50,
  "status": "running"
}
```

**Response:**
```json
{
  "data": {
    "id": "D-01",
    "name": "DA13",
    "oee": 83.6,
    "availability": 94.5,
    "performance": 89.2,
    "quality": 99.1,
    ...
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

## Future Enhancements

1. **OEE Trending Charts**: Display OEE over time
2. **OEE Alerts**: Notify when OEE drops below threshold
3. **OEE Comparison**: Compare OEE across machines/areas
4. **OEE Reports**: Generate OEE reports per shift/day/week
5. **Machine Learning**: Predict OEE based on historical patterns

## References

- [OEE Calculation Standards](https://www.oee.com/)
- [Real-Time Data Architecture](./MES_ENTERPRISE_DATA_ARCHITECTURE.md)
- [API Integration Guide](./API_INTEGRATION.md)

