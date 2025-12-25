-- Migration: Add Availability Aggregation Table
-- This migration creates a table to store aggregated availability calculations
-- for fast real-time dashboard queries using rolling time windows

-- Availability Aggregation Table
-- Stores pre-calculated availability metrics for each machine within time windows
CREATE TABLE IF NOT EXISTS availability_aggregations (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    window_duration_seconds INTEGER NOT NULL DEFAULT 600, -- 10 minutes default, can be changed for shifts
    
    -- Aggregated durations for each status (in seconds)
    duration_running DECIMAL(10, 2) DEFAULT 0,
    duration_idle DECIMAL(10, 2) DEFAULT 0,
    duration_warning DECIMAL(10, 2) DEFAULT 0,
    duration_error DECIMAL(10, 2) DEFAULT 0,
    duration_stopped DECIMAL(10, 2) DEFAULT 0,
    duration_setup DECIMAL(10, 2) DEFAULT 0,
    
    -- Calculated metrics
    planned_time_seconds DECIMAL(10, 2) NOT NULL, -- Total window duration
    downtime_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Sum of all non-running statuses
    running_time_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Planned Time - Downtime
    availability_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0, -- (Running Time / Planned Time) × 100
    
    -- Metadata
    calculation_type VARCHAR(50) DEFAULT 'rolling_window', -- 'rolling_window' or 'shift' for future
    production_order_id VARCHAR(100) REFERENCES production_orders(id), -- For shift-based calculations
    shift_id VARCHAR(100), -- For future shift-based calculations
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one aggregation per machine per time window
    CONSTRAINT unique_machine_window UNIQUE (machine_id, window_start, window_end, calculation_type)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_availability_agg_machine_id ON availability_aggregations(machine_id);
CREATE INDEX IF NOT EXISTS idx_availability_agg_window_end ON availability_aggregations(window_end DESC);
CREATE INDEX IF NOT EXISTS idx_availability_agg_machine_window ON availability_aggregations(machine_id, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_availability_agg_calc_type ON availability_aggregations(calculation_type);

-- Function to calculate and store availability aggregation for a machine within a time window
CREATE OR REPLACE FUNCTION calculate_availability_aggregation(
    p_machine_id VARCHAR(50),
    p_window_start TIMESTAMP,
    p_window_end TIMESTAMP,
    p_calculation_type VARCHAR(50) DEFAULT 'rolling_window',
    p_production_order_id VARCHAR(100) DEFAULT NULL,
    p_shift_id VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    availability_percentage DECIMAL(5, 2),
    running_time_seconds DECIMAL(10, 2),
    downtime_seconds DECIMAL(10, 2)
) AS $$
DECLARE
    v_window_duration DECIMAL(10, 2);
    v_duration_running DECIMAL(10, 2) := 0;
    v_duration_idle DECIMAL(10, 2) := 0;
    v_duration_warning DECIMAL(10, 2) := 0;
    v_duration_error DECIMAL(10, 2) := 0;
    v_duration_stopped DECIMAL(10, 2) := 0;
    v_duration_setup DECIMAL(10, 2) := 0;
    v_downtime DECIMAL(10, 2) := 0;
    v_running_time DECIMAL(10, 2) := 0;
    v_availability DECIMAL(5, 2) := 0;
BEGIN
    -- Calculate window duration in seconds
    v_window_duration := EXTRACT(EPOCH FROM (p_window_end - p_window_start));
    
    -- Aggregate durations for each status within the time window
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_running
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'running'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_idle
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'idle'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_warning
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'warning'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_error
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'error'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_stopped
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'stopped'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status_end_time IS NOT NULL THEN 
                    LEAST(EXTRACT(EPOCH FROM (status_end_time - GREATEST(status_start_time, p_window_start))), 
                          EXTRACT(EPOCH FROM (LEAST(COALESCE(status_end_time, p_window_end), p_window_end) - GREATEST(status_start_time, p_window_start))))
                ELSE 
                    EXTRACT(EPOCH FROM (LEAST(p_window_end, CURRENT_TIMESTAMP) - GREATEST(status_start_time, p_window_start)))
            END
        ), 0)
    INTO v_duration_setup
    FROM machine_status_history
    WHERE machine_id = p_machine_id
      AND status = 'setup'
      AND status_start_time < p_window_end
      AND (status_end_time IS NULL OR status_end_time > p_window_start);
    
    -- Calculate downtime (sum of all non-running statuses)
    v_downtime := v_duration_idle + v_duration_warning + v_duration_error + v_duration_stopped + v_duration_setup;
    
    -- Calculate running time (Planned Time - Downtime)
    v_running_time := GREATEST(0, v_window_duration - v_downtime);
    
    -- Calculate availability percentage
    IF v_window_duration > 0 THEN
        v_availability := (v_running_time / v_window_duration) * 100;
    ELSE
        v_availability := 0;
    END IF;
    
    -- Clamp availability between 0 and 100
    v_availability := GREATEST(0, LEAST(100, v_availability));
    
    -- Insert or update the aggregation record
    INSERT INTO availability_aggregations (
        machine_id,
        window_start,
        window_end,
        window_duration_seconds,
        duration_running,
        duration_idle,
        duration_warning,
        duration_error,
        duration_stopped,
        duration_setup,
        planned_time_seconds,
        downtime_seconds,
        running_time_seconds,
        availability_percentage,
        calculation_type,
        production_order_id,
        shift_id,
        calculated_at
    ) VALUES (
        p_machine_id,
        p_window_start,
        p_window_end,
        EXTRACT(EPOCH FROM (p_window_end - p_window_start))::INTEGER,
        v_duration_running,
        v_duration_idle,
        v_duration_warning,
        v_duration_error,
        v_duration_stopped,
        v_duration_setup,
        v_window_duration,
        v_downtime,
        v_running_time,
        v_availability,
        p_calculation_type,
        p_production_order_id,
        p_shift_id,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (machine_id, window_start, window_end, calculation_type)
    DO UPDATE SET
        duration_running = EXCLUDED.duration_running,
        duration_idle = EXCLUDED.duration_idle,
        duration_warning = EXCLUDED.duration_warning,
        duration_error = EXCLUDED.duration_error,
        duration_stopped = EXCLUDED.duration_stopped,
        duration_setup = EXCLUDED.duration_setup,
        planned_time_seconds = EXCLUDED.planned_time_seconds,
        downtime_seconds = EXCLUDED.downtime_seconds,
        running_time_seconds = EXCLUDED.running_time_seconds,
        availability_percentage = EXCLUDED.availability_percentage,
        calculated_at = CURRENT_TIMESTAMP;
    
    -- Return the calculated values
    RETURN QUERY SELECT v_availability, v_running_time, v_downtime;
END;
$$ LANGUAGE plpgsql;

-- Function to get the latest availability aggregation for a machine (for real-time queries)
CREATE OR REPLACE FUNCTION get_latest_availability(
    p_machine_id VARCHAR(50),
    p_calculation_type VARCHAR(50) DEFAULT 'rolling_window'
)
RETURNS TABLE (
    availability_percentage DECIMAL(5, 2),
    running_time_seconds DECIMAL(10, 2),
    downtime_seconds DECIMAL(10, 2),
    duration_running DECIMAL(10, 2),
    duration_idle DECIMAL(10, 2),
    duration_warning DECIMAL(10, 2),
    duration_error DECIMAL(10, 2),
    duration_stopped DECIMAL(10, 2),
    duration_setup DECIMAL(10, 2),
    window_start TIMESTAMP,
    window_end TIMESTAMP,
    calculated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aa.availability_percentage,
        aa.running_time_seconds,
        aa.downtime_seconds,
        aa.duration_running,
        aa.duration_idle,
        aa.duration_warning,
        aa.duration_error,
        aa.duration_stopped,
        aa.duration_setup,
        aa.window_start,
        aa.window_end,
        aa.calculated_at
    FROM availability_aggregations aa
    WHERE aa.machine_id = p_machine_id
      AND aa.calculation_type = p_calculation_type
    ORDER BY aa.window_end DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically calculate availability when machine status changes
-- This ensures the aggregation table is always up-to-date with all related data
CREATE OR REPLACE FUNCTION trigger_availability_calculation()
RETURNS TRIGGER AS $$
DECLARE
    v_window_start TIMESTAMP;
    v_window_end TIMESTAMP;
    v_production_order_id VARCHAR(100);
BEGIN
    -- Calculate for 10-minute rolling window (can be changed to shift-based in production)
    v_window_end := CURRENT_TIMESTAMP;
    v_window_start := v_window_end - INTERVAL '10 minutes';
    
    -- Get current production order for this machine (if any)
    SELECT id INTO v_production_order_id
    FROM production_orders
    WHERE machine_id = NEW.id
      AND status = 'running'
      AND start_time <= v_window_end
      AND (end_time IS NULL OR end_time >= v_window_start)
    ORDER BY start_time DESC
    LIMIT 1;
    
    -- Calculate and store aggregation for the affected machine
    -- Includes production order context for comprehensive data synchronization
    PERFORM calculate_availability_aggregation(
        NEW.id,
        v_window_start,
        v_window_end,
        'rolling_window',
        v_production_order_id, -- Include production order if available
        NULL  -- shift_id (can be added for shift-based)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate availability when machine status changes
-- This ensures immediate calculation when status changes
DROP TRIGGER IF EXISTS trigger_calculate_availability ON machines;
CREATE TRIGGER trigger_calculate_availability
    AFTER UPDATE OF status ON machines
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION trigger_availability_calculation();

-- Note: Continuous synchronization service runs periodically (every 30 seconds by default)
-- to ensure all machines are synchronized even if status changes are missed
-- This is handled by the availabilitySync.js service in the backend

-- Success message
SELECT 'Migration completed: Availability aggregation table and functions created' AS result;

