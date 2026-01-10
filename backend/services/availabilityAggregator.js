/**
 * Availability Aggregator Service
 * 
 * Manages availability aggregation calculations and ensures the aggregation table
 * is kept up-to-date for fast real-time dashboard queries.
 */

import { query } from '../database/connection.js';

/**
 * Calculate and store availability aggregation for a machine within a time window
 * This function calls the PostgreSQL function to perform the calculation
 * 
 * @param {string} machineId - Machine ID
 * @param {Date} windowStart - Start of time window
 * @param {Date} windowEnd - End of time window
 * @param {string} calculationType - 'rolling_window' or 'shift' (default: 'rolling_window')
 * @param {string} productionOrderId - Production order ID (optional, for shift-based)
 * @param {string} shiftId - Shift ID (optional, for shift-based)
 * @returns {Promise<Object>} Aggregation result with availability percentage and durations
 */
export async function calculateAndStoreAvailability(
  machineId,
  windowStart,
  windowEnd,
  calculationType = 'rolling_window',
  productionOrderId = null,
  shiftId = null
) {
  try {
    const result = await query(
      `SELECT * FROM calculate_availability_aggregation(
        $1, $2, $3, $4, $5, $6
      )`,
      [
        machineId,
        windowStart,
        windowEnd,
        calculationType,
        productionOrderId,
        shiftId
      ]
    );

    if (result.rows.length > 0) {
      return {
        availabilityPercentage: parseFloat(result.rows[0].availability_percentage || 0),
        runningTimeSeconds: parseFloat(result.rows[0].running_time_seconds || 0),
        downtimeSeconds: parseFloat(result.rows[0].downtime_seconds || 0),
        success: true
      };
    }

    return {
      availabilityPercentage: 0,
      runningTimeSeconds: 0,
      downtimeSeconds: 0,
      success: false
    };
  } catch (error) {
    console.error(`Error calculating availability aggregation for ${machineId}:`, error);
    throw error;
  }
}

/**
 * Get the latest availability aggregation for a machine
 * Fast query from pre-calculated aggregation table
 * 
 * @param {string} machineId - Machine ID
 * @param {string} calculationType - 'rolling_window' or 'shift' (default: 'rolling_window')
 * @returns {Promise<Object|null>} Latest availability aggregation or null if not found
 */
export async function getLatestAvailability(machineId, calculationType = 'shift') {
  try {
    const result = await query(
      `SELECT * FROM get_latest_availability($1, $2)`,
      [machineId, calculationType]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        availabilityPercentage: parseFloat(row.availability_percentage || 0),
        runningTimeSeconds: parseFloat(row.running_time_seconds || 0),
        downtimeSeconds: parseFloat(row.downtime_seconds || 0),
        durations: {
          running: parseFloat(row.duration_running || 0),
          idle: parseFloat(row.duration_idle || 0),
          warning: parseFloat(row.duration_warning || 0),
          error: parseFloat(row.duration_error || 0),
          stopped: parseFloat(row.duration_stopped || 0),
          setup: parseFloat(row.duration_setup || 0)
        },
        windowStart: new Date(row.window_start),
        windowEnd: new Date(row.window_end),
        calculatedAt: new Date(row.calculated_at)
      };
    }

    return null;
  } catch (error) {
    console.error(`Error getting latest availability for ${machineId}:`, error);
    return null;
  }
}

/**
 * Ensure availability aggregation is calculated for a machine's current window
 * This is called when machine status changes to keep aggregations up-to-date
 * Uses shift-based calculation by default
 * 
 * @param {string} machineId - Machine ID
 * @param {boolean} useShiftBased - Whether to use shift-based calculation (default: true)
 * @returns {Promise<Object>} Aggregation result
 */
export async function ensureAvailabilityCalculated(machineId, useShiftBased = true) {
  try {
    let windowStart, windowEnd, calculationType, shiftId;
    
    if (useShiftBased) {
      // Use shift-based calculation
      const { getCurrentShiftWindow, getShiftId } = await import('../utils/shiftCalculator.js');
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

    return await calculateAndStoreAvailability(
      machineId,
      windowStart,
      windowEnd,
      calculationType,
      null,
      shiftId
    );
  } catch (error) {
    console.error(`Error ensuring availability calculated for ${machineId}:`, error);
    throw error;
  }
}

/**
 * Get availability aggregation history for a machine
 * Useful for trending and historical analysis
 * 
 * @param {string} machineId - Machine ID
 * @param {Date} startTime - Start time for history query
 * @param {Date} endTime - End time for history query
 * @param {string} calculationType - 'rolling_window' or 'shift' (default: 'rolling_window')
 * @returns {Promise<Array>} Array of availability aggregations
 */
export async function getAvailabilityHistory(
  machineId,
  startTime,
  endTime,
  calculationType = 'rolling_window'
) {
  try {
    const result = await query(
      `SELECT 
        window_start,
        window_end,
        availability_percentage,
        running_time_seconds,
        downtime_seconds,
        duration_running,
        duration_idle,
        duration_warning,
        duration_error,
        duration_stopped,
        duration_setup,
        calculated_at
       FROM availability_aggregations
       WHERE machine_id = $1
         AND calculation_type = $2
         AND window_end >= $3
         AND window_start <= $4
       ORDER BY window_end DESC`,
      [machineId, calculationType, startTime, endTime]
    );

    return result.rows.map(row => ({
      windowStart: new Date(row.window_start),
      windowEnd: new Date(row.window_end),
      availabilityPercentage: parseFloat(row.availability_percentage || 0),
      runningTimeSeconds: parseFloat(row.running_time_seconds || 0),
      downtimeSeconds: parseFloat(row.downtime_seconds || 0),
      durations: {
        running: parseFloat(row.duration_running || 0),
        idle: parseFloat(row.duration_idle || 0),
        warning: parseFloat(row.duration_warning || 0),
        error: parseFloat(row.duration_error || 0),
        stopped: parseFloat(row.duration_stopped || 0),
        setup: parseFloat(row.duration_setup || 0)
      },
      calculatedAt: new Date(row.calculated_at)
    }));
  } catch (error) {
    console.error(`Error getting availability history for ${machineId}:`, error);
    return [];
  }
}

