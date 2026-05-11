-- Full-line telemetry snapshots (all machine snapshot fields) partitioned by month on sampled_at.
-- PK includes sampled_at (required for PostgreSQL declarative partitioning).
-- Run ensure-machine-line-telemetry-partitions.mjs monthly (or via cron) to create future partitions.

BEGIN;

CREATE TABLE IF NOT EXISTS machine_line_telemetry (
    telemetry_id UUID NOT NULL DEFAULT gen_random_uuid(),
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    sampled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    area production_area NOT NULL,
    status machine_status NOT NULL DEFAULT 'idle',
    line_speed DECIMAL(14, 4),
    target_speed DECIMAL(14, 4),
    produced_length DECIMAL(14, 3),
    produced_length_ok DECIMAL(14, 3),
    produced_length_ng DECIMAL(14, 3),
    target_length DECIMAL(14, 3),
    production_order_id VARCHAR(100),
    production_order_name VARCHAR(255),
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    operator_name VARCHAR(255),
    oee DECIMAL(8, 4),
    availability DECIMAL(8, 4),
    performance DECIMAL(8, 4),
    quality DECIMAL(8, 4),
    performance_data_quality VARCHAR(64),
    quality_data_quality VARCHAR(64),
    motor_current DECIMAL(12, 4),
    power_kw DECIMAL(12, 4),
    energy_meter_kwh DECIMAL(14, 4),
    temperature DECIMAL(10, 2),
    multi_zone_temperatures JSONB,
    health_score DECIMAL(8, 2),
    vibration_level VARCHAR(64),
    runtime_hours DECIMAL(14, 4),
    source VARCHAR(32) NOT NULL DEFAULT 'machine_api',
    data_quality_flags SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sampled_at, telemetry_id)
) PARTITION BY RANGE (sampled_at);

COMMENT ON TABLE machine_line_telemetry IS 'Time-series snapshot of all machine line KPIs from API updates; partitioned monthly for reporting and AI.';

-- Default catch-all (safety if a month partition is missing)
CREATE TABLE IF NOT EXISTS machine_line_telemetry_default
    PARTITION OF machine_line_telemetry DEFAULT;

-- Create partitions for previous month, current, and next 2 months (relative to migration run time)
DO $$
DECLARE
    base_m date := date_trunc('month', CURRENT_DATE)::date;
    i int;
    p_start date;
    p_end date;
    p_name text;
BEGIN
    FOR i IN -1..2 LOOP
        p_start := (base_m + (i * interval '1 month'))::date;
        p_end := (p_start + interval '1 month')::date;
        p_name := 'machine_line_telemetry_y' || to_char(p_start, 'YYYY') || 'm' || to_char(p_start, 'MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF machine_line_telemetry FOR VALUES FROM (%L::timestamp) TO (%L::timestamp)',
            p_name,
            p_start::text,
            p_end::text
        );
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_mlt_machine_sampled
    ON machine_line_telemetry (machine_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mlt_sampled
    ON machine_line_telemetry (sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mlt_material_sampled
    ON machine_line_telemetry (material_code, sampled_at DESC)
    WHERE material_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mlt_order_sampled
    ON machine_line_telemetry (production_order_id, sampled_at DESC)
    WHERE production_order_id IS NOT NULL;

-- Hourly AI-oriented rollup (non-partitioned; bounded by query window in API)
CREATE OR REPLACE VIEW v_machine_telemetry_ai_hourly AS
SELECT
    date_trunc('hour', sampled_at) AS bucket_start,
    machine_id,
    area,
    COUNT(*)::bigint AS sample_count,
    AVG(power_kw) FILTER (WHERE power_kw IS NOT NULL) AS avg_power_kw,
    MIN(energy_meter_kwh) FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_min_kwh,
    MAX(energy_meter_kwh) FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_max_kwh,
    CASE
        WHEN MAX(energy_meter_kwh) IS NULL OR MIN(energy_meter_kwh) IS NULL THEN NULL::numeric
        WHEN MAX(energy_meter_kwh) < MIN(energy_meter_kwh) THEN NULL::numeric
        ELSE ROUND((MAX(energy_meter_kwh) - MIN(energy_meter_kwh))::numeric, 4)
    END AS energy_delta_kwh_bucket,
    AVG(line_speed) FILTER (WHERE line_speed IS NOT NULL) AS avg_line_speed,
    AVG(target_speed) FILTER (WHERE target_speed IS NOT NULL) AS avg_target_speed,
    AVG(availability) FILTER (WHERE availability IS NOT NULL) AS avg_availability,
    AVG(performance) FILTER (WHERE performance IS NOT NULL) AS avg_performance,
    AVG(quality) FILTER (WHERE quality IS NOT NULL) AS avg_quality,
    (ARRAY_AGG(material_code ORDER BY sampled_at DESC) FILTER (WHERE material_code IS NOT NULL))[1] AS material_code_last,
    (ARRAY_AGG(product_name ORDER BY sampled_at DESC) FILTER (WHERE product_name IS NOT NULL))[1] AS product_name_last,
    BOOL_OR((data_quality_flags & 1) = 1) AS any_meter_reset_flag
FROM machine_line_telemetry
GROUP BY date_trunc('hour', sampled_at), machine_id, area;

COMMENT ON VIEW v_machine_telemetry_ai_hourly IS 'Hourly aggregates for AI/reporting from machine_line_telemetry.';

COMMIT;
