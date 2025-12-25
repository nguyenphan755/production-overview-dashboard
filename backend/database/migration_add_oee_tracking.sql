-- Migration: Add Real-Time OEE Tracking Tables
-- This migration adds tables for tracking machine status history and OEE calculations

-- Machine Status History Table
-- Tracks status changes over time for availability calculation
CREATE TABLE IF NOT EXISTS machine_status_history (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    status machine_status NOT NULL,
    previous_status machine_status,
    status_start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_end_time TIMESTAMP,
    duration_seconds INTEGER, -- Calculated duration in seconds
    is_production_time BOOLEAN DEFAULT FALSE, -- true if status is 'running'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_machine_status_history_machine_id ON machine_status_history(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_status_history_status_start ON machine_status_history(status_start_time);
CREATE INDEX IF NOT EXISTS idx_machine_status_history_machine_status ON machine_status_history(machine_id, status_start_time DESC);

-- Production Quality Tracking Table
-- Tracks OK and NG (No Good) production lengths
CREATE TABLE IF NOT EXISTS production_quality (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    production_order_id VARCHAR(100) REFERENCES production_orders(id),
    produced_length_ok DECIMAL(12, 2) DEFAULT 0, -- Good/OK length in meters
    produced_length_ng DECIMAL(12, 2) DEFAULT 0, -- No Good/Rejected length in meters
    total_produced_length DECIMAL(12, 2) DEFAULT 0, -- Total (OK + NG)
    quality_percentage DECIMAL(5, 2), -- Calculated quality: OK / Total * 100
    calculation_period_start TIMESTAMP NOT NULL,
    calculation_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quality tracking
CREATE INDEX IF NOT EXISTS idx_production_quality_machine_id ON production_quality(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_quality_order_id ON production_quality(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_quality_period ON production_quality(calculation_period_start, calculation_period_end);

-- OEE Calculation History Table
-- Stores calculated OEE values over time for trending
CREATE TABLE IF NOT EXISTS oee_calculations (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) REFERENCES machines(id) ON DELETE CASCADE,
    production_order_id VARCHAR(100) REFERENCES production_orders(id),
    calculation_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    availability DECIMAL(5, 2) NOT NULL, -- 0-100
    performance DECIMAL(5, 2) NOT NULL, -- 0-100
    quality DECIMAL(5, 2) NOT NULL, -- 0-100
    oee DECIMAL(5, 2) NOT NULL, -- 0-100 (Availability × Performance × Quality)
    -- Calculation period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    -- Raw data used for calculation
    running_time_seconds INTEGER, -- Actual running time
    planned_time_seconds INTEGER, -- Planned production time
    actual_speed DECIMAL(10, 2), -- Current/actual speed
    target_speed DECIMAL(10, 2), -- Target/rated speed
    produced_length_ok DECIMAL(12, 2), -- OK length
    produced_length_ng DECIMAL(12, 2), -- NG length
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for OEE calculations
CREATE INDEX IF NOT EXISTS idx_oee_calculations_machine_id ON oee_calculations(machine_id);
CREATE INDEX IF NOT EXISTS idx_oee_calculations_timestamp ON oee_calculations(calculation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_oee_calculations_order_id ON oee_calculations(production_order_id);
CREATE INDEX IF NOT EXISTS idx_oee_calculations_machine_timestamp ON oee_calculations(machine_id, calculation_timestamp DESC);

-- Function to update machine status history when status changes
CREATE OR REPLACE FUNCTION update_machine_status_history()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed, close previous status record and create new one
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Close previous status record
        UPDATE machine_status_history
        SET 
            status_end_time = CURRENT_TIMESTAMP,
            duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - status_start_time))::INTEGER
        WHERE machine_id = NEW.id 
          AND status_end_time IS NULL;
        
        -- Create new status record
        INSERT INTO machine_status_history (
            machine_id,
            status,
            previous_status,
            status_start_time,
            is_production_time
        ) VALUES (
            NEW.id,
            NEW.status,
            OLD.status,
            CURRENT_TIMESTAMP,
            NEW.status = 'running'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically track status changes
-- Note: This trigger only fires when status actually changes (OLD.status IS DISTINCT FROM NEW.status)
-- The backend also implements event-based status updates to prevent unnecessary writes
DROP TRIGGER IF EXISTS trigger_machine_status_history ON machines;
CREATE TRIGGER trigger_machine_status_history
    AFTER UPDATE OF status ON machines
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_machine_status_history();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_quality_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for production_quality updated_at
CREATE TRIGGER update_production_quality_updated_at
    BEFORE UPDATE ON production_quality
    FOR EACH ROW
    EXECUTE FUNCTION update_production_quality_updated_at();

-- Success message
SELECT 'Migration completed: Real-time OEE tracking tables created' AS result;

