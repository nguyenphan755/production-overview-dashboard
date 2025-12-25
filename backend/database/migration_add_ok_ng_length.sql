-- Migration: Add OK/NG Length Columns to Machines Table
-- This migration adds columns for tracking OK and NG (No Good) production lengths
-- for real-time OEE quality calculation

-- Add produced_length_ok column (OK/Good length in meters)
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS produced_length_ok DECIMAL(12, 2) DEFAULT 0;

-- Add produced_length_ng column (NG/Rejected length in meters)
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS produced_length_ng DECIMAL(12, 2) DEFAULT 0;

-- Add index for performance (if needed for queries)
CREATE INDEX IF NOT EXISTS idx_machines_produced_length_ok ON machines(produced_length_ok);
CREATE INDEX IF NOT EXISTS idx_machines_produced_length_ng ON machines(produced_length_ng);

-- Success message
SELECT 'Migration completed: OK/NG length columns added to machines table' AS result;

