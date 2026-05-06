# Grafana Integration Guide: Technical Recommendation & Best Practices

## Executive Summary

**✅ Feasibility: YES** - Your system is well-suited for Grafana integration  
**✅ Performance: OPTIMAL** - With recommended optimizations  
**✅ Feature Support: FULL** - All Grafana features are accessible

---

## Current System Analysis

### Existing Architecture
- **Database:** PostgreSQL with `machine_metrics` table (time-series data)
- **Backend:** Express.js REST API + WebSocket for real-time updates
- **Data Structure:** 
  - `machine_metrics` table: `machine_id`, `metric_type`, `value`, `timestamp`, `zone_number`, `target_value`
  - Indexed on: `machine_id`, `timestamp`, `metric_type`
- **Current Trends:** Queried with time-range filters (5 minutes, 2 hours, 24 hours)

### Data Volume Estimate
- Assuming 20 machines × 5 metrics × 1 sample/30s = **~600 data points/minute**
- **~36,000 points/hour** = **~864,000 points/day**
- Current PostgreSQL setup can handle this, but optimization recommended for long-term scalability

---

## Recommended Integration Architecture

### **Option 1: Direct PostgreSQL Connection (Recommended for Start)**

**Best for:** Immediate implementation, existing infrastructure, moderate data volumes

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   MES API   │────▶│  PostgreSQL  │◀────│   Grafana   │
│  (Express)  │     │  (Current)   │     │  Dashboard  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       │                    │
       └────────────────────┘
      WebSocket (Real-time)
```

**Advantages:**
- ✅ **Zero additional infrastructure** - Use existing PostgreSQL
- ✅ **Immediate implementation** - Connect Grafana today
- ✅ **Single source of truth** - No data synchronization needed
- ✅ **Full SQL query support** - Leverage PostgreSQL's powerful querying
- ✅ **Cost-effective** - No additional database licenses

**Performance Considerations:**
- Current indexes are adequate for moderate queries
- For high-frequency dashboards (10+ panels), consider:
  - **Materialized views** for pre-aggregated metrics
  - **Partitioning** `machine_metrics` by time (monthly/quarterly)
  - **TimescaleDB extension** (see Option 2)

**Implementation Steps:**
1. Install Grafana
2. Add PostgreSQL data source
3. Configure connection (read-only user recommended)
4. Create dashboards with SQL queries

---

### **Option 2: TimescaleDB (PostgreSQL Extension) - Recommended for Scale**

**Best for:** Long-term scalability, high-frequency queries, time-series optimization

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   MES API   │────▶│   TimescaleDB    │◀────│   Grafana   │
│  (Express)  │     │  (PostgreSQL +   │     │  Dashboard  │
└─────────────┘     │   Extension)     │     └─────────────┘
       │            └──────────────────┘
       │
       └────────────────────┘
      WebSocket (Real-time)
```

**Advantages:**
- ✅ **10-100x faster queries** for time-series data
- ✅ **Automatic data compression** (up to 90% storage reduction)
- ✅ **Continuous aggregates** (pre-computed rollups)
- ✅ **Retention policies** (automatic data lifecycle management)
- ✅ **Hypertables** (automatic partitioning by time)
- ✅ **No application changes** - Works with existing PostgreSQL

**Migration Path:**
```sql
-- 1. Install TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Convert machine_metrics to hypertable
SELECT create_hypertable('machine_metrics', 'timestamp');

-- 3. Create continuous aggregate for common queries
CREATE MATERIALIZED VIEW machine_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', timestamp) AS hour,
  machine_id,
  metric_type,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS point_count
FROM machine_metrics
GROUP BY hour, machine_id, metric_type;

-- 4. Add refresh policy (updates every hour)
SELECT add_continuous_aggregate_policy('machine_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

**Performance Gains:**
- **Query speed:** 10-50x faster for time-range queries
- **Storage:** 70-90% reduction with compression
- **Dashboard load:** Sub-second response for complex dashboards

---

### **Option 3: InfluxDB (Dedicated Time-Series Database)**

**Best for:** Maximum performance, very high data volumes, specialized time-series needs

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   MES API   │────▶│   InfluxDB   │◀────│   Grafana   │
│  (Express)  │     │  (Time-Series│     │  Dashboard  │
└─────────────┘     │   Database)  │     └─────────────┘
       │            └──────────────┘
       │                    ▲
       │                    │
       └────────────────────┘
      WebSocket (Real-time)
```

