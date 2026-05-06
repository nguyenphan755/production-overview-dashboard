-- Migration: Add material tracking to machines and metrics
-- Adds material_master table, machine material fields, and metric product_name

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

    -- Add product_name column to machines if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'machines' AND column_name = 'product_name') THEN
        ALTER TABLE machines ADD COLUMN product_name VARCHAR(255);
        COMMENT ON COLUMN machines.product_name IS 'Resolved material name (per machine)';
    END IF;

    -- Add product_name column to machine_metrics if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'machine_metrics' AND column_name = 'product_name') THEN
        ALTER TABLE machine_metrics ADD COLUMN product_name VARCHAR(255);
        COMMENT ON COLUMN machine_metrics.product_name IS 'Material name at time of metric capture';
    END IF;

    -- Add machine_name column to production_orders if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'production_orders' AND column_name = 'machine_name') THEN
        ALTER TABLE production_orders ADD COLUMN machine_name VARCHAR(255);
        COMMENT ON COLUMN production_orders.machine_name IS 'Machine name snapshot for this order';
    END IF;

    -- Add product_name_current column to production_orders if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'production_orders' AND column_name = 'product_name_current') THEN
        ALTER TABLE production_orders ADD COLUMN product_name_current VARCHAR(255);
        COMMENT ON COLUMN production_orders.product_name_current IS 'Live product name for this order execution';
    END IF;
END $$;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_machines_material_code ON machines(material_code);
CREATE INDEX IF NOT EXISTS idx_material_master_code ON material_master(material_code);

-- Backfill machines.product_name from material_master using material_code
UPDATE machines m
SET product_name = mm.material_name
FROM material_master mm
WHERE m.material_code = mm.material_code;

-- Backfill production_orders.machine_name from machines
UPDATE production_orders po
SET machine_name = m.name
FROM machines m
WHERE po.machine_id = m.id
  AND (po.machine_name IS NULL OR po.machine_name = '');

-- Backfill product_name_current from product_name if missing
UPDATE production_orders
SET product_name_current = product_name
WHERE product_name_current IS NULL;

-- Success message
SELECT 'Migration completed: material tracking added' AS result;
