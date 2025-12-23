-- Production Overview Dashboard Database Schema

-- Create enum types
CREATE TYPE machine_status AS ENUM ('running', 'idle', 'warning', 'error', 'stopped', 'setup');
CREATE TYPE production_area AS ENUM ('drawing', 'stranding', 'armoring', 'sheathing');
CREATE TYPE alarm_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE order_status AS ENUM ('running', 'completed', 'interrupted', 'cancelled');

-- Machines table
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    area production_area NOT NULL,
    status machine_status NOT NULL DEFAULT 'idle',
    line_speed DECIMAL(10, 2) DEFAULT 0,
    target_speed DECIMAL(10, 2) DEFAULT 0,
    produced_length DECIMAL(12, 2) DEFAULT 0,
    target_length DECIMAL(12, 2),
    production_order_id VARCHAR(100),
    production_order_name VARCHAR(255),
    operator_name VARCHAR(255),
    oee DECIMAL(5, 2),
    availability DECIMAL(5, 2),
    performance DECIMAL(5, 2),
    quality DECIMAL(5, 2),
    current DECIMAL(10, 2),
    power DECIMAL(10, 2),
    temperature DECIMAL(10, 2),
    multi_zone_temperatures JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production Orders table
CREATE TABLE IF NOT EXISTS production_orders (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    customer VARCHAR(255) NOT NULL,
    machine_id VARCHAR(50) REFERENCES machines(id),
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
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Energy Consumption table
CREATE TABLE IF NOT EXISTS energy_consumption (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    energy_kwh DECIMAL(10, 2) NOT NULL,
    hour TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_machines_area ON machines(area);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_last_updated ON machines(last_updated);
CREATE INDEX IF NOT EXISTS idx_production_orders_machine_id ON production_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_alarms_machine_id ON alarms(machine_id);
CREATE INDEX IF NOT EXISTS idx_alarms_acknowledged ON alarms(acknowledged);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_machine_id ON machine_metrics(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_timestamp ON machine_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_machine_metrics_type ON machine_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_machine_id ON energy_consumption(machine_id);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_hour ON energy_consumption(hour);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

