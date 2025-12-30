# Grafana Quick Start Guide

## Prerequisites

- Grafana installed (see installation steps below)
- PostgreSQL database running (already set up)
- Backend API running (for data collection)

---

## Step 1: Install Grafana

### Windows (Using Chocolatey)
```powershell
choco install grafana
```

### Windows (Manual)
1. Download from: https://grafana.com/grafana/download?platform=windows
2. Extract and run `bin/grafana-server.exe`
3. Access at: http://localhost:3000
4. Default login: `admin` / `admin` (change on first login)

### Docker (Recommended)
```powershell
docker run -d -p 3000:3000 --name=grafana grafana/grafana
```

---

## Step 2: Configure PostgreSQL Data Source

1. **Login to Grafana:** http://localhost:3000
2. **Go to:** Configuration → Data Sources → Add data source
3. **Select:** PostgreSQL
4. **Configure:**
   ```
   Name: Production MES Database
   Host: localhost:5432 (or your PostgreSQL host)
   Database: production_dashboard
   User: grafana_readonly (create this user - see below)
   Password: [your password]
   SSL Mode: disable (or require for production)
   ```

5. **Click:** "Save & Test"

---

## Step 3: Create Read-Only Database User

Run this SQL in PostgreSQL:

```sql
-- Create read-only user for Grafana
CREATE USER grafana_readonly WITH PASSWORD 'your_secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE production_dashboard TO grafana_readonly;
GRANT USAGE ON SCHEMA public TO grafana_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_readonly;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO grafana_readonly;
```

---

## Step 4: Create Your First Dashboard

### Dashboard 1: Machine Temperature Trend

1. **Create Dashboard:** Dashboards → New Dashboard
2. **Add Panel:** Click "Add visualization"
3. **Select Data Source:** Production MES Database
4. **Query:**
   ```sql
   SELECT 
     timestamp AS time,
     value AS temperature
   FROM machine_metrics
   WHERE 
     machine_id = 'D-01'
     AND metric_type = 'temperature'
     AND timestamp >= $__timeFrom()
     AND timestamp <= $__timeTo()
   ORDER BY timestamp ASC;
   ```
5. **Visualization:** Time series
6. **Panel Title:** "Machine D-01 Temperature"
7. **Save Dashboard**

### Dashboard 2: Multi-Machine Overview

1. **Create Dashboard:** Dashboards → New Dashboard
2. **Add Variable:**
   - Name: `machine_id`
   - Type: Query
   - Data Source: Production MES Database
   - Query: `SELECT id, name FROM machines ORDER BY name;`
   - Multi-value: Yes
   - Include All: Yes

3. **Add Panel - Temperature:**
   ```sql
   SELECT 
     timestamp AS time,
     machine_id,
     value AS temperature
   FROM machine_metrics
   WHERE 
     machine_id IN ($machine_id)
     AND metric_type = 'temperature'
     AND timestamp >= $__timeFrom()
     AND timestamp <= $__timeTo()
   ORDER BY timestamp ASC;
   ```

4. **Add Panel - Speed:**
   ```sql
   SELECT 
     timestamp AS time,
     machine_id,
     value AS speed,
     target_value AS target
   FROM machine_metrics
   WHERE 
     machine_id IN ($machine_id)
     AND metric_type = 'speed'
     AND timestamp >= $__timeFrom()
     AND timestamp <= $__timeTo()
   ORDER BY timestamp ASC;
   ```

5. **Add Panel - Current:**
   ```sql
   SELECT 
     timestamp AS time,
     machine_id,
     value AS current
   FROM machine_metrics
   WHERE 
     machine_id IN ($machine_id)
     AND metric_type = 'current'
     AND timestamp >= $__timeFrom()
     AND timestamp <= $__timeTo()
   ORDER BY timestamp ASC;
   ```

6. **Save Dashboard**

---

## Step 5: Configure Auto-Refresh

1. **Open Dashboard**
2. **Click:** Time picker (top right)
3. **Set:** Auto-refresh interval (e.g., 30s, 1m, 5m)
4. **Enable:** "Live" mode for real-time updates

---

## Step 6: Add Thresholds & Alerts

### Example: High Temperature Alert

1. **Edit Panel** → **Alert** tab
2. **Create Alert Rule:**
   ```
   Name: High Temperature Alert
   Condition: 
     WHEN avg() OF query(A, 5m, now) IS ABOVE 85
   Evaluations:
     - Evaluate every: 1m
     - For: 5m
   ```

3. **Add Notification Channel:**
   - Go to: Alerting → Notification channels
   - Add: Email, Slack, or Webhook
   - Configure with your details

4. **Save Alert**

---

## Step 7: Create Dashboard Variables (Advanced)

### Variable: Production Area

1. **Dashboard Settings** → **Variables** → **New variable**
2. **Configure:**
   ```
   Name: area
   Type: Query
   Data Source: Production MES Database
   Query: SELECT DISTINCT area FROM machines;
   Multi-value: Yes
   Include All: Yes
   ```

