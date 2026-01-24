/**
 * Real-Time OEE (Overall Equipment Effectiveness) Calculator
 * 
 * Calculates OEE components in real-time:
 * - Availability: Running time vs Planned production time
 * - Performance: Actual speed vs Target speed
 * - Quality: OK length vs Total produced length
 * 
 * OEE = Availability × Performance × Quality
 */

import { query } from '../database/connection.js';

/**
 * Calculate Availability component
 * Availability = (Running Time / Planned Production Time) × 100
 * 
 * Uses aggregated availability data from availability_aggregations table for fast queries
 * Falls back to direct calculation from machine_status_history if aggregation not available
 * 
 * Uses shift-based intervals for availability calculation
 * 
 * @param {string} machineId - Machine ID
 * @param {string} productionOrderId - Current production order ID (optional)
 * @param {Date} periodStart - Start of calculation period (shift start)
 * @param {Date} periodEnd - End of calculation period (shift end)
 * @returns {Promise<number>} Availability percentage (0-100)
 */
export async function calculateAvailability(machineId, productionOrderId, periodStart, periodEnd) {
  try {
    const now = new Date();
    const isCurrentShiftWindow = periodEnd && periodEnd.getTime() > now.getTime();

    if (isCurrentShiftWindow) {
      const plannedTimeMs = now.getTime() - periodStart.getTime();
      const plannedTimeSeconds = Math.max(plannedTimeMs / 1000, 1);

      const statusDurationsResult = await query(
        `SELECT 
          status,
          COALESCE(SUM(
            CASE 
              WHEN status_end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (
                  LEAST(status_end_time, $3::timestamp) - 
                  GREATEST(status_start_time, $2::timestamp)
                ))
              ELSE 
                EXTRACT(EPOCH FROM (
                  LEAST($3::timestamp, CURRENT_TIMESTAMP) - 
                  GREATEST(status_start_time, $2::timestamp)
                ))
            END
          ), 0) as duration_seconds
         FROM machine_status_history
         WHERE machine_id = $1
           AND status_start_time < $3
           AND (status_end_time IS NULL OR status_end_time > $2)
         GROUP BY status`,
        [machineId, periodStart, now]
      );

      let runningTimeSeconds = 0;
      let downtimeSeconds = 0;

      statusDurationsResult.rows.forEach(row => {
        const duration = parseFloat(row.duration_seconds || 0);
        if (row.status === 'running') {
          runningTimeSeconds = duration;
        } else {
          downtimeSeconds += duration;
        }
      });

      const calculatedRunningTime = Math.max(0, plannedTimeSeconds - downtimeSeconds);
      const finalRunningTime = runningTimeSeconds > 0 ? runningTimeSeconds : calculatedRunningTime;
      const currentAvailability = Math.max(0, Math.min(100, (finalRunningTime / plannedTimeSeconds) * 100));

      if (currentAvailability < 10) {
        const previousShiftResult = await query(
          `SELECT availability_percentage
           FROM availability_aggregations
           WHERE machine_id = $1
             AND calculation_type = 'shift'
             AND window_end <= $2
           ORDER BY window_end DESC
           LIMIT 1`,
          [machineId, now]
        );

        if (previousShiftResult.rows.length > 0) {
          const availability = parseFloat(previousShiftResult.rows[0].availability_percentage || 0);
          return {
            availability: Math.max(0, Math.min(100, availability)),
            isPreliminary: true
          };
        }
      }

      return {
        availability: currentAvailability,
        isPreliminary: false
      };
    } else {
      // For completed shifts, use aggregation table (fast query)
      // Prefer shift-based calculation, fallback to rolling_window for legacy data
      const aggregationResult = await query(
        `SELECT availability_percentage
         FROM availability_aggregations
         WHERE machine_id = $1
           AND calculation_type IN ('shift', 'rolling_window')
           AND window_end >= $2
           AND window_start <= $3
         ORDER BY 
           CASE calculation_type 
             WHEN 'shift' THEN 1 
             ELSE 2 
           END,
           window_end DESC
         LIMIT 1`,
        [machineId, periodStart, periodEnd]
      );

      if (aggregationResult.rows.length > 0) {
        // Use pre-calculated availability from aggregation table
        const availability = parseFloat(aggregationResult.rows[0].availability_percentage || 0);
        return {
          availability: Math.max(0, Math.min(100, availability)),
          isPreliminary: false
        };
      }
    }

    // Fallback: Calculate on-the-fly if aggregation not available
    // This ensures backward compatibility and handles edge cases
    const plannedTimeMs = periodEnd.getTime() - periodStart.getTime();
    const plannedTimeSeconds = Math.max(plannedTimeMs / 1000, 1);

    // Get aggregated durations for all statuses
    const statusDurationsResult = await query(
      `SELECT 
        status,
        COALESCE(SUM(
          CASE 
            WHEN status_end_time IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (
                LEAST(status_end_time, $3::timestamp) - 
                GREATEST(status_start_time, $2::timestamp)
              ))
            ELSE 
              EXTRACT(EPOCH FROM (
                LEAST($3::timestamp, CURRENT_TIMESTAMP) - 
                GREATEST(status_start_time, $2::timestamp)
              ))
          END
        ), 0) as duration_seconds
       FROM machine_status_history
       WHERE machine_id = $1
         AND status_start_time < $3
         AND (status_end_time IS NULL OR status_end_time > $2)
       GROUP BY status`,
      [machineId, periodStart, periodEnd]
    );

    let runningTimeSeconds = 0;
    let downtimeSeconds = 0;

    statusDurationsResult.rows.forEach(row => {
      const duration = parseFloat(row.duration_seconds || 0);
      if (row.status === 'running') {
        runningTimeSeconds = duration;
      } else {
        // All other statuses contribute to downtime
        downtimeSeconds += duration;
      }
    });

    // Calculate running time: Planned Time - Downtime
    // This matches the aggregation table calculation method
    const calculatedRunningTime = Math.max(0, plannedTimeSeconds - downtimeSeconds);
    
    // Use running time from status history if available, otherwise use calculated
    const finalRunningTime = runningTimeSeconds > 0 ? runningTimeSeconds : calculatedRunningTime;

    // Calculate availability
    const availability = (finalRunningTime / plannedTimeSeconds) * 100;
    
    // Clamp between 0 and 100
    return {
      availability: Math.max(0, Math.min(100, availability)),
      isPreliminary: false
    };
  } catch (error) {
    console.error(`Error calculating availability for ${machineId}:`, error);
    return {
      availability: 0,
      isPreliminary: false
    };
  }
}

