-- Fix: Delete Machine D-07 (Handle Production Orders First)
-- This script handles the foreign key constraint error

BEGIN;

-- ============================================================================
-- STEP 1: Check Production Orders for D-07
-- ============================================================================
SELECT '=== CHECKING PRODUCTION ORDERS FOR D-07 ===' as step;

SELECT 
    id, 
    name, 
    product_name, 
    customer, 
    status, 
    start_time,
    produced_length,
    target_length
FROM production_orders 
WHERE machine_id = 'D-07';

-- Count how many orders reference D-07
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'running' THEN 1 END) as running_orders,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
FROM production_orders 
WHERE machine_id = 'D-07';

-- ============================================================================
-- STEP 2: Handle Production Orders
-- ============================================================================
SELECT '=== HANDLING PRODUCTION ORDERS ===' as step;

-- Option A: Delete all production orders for D-07
-- Uncomment the line below if you want to DELETE the orders:
DELETE FROM production_orders WHERE machine_id = 'D-07';

-- Option B: Unassign machine from orders (set machine_id to NULL)
-- Uncomment the lines below if you want to KEEP the orders but unassign the machine:
-- UPDATE production_orders 
-- SET machine_id = NULL 
-- WHERE machine_id = 'D-07';

-- Option C: Reassign orders to another machine (e.g., D-01)
-- Uncomment and modify the lines below if you want to REASSIGN orders:
-- UPDATE production_orders 
-- SET machine_id = 'D-01'  -- Change to your preferred machine ID
-- WHERE machine_id = 'D-07';

SELECT 'Production orders handled' as result;

-- ============================================================================
-- STEP 3: Verify no orders reference D-07
-- ============================================================================
SELECT '=== VERIFYING NO ORDERS REFERENCE D-07 ===' as step;

SELECT COUNT(*) as remaining_orders
FROM production_orders 
WHERE machine_id = 'D-07';
-- Should return 0

-- ============================================================================
-- STEP 4: Now delete the machine
-- ============================================================================
SELECT '=== DELETING MACHINE D-07 ===' as step;

DELETE FROM machines WHERE id = 'D-07';

SELECT 'Machine D-07 deleted successfully' as result;

-- ============================================================================
-- STEP 5: Verify deletion
-- ============================================================================
SELECT '=== VERIFYING DELETION ===' as step;

-- Check if machine still exists (should return 0 rows)
SELECT id, name FROM machines WHERE id = 'D-07';

-- Verify related records were also deleted
SELECT 
    'alarms' as table_name,
    COUNT(*) as remaining_records
FROM alarms WHERE machine_id = 'D-07'
UNION ALL
SELECT 
    'machine_metrics',
    COUNT(*)
FROM machine_metrics WHERE machine_id = 'D-07'
UNION ALL
SELECT 
    'energy_consumption',
    COUNT(*)
FROM energy_consumption WHERE machine_id = 'D-07';

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- Review the results above, then:
-- If everything looks good: COMMIT;
-- If something is wrong: ROLLBACK;

SELECT '=== TRANSACTION PENDING ===' as step;
SELECT 'Review results, then run: COMMIT; or ROLLBACK;' as instruction;

