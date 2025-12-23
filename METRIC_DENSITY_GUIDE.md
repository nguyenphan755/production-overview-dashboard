# Machine Metrics Density Guide - 3-5 Minute Trend Windows

This guide explains how to increase machine metrics sampling density to display clear 3-5 minute trend windows with 15-30 data points.

---

## 🎯 Goal

**Display clear 3-5 minute trend charts with:**
- **Minimum:** 15 data points (3 minutes × 5 points/minute)
- **Recommended:** 20-30 data points (5 minutes × 4-6 points/minute)
- **Current:** Only 7 data points (insufficient for clear visualization)

---

## 📊 Current vs. Recommended Sampling

### Current Setup (Insufficient)
- **Interval:** ~5 minutes between points
- **Window:** 30 minutes
- **Points:** 7 data points
- **Result:** Sparse, difficult to evaluate trends

### Recommended Setup (For 3-5 Minute Windows)
- **Interval:** 30 seconds to 1 minute between points
- **Window:** 5 minutes
- **Points:** 10-20 data points
- **Result:** Clear, detailed trend visualization

---

## 🔧 Solution 1: Update Backend Queries (Already Done ✅)

The backend queries have been updated to:
- Fetch data from **last 5 minutes** instead of just `LIMIT 7`
- Support up to **20 data points** per metric type
- Use time-based filtering: `timestamp >= NOW() - INTERVAL '5 minutes'`

**Updated queries in:** `backend/routes/machines.js`

---

## 🔧 Solution 2: Update Seed Script (Already Done ✅)

The seed script now generates:
- **10 data points** per metric (instead of 7)
- **5-minute window** (instead of 30 minutes)
- **30-second intervals** between points

**Updated file:** `backend/scripts/seed-sample-data.js`

---

## 🔧 Solution 3: Configure Real-Time Data Collection

### For Node-RED or PLC Integration

**Recommended sampling frequency:**

```javascript
// Insert metrics every 30 seconds for 3-5 minute trends
// This gives 6-10 data points per minute

// Example Node-RED flow:
// Inject node: Repeat every 30 seconds
// Function node: Generate/collect machine data
// PostgreSQL node: INSERT INTO machine_metrics
```

**SQL Template:**
```sql
INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
VALUES ($1, 'speed', $2, $3, CURRENT_TIMESTAMP);
```

### Sampling Frequency Recommendations

| Metric Type | Interval | Points (5 min) | Use Case |
|------------|----------|----------------|----------|
| **Speed** | 30 seconds | 10 points | Real-time monitoring |
| **Temperature** | 30 seconds | 10 points | Safety monitoring |
| **Current** | 30 seconds | 10 points | Load monitoring |
| **Power** | 1 minute | 5 points | Energy tracking |
| **Multi-zone Temp** | 30 seconds | 10 points | Zone control |

---

## 🔧 Solution 4: Backfill Dense Historical Data

Use the migration script to generate dense data for existing machines:

### Step 1: Run Migration Script

```bash
cd backend
psql -U postgres -d production_dashboard -f database/migration_increase_metric_density.sql
```

### Step 2: Generate Dense Data for All Machines

```sql
-- Connect to PostgreSQL
psql -U postgres -d production_dashboard

-- Generate dense metrics for all running machines
DO $$
DECLARE
    machine_record RECORD;
BEGIN
    FOR machine_record IN 
        SELECT id, line_speed, target_speed, current, power, temperature 
        FROM machines 
        WHERE status = 'running' AND line_speed > 0
    LOOP
        -- Speed metrics (10 points over 5 minutes)
        PERFORM generate_dense_metrics(
            machine_record.id, 
            'speed',
            machine_record.line_speed * 0.95,
            machine_record.line_speed,
            machine_record.target_speed,
            5,  -- 5 minutes
            30  -- 30 second intervals
        );
        
        -- Temperature metrics
        IF machine_record.temperature IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'temperature',
                machine_record.temperature - 5,
                machine_record.temperature,
                NULL,
                5,
                30
            );
        END IF;
        
        -- Current metrics
        IF machine_record.current IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'current',
                machine_record.current - 3,
                machine_record.current,
                NULL,
                5,
                30
            );
        END IF;
        
        -- Power metrics
        IF machine_record.power IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'power',
                machine_record.power - 5,
                machine_record.power,
                NULL,
                5,
                30
            );
        END IF;
    END LOOP;
END $$;
```

---

## 📝 Node-RED Configuration Example

### Flow: Insert Metrics Every 30 Seconds

**1. Inject Node:**
- Name: "Every 30s"
- Repeat: `30` seconds
- Once at start: `true`

