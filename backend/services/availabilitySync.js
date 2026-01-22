/**
 * Availability Synchronization Service
 * 
 * Continuously synchronizes all production line data into availability_aggregations table.
 * Ensures real-time Availability calculations for all machines across all production lines.
 * Uses shift-based intervals instead of rolling windows.
 */

import { query } from '../database/connection.js';
import { getCurrentShiftWindow, getShiftId } from '../utils/shiftCalculator.js';

/**
 * Synchronize availability aggregation for a single machine
 * Calculates and stores aggregation for the current shift window
 * Includes production order context if available
 * 
 * @param {string} machineId - Machine ID
 * @param {boolean} useShiftBased - Whether to use shift-based calculation (default: true)
 * @returns {Promise<Object>} Aggregation result
 */
async function syncMachineAvailability(machineId, useShiftBased = true) {
  try {
    let windowStart, windowEnd, calculationType, shiftId;
    
    if (useShiftBased) {
      // Use shift-based calculation
      const shiftWindow = getCurrentShiftWindow();
      windowStart = shiftWindow.start;
      windowEnd = shiftWindow.end;
      calculationType = 'shift';
      shiftId = getShiftId(shiftWindow.shift, new Date());
    } else {
      // Fallback to rolling window (legacy support)
      const windowMinutes = 10;
      windowEnd = new Date();
      windowStart = new Date(windowEnd.getTime() - windowMinutes * 60 * 1000);
      calculationType = 'rolling_window';
      shiftId = null;
    }

    // Get current production order for this machine (if any)
    const orderResult = await query(
      `SELECT id FROM production_orders 
       WHERE machine_id = $1 
         AND status = 'running'
         AND start_time <= $2
         AND (end_time IS NULL OR end_time >= $3)
       ORDER BY start_time DESC
       LIMIT 1`,
      [machineId, windowEnd, windowStart]
    );

    const productionOrderId = orderResult.rows.length > 0 ? orderResult.rows[0].id : null;

    // Calculate and store aggregation with production order context
    const result = await query(
      `SELECT * FROM calculate_availability_aggregation(
        $1, $2, $3, $4, $5, $6
      )`,
      [machineId, windowStart, windowEnd, calculationType, productionOrderId, shiftId]
    );

    if (result.rows.length > 0) {
      return {
        machineId,
        availabilityPercentage: parseFloat(result.rows[0].availability_percentage || 0),
        runningTimeSeconds: parseFloat(result.rows[0].running_time_seconds || 0),
        downtimeSeconds: parseFloat(result.rows[0].downtime_seconds || 0),
        productionOrderId,
        success: true
      };
    }

    return {
      machineId,
      success: false,
      error: 'No aggregation result returned'
    };
  } catch (error) {
    console.error(`Error syncing availability for machine ${machineId}:`, error);
    return {
      machineId,
      success: false,
      error: error.message
    };
  }
}

/**
 * Synchronize availability aggregations for all machines
 * Processes all machines across all production lines
 * Includes all related machine and production data
 * Uses shift-based calculation by default
 * 
 * @param {boolean} useShiftBased - Whether to use shift-based calculation (default: true)
 * @param {boolean} retryFailed - Whether to retry failed machines (default: false)
 * @returns {Promise<Object>} Synchronization summary
 */