**Advantages:**
- ✅ **Optimized for time-series** - Purpose-built database
- ✅ **High write throughput** - Millions of points/second
- ✅ **Efficient compression** - Columnar storage
- ✅ **Downsampling/retention** - Built-in data lifecycle

**Disadvantages:**
- ❌ **Additional infrastructure** - Separate database to maintain
- ❌ **Data synchronization** - Need to write to both PostgreSQL and InfluxDB
- ❌ **Learning curve** - Different query language (Flux/InfluxQL)
- ❌ **Cost** - Additional server resources

**When to Use:**
- Data volume > 1 million points/day
- Need sub-100ms query response times
- Specialized time-series analytics required

---

## Connection Pattern: Scalability & Low Latency

### **Recommended Pattern: Direct Database Connection with Connection Pooling**

```
┌─────────────┐
│   Grafana   │
│  Dashboard  │
└──────┬──────┘
       │
       │ (Connection Pool)
       │ Max: 10-20 connections
       │
       ▼
┌──────────────────┐
│  PostgreSQL      │
│  Connection Pool  │
│  (pgBouncer)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  PostgreSQL DB   │
│  (Read Replica)  │
└──────────────────┘
```

**Configuration:**
1. **Read-Only User for Grafana:**
   ```sql
   CREATE USER grafana_readonly WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE production_dashboard TO grafana_readonly;
   GRANT USAGE ON SCHEMA public TO grafana_readonly;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_readonly;
   ```

2. **Connection Pooling (pgBouncer):**
   - Prevents connection exhaustion
   - Reduces connection overhead
   - Recommended: 10-20 max connections per Grafana instance

3. **Read Replica (Optional, for Scale):**
   - Offloads read queries from primary database
   - Ensures MES API writes don't impact Grafana queries
   - Recommended when: > 5 concurrent Grafana users, > 50 dashboard panels

---

## Grafana Feature Support

### ✅ **1. Arbitrary Time-Range Queries**

**Fully Supported** - PostgreSQL excels at time-range queries

**Example Query:**
```sql
SELECT 
  time_bucket('5 minutes', timestamp) AS time,
  machine_id,
  metric_type,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value
FROM machine_metrics
WHERE 
  timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
  AND machine_id = '$machine_id'
  AND metric_type = 'temperature'
GROUP BY time, machine_id, metric_type
ORDER BY time ASC;
```

**Grafana Variables:**
- `$__timeFrom()` - Start of selected time range
- `$__timeTo()` - End of selected time range
- `$machine_id` - Selected machine (dropdown variable)

**Performance:**
- With TimescaleDB: **< 100ms** for 1-year queries
- With standard PostgreSQL: **< 500ms** for 1-month queries

---

### ✅ **2. Dynamic Filtering & Ad-Hoc Queries**

**Fully Supported** - Use Grafana template variables

**Example Dashboard Variables:**
```sql
-- Variable: machine_id (Multi-select dropdown)
SELECT id, name FROM machines ORDER BY name;

-- Variable: metric_type (Multi-select)
SELECT DISTINCT metric_type FROM machine_metrics;

-- Variable: area (Filter by production area)
SELECT DISTINCT area FROM machines;
```

**Dynamic Query Example:**
```sql
SELECT 
  timestamp AS time,
  value,
  target_value
FROM machine_metrics
WHERE 
  machine_id IN ($machine_id)
  AND metric_type IN ($metric_type)
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
ORDER BY timestamp ASC;
```

**Features:**
- ✅ Multi-select filters
- ✅ Regex matching
- ✅ Cascading variables (area → machine)
- ✅ Custom query variables

---

### ✅ **3. Conditional Coloring, Thresholds & Alerts**

**Fully Supported** - Grafana's native features

**Threshold Configuration:**
```yaml
Thresholds:
  - value: 0
    color: "green"
    label: "Normal"
  - value: 70
    color: "yellow"
    label: "Warning"
  - value: 85
    color: "red"
    label: "Critical"
```

**Alert Rules:**
```yaml
Alert:
  Name: High Temperature Alert
  Condition: 
    WHEN avg() OF query(A, 5m, now) IS ABOVE 85
  Evaluations:
    - Evaluate every: 1m
    - For: 5m
  Notifications:
    - Email
    - Slack
    - PagerDuty
```

