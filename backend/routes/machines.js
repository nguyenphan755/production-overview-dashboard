import express from 'express';
import { query } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcast } from '../websocket/broadcast.js';
import { calculateOEE } from '../services/oeeCalculator.js';
import { ensureAvailabilityCalculated } from '../services/availabilityAggregator.js';
import { 
  hasStatusChanged, 
  updateCachedStatus, 
  getCachedStatus,
  initializeCache 
} from '../services/machineStatusCache.js';

const router = express.Router();

// Initialize status cache on module load
initializeCache(query).catch(err => {
  console.error('Failed to initialize status cache:', err);
});

// Helper function to format machine data
const formatMachine = (row) => {
  // Parse multi_zone_temperatures if it's a string (JSONB from PostgreSQL)
  let multiZoneTemps = undefined;
  if (row.multi_zone_temperatures) {
    if (typeof row.multi_zone_temperatures === 'string') {
      try {
        multiZoneTemps = JSON.parse(row.multi_zone_temperatures);
      } catch (e) {
        console.warn('Failed to parse multi_zone_temperatures:', e);
      }
    } else {
      multiZoneTemps = row.multi_zone_temperatures;
    }
  }

  return {
    id: row.id,
    name: row.name,
    area: row.area,
    status: row.status,
    lineSpeed: parseFloat(row.line_speed || 0),
    targetSpeed: parseFloat(row.target_speed || 0),
    producedLength: parseFloat(row.produced_length || 0),
    producedLengthOk: row.produced_length_ok !== undefined && row.produced_length_ok !== null ? parseFloat(row.produced_length_ok) : undefined,
    producedLengthNg: row.produced_length_ng !== undefined && row.produced_length_ng !== null ? parseFloat(row.produced_length_ng) : undefined,
    targetLength: row.target_length ? parseFloat(row.target_length) : undefined,
    productionOrderId: row.production_order_id,
    productionOrderName: row.production_order_name,
    productionOrderProductName: row.order_product_name, // Product name from joined production_orders table
    operatorName: row.operator_name,
    oee: row.oee ? parseFloat(row.oee) : undefined,
    availability: row.availability ? parseFloat(row.availability) : undefined,
    performance: row.performance ? parseFloat(row.performance) : undefined,
    quality: row.quality ? parseFloat(row.quality) : undefined,
    current: row.current ? parseFloat(row.current) : undefined,
    power: row.power ? parseFloat(row.power) : undefined,
    temperature: row.temperature ? parseFloat(row.temperature) : undefined,
    multiZoneTemperatures: multiZoneTemps,
    healthScore: row.health_score ? parseFloat(row.health_score) : undefined,
    vibrationLevel: row.vibration_level || undefined,
    runtimeHours: row.runtime_hours ? parseFloat(row.runtime_hours) : undefined,
    lastStatusUpdate: row.last_status_update ? new Date(row.last_status_update).toISOString() : undefined,
    alarms: [], // Will be populated separately if needed
    lastUpdated: row.last_updated ? new Date(row.last_updated).toISOString() : new Date().toISOString(),
  };
};

