-- ============================================================================
-- Performance indexes + retention guidance for hot MES query paths
-- Generated from the 2026-07 full technical audit.
--
-- HOW TO RUN (production-safe):
--   CREATE INDEX CONCURRENTLY does NOT lock writes, but it CANNOT run inside a
--   transaction block. Run each statement individually (psql autocommit), e.g.:
--
--     $env:PGPASSWORD='***'
--     psql -h <host> -U postgres -d production_dashboard -f backend/database/migration_performance_indexes_2026_07.sql
--
--   Prefer a low-traffic window. After completion, run ANALYZE on the tables.
--   Every statement is IF NOT EXISTS, so re-running is safe.
-- ============================================================================

-- 1) machine_metrics: every trend/sparkline filters (machine_id, metric_type, time).
--    Today only single-column indexes exist -> planner combines or seq-scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_machine_metrics_machine_type_time
  ON machine_metrics (machine_id, metric_type, timestamp DESC);

-- 2) production_orders: overlap queries (machine_id + start_time/end_time window)
--    used by speed history, availability sync and the OEE waterfall.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_orders_machine_start
  ON production_orders (machine_id, start_time DESC);

-- 3) production_length_events: range SUMs by (machine_id, event_time).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prod_len_events_machine_time
  ON production_length_events (machine_id, event_time);

-- 4) availability_aggregations: "latest shift per machine" lookup filters
--    calculation_type then orders by window_end; include type in the index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_agg_machine_type_window
  ON availability_aggregations (machine_id, calculation_type, window_end DESC);

-- 5) machine_status_history: closed-segment overlap also filters status_end_time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msh_machine_closed_end_start
  ON machine_status_history (machine_id, status_end_time, status_start_time)
  WHERE status_end_time IS NOT NULL;

-- 6) alarms: time-range queries by machine.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alarms_machine_timestamp
  ON alarms (machine_id, timestamp DESC);

-- 7) oee_calculations: BRIN for cheap, tiny cross-machine time scans (analytics).
--    Keep the existing (machine_id, calculation_timestamp) B-tree for per-machine.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oee_calc_ts_brin
  ON oee_calculations USING BRIN (calculation_timestamp);

-- ----------------------------------------------------------------------------
-- DATA INTEGRITY: at most one OPEN status segment per machine.
-- The status-history trigger assumes a single row with status_end_time IS NULL,
-- but nothing enforces it; concurrent status writes can create duplicates.
-- NOTE: if duplicates already exist this will fail — clean them up first:
--   -- find offenders:
--   -- SELECT machine_id, count(*) FROM machine_status_history
--   --   WHERE status_end_time IS NULL GROUP BY machine_id HAVING count(*) > 1;
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_msh_one_open_per_machine
  ON machine_status_history (machine_id)
  WHERE status_end_time IS NULL;

-- ----------------------------------------------------------------------------
-- RETENTION (review thresholds before enabling as scheduled jobs).
-- High-write tables grow unbounded today. Suggested policy — keep raw hot data
-- ~90 days, rely on oee_calculations_hourly for long-range reads.
--
--   DELETE FROM machine_metrics       WHERE timestamp < NOW() - INTERVAL '30 days';
--   DELETE FROM machine_energy_samples WHERE sampled_at < NOW() - INTERVAL '30 days';
--   DELETE FROM oee_calculations      WHERE calculation_timestamp < NOW() - INTERVAL '180 days';
--   DELETE FROM availability_aggregations WHERE window_end < NOW() - INTERVAL '180 days';
--
-- For machine_line_telemetry (monthly RANGE partitions) prefer DROP/DETACH of
-- old partitions over DELETE. Schedule via Windows Task Scheduler / pg_cron.
-- ----------------------------------------------------------------------------

-- After creating indexes, refresh planner statistics:
-- ANALYZE machine_metrics, production_orders, production_length_events,
--         availability_aggregations, machine_status_history, alarms, oee_calculations;
