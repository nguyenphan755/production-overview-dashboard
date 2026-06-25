-- Hourly rollup for oee_calculations (Grafana + long-range Speed Lab)
-- Run after migration_add_oee_tracking.sql
-- Refresh via backend/scripts/refresh-oee-calculations-hourly.mjs or pg_cron

CREATE TABLE IF NOT EXISTS oee_calculations_hourly (
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    hour_start TIMESTAMP NOT NULL,
    avg_actual_speed DECIMAL(10, 2),
    max_actual_speed DECIMAL(10, 2),
    avg_target_speed DECIMAL(10, 2),
    avg_oee DECIMAL(5, 2),
    avg_availability DECIMAL(5, 2),
    avg_performance DECIMAL(5, 2),
    avg_quality DECIMAL(5, 2),
    sample_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (machine_id, hour_start)
);

CREATE INDEX IF NOT EXISTS idx_oee_calc_hourly_hour
    ON oee_calculations_hourly(hour_start DESC);

CREATE INDEX IF NOT EXISTS idx_oee_calc_hourly_machine_hour
    ON oee_calculations_hourly(machine_id, hour_start DESC);

COMMENT ON TABLE oee_calculations_hourly IS
    'Hourly aggregates from oee_calculations for Grafana long-range and retention warm tier.';

-- One-shot backfill helper (run manually for historical data)
-- INSERT INTO oee_calculations_hourly (...)
-- SELECT machine_id, date_trunc('hour', calculation_timestamp), ...
-- FROM oee_calculations
-- WHERE calculation_timestamp >= NOW() - INTERVAL '90 days'
-- GROUP BY machine_id, date_trunc('hour', calculation_timestamp)
-- ON CONFLICT (machine_id, hour_start) DO UPDATE SET ...;