**Example Alert Query:**
```sql
SELECT 
  time_bucket('1 minute', timestamp) AS time,
  machine_id,
  AVG(value) AS avg_temperature
FROM machine_metrics
WHERE 
  metric_type = 'temperature'
  AND timestamp >= NOW() - INTERVAL '10 minutes'
GROUP BY time, machine_id
HAVING AVG(value) > 85;
```

---

### ✅ **4. Dashboard-Level Time Synchronization**

**Fully Supported** - Grafana's built-in feature

**Configuration:**
- **Time Range Picker:** Top-right corner (Last 1h, 6h, 24h, 7d, 30d, Custom)
- **Auto-refresh:** Configurable interval (5s, 10s, 30s, 1m, 5m)
- **Time Sync:** All panels automatically use dashboard time range

**Best Practices:**
1. **Use `$__timeFrom()` and `$__timeTo()`** in all queries
2. **Enable auto-refresh** for real-time monitoring (30s-1m recommended)
3. **Use relative time ranges** for consistency across users
4. **Set default time range** based on use case:
   - Real-time monitoring: Last 1 hour
   - Daily review: Last 24 hours
   - Weekly analysis: Last 7 days

---

## Performance Optimization Recommendations

### **1. Database Indexes (Current + Additional)**

```sql
-- Existing indexes (already present)
CREATE INDEX idx_machine_metrics_machine_id ON machine_metrics(machine_id);
CREATE INDEX idx_machine_metrics_timestamp ON machine_metrics(timestamp);
CREATE INDEX idx_machine_metrics_type ON machine_metrics(metric_type);

-- Recommended composite indexes for Grafana queries
CREATE INDEX idx_machine_metrics_composite ON machine_metrics(machine_id, metric_type, timestamp DESC);
CREATE INDEX idx_machine_metrics_time_type ON machine_metrics(timestamp, metric_type) WHERE timestamp > NOW() - INTERVAL '30 days';
```

### **2. Query Optimization**

**Use Time Bucketing:**
```sql
-- Instead of raw points (slow for long ranges)
SELECT timestamp, value FROM machine_metrics WHERE ...

-- Use aggregation (fast for long ranges)
SELECT 
  time_bucket('5 minutes', timestamp) AS time,
  AVG(value) AS avg_value
FROM machine_metrics
WHERE ...
GROUP BY time;
```

**Limit Data Points:**
```sql
-- Grafana automatically limits, but you can optimize
SELECT * FROM (
  SELECT timestamp, value
  FROM machine_metrics
  WHERE timestamp >= $__timeFrom()
  ORDER BY timestamp DESC
  LIMIT 10000  -- Max points per query
) subquery
ORDER BY timestamp ASC;
```

### **3. Materialized Views (For Common Queries)**

```sql
-- Pre-aggregate hourly metrics
CREATE MATERIALIZED VIEW machine_metrics_hourly AS
SELECT 
  DATE_TRUNC('hour', timestamp) AS hour,
  machine_id,
  metric_type,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS point_count
FROM machine_metrics
GROUP BY hour, machine_id, metric_type;

-- Refresh periodically (via cron or pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY machine_metrics_hourly;

-- Create index on materialized view
CREATE INDEX idx_metrics_hourly ON machine_metrics_hourly(hour, machine_id, metric_type);
```

---

## Implementation Roadmap

### **Phase 1: Quick Start (1-2 days)**
1. ✅ Install Grafana
2. ✅ Add PostgreSQL data source
3. ✅ Create basic dashboard with 3-5 panels
4. ✅ Test time-range queries
5. ✅ Configure auto-refresh

### **Phase 2: Optimization (3-5 days)**
1. ✅ Add composite indexes
2. ✅ Create materialized views for common queries
3. ✅ Set up connection pooling (pgBouncer)
4. ✅ Configure read-only user
5. ✅ Create dashboard templates

### **Phase 3: Advanced Features (1 week)**
1. ✅ Set up alerts (email/Slack)
2. ✅ Create multi-machine dashboards
3. ✅ Implement dashboard variables
4. ✅ Add annotations (alarms, maintenance)
5. ✅ Configure user permissions

### **Phase 4: Scale (Optional, 1-2 weeks)**
1. ✅ Migrate to TimescaleDB (if needed)
2. ✅ Set up read replica
3. ✅ Implement data retention policies
4. ✅ Create continuous aggregates
5. ✅ Performance tuning

---

## Sample Grafana Dashboard Queries

### **1. Machine Temperature Over Time**
```sql
SELECT 
  timestamp AS time,
  value AS temperature,
  target_value AS target
FROM machine_metrics
WHERE 
  machine_id = '$machine_id'
  AND metric_type = 'temperature'
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
ORDER BY timestamp ASC;
```

