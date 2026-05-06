# Real-Time Trend Updates Guide

## Overview
The Equipment Status tab now displays real-time trend charts for each machine, showing how key metrics change over time.

## Features

### 1. **Temperature Trend**
- Real-time temperature monitoring with color-coded indicators
- Red: >75°C (Warning)
- Orange: 65-75°C (Caution)
- Blue: <65°C (Normal)
- Updates automatically as temperature changes

### 2. **Speed Trend**
- Line speed tracking over time
- Shows current speed vs target speed
- Updates every 1 second or via WebSocket

### 3. **Motor Current Trend**
- Real-time current monitoring (Amperes)
- Tracks motor load and performance
- Updates automatically

### 4. **Power Trend**
- Power consumption tracking (kW)
- Area chart visualization
- Real-time updates

### 5. **Multi-Zone Temperature Monitoring**
- 4-zone temperature tracking (Z1, Z2, Z3, Z4)
- Individual trend lines for each zone
- Color-coded zones:
  - Zone 1: Red (#FF6B6B)
  - Zone 2: Orange (#FFB86C)
  - Zone 3: Amber (#F59E0B)
  - Zone 4: Cyan (#34E7F8)

### 6. **Energy Consumption**
- 24-hour energy tracking (kWh)
- Bar chart visualization
- Updates in real-time

## How It Works

### Frontend Architecture

1. **MachineTrendChart Component** (`src/components/MachineTrendChart.tsx`)
   - Mini sparkline chart component
   - Supports line and area chart modes
   - Auto-normalizes data for consistent visualization
   - Handles empty data gracefully

2. **useMachineTrends Hook** (`src/hooks/useMachineTrends.ts`)
   - Tracks trend history for all machines
   - Maintains last 20 data points per metric
   - Updates automatically when machine data changes
   - Efficient change detection (only updates when values change >0.1)

3. **EquipmentStatus Component** (`src/components/tabs/EquipmentStatus.tsx`)
   - Displays trends for each machine card
   - Shows current value + trend chart
   - Updates in real-time via polling (1s) and WebSocket

### Backend Support

- **Multi-Zone Temperatures**: JSONB column properly parsed
- **Real-Time Updates**: WebSocket broadcasts machine updates
- **Polling Fallback**: 1-second polling ensures data freshness

## Data Flow

```
Machine Data Update (SQL/API/Node-RED)
    ↓
Backend API (POSTGRESQL)
    ↓
WebSocket Broadcast / Polling (1s)
    ↓
Frontend Hook (useMachines)
    ↓
Trend Hook (useMachineTrends)
    ↓
Machine Card Component
    ↓
Trend Chart Display
```

## Update Methods

Trends update automatically when machine data changes via:

1. **SQL Updates** - Changes appear after 1 second (polling)
2. **API Updates** - Instant updates via WebSocket
3. **Node-RED Updates** - Real-time via MES REST API → WebSocket

## Trend Data Points

- **Maximum Points**: 20 data points per metric
- **Update Frequency**: Every 1 second (polling) or instant (WebSocket)
- **Change Detection**: Only updates when value changes >0.1
- **Normalization**: Data auto-normalized to 0-100% for consistent visualization

## Visual Design

- **Chart Height**: 30-40px (compact for machine cards)
- **Colors**: Match metric type and status
- **Animation**: Smooth 300ms transitions
- **Area Charts**: Used for temperature and power (gradient fill)
- **Line Charts**: Used for speed and current

## Example Usage

When you update machine data via SQL, API, or Node-RED:

```sql
-- Update temperature
UPDATE machines SET temperature = 72.5 WHERE id = 'D-01';
```

The trend chart will:
1. Detect the change (>0.1°C difference)
2. Add new data point to trend array
3. Remove oldest point (keep last 20)
4. Update chart visualization
5. Show updated current value

## Troubleshooting

### Trends Not Updating
1. Check if machine data is actually changing (>0.1 threshold)
2. Verify WebSocket connection (check browser console)
3. Ensure polling is active (1s interval)
4. Check backend logs for errors

### Empty Trends
- Trends start empty and populate as data arrives
- Minimum 2 data points needed for visualization
- Single data point is duplicated for display

### Performance
- Trends limited to 20 points per metric
- Change detection prevents unnecessary re-renders
- Charts use efficient Recharts library

## Future Enhancements

- Configurable trend history length
- Time-based x-axis labels
- Trend comparison between machines
- Export trend data
- Alert thresholds on trends

