# API Integration Guide

This document describes the API structure for the Production Overview Dashboard and how to integrate it with Node-RED and PLC systems.

## Overview

The frontend is designed to work with a REST API that can be easily switched between:
- **Mock Data** (for development) - Currently active
- **Real Node-RED API** (for production) - Ready to integrate

## Configuration

The API configuration is controlled by environment variables in `.env`:

```env
# API Base URL (for real API)
VITE_API_BASE_URL=http://localhost:3001/api

# Use mock data (true/false)
VITE_USE_MOCK_DATA=true

# Enable real-time updates
VITE_REALTIME_ENABLED=false
```

To switch to real API:
1. Set `VITE_USE_MOCK_DATA=false`
2. Set `VITE_API_BASE_URL` to your Node-RED API endpoint
3. Ensure your Node-RED API matches the endpoints below

## API Endpoints

### Base URL
All endpoints are relative to the base URL configured in `VITE_API_BASE_URL`.

### 1. Global KPIs
**GET** `/kpis/global`

**Response:**
```json
{
  "data": {
    "running": 26,
    "total": 33,
    "output": 93050,
    "orders": 18,
    "alarms": 3,
    "energy": 1.2
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

### 2. Production Areas
**GET** `/areas`

**Response:**
```json
{
  "data": [
    {
      "id": "drawing",
      "name": "KÉO",
      "nameEn": "DRAWING",
      "running": 12,
      "total": 15,
      "output": 45680,
      "speedAvg": 856,
      "alarms": 2,
      "topMachines": [
        {
          "id": "D-01",
          "name": "D-01",
          "speed": 920,
          "status": "running"
        }
      ],
      "sparklineData": [780, 820, 850, 840, 880, 890, 870, 885, 900, 856]
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

**GET** `/areas/{areaId}`

Get single area by ID (`drawing`, `stranding`, `armoring`, `sheathing`)

### 3. Machines
**GET** `/machines`

Get all machines.

**GET** `/machines?area={areaId}`

Get machines filtered by area.

**Response:**
```json
{
  "data": [
    {
      "id": "D-01",
      "name": "Drawing Line 01",
      "area": "drawing",
      "status": "running",
      "lineSpeed": 920,
      "targetSpeed": 1000,
      "producedLength": 3850,
      "targetLength": 5000,
      "productionOrderId": "PO-2024-156",
      "productionOrderName": "PO-2024-156",
      "operatorName": "Nguyễn Văn An",
      "oee": 83.6,
      "availability": 94.5,
      "performance": 89.2,
      "quality": 99.1,
      "current": 45.2,
      "power": 68.5,
      "temperature": 68,
      "multiZoneTemperatures": {
        "zone1": 148,
        "zone2": 161,
        "zone3": 169,
        "zone4": 155
      },
      "alarms": [],
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

**GET** `/machines/{machineId}`

Get detailed machine information including trends.

**Response:**
```json
{
  "data": {
    "id": "D-01",
    "name": "Drawing Line 01",
    "area": "drawing",
    "status": "running",
    "lineSpeed": 920,
    "targetSpeed": 1000,
    "producedLength": 3850,
    "targetLength": 5000,
    "productionOrderId": "PO-2024-156",
    "productionOrderName": "PO-2024-156",
    "operatorName": "Nguyễn Văn An",
    "oee": 83.6,
    "availability": 94.5,
    "performance": 89.2,
    "quality": 99.1,
    "current": 45.2,
    "power": 68.5,
    "temperature": 68,
    "multiZoneTemperatures": {
      "zone1": 148,
      "zone2": 161,
      "zone3": 169,
      "zone4": 155
    },
    "alarms": [],
    "lastUpdated": "2024-01-15T10:30:00.000Z",
    "productionOrder": {
      "id": "PO-2024-156",
      "name": "PO-2024-156",
      "productName": "CV 3x2.5mm²",
      "customer": "Công ty ABC",
      "machineId": "D-01",
      "startTime": "2024-01-15T06:15:00.000Z",
      "producedLength": 3850,
      "targetLength": 5000,
      "status": "running"
    },
    "speedTrend": [
      {
        "time": "13:30",
        "speed": 890,
        "target": 1000
      }
    ],
    "temperatureTrend": [
      {
        "time": "13:30",
        "temp": 65
      }
    ],
    "currentTrend": [
      {
        "time": "13:30",
        "current": 43.2
      }
    ],
    "multiZoneTemperatureTrend": [
      {
        "time": "13:30",
        "zone1": 145,
        "zone2": 158,
        "zone3": 165,
        "zone4": 152
      }
    ],
    "powerTrend": [
      {
        "time": "12:00",
        "power": 65.2,
        "avgPower": 68,
        "minRange": 60,
        "maxRange": 75
      }
    ],
    "energyConsumption": [
      {
        "hour": "00:00",
        "energy": 52.3
      }
    ],
    "orderHistory": []
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

### 4. Production Orders
**GET** `/orders`

Get all production orders.

**GET** `/orders/{orderId}`

Get single production order.

**GET** `/machines/{machineId}/orders`

Get orders for a specific machine.

**Response:**
```json
{
  "data": [
    {
      "id": "PO-2024-156",
      "name": "PO-2024-156",
      "productName": "CV 3x2.5mm²",
      "customer": "Công ty ABC",
      "machineId": "D-01",
      "startTime": "2024-01-15T06:15:00.000Z",
      "endTime": null,
      "producedLength": 3850,
      "targetLength": 5000,
      "status": "running"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

## Data Types

### Machine Status
- `running` - Machine is actively producing
- `idle` - Machine is on but not producing
- `warning` - Machine has warnings but still operational
- `error` - Machine has errors and stopped
- `stopped` - Machine is intentionally stopped
- `setup` - Machine is being set up for production

### Production Area
- `drawing` - Drawing/Kéo area
- `stranding` - Stranding/Xoắn area
- `armoring` - Armoring/Bọc thép area
- `sheathing` - Sheathing/Bọc area

### Production Order Status
- `running` - Order is currently being produced
- `completed` - Order is finished
- `interrupted` - Order was interrupted
- `cancelled` - Order was cancelled

## Real-Time Updates

The frontend supports real-time updates via WebSocket or Server-Sent Events (SSE). Currently, the mock API simulates this with polling intervals.

### WebSocket Implementation (Recommended)

For Node-RED, implement WebSocket endpoints:

**Machine Updates:**
```
ws://your-api-url/machines/{machineId}/stream
```

**Global Updates:**
```
ws://your-api-url/global/stream
```

The WebSocket should send JSON messages matching the data structures above.

### Server-Sent Events (Alternative)

**Machine Updates:**
```
GET /machines/{machineId}/stream
Content-Type: text/event-stream
```

**Global Updates:**
```
GET /global/stream
Content-Type: text/event-stream
```

## Node-RED Integration

### Recommended Flow Structure

1. **PLC Data Collection**
   - OPC UA nodes to read from PLCs
   - MQTT nodes for IoT sensors
   - HTTP nodes for other data sources

2. **Data Processing**
   - Function nodes to transform data
   - Calculate OEE metrics
   - Aggregate area statistics

3. **API Endpoints**
   - HTTP In nodes for REST endpoints
   - Store data in InfluxDB or similar time-series DB
   - Return formatted JSON responses

4. **Real-Time Updates**
   - WebSocket nodes for live updates
   - Or use `node-red-contrib-sse` for SSE

### Example Node-RED Flow

```javascript
// HTTP In node: GET /api/machines
// Function node: Query InfluxDB and format response
const machines = await queryInfluxDB('SELECT * FROM machines');
return {
  data: machines.map(formatMachine),
  timestamp: new Date().toISOString(),
  success: true
};
```

## Database Schema Recommendations

### InfluxDB (Time-Series)

**Measurement: `machine_metrics`**
```
Tags: machine_id, area, status
Fields: line_speed, target_speed, produced_length, current, power, temperature, oee, availability, performance, quality
Time: timestamp
```

**Measurement: `production_orders`**
```
Tags: order_id, machine_id, status, customer
Fields: produced_length, target_length
Time: start_time, end_time
```

### PostgreSQL (Relational - Optional)

**Tables:**
- `machines` - Machine master data
- `production_orders` - Order information
- `machine_alarms` - Alarm history
- `operators` - Operator assignments

## Error Handling

All API responses follow this structure:

```json
{
  "data": null,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": false,
  "message": "Error description"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

## Testing

To test the API integration:

1. Start with mock data (`VITE_USE_MOCK_DATA=true`)
2. Verify all UI components work correctly
3. Switch to real API (`VITE_USE_MOCK_DATA=false`)
4. Test each endpoint individually
5. Verify real-time updates work

## Migration Checklist

- [ ] Set up Node-RED flows for data collection
- [ ] Implement REST API endpoints matching the schema
- [ ] Set up time-series database (InfluxDB recommended)
- [ ] Configure WebSocket/SSE for real-time updates
- [ ] Test all endpoints with Postman/curl
- [ ] Update environment variables
- [ ] Test frontend with real API
- [ ] Monitor performance and optimize queries
- [ ] Set up error logging and monitoring

## Support

For questions or issues:
1. Check the mock API implementation in `src/services/mockApi.ts`
2. Review the type definitions in `src/types/index.ts`
3. Check the API client in `src/services/api.ts`

