-- Migration: Increase Machine Metrics Sampling Density
-- This migration helps increase data density for better trend visualization
--
-- Purpose: Store metrics more frequently (every 30 seconds to 1 minute) 
--          to show clear 3-5 minute trend windows with 15-30 data points

-- ============================================================================
-- STEP 1: Check Current Data Density
-- ============================================================================
SELECT '=== CURRENT DATA DENSITY ANALYSIS ===' as step;

-- Check average time between data points for each metric type
SELECT 
    machine_id,
    metric_type,
    COUNT(*) as total_points,
    MIN(timestamp) as earliest,
    MAX(timestamp) as latest,
    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / COUNT(*) as avg_seconds_between_points
FROM machine_metrics
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY machine_id, metric_type
ORDER BY machine_id, metric_type;

-- ============================================================================
-- STEP 2: Clean Old Sparse Data (Optional)
-- ============================================================================
-- Uncomment to remove old sparse data before increasing density:
-- DELETE FROM machine_metrics WHERE timestamp < NOW() - INTERVAL '24 hours';

-- ============================================================================
-- STEP 3: Create Function to Generate Dense Historical Data
-- ============================================================================
-- This function can be used to backfill dense data for existing machines

CREATE OR REPLACE FUNCTION generate_dense_metrics(
    p_machine_id VARCHAR(50),
    p_metric_type VARCHAR(50),
    p_start_value DECIMAL,
    p_end_value DECIMAL,
    p_target_value DECIMAL DEFAULT NULL,
    p_minutes_back INTEGER DEFAULT 5,
    p_interval_seconds INTEGER DEFAULT 30
)
RETURNS VOID AS $$
DECLARE
    v_timestamp TIMESTAMP;
    v_current_value DECIMAL;
    v_steps INTEGER;
    v_step DECIMAL;
    i INTEGER;
BEGIN
    -- Calculate number of steps
    v_steps := (p_minutes_back * 60) / p_interval_seconds;
    v_step := (p_end_value - p_start_value) / GREATEST(v_steps - 1, 1);
    
    -- Generate data points
    FOR i IN 0..v_steps-1 LOOP
        v_timestamp := NOW() - (INTERVAL '1 second' * (p_minutes_back * 60 - i * p_interval_seconds));
        v_current_value := p_start_value + (v_step * i) + (RANDOM() - 0.5) * ABS(p_end_value - p_start_value) * 0.05;
        
        INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
        VALUES (p_machine_id, p_metric_type, v_current_value, p_target_value, v_timestamp)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Example Usage - Generate Dense Data for All Running Machines
-- ============================================================================
-- Uncomment and customize to generate dense historical data:

/*
DO $$
DECLARE
    machine_record RECORD;
BEGIN
    FOR machine_record IN 
        SELECT id, line_speed, target_speed, current, power, temperature 
        FROM machines 
        WHERE status = 'running' AND line_speed > 0
    LOOP
        -- Speed metrics (every 30 seconds for last 5 minutes = 10 points)
        PERFORM generate_dense_metrics(
            machine_record.id, 
            'speed',
            machine_record.line_speed * 0.95,
            machine_record.line_speed,
            machine_record.target_speed,
            5,  -- 5 minutes
            30  -- 30 second intervals
        );
        
        -- Temperature metrics
        IF machine_record.temperature IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'temperature',
                machine_record.temperature - 5,
                machine_record.temperature,
                NULL,
                5,
                30
            );
        END IF;
        
        -- Current metrics
        IF machine_record.current IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'current',
                machine_record.current - 3,
                machine_record.current,
                NULL,
                5,
                30
            );
        END IF;
        
        -- Power metrics
        IF machine_record.power IS NOT NULL THEN
            PERFORM generate_dense_metrics(
                machine_record.id,
                'power',
                machine_record.power - 5,
                machine_record.power,
                NULL,
                5,
                30
            );
        END IF;
    END LOOP;
END $$;
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

-- Check data density after migration
SELECT 
    machine_id,
    metric_type,
    COUNT(*) as points_last_5min,
    MIN(timestamp) as earliest,
    MAX(timestamp) as latest
FROM machine_metrics
WHERE timestamp >= NOW() - INTERVAL '5 minutes'
GROUP BY machine_id, metric_type
ORDER BY machine_id, metric_type;

-- Should show 10 points per metric type per machine (5 minutes / 30 seconds = 10)

SELECT 'Migration completed. Data density increased for better trend visualization.' AS result;