// GET /api/machines
router.get('/', async (req, res) => {
  try {
    const { area } = req.query;
    
    let machinesResult;
    if (area) {
      machinesResult = await query(
        `SELECT 
          m.*,
          po.product_name as order_product_name
        FROM machines m
        LEFT JOIN production_orders po ON m.production_order_id = po.id
        WHERE m.area = $1 
        ORDER BY m.id`,
        [area]
      );
    } else {
      machinesResult = await query(
        `SELECT 
          m.*,
          po.product_name as order_product_name
        FROM machines m
        LEFT JOIN production_orders po ON m.production_order_id = po.id
        ORDER BY m.area, m.id`
      );
    }

    const machines = machinesResult.rows.map(formatMachine);

    // Get alarms for all machines
    const machineIds = machines.map((m) => m.id);
    if (machineIds.length > 0) {
      const alarmsResult = await query(
        `SELECT * FROM alarms 
         WHERE machine_id = ANY($1) AND acknowledged = FALSE
         ORDER BY timestamp DESC`,
        [machineIds]
      );

      // Group alarms by machine
      const alarmsByMachine = {};
      alarmsResult.rows.forEach((alarm) => {
        if (!alarmsByMachine[alarm.machine_id]) {
          alarmsByMachine[alarm.machine_id] = [];
        }
        alarmsByMachine[alarm.machine_id].push({
          id: alarm.id,
          machineId: alarm.machine_id,
          severity: alarm.severity,
          message: alarm.message,
          timestamp: new Date(alarm.timestamp).toISOString(),
          acknowledged: alarm.acknowledged,
        });
      });

      // Attach alarms to machines
      machines.forEach((machine) => {
        machine.alarms = alarmsByMachine[machine.id] || [];
      });
    }

    res.json({
      data: machines,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// GET /api/machines/:machineId
router.get('/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;

    // Get machine
    const machineResult = await query(
      `SELECT * FROM machines WHERE id = $1`,
      [machineId]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Machine not found',
      });
    }

    const machine = formatMachine(machineResult.rows[0]);

    // Get production order if exists
    if (machine.productionOrderId) {
      const orderResult = await query(
        `SELECT * FROM production_orders WHERE id = $1`,
        [machine.productionOrderId]
      );
      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        machine.productionOrder = {
          id: order.id,
          name: order.name,
          productName: order.product_name,
          customer: order.customer,
          machineId: order.machine_id,
          startTime: new Date(order.start_time).toISOString(),
          endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
          producedLength: parseFloat(order.produced_length || 0),
          targetLength: parseFloat(order.target_length || 0),
          status: order.status,
          duration: order.duration,
        };
      }
    }

    // Calculate real-time OEE
    try {
      const oeeResult = await calculateOEE(
        machineId,
        {
          lineSpeed: machine.lineSpeed,
          targetSpeed: machine.targetSpeed,
          producedLength: machine.producedLength,
          producedLengthOk: row.produced_length_ok !== undefined && row.produced_length_ok !== null ? parseFloat(row.produced_length_ok) : undefined,
          producedLengthNg: row.produced_length_ng !== undefined && row.produced_length_ng !== null ? parseFloat(row.produced_length_ng) : undefined,
          status: machine.status
        },
        machine.productionOrderId || null
      );

      // Update machine OEE values
      machine.oee = oeeResult.oee;
      machine.availability = oeeResult.availability;
      machine.performance = oeeResult.performance;
      machine.quality = oeeResult.quality;

      // Update OEE in database
      await query(
        `UPDATE machines 
         SET oee = $1, availability = $2, performance = $3, quality = $4, last_updated = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [oeeResult.oee, oeeResult.availability, oeeResult.performance, oeeResult.quality, machineId]
      );
    } catch (error) {
      console.error(`Error calculating OEE for ${machineId}:`, error);
      // Continue with existing OEE values if calculation fails
    }

    // Get speed trend (last 5 minutes, 30-second intervals = ~10 points)
    const speedTrendResult = await query(
      `SELECT value, target_value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'speed'
       AND timestamp >= NOW() - INTERVAL '5 minutes'
       ORDER BY timestamp ASC
       LIMIT 20`,
      [machineId]
    );
    machine.speedTrend = speedTrendResult.rows.map((row) => ({
      time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      speed: parseFloat(row.value || 0),
      target: parseFloat(row.target_value || machine.targetSpeed),
    }));

    // Get temperature trend (last 5 minutes, 30-second intervals = ~10 points)
    const tempTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'temperature'
       AND timestamp >= NOW() - INTERVAL '5 minutes'
       ORDER BY timestamp ASC
       LIMIT 20`,
      [machineId]
    );
    machine.temperatureTrend = tempTrendResult.rows.map((row) => ({
      time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temp: parseFloat(row.value || 0),
    }));

    // Get current trend (last 5 minutes, 30-second intervals = ~10 points)
    const currentTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'current'
       AND timestamp >= NOW() - INTERVAL '5 minutes'
       ORDER BY timestamp ASC
       LIMIT 20`,
      [machineId]
    );
    machine.currentTrend = currentTrendResult.rows.map((row) => ({
      time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      current: parseFloat(row.value || 0),
    }));

    // Get multi-zone temperature trend (last 5 minutes, 30-second intervals)
    const multiZoneTempResult = await query(
      `SELECT value, zone_number, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'multi_zone_temp'
       AND timestamp >= NOW() - INTERVAL '5 minutes'
       ORDER BY timestamp ASC
       LIMIT 80`,
      [machineId]
    );
    
    // Group by timestamp
    const tempByTime = {};
    multiZoneTempResult.rows.forEach((row) => {
      const timeKey = new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (!tempByTime[timeKey]) {
        tempByTime[timeKey] = {};
      }
      if (row.zone_number) {
        tempByTime[timeKey][`zone${row.zone_number}`] = parseFloat(row.value || 0);
      }
    });
    machine.multiZoneTemperatureTrend = Object.entries(tempByTime)
      .map(([time, zones]) => ({ time, ...zones }));

    // Get power trend (last 2 hours, 15-min intervals)
    const powerTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'power'
       AND timestamp >= NOW() - INTERVAL '2 hours'
       ORDER BY timestamp ASC`,
      [machineId]
    );
    
    const avgPower = machine.power || 68;
    machine.powerTrend = powerTrendResult.rows
      .filter((_, i) => i % 3 === 0) // Sample every 3rd point for 15-min intervals
      .slice(-9)
      .map((row) => ({
        time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        power: parseFloat(row.value || 0),
        avgPower,
        minRange: avgPower - 8,
        maxRange: avgPower + 7,
      }));

    // Get energy consumption (last 24 hours, hourly)
    const energyResult = await query(
      `SELECT energy_kwh, hour 
       FROM energy_consumption 
       WHERE machine_id = $1
       AND hour >= NOW() - INTERVAL '24 hours'
       ORDER BY hour ASC`,
      [machineId]
    );
    machine.energyConsumption = energyResult.rows.map((row) => ({
      hour: new Date(row.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      energy: parseFloat(row.energy_kwh || 0),
    }));

    // Get order history
    const orderHistoryResult = await query(
      `SELECT * FROM production_orders 
       WHERE machine_id = $1
       ORDER BY start_time DESC
       LIMIT 10`,
      [machineId]
    );
    machine.orderHistory = orderHistoryResult.rows.map((order) => ({
      id: order.id,
      name: order.name,
      productName: order.product_name,
      customer: order.customer,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
    }));

    // Get alarms
    const alarmsResult = await query(
      `SELECT * FROM alarms 
       WHERE machine_id = $1
       ORDER BY timestamp DESC`,
      [machineId]
    );
    machine.alarms = alarmsResult.rows.map((alarm) => ({
      id: alarm.id,
      machineId: alarm.machine_id,
      severity: alarm.severity,
      message: alarm.message,
      timestamp: new Date(alarm.timestamp).toISOString(),
      acknowledged: alarm.acknowledged,
    }));

    res.json({
      data: machine,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching machine detail:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PATCH /api/machines/:machineId - Update machine data
router.patch('/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const updates = req.body;

    // EVENT-BASED STATUS UPDATE: Only update status if it has changed
    let statusChanged = false;
    if (updates.status !== undefined) {
      const newStatus = updates.status;
      statusChanged = hasStatusChanged(machineId, newStatus);
      
      if (!statusChanged) {
        // Status hasn't changed, remove it from updates to prevent unnecessary database write
        console.log(`⏭️  Machine ${machineId}: Status unchanged (${newStatus}), skipping status update`);
        delete updates.status;
      } else {
        // Status has changed, will update database and trigger status history
        console.log(`🔄 Machine ${machineId}: Status changed to ${newStatus}`);
      }
    }

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      status: 'status',
      lineSpeed: 'line_speed',
      targetSpeed: 'target_speed',
      producedLength: 'produced_length',
      producedLengthOk: 'produced_length_ok', // OK length for quality calculation
      producedLengthNg: 'produced_length_ng', // NG length for quality calculation
      targetLength: 'target_length',
      productionOrderId: 'production_order_id',
      productionOrderName: 'production_order_name',
      operatorName: 'operator_name',
      oee: 'oee',
      availability: 'availability',
      performance: 'performance',
      quality: 'quality',
      current: 'current',
      power: 'power',
      temperature: 'temperature',
      multiZoneTemperatures: 'multi_zone_temperatures',
      healthScore: 'health_score',
      vibrationLevel: 'vibration_level',
      runtimeHours: 'runtime_hours',
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key] && value !== undefined) {
        fields.push(`${fieldMapping[key]} = $${paramIndex}`);
        if (key === 'multiZoneTemperatures' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Always update last_updated
    fields.push(`last_updated = CURRENT_TIMESTAMP`);
    
    // Only update last_status_update if status actually changed
    if (statusChanged) {
      fields.push(`last_status_update = CURRENT_TIMESTAMP`);
    }
    
    values.push(machineId);

    const updateQuery = `
      UPDATE machines 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Machine not found',
      });
    }

    const updatedMachine = formatMachine(result.rows[0]);

    // Update status cache if status changed
    if (statusChanged) {
      updateCachedStatus(machineId, updatedMachine.status);
      
      // Ensure availability aggregation is calculated when status changes
      try {
        await ensureAvailabilityCalculated(machineId, 10); // 10-minute window
      } catch (error) {
        console.error(`Error ensuring availability calculated for ${machineId}:`, error);
        // Continue without blocking
      }
    }

    // Calculate real-time OEE if relevant fields were updated
    // Note: statusChanged indicates if status was in the original updates and changed
    const oeeRelevantFields = ['lineSpeed', 'targetSpeed', 'producedLength', 'status', 'productionOrderId'];
    const shouldRecalculateOEE = oeeRelevantFields.some(field => 
      (field === 'status' && statusChanged) || (field !== 'status' && updates[field] !== undefined)
    );
    
    if (shouldRecalculateOEE) {
      try {
        // Get current machine data for OEE calculation
        const currentMachineData = {
          lineSpeed: updatedMachine.lineSpeed || 0,
          targetSpeed: updatedMachine.targetSpeed || 0,
          producedLength: updatedMachine.producedLength || 0,
          producedLengthOk: updates.producedLengthOk !== undefined ? updates.producedLengthOk : undefined,
          producedLengthNg: updates.producedLengthNg !== undefined ? updates.producedLengthNg : undefined,
          status: updatedMachine.status
        };

        const oeeResult = await calculateOEE(
          machineId,
          currentMachineData,
          updatedMachine.productionOrderId || null
        );

        // Update OEE values in database
        await query(
          `UPDATE machines 
           SET oee = $1, availability = $2, performance = $3, quality = $4, last_updated = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [oeeResult.oee, oeeResult.availability, oeeResult.performance, oeeResult.quality, machineId]
        );

        // Update machine object with OEE values
        updatedMachine.oee = oeeResult.oee;
        updatedMachine.availability = oeeResult.availability;
        updatedMachine.performance = oeeResult.performance;
        updatedMachine.quality = oeeResult.quality;
      } catch (error) {
        console.error(`Error calculating OEE for ${machineId}:`, error);
        // Continue without OEE update if calculation fails
      }
    }

    // Broadcast WebSocket update (includes OEE if calculated)
    broadcast('machine:update', updatedMachine);

    res.json({
      data: updatedMachine,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error updating machine:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PUT /api/machines/name/:machineName - Update machine by name (for Node-RED)
router.put('/name/:machineName', authenticateToken, async (req, res) => {
  try {
    const { machineName } = req.params;
    const updates = req.body;

    // First, get machine ID by name
    const machineResult = await query(
      `SELECT id FROM machines WHERE name = $1`,
      [machineName]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: `Machine with name "${machineName}" not found`,
      });
    }

    const machineId = machineResult.rows[0].id;

    // EVENT-BASED STATUS UPDATE: Only update status if it has changed
    // This prevents excessive database writes and reduces load on machine_status_history table
    let statusChanged = false;
    if (updates.status !== undefined) {
      const newStatus = updates.status;
      statusChanged = hasStatusChanged(machineId, newStatus);
      
      if (!statusChanged) {
        // Status hasn't changed, remove it from updates to prevent unnecessary database write
        console.log(`⏭️  Machine ${machineName} (${machineId}): Status unchanged (${newStatus}), skipping status update`);
        delete updates.status;
      } else {
        // Status has changed, will update database and trigger status history
        console.log(`🔄 Machine ${machineName} (${machineId}): Status changed to ${newStatus}`);
      }
    }

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Map API field names to database column names
    const fieldMapping = {
      status: 'status',
      lineSpeed: 'line_speed',
      targetSpeed: 'target_speed',
      producedLength: 'produced_length',
      targetLength: 'target_length',
      productionOrderId: 'production_order_id',
      productionOrderName: 'production_order_name',
      operatorName: 'operator_name',
      producedLengthOk: 'produced_length_ok', // OK length for quality calculation
      producedLengthNg: 'produced_length_ng', // NG length for quality calculation
      oee: 'oee',
      availability: 'availability',
      performance: 'performance',
      quality: 'quality',
      current: 'current',
      power: 'power',
      powerConsumption: 'power', // Alias for power
      temperature: 'temperature',
      multiZoneTemperatures: 'multi_zone_temperatures',
      healthScore: 'health_score',
      health_score: 'health_score', // Support both formats
      vibrationLevel: 'vibration_level',
      vibration_level: 'vibration_level', // Support both formats
      runtimeHours: 'runtime_hours',
      runtime_hours: 'runtime_hours', // Support both formats
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        if (key === 'multiZoneTemperatures' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Always update last_updated
    fields.push(`last_updated = CURRENT_TIMESTAMP`);
    
    // Only update last_status_update if status actually changed
    if (statusChanged) {
      fields.push(`last_status_update = CURRENT_TIMESTAMP`);
    }
    
    values.push(machineId);

    const updateQuery = `
      UPDATE machines 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Machine not found',
      });
    }

    const updatedMachine = formatMachine(result.rows[0]);

    // Ensure availability aggregation is calculated when status changes
    if (updates.status !== undefined) {
      try {
        await ensureAvailabilityCalculated(machineId, 10); // 10-minute window
      } catch (error) {
        console.error(`Error ensuring availability calculated for ${machineId}:`, error);
        // Continue without blocking
      }
    }

    // Calculate real-time OEE if relevant fields were updated
    const oeeRelevantFields = ['lineSpeed', 'targetSpeed', 'producedLength', 'producedLengthOk', 'producedLengthNg', 'status', 'productionOrderId'];
    const shouldRecalculateOEE = oeeRelevantFields.some(field => updates[field] !== undefined);
    
    if (shouldRecalculateOEE) {
      try {
        // Get current machine data for OEE calculation
        const currentMachineData = {
          lineSpeed: updatedMachine.lineSpeed || 0,
          targetSpeed: updatedMachine.targetSpeed || 0,
          producedLength: updatedMachine.producedLength || 0,
          producedLengthOk: updates.producedLengthOk !== undefined ? updates.producedLengthOk : undefined,
          producedLengthNg: updates.producedLengthNg !== undefined ? updates.producedLengthNg : undefined,
          status: updatedMachine.status
        };

        const oeeResult = await calculateOEE(
          machineId,
          currentMachineData,
          updatedMachine.productionOrderId || null
        );

        // Update OEE values in database
        await query(
          `UPDATE machines 
           SET oee = $1, availability = $2, performance = $3, quality = $4, last_updated = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [oeeResult.oee, oeeResult.availability, oeeResult.performance, oeeResult.quality, machineId]
        );

        // Update machine object with OEE values
        updatedMachine.oee = oeeResult.oee;
        updatedMachine.availability = oeeResult.availability;
        updatedMachine.performance = oeeResult.performance;
        updatedMachine.quality = oeeResult.quality;
      } catch (error) {
        console.error(`Error calculating OEE for ${machineId}:`, error);
        // Continue without OEE update if calculation fails
      }
    }

    // Broadcast WebSocket update (includes OEE if calculated)
    broadcast('machine:update', updatedMachine);

    console.log(`✅ Machine ${machineName} updated via API by ${req.user?.username || 'unknown'}`);

    res.json({
      data: updatedMachine,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error updating machine by name:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// POST /api/machines/:machineId/metrics - Insert metric data point
router.post('/:machineId/metrics', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { metricType, value, targetValue, zoneNumber } = req.body;

    if (!metricType || value === undefined) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'metricType and value are required',
      });
    }

    const result = await query(
      `INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, zone_number, timestamp)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [machineId, metricType, value, targetValue || null, zoneNumber || null]
    );

    res.json({
      data: {
        id: result.rows[0].id,
        machineId: result.rows[0].machine_id,
        metricType: result.rows[0].metric_type,
        value: parseFloat(result.rows[0].value),
        timestamp: new Date(result.rows[0].timestamp).toISOString(),
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error inserting metric:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// POST /api/machines/:machineId/alarms - Create alarm
router.post('/:machineId/alarms', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { severity, message } = req.body;

    if (!severity || !message) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'severity and message are required',
      });
    }

    const alarmId = `ALM-${Date.now()}`;
    const result = await query(
      `INSERT INTO alarms (id, machine_id, severity, message, timestamp, acknowledged)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, FALSE)
       RETURNING *`,
      [alarmId, machineId, severity, message]
    );

    res.json({
      data: {
        id: result.rows[0].id,
        machineId: result.rows[0].machine_id,
        severity: result.rows[0].severity,
        message: result.rows[0].message,
        timestamp: new Date(result.rows[0].timestamp).toISOString(),
        acknowledged: result.rows[0].acknowledged,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error creating alarm:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// GET /api/machines/:machineId/orders
router.get('/:machineId/orders', async (req, res) => {
  try {
    const { machineId } = req.params;

    const ordersResult = await query(
      `SELECT * FROM production_orders 
       WHERE machine_id = $1
       ORDER BY start_time DESC`,
      [machineId]
    );

    const orders = ordersResult.rows.map((order) => ({
      id: order.id,
      name: order.name,
      productName: order.product_name,
      customer: order.customer,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
    }));

    res.json({
      data: orders,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching machine orders:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;