### Variable: Machine (Filtered by Area)

1. **New variable:**
   ```
   Name: machine_id
   Type: Query
   Data Source: Production MES Database
   Query: SELECT id, name FROM machines WHERE area = '$area' ORDER BY name;
   Multi-value: Yes
   Include All: Yes
   ```

### Use in Queries:
```sql
SELECT 
  timestamp AS time,
  value AS temperature
FROM machine_metrics
WHERE 
  machine_id IN ($machine_id)
  AND metric_type = 'temperature'
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
ORDER BY timestamp ASC;
```

---

## Step 8: Optimize Queries (Performance)

### Use Time Bucketing for Long Ranges

Instead of:
```sql
SELECT timestamp, value FROM machine_metrics WHERE ...
```

Use:
```sql
SELECT 
  time_bucket('5 minutes', timestamp) AS time,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value
FROM machine_metrics
WHERE 
  machine_id = '$machine_id'
  AND metric_type = 'temperature'
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
GROUP BY time
ORDER BY time ASC;
```

**Note:** Requires TimescaleDB extension. See main guide for installation.

---

## Sample Dashboard JSON Export

Save this as `machine-overview-dashboard.json` and import into Grafana:

```json
{
  "dashboard": {
    "title": "Machine Overview",
    "tags": ["machines", "production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Temperature Trend",
        "type": "timeseries",
        "targets": [
          {
            "rawSql": "SELECT timestamp AS time, value AS temperature FROM machine_metrics WHERE machine_id = '$machine_id' AND metric_type = 'temperature' AND timestamp >= $__timeFrom() AND timestamp <= $__timeTo() ORDER BY timestamp ASC;",
            "format": "time_series"
          }
        ]
      },
      {
        "id": 2,
        "title": "Speed vs Target",
        "type": "timeseries",
        "targets": [
          {
            "rawSql": "SELECT timestamp AS time, value AS speed, target_value AS target FROM machine_metrics WHERE machine_id = '$machine_id' AND metric_type = 'speed' AND timestamp >= $__timeFrom() AND timestamp <= $__timeTo() ORDER BY timestamp ASC;",
            "format": "time_series"
          }
        ]
      }
    ],
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

**Import:** Dashboards → Import → Upload JSON file

---

## Troubleshooting

### Connection Issues

**Error:** "Failed to connect to database"
- ✅ Check PostgreSQL is running
- ✅ Verify host/port (default: localhost:5432)
- ✅ Check firewall rules
- ✅ Verify user credentials

**Error:** "Permission denied"
- ✅ Verify user has SELECT permissions
- ✅ Check schema permissions
- ✅ Ensure user can connect to database

### Query Performance

**Slow Queries:**
- ✅ Add indexes (see main guide)
- ✅ Use time bucketing for long ranges
- ✅ Limit data points (use LIMIT in queries)
- ✅ Consider TimescaleDB for optimization

**No Data Showing:**
- ✅ Check time range (use "Last 1 hour" for testing)
- ✅ Verify data exists in database
- ✅ Check WHERE clause filters
- ✅ Test query directly in PostgreSQL

### Dashboard Issues

**Panels Not Updating:**
- ✅ Enable auto-refresh
- ✅ Check time range
- ✅ Verify data source connection
- ✅ Check browser console for errors

**Variables Not Working:**
- ✅ Verify variable query syntax
- ✅ Check variable name matches query usage
- ✅ Ensure multi-value is enabled if using IN clause

---

## Next Steps

1. ✅ Create additional dashboards for different use cases
2. ✅ Set up alerts for critical metrics
3. ✅ Configure user permissions and teams
4. ✅ Optimize queries with TimescaleDB (optional)
5. ✅ Set up data retention policies

---

## Quick Reference: Common Queries

### All Machines Temperature
```sql
SELECT 
  timestamp AS time,
  machine_id,
  value AS temperature
FROM machine_metrics
WHERE 
  metric_type = 'temperature'
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
ORDER BY timestamp ASC;
```

### Machine OEE Trend
```sql
SELECT 
  last_updated AS time,
  oee,
  availability,
  performance,
  quality
FROM machines
WHERE 
  id = '$machine_id'
  AND last_updated >= $__timeFrom()
  AND last_updated <= $__timeTo()
ORDER BY last_updated ASC;
```

### Energy Consumption
```sql
SELECT 
  hour AS time,
  SUM(energy_kwh) AS total_energy
FROM energy_consumption
WHERE 
  machine_id = '$machine_id'
  AND hour >= $__timeFrom()
  AND hour <= $__timeTo()
GROUP BY hour
ORDER BY hour ASC;
```

### Machine Status Count
```sql
SELECT 
  status,
  COUNT(*) AS count
FROM machines
GROUP BY status;
```

---

**For detailed technical information, see:** `GRAFANA_INTEGRATION_GUIDE.md`