**2. Function Node (Generate Data):**
```javascript
// Get machine data
const machines = ['D-01', 'D-02', 'D-03', 'S-01', 'S-02', 'SH-01'];
const machineId = machines[Math.floor(Math.random() * machines.length)];

// Get current machine state from database or PLC
// For this example, using simulated data
const baseSpeed = 920;
const baseTemp = 68;
const baseCurrent = 45.2;
const basePower = 68.5;

msg.payload = {
    machineId: machineId,
    metrics: [
        {
            metricType: 'speed',
            value: baseSpeed + (Math.random() - 0.5) * 20,
            targetValue: 1000
        },
        {
            metricType: 'temperature',
            value: baseTemp + (Math.random() - 0.5) * 5
        },
        {
            metricType: 'current',
            value: baseCurrent + (Math.random() - 0.5) * 3
        },
        {
            metricType: 'power',
            value: basePower + (Math.random() - 0.5) * 5
        }
    ]
};

return msg;
```

**3. Split Node:**
- Split array: `msg.payload.metrics`

**4. PostgreSQL Node:**
- Connection: Your PostgreSQL connection
- Query:
```sql
INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
```
- Parameters: `["payload.machineId", "payload.metricType", "payload.value", "payload.targetValue"]`

---

## 🔍 Verify Data Density

### Check Current Density

```sql
-- Check data points in last 5 minutes
SELECT 
    machine_id,
    metric_type,
    COUNT(*) as points,
    MIN(timestamp) as earliest,
    MAX(timestamp) as latest,
    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / COUNT(*) as avg_seconds_between
FROM machine_metrics
WHERE timestamp >= NOW() - INTERVAL '5 minutes'
GROUP BY machine_id, metric_type
ORDER BY machine_id, metric_type;
```

**Expected Result:**
- **Points:** 10-20 per metric type
- **Avg seconds between:** 30-60 seconds
- **Window:** Last 5 minutes

### Check Specific Machine

```sql
-- Check D-01 metrics density
SELECT 
    metric_type,
    COUNT(*) as points,
    MIN(timestamp) as first_point,
    MAX(timestamp) as last_point
FROM machine_metrics
WHERE machine_id = 'D-01'
  AND timestamp >= NOW() - INTERVAL '5 minutes'
GROUP BY metric_type
ORDER BY metric_type;
```

---

## 📊 Frontend Display

The frontend will now automatically:
- Fetch **up to 20 data points** per trend
- Display **5-minute time window**
- Show **smooth, detailed trend lines**

**No frontend changes needed** - the updated backend queries handle this automatically.

---

## ⚙️ Configuration Options

### Option A: 30-Second Intervals (Recommended)
- **Points:** 10 per 5 minutes
- **Best for:** Real-time monitoring, quick trend analysis
- **Storage:** ~2,880 points per machine per day

### Option B: 1-Minute Intervals
- **Points:** 5 per 5 minutes
- **Best for:** Balanced storage and detail
- **Storage:** ~1,440 points per machine per day

### Option C: 15-Second Intervals (High Frequency)
- **Points:** 20 per 5 minutes
- **Best for:** Critical monitoring, high-resolution analysis
- **Storage:** ~5,760 points per machine per day

---

## 🗄️ Database Storage Considerations

### Storage Calculation

**Per machine, per day:**
- 4 metric types (speed, temp, current, power) × 10 points/hour × 24 hours = **960 points/day**
- With 30-second intervals: **2,880 points/day**
- With 20 machines: **57,600 points/day**

### Index Performance

The existing indexes are optimized for this:
- `idx_machine_metrics_machine_id` - Fast machine lookups
- `idx_machine_metrics_timestamp` - Fast time-based queries
- `idx_machine_metrics_type` - Fast metric type filtering

### Data Retention

Consider archiving old data:
```sql
-- Archive data older than 30 days
DELETE FROM machine_metrics 
WHERE timestamp < NOW() - INTERVAL '30 days';
```

Or create a retention policy:
```sql
-- Keep only last 7 days of detailed metrics
DELETE FROM machine_metrics 
WHERE timestamp < NOW() - INTERVAL '7 days';
```

---

## ✅ Checklist

- [x] Backend queries updated to fetch 5-minute windows
- [x] Seed script updated to generate 10 points per metric
- [x] Migration script created for backfilling dense data
- [ ] Run migration script to backfill existing data
- [ ] Configure Node-RED/PLC to insert metrics every 30 seconds
- [ ] Verify data density using SQL queries
- [ ] Test trend charts display 10+ data points

---

## 🚀 Quick Start

### 1. Re-seed with Dense Data

```bash
cd backend
npm run seed
```

This will generate 10 data points per metric (instead of 7).

### 2. Verify in Database

```sql
SELECT COUNT(*) 
FROM machine_metrics 
WHERE timestamp >= NOW() - INTERVAL '5 minutes';
-- Should return 10+ points per machine per metric type
```

### 3. Configure Real-Time Collection

Set up Node-RED or your data source to insert metrics every 30 seconds.

---

## 📈 Expected Results

**Before:**
- 7 sparse data points
- 30-minute window
- Difficult to see trends

**After:**
- 10-20 dense data points
- 5-minute window
- Clear, detailed trend visualization

---

**Status:** Backend and seed script updated. Configure data collection frequency for real-time systems! ✅