/**
 * Calculate Performance component
 * 
 * TEMPORARY RULE: Due to incomplete targetSpeed data availability:
 * - If targetSpeed > 0 (valid): Calculate normally as (actualSpeed / targetSpeed) × 100
 * - If targetSpeed = 0 or missing: Default Performance to 100%
 * 
 * TODO: Once complete targetSpeed data is available, this function will always use:
 *   Performance = (actualSpeed / targetSpeed) × 100
 * 
 * TEMPORARY CHANGE: If targetSpeed is 0 or missing, performance defaults to 100%.
 * This is because targetSpeed values are not fully available yet.
 * TODO: Once complete targetSpeed data is available, remove the default 100% logic.
 * 
 * @param {number} actualSpeed - Current line speed (m/min)
 * @param {number} targetSpeed - Target/rated speed (m/min)
 * @returns {number} Performance percentage (0-100)
 */
export function calculatePerformance(actualSpeed, targetSpeed) {

  // TEMPORARY: If targetSpeed is 0 or missing, default performance to 100%
  // TODO: Remove this when complete targetSpeed data is available
// 822e5bc (update performance with targetSpeed)
  if (!targetSpeed || targetSpeed <= 0) {
    return 100;
  }
  

  // Standard formula: Performance = (Actual Speed / Target Speed) × 100
  // Performance cannot exceed 100% (machine cannot run faster than rated speed)
// 822e5bc (update performance with targetSpeed)
  const performance = (actualSpeed / targetSpeed) * 100;
  
  // Performance cannot exceed 100% (machine cannot run faster than rated speed)
  return Math.max(0, Math.min(100, performance));
}

/**
 * Calculate Quality component
 * Quality = (OK Length / Total Produced Length) × 100
 * 
 * @param {string} machineId - Machine ID
 * @param {string} productionOrderId - Current production order ID (optional)
 * @param {number} producedLengthOk - OK length from real-time data (optional)
 * @param {number} producedLengthNg - NG length from real-time data (optional)
 * @param {number} producedLength - Total produced length (fallback)
 * @param {Date} periodStart - Start of calculation period
 * @param {Date} periodEnd - End of calculation period
 * @returns {Promise<number>} Quality percentage (0-100)
 */
