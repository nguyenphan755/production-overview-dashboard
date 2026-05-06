-- Fix: Delete Machine D-07 with Options
-- Choose one of the options below based on what you want to do with production orders

BEGIN;

-- ============================================================================
-- STEP 1: Check what production orders exist for D-07
-- ============================================================================
SELECT '=== PRODUCTION ORDERS FOR D-07 ===' as step;

SELECT 
    id as order_id,
    name as order_name,
    product_name,
    customer,
    status,
    start_time,
    produced_length,
    target_length,
    CASE 
        WHEN status = 'running' THEN '⚠️ ACTIVE ORDER'
        WHEN status = 'completed' THEN '✅ Completed'
        ELSE 'ℹ️ ' || status
    END as note
FROM production_orders 
WHERE machine_id = 'D-07'
ORDER BY start_time DESC;

-- ============================================================================
-- OPTION 1: DELETE all production orders (Recommended if orders are not important)
-- ============================================================================
-- Uncomment the lines below to DELETE all production orders for D-07:

-- DELETE FROM production_orders WHERE machine_id = 'D-07';
-- SELECT 'Option 1: All production orders DELETED' as result;

-- ============================================================================
-- OPTION 2: UNASSIGN machine (Keep orders, remove machine reference)
-- ============================================================================
-- Uncomment the lines below to UNASSIGN machine from orders (keep orders):

-- UPDATE production_orders 
-- SET machine_id = NULL 
-- WHERE machine_id = 'D-07';
-- SELECT 'Option 2: Machine UNASSIGNED from orders (orders kept)' as result;

-- ============================================================================
-- OPTION 3: REASSIGN to another machine (e.g., D-01)
-- ============================================================================
-- Uncomment and modify the lines below to REASSIGN orders to another machine:

-- UPDATE production_orders 
-- SET machine_id = 'D-01'  -- ⚠️ CHANGE THIS to your preferred machine ID
-- WHERE machine_id = 'D-07';
-- SELECT 'Option 3: Orders REASSIGNED to D-01' as result;

-- ============================================================================
-- OPTION 4: DELETE only completed orders, reassign running orders
-- ============================================================================
-- Uncomment the lines below for selective handling:

-- -- Delete completed orders
-- DELETE FROM production_orders 
-- WHERE machine_id = 'D-07' AND status = 'completed';
-- 
-- -- Reassign running orders to another machine
-- UPDATE production_orders 
-- SET machine_id = 'D-01'  -- ⚠️ CHANGE THIS to your preferred machine ID
-- WHERE machine_id = 'D-07' AND status = 'running';
-- 
-- SELECT 'Option 4: Completed orders deleted, running orders reassigned' as result;

-- ============================================================================
-- STEP 2: Verify no orders reference D-07
-- ============================================================================
SELECT '=== VERIFYING NO ORDERS REFERENCE D-07 ===' as step;

SELECT COUNT(*) as remaining_orders
FROM production_orders 
WHERE machine_id = 'D-07';
-- Should return 0 if you chose Option 1, 2, or 4
-- Should return count of reassigned orders if you chose Option 3

-- ============================================================================
-- STEP 3: Delete the machine
-- ============================================================================
SELECT '=== DELETING MACHINE D-07 ===' as step;

DELETE FROM machines WHERE id = 'D-07';

SELECT '✅ Machine D-07 deleted successfully' as result;

-- ============================================================================
-- STEP 4: Verify deletion
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Machine D-07 successfully deleted'
        ELSE '❌ Machine D-07 still exists'
    END as machine_status
FROM machines WHERE id = 'D-07';

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- ⚠️ IMPORTANT: Review all results above before committing!
-- If everything looks good: COMMIT;
-- If something is wrong: ROLLBACK;

SELECT '=== ⚠️ TRANSACTION PENDING ===' as step;
SELECT 'Review results, then run: COMMIT; or ROLLBACK;' as instruction;