export async function syncAllMachinesAvailability(useShiftBased = true, retryFailed = false) {
  try {
    const now = new Date();
    let windowStart = null;
    let windowEnd = null;
    let windowMinutes = null;

    if (useShiftBased) {
      const shiftWindow = getCurrentShiftWindow(now);
      windowStart = shiftWindow.start;
      windowEnd = shiftWindow.end;
    } else {
      windowMinutes = 10;
      windowEnd = now;
      windowStart = new Date(windowEnd.getTime() - windowMinutes * 60 * 1000);
    }

    // Get all machines with their current status and production order info
    const machinesResult = await query(
      `SELECT 
        m.id, 
        m.name, 
        m.area,
        m.status,
        m.production_order_id,
        po.id as active_order_id,
        po.start_time as order_start_time
       FROM machines m
       LEFT JOIN production_orders po ON po.machine_id = m.id 
         AND po.status = 'running'
         AND po.start_time <= $1
         AND (po.end_time IS NULL OR po.end_time >= $2)
       ORDER BY m.id`,
      [windowEnd, windowStart]
    );

    if (machinesResult.rows.length === 0) {
      return {
        success: true,
        totalMachines: 0,
        syncedMachines: 0,
        failedMachines: 0,
        message: 'No machines found'
      };
    }

    const machines = machinesResult.rows;
    const results = [];
    let successCount = 0;
    let failCount = 0;
    const failedMachines = [];

    // Process all machines in parallel for better performance
    // Use Promise.allSettled to ensure all machines are processed even if some fail
    const syncPromises = machines.map(machine => 
      syncMachineAvailability(machine.id, useShiftBased)
        .then(result => {
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            failedMachines.push(machine.id);
          }
          return {
            ...result,
            machineName: machine.name,
            area: machine.area,
            currentStatus: machine.status
          };
        })
        .catch(error => {
          failCount++;
          failedMachines.push(machine.id);
          return {
            machineId: machine.id,
            machineName: machine.name,
            area: machine.area,
            success: false,
            error: error.message
          };
        })
    );

    const syncResults = await Promise.allSettled(syncPromises);
    const processedResults = syncResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const machine = machines[index];
        return {
          machineId: machine?.id || 'unknown',
          machineName: machine?.name || 'unknown',
          area: machine?.area || 'unknown',
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    // Retry failed machines if requested
    if (retryFailed && failedMachines.length > 0) {
      console.log(`🔄 Retrying ${failedMachines.length} failed machines...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      
      const retryPromises = failedMachines.map(machineId => 
        syncMachineAvailability(machineId, useShiftBased)
          .then(result => {
            if (result.success) {
              successCount++;
              failCount--;
              // Update the result in processedResults
              const index = processedResults.findIndex(r => r.machineId === machineId);
              if (index >= 0) {
                processedResults[index] = { ...result, machineName: machines.find(m => m.id === machineId)?.name };
              }
            }
            return result;
          })
          .catch(() => null) // Ignore retry errors
      );
      
      await Promise.allSettled(retryPromises);
    }

    return {
      success: true,
      totalMachines: machines.length,
      syncedMachines: successCount,
      failedMachines: failCount,
      timestamp: new Date().toISOString(),
      results: processedResults
    };
  } catch (error) {
    console.error('Error syncing all machines availability:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Synchronize availability for machines in a specific production area
 * Uses shift-based calculation by default
 * 
 * @param {string} area - Production area (drawing, stranding, armoring, sheathing)
 * @param {boolean} useShiftBased - Whether to use shift-based calculation (default: true)
 * @returns {Promise<Object>} Synchronization summary
 */
export async function syncAreaAvailability(area, useShiftBased = true) {
  try {
    const machinesResult = await query(
      `SELECT id, name FROM machines WHERE area = $1 ORDER BY id`,
      [area]
    );

    if (machinesResult.rows.length === 0) {
      return {
        success: true,
        area,
        totalMachines: 0,
        syncedMachines: 0,
        failedMachines: 0,
        message: `No machines found in area ${area}`
      };
    }

    const machines = machinesResult.rows;
    const results = [];
    let successCount = 0;
    let failCount = 0;

    const syncPromises = machines.map(machine => 
      syncMachineAvailability(machine.id, useShiftBased)
        .then(result => {
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
          return result;
        })
        .catch(error => {
          failCount++;
          return {
            machineId: machine.id,
            success: false,
            error: error.message
          };
        })
    );

    const syncResults = await Promise.all(syncPromises);

    return {
      success: true,
      area,
      totalMachines: machines.length,
      syncedMachines: successCount,
      failedMachines: failCount,
      timestamp: new Date().toISOString(),
      results: syncResults
    };
  } catch (error) {
    console.error(`Error syncing availability for area ${area}:`, error);
    return {
      success: false,
      area,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Start continuous availability synchronization
 * Runs synchronization at regular intervals to ensure real-time updates
 * Automatically handles all related machine and production data
 * Uses shift-based calculation by default
 * 
 * @param {number} intervalSeconds - Sync interval in seconds (default: 30 seconds)
 * @param {boolean} useShiftBased - Whether to use shift-based calculation (default: true)
 * @returns {Function} Stop function to cancel the interval
 */
export function startContinuousSync(intervalSeconds = 30, useShiftBased = true) {
  const syncType = useShiftBased ? 'shift-based (3 shifts: 06:00-14:00, 14:00-22:00, 22:00-06:00)' : 'rolling window (10 minutes)';
  console.log(`🔄 Starting continuous availability synchronization (interval: ${intervalSeconds}s, calculation: ${syncType})`);
  console.log(`📊 Synchronizing all machine and production data into availability_aggregations table`);

  // Run immediately on start with retry for failed machines
  syncAllMachinesAvailability(useShiftBased, true)
    .then(result => {
      if (result.success) {
        console.log(`✅ Initial sync completed: ${result.syncedMachines}/${result.totalMachines} machines synced`);
        if (result.failedMachines > 0) {
          console.warn(`⚠️  ${result.failedMachines} machines failed to sync (will retry on next interval)`);
        }
      } else {
        console.error(`❌ Initial sync failed: ${result.error}`);
      }
    })
    .catch(error => {
      console.error('❌ Initial sync failed:', error);
    });

  // Set up interval for continuous synchronization
  const intervalId = setInterval(async () => {
    try {
      // Sync all machines with retry for failed ones
      const result = await syncAllMachinesAvailability(useShiftBased, true);
      if (result.success) {
        const successRate = ((result.syncedMachines / result.totalMachines) * 100).toFixed(1);
        console.log(`✅ Sync completed: ${result.syncedMachines}/${result.totalMachines} machines synced (${successRate}% success)`);
        if (result.failedMachines > 0) {
          console.warn(`⚠️  ${result.failedMachines} machines failed to sync`);
        }
      } else {
        console.error(`❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }, intervalSeconds * 1000);

  // Return stop function
  return () => {
    clearInterval(intervalId);
    console.log('🛑 Stopped continuous availability synchronization');
  };
}

/**
 * Get synchronization status for all machines
 * Returns the latest availability aggregation timestamp for each machine
 * Includes production order information
 * 
 * @returns {Promise<Array>} Array of machine sync status
 */
export async function getSyncStatus() {
  try {
    const result = await query(
      `SELECT 
        m.id as machine_id,
        m.name as machine_name,
        m.area,
        m.status as current_status,
        m.production_order_id,
        po.name as production_order_name,
        po.start_time as order_start_time,
        aa.availability_percentage,
        aa.running_time_seconds,
        aa.downtime_seconds,
        aa.window_start,
        aa.window_end,
        aa.calculated_at,
        aa.production_order_id as agg_production_order_id,
        CASE 
          WHEN aa.calculated_at IS NULL THEN 'not_synced'
          WHEN aa.calculated_at > NOW() - INTERVAL '1 minute' THEN 'current'
          WHEN aa.calculated_at > NOW() - INTERVAL '5 minutes' THEN 'recent'
          ELSE 'stale'
        END as sync_status
       FROM machines m
       LEFT JOIN production_orders po ON po.id = m.production_order_id
       LEFT JOIN LATERAL (
         SELECT 
           availability_percentage, 
           running_time_seconds,
           downtime_seconds,
           window_start,
           window_end, 
           calculated_at,
           production_order_id
         FROM availability_aggregations
         WHERE machine_id = m.id
           AND calculation_type = 'shift'
         ORDER BY window_end DESC
         LIMIT 1
       ) aa ON true
       ORDER BY m.area, m.id`
    );

    return result.rows.map(row => ({
      machineId: row.machine_id,
      machineName: row.machine_name,
      area: row.area,
      currentStatus: row.current_status,
      productionOrderId: row.production_order_id,
      productionOrderName: row.production_order_name,
      orderStartTime: row.order_start_time ? new Date(row.order_start_time) : null,
      availabilityPercentage: row.availability_percentage ? parseFloat(row.availability_percentage) : null,
      runningTimeSeconds: row.running_time_seconds ? parseFloat(row.running_time_seconds) : null,
      downtimeSeconds: row.downtime_seconds ? parseFloat(row.downtime_seconds) : null,
      windowStart: row.window_start ? new Date(row.window_start) : null,
      windowEnd: row.window_end ? new Date(row.window_end) : null,
      calculatedAt: row.calculated_at ? new Date(row.calculated_at) : null,
      syncStatus: row.sync_status,
      hasProductionOrder: !!row.production_order_id,
      aggregationHasOrder: !!row.agg_production_order_id
    }));
  } catch (error) {
    console.error('Error getting sync status:', error);
    return [];
  }
}