export async function calculateQuality(machineId, productionOrderId, producedLengthOk, producedLengthNg, producedLength, periodStart, periodEnd) {
  try {
    let okLength = 0;
    let ngLength = 0;
    let totalLength = 0;

    // Use real-time OK/NG data if provided
    if (producedLengthOk !== undefined && producedLengthNg !== undefined) {
      okLength = parseFloat(producedLengthOk || 0);
      ngLength = parseFloat(producedLengthNg || 0);
      totalLength = okLength + ngLength;
    } else if (producedLength !== undefined) {
      // Fallback: Use total produced length (assume all is OK if no NG data)
      totalLength = parseFloat(producedLength || 0);
      okLength = totalLength;
      ngLength = 0;
    } else {
      // Try to get from production_quality table
      if (productionOrderId) {
        const qualityResult = await query(
          `SELECT 
            COALESCE(SUM(produced_length_ok), 0) as total_ok,
            COALESCE(SUM(produced_length_ng), 0) as total_ng,
            COALESCE(SUM(total_produced_length), 0) as total_length
           FROM production_quality
           WHERE machine_id = $1
             AND production_order_id = $2
             AND calculation_period_start >= $3
             AND (calculation_period_end IS NULL OR calculation_period_end <= $4)`,
          [machineId, productionOrderId, periodStart, periodEnd]
        );

        if (qualityResult.rows.length > 0) {
          okLength = parseFloat(qualityResult.rows[0].total_ok || 0);
          ngLength = parseFloat(qualityResult.rows[0].total_ng || 0);
          totalLength = parseFloat(qualityResult.rows[0].total_length || 0);
        }
      }

      // Final fallback: Use produced_length from machines table
      if (totalLength === 0) {
        const machineResult = await query(
          `SELECT produced_length FROM machines WHERE id = $1`,
          [machineId]
        );
        if (machineResult.rows.length > 0) {
          totalLength = parseFloat(machineResult.rows[0].produced_length || 0);
          okLength = totalLength; // Assume all is OK if no quality data
          ngLength = 0;
        }
      }
    }

    // Calculate quality
    if (totalLength === 0) {
      return 100; // No production yet, assume 100% quality
    }

    const quality = (okLength / totalLength) * 100;
    return Math.max(0, Math.min(100, quality));
  } catch (error) {
    console.error(`Error calculating quality for ${machineId}:`, error);
    return 100; // Default to 100% if error
  }
}

/**
 * Calculate Overall OEE in Real-Time
 * OEE = Availability × Performance × Quality
 * 
 * @param {string} machineId - Machine ID
 * @param {Object} machineData - Current machine data with real-time values:
 *   - lineSpeed: Current line speed (m/min)
 *   - targetSpeed: Target/rated speed (m/min)
 *   - producedLength: Total produced length (meters)
 *   - producedLengthOk: OK length (meters) - optional
 *   - producedLengthNg: NG length (meters) - optional
 *   - status: Current machine status
 * @param {string} productionOrderId - Current production order ID (optional)
 * @param {Date} periodStart - Start of calculation period (default: 10 minutes ago for demo phase)
 * @param {Date} periodEnd - End of calculation period (default: NOW)
 * @returns {Promise<Object>} OEE calculation result
 */
