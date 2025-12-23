-- Migration: Add Equipment Status fields to machines table
-- Run this migration to add health_score, vibration_level, runtime_hours, last_status_update

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add health_score column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'health_score') THEN
        ALTER TABLE machines ADD COLUMN health_score DECIMAL(5, 2) DEFAULT 100.0;
        COMMENT ON COLUMN machines.health_score IS 'Machine health score (0-100)';
    END IF;

    -- Add vibration_level column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'vibration_level') THEN
        ALTER TABLE machines ADD COLUMN vibration_level VARCHAR(50) DEFAULT 'Normal';
        COMMENT ON COLUMN machines.vibration_level IS 'Vibration level: Normal, Elevated, High, Critical';
    END IF;

    -- Add runtime_hours column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'runtime_hours') THEN
        ALTER TABLE machines ADD COLUMN runtime_hours DECIMAL(10, 2) DEFAULT 0;
        COMMENT ON COLUMN machines.runtime_hours IS 'Total runtime hours';
    END IF;

    -- Add last_status_update column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'machines' AND column_name = 'last_status_update') THEN
        ALTER TABLE machines ADD COLUMN last_status_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN machines.last_status_update IS 'Last time status was updated';
    END IF;
END $$;

-- Create index on last_status_update for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_last_status_update ON machines(last_status_update);

-- Update existing machines with default values if needed
UPDATE machines 
SET 
    health_score = COALESCE(health_score, 100.0),
    vibration_level = COALESCE(vibration_level, 'Normal'),
    runtime_hours = COALESCE(runtime_hours, 0),
    last_status_update = COALESCE(last_status_update, last_updated, CURRENT_TIMESTAMP)
WHERE 
    health_score IS NULL 
    OR vibration_level IS NULL 
    OR runtime_hours IS NULL 
    OR last_status_update IS NULL;

-- Add check constraint for health_score (0-100)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'machines_health_score_check'
    ) THEN
        ALTER TABLE machines 
        ADD CONSTRAINT machines_health_score_check 
        CHECK (health_score >= 0 AND health_score <= 100);
    END IF;
END $$;

-- Add check constraint for vibration_level
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'machines_vibration_level_check'
    ) THEN
        ALTER TABLE machines 
        ADD CONSTRAINT machines_vibration_level_check 
        CHECK (vibration_level IN ('Normal', 'Elevated', 'High', 'Critical'));
    END IF;
END $$;

-- Success message
SELECT 'Migration completed: Equipment Status fields added to machines table' AS result;

