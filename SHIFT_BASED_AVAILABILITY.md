# Shift-Based Availability Calculation Update

## Overview

The Availability (A) factor in OEE calculations has been updated from a 10-minute rolling window to **shift-based intervals** aligned with the factory's 3-shift schedule.

## Shift Schedule

The factory operates with 3 shifts, each 8 hours:

- **Shift 1**: 06:00–14:00 (8 hours)
- **Shift 2**: 14:00–22:00 (8 hours)
- **Shift 3**: 22:00–06:00 (next day) (8 hours)

## What Changed

### 1. New Shift Calculator Utility

**File**: `backend/utils/shiftCalculator.js`

New utility functions:
- `getCurrentShift(date)` - Returns current shift number (1, 2, or 3)
- `getCurrentShiftWindow(date)` - Returns shift start/end times for current time
- `getShiftWindow(shift, date)` - Returns shift start/end times for specific shift
- `getShiftId(shift, date)` - Generates shift ID string (format: `shift-{number}-{YYYY-MM-DD}`)

### 2. Availability Sync Service

**File**: `backend/services/availabilitySync.js`

**Changes**:
- `syncMachineAvailability()` now uses shift-based windows instead of rolling windows
- `syncAllMachinesAvailability()` default parameter changed from `windowMinutes` to `useShiftBased` (default: `true`)
- `startContinuousSync()` now accepts `useShiftBased` parameter (default: `true`)
- All sync functions now calculate availability for the current shift period

### 3. OEE Calculator

**File**: `backend/services/oeeCalculator.js`

**Changes**:
- `calculateOEE()` now uses current shift window instead of 10-minute rolling window
- `calculateAvailability()` queries prioritize `'shift'` calculation type, falls back to `'rolling_window'` for legacy data

### 4. Availability Aggregator

**File**: `backend/services/availabilityAggregator.js`

**Changes**:
- `ensureAvailabilityCalculated()` now accepts `useShiftBased` parameter (default: `true`) instead of `windowMinutes`
- Automatically calculates current shift window when `useShiftBased = true`

### 5. Backend Server Configuration

**File**: `backend/server.js`

**Changes**:
- Replaced `WINDOW_MINUTES` environment variable with `AVAILABILITY_USE_SHIFTS` (default: `true`)
- `AVAILABILITY_SYNC_INTERVAL` still controls sync frequency (default: 30 seconds)
- Logging updated to show shift-based calculation type

### 6. Database Functions

**File**: `backend/database/migration_add_availability_aggregation.sql`

**Changes**:
- `trigger_availability_calculation()` function now calculates shift windows automatically
- `get_latest_availability()` function default changed from `'rolling_window'` to `'shift'`
- Shift window calculation handles midnight crossover for Shift 3

### 7. Machine Routes

**File**: `backend/routes/machines.js`

**Changes**:
- Status change handlers now call `ensureAvailabilityCalculated(machineId, true)` for shift-based calculation
- Updated in both `PATCH /api/machines/:id` and `PUT /api/machines/:id` endpoints

### 8. Availability Route

**File**: `backend/routes/availability.js`

**Changes**:
- `get_latest_availability()` query now uses `'shift'` calculation type

## How It Works

### Availability Calculation Flow

1. **Current Shift Detection**: System determines current shift based on time:
   - 06:00–14:00 → Shift 1
   - 14:00–22:00 → Shift 2
   - 22:00–06:00 → Shift 3

2. **Shift Window Calculation**: 
   - **Shift 1**: Start at 06:00 today, end at 14:00 today
   - **Shift 2**: Start at 14:00 today, end at 22:00 today
   - **Shift 3**: Start at 22:00 today, end at 06:00 tomorrow (handles midnight crossover)

3. **Availability Formula** (unchanged):
   ```
   Availability = (Running Time / Planned Production Time) × 100
   ```
   Where:
   - **Planned Production Time** = Shift duration (8 hours = 28,800 seconds)
   - **Running Time** = Sum of time spent in `'running'` status during the shift
   - **Downtime** = Sum of time spent in `'idle'`, `'stopped'`, `'error'`, `'warning'`, `'setup'` statuses

4. **Update Cycle**:
   - **Continuous Sync**: Every 30 seconds (configurable via `AVAILABILITY_SYNC_INTERVAL`)
   - **Status Change Trigger**: Immediately when machine status changes
   - **Frontend Polling**: Every 1 second (fetches latest calculated values)

## Configuration

### Environment Variables

**Backend `.env` file**:

```env
# Availability sync interval (seconds)
AVAILABILITY_SYNC_INTERVAL=30

# Use shift-based calculation (true/false)
# Default: true (uses shifts)
# Set to false to use legacy 10-minute rolling window
AVAILABILITY_USE_SHIFTS=true
```

### Switching Back to Rolling Window

If you need to temporarily switch back to rolling window calculation:

1. Set `AVAILABILITY_USE_SHIFTS=false` in backend `.env` file
2. Restart backend server
3. System will use 10-minute rolling windows instead

## Database Impact

### Availability Aggregations Table

The `availability_aggregations` table now stores:
- **Calculation Type**: `'shift'` (instead of `'rolling_window'`)
- **Shift ID**: Format `shift-{number}-{YYYY-MM-DD}` (e.g., `shift-1-2025-01-10`)
- **Window Start/End**: Shift start and end times

### Historical Data

- Legacy `'rolling_window'` records remain in database (for historical queries)
- New calculations use `'shift'` type
- System can query both types but prioritizes `'shift'` for current calculations

## Example

### Before (Rolling Window)
```
Current time: 13:45
Window: 13:35 - 13:45 (10 minutes)
Availability: Based on last 10 minutes of status history
```

### After (Shift-Based)
```
Current time: 13:45
Shift: Shift 1 (06:00-14:00)
Window: 06:00 - 14:00 (8 hours)
Availability: Based on entire Shift 1 performance so far
Running time: Sum of 'running' status since 06:00
Downtime: Sum of non-running statuses since 06:00
```

## Migration Notes

1. **No Data Migration Required**: Existing rolling window data remains unchanged
2. **Automatic Switch**: System automatically uses shift-based calculation on next sync
3. **Database Functions**: Updated functions are backward-compatible with existing data
4. **Frontend**: No changes required - frontend continues to poll and display availability values

## Testing

After deployment:

1. Check backend logs for shift-based sync confirmation:
   ```
   🔄 Starting continuous availability synchronization (interval: 30s, calculation: shift-based (3 shifts: 06:00-14:00, 14:00-22:00, 22:00-06:00))
   ```

2. Verify database:
   ```sql
   SELECT calculation_type, shift_id, window_start, window_end 
   FROM availability_aggregations 
   ORDER BY calculated_at DESC 
   LIMIT 5;
   ```
   Should show `calculation_type = 'shift'` with proper shift IDs

3. Check frontend displays:
   - Availability values should now reflect entire shift performance
   - Values update every 1 second (unchanged)
   - Status changes trigger immediate recalculation (unchanged)

## Rollback

To rollback to rolling window calculation:

1. Set `AVAILABILITY_USE_SHIFTS=false` in backend `.env`
2. Restart backend server
3. System will revert to 10-minute rolling windows

Note: Shift-based data in database will remain but won't be used for calculations.
