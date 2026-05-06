-- Migration: Rename Production Lines, Line Groups, and Related Entities
-- This migration safely renames machines, areas, and updates all related references
--
-- IMPORTANT: Review and customize the rename mappings below before running!
-- This script uses transactions to ensure data integrity.

BEGIN;

-- ============================================================================
-- STEP 1: RENAME MACHINE IDs (Production Lines)
-- ============================================================================
-- WARNING: Machine IDs are used as foreign keys. This requires careful handling.
-- 
-- If you need to rename machine IDs, you must:
-- 1. Update all foreign key references first
-- 2. Then update the primary key
--
-- Example rename mapping (customize these):
-- 'D-01' -> 'DRW-001'
-- 'D-02' -> 'DRW-002'
-- 'S-01' -> 'STR-001'
-- etc.

-- Create a temporary mapping table for machine ID renames
CREATE TEMP TABLE machine_id_renames (
    old_id VARCHAR(50) PRIMARY KEY,
    new_id VARCHAR(50) NOT NULL UNIQUE
);

-- INSERT YOUR RENAME MAPPINGS HERE:
-- Example (uncomment and modify):
-- INSERT INTO machine_id_renames (old_id, new_id) VALUES
--     ('D-01', 'DRW-001'),
--     ('D-02', 'DRW-002'),
--     ('S-01', 'STR-001'),
--     ('SH-01', 'SHT-001');

-- If no renames needed, leave the INSERT above commented out.

-- Update foreign key references BEFORE updating primary key
-- 1. Update production_orders
UPDATE production_orders po
SET machine_id = mrn.new_id
FROM machine_id_renames mrn
WHERE po.machine_id = mrn.old_id;

-- 2. Update alarms
UPDATE alarms a
SET machine_id = mrn.new_id
FROM machine_id_renames mrn
WHERE a.machine_id = mrn.old_id;

-- 3. Update machine_metrics
UPDATE machine_metrics mm
SET machine_id = mrn.new_id
FROM machine_id_renames mrn
WHERE mm.machine_id = mrn.old_id;

-- 4. Update energy_consumption
UPDATE energy_consumption ec
SET machine_id = mrn.new_id
FROM machine_id_renames mrn
WHERE ec.machine_id = mrn.old_id;

-- 5. Finally, update machines table (primary key)
UPDATE machines m
SET id = mrn.new_id
FROM machine_id_renames mrn
WHERE m.id = mrn.old_id;

-- ============================================================================
-- STEP 2: RENAME MACHINE NAMES (Display Names)
-- ============================================================================
-- This is safer as it doesn't affect foreign keys.
-- Update machine display names directly:

-- Example (uncomment and modify):
-- UPDATE machines SET name = 'Drawing Line 1 - New Name' WHERE id = 'D-01';
-- UPDATE machines SET name = 'Stranding Unit 1 - New Name' WHERE id = 'S-01';

-- ============================================================================
-- STEP 3: RENAME PRODUCTION AREAS (Line Groups)
-- ============================================================================
-- WARNING: Changing ENUM values requires special handling in PostgreSQL.
-- 
-- Option A: If you want to keep the enum values but change display names:
--   -> Update the areaNames mapping in backend/routes/areas.js (no DB change needed)
--
-- Option B: If you need to change the actual enum values:
--   This requires creating a new enum, updating all references, then dropping old enum.

-- Example: Rename area enum values (if needed)
-- Step 3.1: Create new enum type
-- CREATE TYPE production_area_new AS ENUM ('drawing_new', 'stranding_new', 'armoring_new', 'sheathing_new');

-- Step 3.2: Add temporary column with new enum
-- ALTER TABLE machines ADD COLUMN area_new production_area_new;

-- Step 3.3: Map old values to new values
-- UPDATE machines SET area_new = 'drawing_new'::production_area_new WHERE area = 'drawing'::production_area;
-- UPDATE machines SET area_new = 'stranding_new'::production_area_new WHERE area = 'stranding'::production_area;
-- UPDATE machines SET area_new = 'armoring_new'::production_area_new WHERE area = 'armoring'::production_area;
-- UPDATE machines SET area_new = 'sheathing_new'::production_area_new WHERE area = 'sheathing'::production_area;

-- Step 3.4: Drop old column, rename new column
-- ALTER TABLE machines DROP COLUMN area;
-- ALTER TABLE machines RENAME COLUMN area_new TO area;
-- ALTER TABLE machines ALTER COLUMN area SET NOT NULL;

-- Step 3.5: Drop old enum (only if no other tables use it)
-- DROP TYPE production_area;

-- Step 3.6: Rename new enum to original name
-- ALTER TYPE production_area_new RENAME TO production_area;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check for orphaned references (should return 0 rows)
SELECT 'production_orders' as table_name, COUNT(*) as orphaned_count
FROM production_orders po
WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = po.machine_id)
UNION ALL
SELECT 'alarms', COUNT(*)
FROM alarms a
WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = a.machine_id)
UNION ALL
SELECT 'machine_metrics', COUNT(*)
FROM machine_metrics mm
WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = mm.machine_id)
UNION ALL
SELECT 'energy_consumption', COUNT(*)
FROM energy_consumption ec
WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = ec.machine_id);

-- Show current machine IDs and names
SELECT id, name, area, status FROM machines ORDER BY area, id;

-- Show area distribution
SELECT area, COUNT(*) as machine_count FROM machines GROUP BY area ORDER BY area;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If something goes wrong, you can rollback:
-- ROLLBACK;
--
-- Or if you've already committed, create a reverse migration:
-- (Create a new migration file with reverse mappings)

COMMIT;

-- Success message
SELECT 'Migration completed: Production lines and line groups renamed successfully' AS result;
SELECT 'IMPORTANT: Update backend/routes/areas.js areaNames mapping if area display names changed' AS reminder;