export async function calculateOEE(machineId, machineData, productionOrderId = null, periodStart = null, periodEnd = null) {
  try {
    const now = periodEnd || new Date();
    
    // Use shift-based window for Availability calculation
    // Shift-based calculation provides better production insights aligned with factory operations
    let calcPeriodStart = periodStart;
    let calcPeriodEnd = now;
    
    if (!calcPeriodStart) {
      // Get current shift window
      const { getCurrentShiftWindow } = await import('../utils/shiftCalculator.js');
      const shiftWindow = getCurrentShiftWindow(now);
      calcPeriodStart = shiftWindow.start;
      calcPeriodEnd = shiftWindow.end; // Use shift end time for proper calculation
    }

    // Calculate Availability: Running time vs Planned time (shift-based)
    const availabilityResult = await calculateAvailability(
      machineId,
      productionOrderId,
      calcPeriodStart,
      calcPeriodEnd
    );
    const availability = availabilityResult.availability;

    // Calculate Performance: Current speed / Target speed (real-time)
    const performance = calculatePerformance(
      machineData.lineSpeed || 0,
      machineData.targetSpeed || 0
    );

    // Calculate Quality: OK length / Total length (real-time)
    const quality = await calculateQuality(
      machineId,
      productionOrderId,
      machineData.producedLengthOk,
      machineData.producedLengthNg,
      machineData.producedLength,
      calcPeriodStart,
      calcPeriodEnd
    );

    // Calculate OEE: (Availability × Performance × Quality) / 10000
    const oee = (availability * performance * quality) / 10000;

    // Store calculation in history (async, don't wait)
    storeOEECalculation(machineId, productionOrderId, {
      availability,
      performance,
      quality,
      oee,
      periodStart: calcPeriodStart,
      periodEnd: calcPeriodEnd,
      machineData
    }).catch(err => {
      console.error(`Error storing OEE calculation (non-blocking):`, err);
    });

    return {
      availability: Math.round(availability * 100) / 100,
      performance: Math.round(performance * 100) / 100,
      quality: Math.round(quality * 100) / 100,
      oee: Math.round(oee * 100) / 100,
      availabilityIsPreliminary: availabilityResult.isPreliminary,
      calculatedAt: now.toISOString(),
      periodStart: calcPeriodStart.toISOString(),
      periodEnd: now.toISOString()
    };
  } catch (error) {
    console.error(`Error calculating OEE for ${machineId}:`, error);
    return {
      availability: 0,
      performance: 0,
      quality: 0,
      oee: 0,
      availabilityIsPreliminary: false,
      calculatedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Store OEE calculation in history table
 */
async function storeOEECalculation(machineId, productionOrderId, calculation) {
  try {
    // Get running time and planned time
    const periodStart = new Date(calculation.periodStart);
    const periodEnd = new Date(calculation.periodEnd);
    const plannedTimeSeconds = Math.floor((periodEnd.getTime() - periodStart.getTime()) / 1000);

    // Get running time
    const runningTimeResult = await query(
      `SELECT 
        COALESCE(SUM(
          CASE 
            WHEN status_end_time IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (status_end_time - status_start_time))
            ELSE 
              EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - status_start_time))
          END
        ), 0) as running_seconds
       FROM machine_status_history
       WHERE machine_id = $1
         AND status = 'running'
         AND status_start_time >= $2
         AND (status_end_time IS NULL OR status_end_time <= $3)`,
      [machineId, periodStart, periodEnd]
    );
    const runningTimeSeconds = Math.floor(parseFloat(runningTimeResult.rows[0]?.running_seconds || 0));

    // Get quality data
    let okLength = calculation.machineData.producedLengthOk || 0;
    let ngLength = calculation.machineData.producedLengthNg || 0;
    if (okLength === 0 && ngLength === 0 && productionOrderId) {
      const qualityResult = await query(
        `SELECT 
          COALESCE(SUM(produced_length_ok), 0) as total_ok,
          COALESCE(SUM(produced_length_ng), 0) as total_ng
         FROM production_quality
         WHERE machine_id = $1 AND production_order_id = $2`,
        [machineId, productionOrderId]
      );
      if (qualityResult.rows.length > 0) {
        okLength = parseFloat(qualityResult.rows[0].total_ok || 0);
        ngLength = parseFloat(qualityResult.rows[0].total_ng || 0);
      }
    }

    // Insert calculation
    await query(
      `INSERT INTO oee_calculations (
        machine_id, production_order_id, calculation_timestamp,
        availability, performance, quality, oee,
        period_start, period_end,
        running_time_seconds, planned_time_seconds,
        actual_speed, target_speed,
        produced_length_ok, produced_length_ng
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        machineId,
        productionOrderId,
        new Date(),
        calculation.availability,
        calculation.performance,
        calculation.quality,
        calculation.oee,
        periodStart,
        periodEnd,
        runningTimeSeconds,
        plannedTimeSeconds,
        calculation.machineData.lineSpeed || 0,
        calculation.machineData.targetSpeed || 0,
        okLength,
        ngLength
      ]
    );
  } catch (error) {
    console.error(`Error storing OEE calculation:`, error);
    // Don't throw - calculation can continue even if storage fails
  }
}

/**
 * Get OEE trend data for a machine
 * @param {string} machineId - Machine ID
 * @param {number} hours - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} Array of OEE calculation points
 */
export async function getOEETrend(machineId, hours = 24) {
  try {
    const result = await query(
      `SELECT 
        calculation_timestamp,
        availability,
        performance,
        quality,
        oee
       FROM oee_calculations
       WHERE machine_id = $1
         AND calculation_timestamp >= NOW() - INTERVAL '${hours} hours'
       ORDER BY calculation_timestamp ASC`,
      [machineId]
    );

    return result.rows.map(row => ({
      time: new Date(row.calculation_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      availability: parseFloat(row.availability),
      performance: parseFloat(row.performance),
      quality: parseFloat(row.quality),
      oee: parseFloat(row.oee)
    }));
  } catch (error) {
    console.error(`Error getting OEE trend for ${machineId}:`, error);
    return [];
  }
}

