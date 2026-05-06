-- Safe Deletion Script for Machines D-07 and D-08
-- This script safely deletes machines and handles related records

BEGIN;

-- ============================================================================
-- STEP 1: Check what will be deleted
-- ============================================================================
SELECT '=== CHECKING MACHINES ===' as step;

SELECT id, name, area, status 
FROM machines 
WHERE id IN ('D-07', 'D-08');

SELECT '=== CHECKING RELATED RECORDS ===' as step;

-- Count related records for D-07
SELECT 
    'D-07' as machine_id,
    'alarms' as table_name, 
    COUNT(*) as record_count
FROM alarms WHERE machine_id = 'D-07'
UNION ALL
SELECT 
    'D-07',
    'machine_metrics', 
    COUNT(*)
FROM machine_metrics WHERE machine_id = 'D-07'
UNION ALL
SELECT 
    'D-07',
    'energy_consumption', 
    COUNT(*)
FROM energy_consumption WHERE machine_id = 'D-07'
UNION ALL
SELECT 
    'D-07',
    'production_orders', 
    COUNT(*)
FROM production_orders WHERE machine_id = 'D-07';

-- Count related records for D-08
SELECT 
    'D-08' as machine_id,
    'alarms' as table_name, 
    COUNT(*) as record_count
FROM alarms WHERE machine_id = 'D-08'
UNION ALL
SELECT 
    'D-08',
    'machine_metrics', 
    COUNT(*)
FROM machine_metrics WHERE machine_id = 'D-08'
UNION ALL
SELECT 
    'D-08',
    'energy_consumption', 
    COUNT(*)
FROM energy_consumption WHERE machine_id = 'D-08'
UNION ALL
SELECT 
    'D-08',
    'production_orders', 
    COUNT(*)
FROM production_orders WHERE machine_id = 'D-08';

-- ============================================================================
-- STEP 2: Handle Production Orders (if any)
-- ============================================================================
SELECT '=== HANDLING PRODUCTION ORDERS ===' as step;

-- Show production orders that will be affected
SELECT id, name, product_name, status, machine_id, start_time
FROM production_orders 
WHERE machine_id IN ('D-07', 'D-08')
ORDER BY machine_id, start_time DESC;

-- Count orders by status
SELECT 
    machine_id,
    status,
    COUNT(*) as order_count
FROM production_orders 
WHERE machine_id IN ('D-07', 'D-08')
GROUP BY machine_id, status
ORDER BY machine_id, status;

-- IMPORTANT: Delete production orders FIRST (they don't cascade)
-- This is required because production_orders has a foreign key without CASCADE
DELETE FROM production_orders WHERE machine_id IN ('D-07', 'D-08');

-- Verify orders were deleted
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ All production orders deleted'
        ELSE '❌ ' || COUNT(*) || ' orders still exist'
    END as result
FROM production_orders 
WHERE machine_id IN ('D-07', 'D-08');

-- ============================================================================
-- STEP 3: Delete the machines
-- ============================================================================
SELECT '=== DELETING MACHINES ===' as step;

-- Delete machines (this will cascade delete alarms, metrics, and energy records)
DELETE FROM machines WHERE id IN ('D-07', 'D-08');

SELECT 'Machines D-07 and D-08 deleted' as result;

-- ============================================================================
-- STEP 4: Verify deletion
-- ============================================================================
SELECT '=== VERIFYING DELETION ===' as step;

-- Check if machines still exist (should return 0 rows)
SELECT id, name FROM machines WHERE id IN ('D-07', 'D-08');

-- Verify related records were also deleted (should all return 0)
SELECT 
    'alarms' as table_name,
    COUNT(*) as remaining_records
FROM alarms WHERE machine_id IN ('D-07', 'D-08')
UNION ALL
SELECT 
    'machine_metrics',
    COUNT(*)
FROM machine_metrics WHERE machine_id IN ('D-07', 'D-08')
UNION ALL
SELECT 
    'energy_consumption',
    COUNT(*)
FROM energy_consumption WHERE machine_id IN ('D-07', 'D-08')
UNION ALL
SELECT 
    'production_orders',
    COUNT(*)
FROM production_orders WHERE machine_id IN ('D-07', 'D-08');

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- If everything looks good, uncomment the line below to commit:
-- COMMIT;

-- If something is wrong, uncomment the line below to rollback:
-- ROLLBACK;

SELECT '=== TRANSACTION PENDING ===' as step;
SELECT 'Review the results above, then run COMMIT; or ROLLBACK;' as instruction;