### **2. Multi-Zone Temperature Comparison**
```sql
SELECT 
  timestamp AS time,
  MAX(CASE WHEN zone_number = 1 THEN value END) AS zone1,
  MAX(CASE WHEN zone_number = 2 THEN value END) AS zone2,
  MAX(CASE WHEN zone_number = 3 THEN value END) AS zone3,
  MAX(CASE WHEN zone_number = 4 THEN value END) AS zone4
FROM machine_metrics
WHERE 
  machine_id = '$machine_id'
  AND metric_type = 'multi_zone_temp'
  AND timestamp >= $__timeFrom()
  AND timestamp <= $__timeTo()
GROUP BY timestamp
ORDER BY timestamp ASC;
```

### **3. OEE Trend (from machines table)**
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

### **4. Power Consumption (Energy Table)**
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

### **5. Machine Status Over Time**
```sql
SELECT 
  timestamp AS time,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  COUNT(*) FILTER (WHERE status = 'idle') AS idle,
  COUNT(*) FILTER (WHERE status = 'error') AS error
FROM machines
WHERE 
  area = '$area'
  AND last_updated >= $__timeFrom()
  AND last_updated <= $__timeTo()
GROUP BY timestamp
ORDER BY timestamp ASC;
```

---

## Security Considerations

### **1. Database Access**
- ✅ Use **read-only user** for Grafana
- ✅ Restrict to specific tables/schemas
- ✅ Use connection pooling to limit connections
- ✅ Enable SSL/TLS for database connections

### **2. Grafana Access**
- ✅ Enable authentication (LDAP, OAuth, or local users)
- ✅ Use role-based access control (RBAC)
- ✅ Restrict dashboard access by team/role
- ✅ Enable audit logging

### **3. Network Security**
- ✅ Place Grafana behind reverse proxy (nginx)
- ✅ Use HTTPS for all connections
- ✅ Restrict database access to Grafana server IP
- ✅ Use VPN for remote access (if needed)

---

## Cost-Benefit Analysis

### **Option 1: Direct PostgreSQL**
- **Cost:** $0 (uses existing infrastructure)
- **Setup Time:** 1-2 days
- **Performance:** Good (adequate for most use cases)
- **Maintenance:** Low (no additional systems)

### **Option 2: TimescaleDB**
- **Cost:** $0 (open-source extension)
- **Setup Time:** 3-5 days (including migration)
- **Performance:** Excellent (10-50x faster)
- **Maintenance:** Low (PostgreSQL extension)

### **Option 3: InfluxDB**
- **Cost:** Server resources + maintenance time
- **Setup Time:** 1-2 weeks (including data sync)
- **Performance:** Excellent (purpose-built)
- **Maintenance:** Medium (separate database)

**Recommendation:** Start with **Option 1**, migrate to **Option 2** when needed.

---

## Conclusion

### **✅ Feasibility: YES**
Your system architecture is well-suited for Grafana integration. The existing PostgreSQL database with `machine_metrics` table provides an excellent foundation.

### **✅ Performance: OPTIMAL (with recommendations)**
- Current setup: **Good** for moderate use
- With TimescaleDB: **Excellent** for high-scale use
- With optimizations: **Sub-second** query responses

### **✅ Feature Support: FULL**
All Grafana features are fully accessible:
- ✅ Arbitrary time-range queries
- ✅ Dynamic filtering and ad-hoc queries
- ✅ Conditional coloring, thresholds, and alerts
- ✅ Dashboard-level time synchronization

### **Recommended Approach:**
1. **Start:** Direct PostgreSQL connection (Option 1)
2. **Optimize:** Add indexes and materialized views
3. **Scale:** Migrate to TimescaleDB (Option 2) when needed

### **Next Steps:**
1. Install Grafana
2. Configure PostgreSQL data source
3. Create first dashboard
4. Test performance with real queries
5. Iterate and optimize based on usage patterns

---

## Additional Resources

- **Grafana PostgreSQL Data Source:** https://grafana.com/docs/grafana/latest/datasources/postgres/
- **TimescaleDB Documentation:** https://docs.timescale.com/
- **Grafana Alerting:** https://grafana.com/docs/grafana/latest/alerting/
- **PostgreSQL Performance Tuning:** https://www.postgresql.org/docs/current/performance-tips.html

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-21  
**Author:** Technical Architecture Team

