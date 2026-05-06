-- Migration: Add production length tracking with delta-based logic
-- Adds length counters, shift tracking, and event log for auditability

-- Add length counter fields to machines
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS length_counter DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS length_counter_last DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS length_counter_last_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_shift_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS current_shift_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_shift_end TIMESTAMP;

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

-- Indexes for aggregation and audit
CREATE INDEX IF NOT EXISTS idx_prod_len_events_machine ON production_length_events(machine_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_area ON production_length_events(area);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_shift ON production_length_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_order ON production_length_events(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_len_events_time ON production_length_events(event_time);

-- Success message
SELECT 'Migration completed: production length tracking tables added' AS result;
