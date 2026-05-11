-- Production Overview Dashboard Database Schema

-- Create enum types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_status') THEN
        CREATE TYPE machine_status AS ENUM ('running', 'idle', 'warning', 'error', 'stopped', 'setup');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_area') THEN
        CREATE TYPE production_area AS ENUM ('drawing', 'stranding', 'armoring', 'sheathing');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alarm_severity') THEN
        CREATE TYPE alarm_severity AS ENUM ('info', 'warning', 'error', 'critical');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('running', 'completed', 'interrupted', 'cancelled');
    END IF;
END$$;

-- Material Master table
CREATE TABLE IF NOT EXISTS material_master (
    material_code VARCHAR(50) PRIMARY KEY,
    material_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Machines table
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    area production_area NOT NULL,
    status machine_status NOT NULL DEFAULT 'idle',
    line_speed DECIMAL(10, 2) DEFAULT 0,
    target_speed DECIMAL(10, 2) DEFAULT 0,
    produced_length DECIMAL(12, 2) DEFAULT 0,
    length_counter DECIMAL(12, 2) DEFAULT 0,
    length_counter_last DECIMAL(12, 2) DEFAULT 0,
    length_counter_last_at TIMESTAMP,
    current_shift_id VARCHAR(50),
    current_shift_start TIMESTAMP,
    current_shift_end TIMESTAMP,
    target_length DECIMAL(12, 2),
    production_order_id VARCHAR(100),
    production_order_name VARCHAR(255),
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    operator_name VARCHAR(255),
    oee DECIMAL(5, 2),
    availability DECIMAL(5, 2),
    performance DECIMAL(5, 2),
    quality DECIMAL(5, 2),
    performance_data_quality VARCHAR(64),
    quality_data_quality VARCHAR(64),
    current DECIMAL(10, 2),
    power DECIMAL(10, 2),
    temperature DECIMAL(10, 2),
    multi_zone_temperatures JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production length event log (delta-based)
CREATE TABLE IF NOT EXISTS production_length_events (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    area production_area NOT NULL,
    production_order_id VARCHAR(100),
    shift_id VARCHAR(50) NOT NULL,
    shift_date DATE NOT NULL,
    status machine_status NOT NULL,
    counter_value DECIMAL(12, 2) NOT NULL,
    last_counter_value DECIMAL(12, 2),
    delta_length DECIMAL(12, 2) NOT NULL DEFAULT 0,
    is_running BOOLEAN NOT NULL DEFAULT FALSE,
    reset_detected BOOLEAN NOT NULL DEFAULT FALSE,
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production Orders table
CREATE TABLE IF NOT EXISTS production_orders (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_name_current VARCHAR(255),
    customer VARCHAR(255) NOT NULL,
    machine_id VARCHAR(50) REFERENCES machines(id),
    machine_name VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    produced_length DECIMAL(12, 2) DEFAULT 0,
    target_length DECIMAL(12, 2) NOT NULL,
    status order_status NOT NULL DEFAULT 'running',
    duration VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alarms table
CREATE TABLE IF NOT EXISTS alarms (
    id VARCHAR(100) PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    severity alarm_severity NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Machine Metrics (Time Series Data)
CREATE TABLE IF NOT EXISTS machine_metrics (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'speed', 'temperature', 'current', 'power', 'multi_zone_temp'
    value DECIMAL(10, 2),
    zone_number INTEGER, -- For multi-zone temperatures (1-4)
    target_value DECIMAL(10, 2),
    product_name VARCHAR(255),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Energy Consumption table
CREATE TABLE IF NOT EXISTS energy_consumption (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    energy_kwh DECIMAL(14, 3) NOT NULL,
    power_kw DECIMAL(10, 3),
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    machine_status machine_status,
    produced_length_m DECIMAL(14, 3),
    kwh_per_100m DECIMAL(14, 4),
    sample_count INTEGER NOT NULL DEFAULT 0,
    hour TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw 5-second telemetry for machine energy and context
CREATE TABLE IF NOT EXISTS machine_energy_samples (
    id BIGSERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    sampled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    machine_status machine_status NOT NULL DEFAULT 'idle',
    power_kw DECIMAL(10, 3),
    energy_meter_kwh DECIMAL(14, 3),
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    produced_length_m DECIMAL(14, 3),
    produced_length_ok_m DECIMAL(14, 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Full-line telemetry (partitioned monthly)
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

CREATE TABLE IF NOT EXISTS machine_line_telemetry_default
    PARTITION OF machine_line_telemetry DEFAULT;

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_machines_area ON machines(area);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_last_updated ON machines(last_updated);
CREATE INDEX IF NOT EXISTS idx_machines_material_code ON machines(material_code);
CREATE INDEX IF NOT EXISTS idx_machines_length_counter ON machines(length_counter);
CREATE INDEX IF NOT EXISTS idx_material_master_code ON material_master(material_code);
CREATE INDEX IF NOT EXISTS idx_production_orders_machine_id ON production_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_alarms_machine_id ON alarms(machine_id);
CREATE INDEX IF NOT EXISTS idx_alarms_acknowledged ON alarms(acknowledged);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_machine_id ON machine_metrics(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_timestamp ON machine_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_type ON machine_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_machine_id ON energy_consumption(machine_id);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_hour ON energy_consumption(hour);
CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_consumption_machine_hour ON energy_consumption(machine_id, hour);
CREATE INDEX IF NOT EXISTS idx_machine_energy_samples_machine_time ON machine_energy_samples(machine_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_machine_energy_samples_status ON machine_energy_samples(machine_status);
CREATE INDEX IF NOT EXISTS idx_mlt_machine_sampled ON machine_line_telemetry (machine_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mlt_sampled ON machine_line_telemetry (sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mlt_material_sampled ON machine_line_telemetry (material_code, sampled_at DESC) WHERE material_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mlt_order_sampled ON machine_line_telemetry (production_order_id, sampled_at DESC) WHERE production_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prod_len_events_machine ON production_length_events(machine_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_area ON production_length_events(area);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_shift ON production_length_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_order ON production_length_events(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_time ON production_length_events(event_time);

CREATE TABLE IF NOT EXISTS oee_shift_settlements (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    shift_id VARCHAR(100) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    availability DECIMAL(5, 2) NOT NULL,
    performance DECIMAL(5, 2) NOT NULL,
    quality DECIMAL(5, 2) NOT NULL,
    oee DECIMAL(5, 2) NOT NULL,
    performance_data_quality VARCHAR(64),
    quality_data_quality VARCHAR(64),
    methodology_version VARCHAR(32) NOT NULL DEFAULT 'rollup_v1',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_oee_shift_settlement_machine_shift UNIQUE (machine_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_oee_shift_settlements_shift_id ON oee_shift_settlements(shift_id);
CREATE INDEX IF NOT EXISTS idx_oee_shift_settlements_period ON oee_shift_settlements(period_start, period_end);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_machines_updated_at ON machines;
CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;
CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

