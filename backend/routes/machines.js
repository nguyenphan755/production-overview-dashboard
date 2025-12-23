import express from 'express';
import { query } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcast } from '../websocket/broadcast.js';

const router = express.Router();

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
    targetLength: row.target_length ? parseFloat(row.target_length) : undefined,
    productionOrderId: row.production_order_id,
    productionOrderName: row.production_order_name,
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
        `SELECT * FROM machines WHERE area = $1 ORDER BY id`,
        [area]
      );
    } else {
      machinesResult = await query(`SELECT * FROM machines ORDER BY area, id`);
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

    // Get speed trend (last 7 data points, 5 min intervals)
    const speedTrendResult = await query(
      `SELECT value, target_value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'speed'
       ORDER BY timestamp DESC
       LIMIT 7`,
      [machineId]
    );
    machine.speedTrend = speedTrendResult.rows
      .reverse()
      .map((row) => ({
        time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        speed: parseFloat(row.value || 0),
        target: parseFloat(row.target_value || machine.targetSpeed),
      }));

    // Get temperature trend
    const tempTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'temperature'
       ORDER BY timestamp DESC
       LIMIT 7`,
      [machineId]
    );
    machine.temperatureTrend = tempTrendResult.rows
      .reverse()
      .map((row) => ({
        time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        temp: parseFloat(row.value || 0),
      }));

    // Get current trend
    const currentTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'current'
       ORDER BY timestamp DESC
       LIMIT 7`,
      [machineId]
    );
    machine.currentTrend = currentTrendResult.rows
      .reverse()
      .map((row) => ({
        time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        current: parseFloat(row.value || 0),
      }));

    // Get multi-zone temperature trend
    const multiZoneTempResult = await query(
      `SELECT value, zone_number, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'multi_zone_temp'
       AND timestamp >= NOW() - INTERVAL '35 minutes'
       ORDER BY timestamp ASC`,
      [machineId]
    );
    
    // Group by timestamp
    const tempByTime = {};
    multiZoneTempResult.rows.forEach((row) => {
      const timeKey = new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (!tempByTime[timeKey]) {
        tempByTime[timeKey] = {};
      }
      if (row.zone_number) {
        tempByTime[timeKey][`zone${row.zone_number}`] = parseFloat(row.value || 0);
      }
    });
    machine.multiZoneTemperatureTrend = Object.entries(tempByTime)
      .slice(-7)
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

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      status: 'status',
      lineSpeed: 'line_speed',
      targetSpeed: 'target_speed',
      producedLength: 'produced_length',
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

    // Broadcast WebSocket update
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

    // Always update last_updated and last_status_update
    fields.push(`last_updated = CURRENT_TIMESTAMP`);
    if (updates.status) {
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

    // Broadcast WebSocket update
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
