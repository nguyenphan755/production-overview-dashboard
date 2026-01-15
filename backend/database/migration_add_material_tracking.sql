-- Migration: Add material tracking to machines and metrics
-- Adds material_master table, machine material fields, and metric production_name

-- Material Master table
CREATE TABLE IF NOT EXISTS material_master (
    material_code VARCHAR(50) PRIMARY KEY,
    material_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if they don't exist
DO $$
BEGIN
    -- Add material_code column to machines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'machines' AND column_name = 'material_code') THEN
        ALTER TABLE machines ADD COLUMN material_code VARCHAR(50);
        COMMENT ON COLUMN machines.material_code IS 'Current material code for this machine';
    END IF;

    -- Add production_name column to machines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'machines' AND column_name = 'production_name') THEN
        ALTER TABLE machines ADD COLUMN production_name VARCHAR(255);
        COMMENT ON COLUMN machines.production_name IS 'Resolved material name (per machine)';
    END IF;

    -- Add production_name column to machine_metrics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'machine_metrics' AND column_name = 'production_name') THEN
        ALTER TABLE machine_metrics ADD COLUMN production_name VARCHAR(255);
        COMMENT ON COLUMN machine_metrics.production_name IS 'Material name at time of metric capture';
    END IF;
END $$;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_machines_material_code ON machines(material_code);
CREATE INDEX IF NOT EXISTS idx_material_master_code ON material_master(material_code);

-- Backfill machines.production_name from material_master using material_code
UPDATE machines m
SET production_name = mm.material_name
FROM material_master mm
WHERE m.material_code = mm.material_code;

-- Success message
SELECT 'Migration completed: material tracking added' AS result;
