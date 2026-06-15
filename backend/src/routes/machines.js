import express from 'express';
import { query, withClient } from '../../database/connection.js';
import {
  parseFiniteOrNull,
  recordEnergyTelemetryAndAggregateBestEffort,
  hasMachineTelemetrySnapshotChanged,
  buildTelemetryRowAfterApiUpdate,
  telemetryApiShouldSkipUnchanged,
} from '../services/machineLineTelemetry.js';
import { applyLengthCounterUpdate } from '../services/productionLengthService.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcast } from '../websocket/broadcast.js';
import { calculateOEE } from '../services/oeeCalculator.js';
import { getMachineSpeedHistory } from '../services/oeeSpeedHistoryService.js';
import { ensureAvailabilityCalculated } from '../services/availabilityAggregator.js';
import { 
  hasStatusChanged, 
  updateCachedStatus, 
  getCachedStatus,
  initializeCache 
} from '../services/machineStatusCache.js';
import { getBobbinCutsGroupedByOrder } from '../services/bobbinCutService.js';

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

  // For Drawing machines, convert speed from m/min to m/s
  // Database stores all speeds in m/min, but Drawing machines should display in m/s
  const lineSpeedRaw = parseFloat(row.line_speed || 0);
  const targetSpeedRaw = parseFloat(row.target_speed || 0);
  const isDrawingMachine = row.area === 'drawing';
  
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    status: row.status,
    lineSpeed: isDrawingMachine ? lineSpeedRaw / 60 : lineSpeedRaw, // Convert to m/s for drawing
    targetSpeed: isDrawingMachine ? targetSpeedRaw / 60 : targetSpeedRaw, // Convert to m/s for drawing
    producedLength: parseFloat(row.produced_length || 0),
    producedLengthOk: row.produced_length_ok !== undefined && row.produced_length_ok !== null ? parseFloat(row.produced_length_ok) : undefined,
    producedLengthNg: row.produced_length_ng !== undefined && row.produced_length_ng !== null ? parseFloat(row.produced_length_ng) : undefined,
    targetLength: row.target_length ? parseFloat(row.target_length) : undefined,
    productionOrderId: row.production_order_id,
    productionOrderName: row.production_order_name,
    productionOrderProductName: row.order_product_name, // Product name from joined production_orders table
    materialCode: row.material_code || undefined,
    productName: row.product_name || undefined,
    operatorName: row.operator_name,
    oee: row.oee ? parseFloat(row.oee) : undefined,
    availability: row.availability ? parseFloat(row.availability) : undefined,
    performance: row.performance ? parseFloat(row.performance) : undefined,
    quality: row.quality ? parseFloat(row.quality) : undefined,
    performanceDataQuality: row.performance_data_quality || undefined,
    qualityDataQuality: row.quality_data_quality || undefined,
    current: row.current ? parseFloat(row.current) : undefined,
    power: row.power ? parseFloat(row.power) : undefined,
    /** Cumulative kWh meter — always present (null if unset) so GET JSON shows the contract. */
    energyMeterKwh: (() => {
      if (row.energy_meter_kwh === undefined || row.energy_meter_kwh === null) return null;
      const v = parseFloat(row.energy_meter_kwh);
      return Number.isFinite(v) ? v : null;
    })(),
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

const resolveMaterialName = async (materialCode) => {
  if (!materialCode) {
    return null;
  }

  const result = await query(
    `SELECT material_name FROM material_master WHERE material_code = $1`,
    [materialCode]
  );

  return result.rows.length > 0 ? result.rows[0].material_name : null;
};

const resolveMachineByName = async (machineName) => {
  if (!machineName) {
    return null;
  }

  const result = await query(
    `SELECT id, area, product_name FROM machines WHERE name = $1`,
    [machineName]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * PLC / Python loggers often send M, DESC, etc. instead of materialCode / productName.
 * Without this, PATCH/PUT deleted product fields when materialCode was absent → machines + machine_line_telemetry did not update.
 */
async function applyMaterialAndProductRules(updates) {
  const u = updates;
  if (u == null || typeof u !== 'object') return;

  if (u.materialCode === undefined && u.material_code === undefined) {
    const alt = u.M ?? u.m ?? u.matCode ?? u.materialNumber ?? u.MaterialCode;
    if (alt !== undefined && alt !== null && String(alt).trim() !== '') {
      u.materialCode = String(alt).trim();
    }
  }

  const hasProduct =
    (u.productName !== undefined &&
      u.productName !== null &&
      String(u.productName).trim() !== '') ||
    (u.product_name !== undefined &&
      u.product_name !== null &&
      String(u.product_name).trim() !== '');

  const descCandidate =
    u.DESC ?? u.desc ?? u.materialDescription ?? u.MaterialDescription ?? u.productDescription;
  if (!hasProduct && descCandidate !== undefined && descCandidate !== null && String(descCandidate).trim() !== '') {
    u.productName = String(descCandidate).trim();
  }

  const normalizedMaterialCode =
    u.materialCode !== undefined ? u.materialCode : u.material_code !== undefined ? u.material_code : undefined;

  delete u.M;
  delete u.m;
  delete u.matCode;
  delete u.materialNumber;
  delete u.MaterialCode;
  delete u.DESC;
  delete u.desc;
  delete u.materialDescription;
  delete u.MaterialDescription;
  delete u.productDescription;

  if (normalizedMaterialCode !== undefined && normalizedMaterialCode !== null) {
    const code = String(normalizedMaterialCode).trim();
    if (code === '') {
      delete u.materialCode;
      delete u.material_code;
    } else {
      const materialName = await resolveMaterialName(code);
      u.materialCode = code;
      if (materialName != null && String(materialName).trim() !== '') {
        u.productName = materialName;
      }
    }
    delete u.material_code;
    delete u.product_name;
  } else {
    if (u.productName === undefined && u.product_name !== undefined) {
      u.productName = u.product_name;
    }
    delete u.product_name;
  }
}

/**
 * PLC often only PATCHes energyMeterKwh (machines.energy_meter_kwh) without POST /metrics.
 * Mirror that into machine_metrics so energyMeterTrend / charts have time series.
 * Skips when the stored kWh did not change (avoids one row per identical poll).
 */
async function recordEnergyMeterSampleOnRowUpdate(client, machineId, prevRow, nextRow, updates) {
  if (updates.energyMeterKwh === undefined && updates.energy_meter_kwh === undefined) {
    return;
  }
  const raw = nextRow.energy_meter_kwh;
  if (raw === undefined || raw === null) return;
  const nextVal = parseFloat(raw);
  if (!Number.isFinite(nextVal)) return;

  const prevRaw = prevRow.energy_meter_kwh;
  const prevVal =
    prevRaw === undefined || prevRaw === null ? null : parseFloat(prevRaw);
  if (
    prevVal !== null &&
    Number.isFinite(prevVal) &&
    Math.abs(prevVal - nextVal) < 1e-5
  ) {
    return;
  }

  await client.query(
    `INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, zone_number, product_name, timestamp)
     VALUES ($1, 'energy_meter_kwh', $2, NULL, NULL, $3, CURRENT_TIMESTAMP)`,
    [machineId, nextVal, nextRow.product_name || null]
  );
}

const syncRunningOrderProductNameCurrent = async (machineId, productName) => {
  if (!machineId || productName === undefined) {
    return;
  }

  await query(
    `UPDATE production_orders
     SET product_name_current = $1
     WHERE machine_id = $2
       AND status = 'running'`,
    [productName, machineId]
  );
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
          producedLengthOk:
            order.produced_length_ok !== undefined && order.produced_length_ok !== null
              ? parseFloat(order.produced_length_ok)
              : undefined,
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
          producedLengthOk: machine.producedLengthOk,
          producedLengthNg: machine.producedLengthNg,
          status: machine.status
        },
        machine.productionOrderId || null
      );

      // Update machine OEE values
      machine.oee = oeeResult.oee;
      machine.availability = oeeResult.availability;
      machine.availabilityIsPreliminary = oeeResult.availabilityIsPreliminary;
      machine.performance = oeeResult.performance;
      machine.quality = oeeResult.quality;
      machine.performanceDataQuality = oeeResult.performanceDataQuality;
      machine.qualityDataQuality = oeeResult.qualityDataQuality;

      // Update OEE in database
      await query(
        `UPDATE machines 
         SET oee = $1, availability = $2, performance = $3, quality = $4,
             performance_data_quality = $5, quality_data_quality = $6, last_updated = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [
          oeeResult.oee,
          oeeResult.availability,
          oeeResult.performance,
          oeeResult.quality,
          oeeResult.performanceDataQuality,
          oeeResult.qualityDataQuality,
          machineId,
        ]
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

    const energyMeterTrendResult = await query(
      `SELECT value, timestamp 
       FROM machine_metrics 
       WHERE machine_id = $1 AND metric_type = 'energy_meter_kwh'
       AND timestamp >= NOW() - INTERVAL '14 days'
       ORDER BY timestamp ASC
       LIMIT 4000`,
      [machineId]
    );
    machine.energyMeterTrend = energyMeterTrendResult.rows.map((row) => ({
      time: new Date(row.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: new Date(row.timestamp).toISOString(),
      meterKwh: parseFloat(row.value || 0),
    }));

    // Energy buckets (hourly kWh) — 14-day lookback so shift/calendar views can filter client-side
    const energyResult = await query(
      `SELECT
         energy_kwh,
         power_kw,
         material_code,
         product_name,
         machine_status,
         produced_length_m,
         kwh_per_100m,
         sample_count,
         hour
       FROM energy_consumption 
       WHERE machine_id = $1
       AND hour >= NOW() - INTERVAL '14 days'
       ORDER BY hour ASC`,
      [machineId]
    );
    machine.energyConsumption = energyResult.rows.map((row) => {
      const start = new Date(row.hour);
      const end = new Date(start.getTime() + 3600000);
      return {
        bucketStart: start.toISOString(),
        bucketEnd: end.toISOString(),
        energy: parseFloat(row.energy_kwh || 0),
        powerKw: parseFiniteOrNull(row.power_kw),
        materialCode: row.material_code || undefined,
        productName: row.product_name || undefined,
        machineStatus: row.machine_status || undefined,
        producedLengthM: parseFiniteOrNull(row.produced_length_m),
        kwhPer100m: parseFiniteOrNull(row.kwh_per_100m),
        sampleCount: row.sample_count !== undefined && row.sample_count !== null ? Number(row.sample_count) : undefined,
        hour: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
    });

    // Get order history
    const orderHistoryResult = await query(
      `SELECT * FROM production_orders 
       WHERE machine_id = $1
       ORDER BY start_time DESC
       LIMIT 50`,
      [machineId]
    );

    let bobbinCutsByOrder = {};
    try {
      bobbinCutsByOrder = await getBobbinCutsGroupedByOrder(machineId);
    } catch (bobbinErr) {
      console.warn(`Bobbin cuts unavailable for ${machineId}:`, bobbinErr.message);
    }

    machine.orderHistory = orderHistoryResult.rows.map((order) => ({
      id: order.id,
      name: order.name,
      productName: order.product_name,
      customer: order.customer,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      producedLengthOk:
        order.produced_length_ok !== undefined && order.produced_length_ok !== null
          ? parseFloat(order.produced_length_ok)
          : undefined,
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
      bobbinCountPlanned:
        order.bobbin_count_planned !== undefined && order.bobbin_count_planned !== null
          ? Number(order.bobbin_count_planned)
          : undefined,
      bobbinCuts: bobbinCutsByOrder[order.id] ?? [],
    }));

    if (machine.productionOrder?.id) {
      const currentId = machine.productionOrder.id;
      machine.productionOrder = {
        ...machine.productionOrder,
        bobbinCuts: bobbinCutsByOrder[currentId] ?? machine.productionOrder.bobbinCuts ?? [],
      };
    }

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

// GET /api/machines/:machineId/status-history - Get status history for Gantt chart
router.get('/:machineId/status-history', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { hours = 8, start: startQ, end: endQ } = req.query;

    let rangeStart;
    let rangeEnd;
    const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

    if (startQ != null && String(startQ).trim() !== '' && endQ != null && String(endQ).trim() !== '') {
      rangeStart = new Date(String(startQ));
      rangeEnd = new Date(String(endQ));
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return res.status(400).json({
          data: null,
          timestamp: new Date().toISOString(),
          success: false,
          message: 'Invalid start or end (expected ISO 8601)',
        });
      }
      if (rangeStart >= rangeEnd) {
        return res.status(400).json({
          data: null,
          timestamp: new Date().toISOString(),
          success: false,
          message: 'start must be before end',
        });
      }
      if (rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS) {
        return res.status(400).json({
          data: null,
          timestamp: new Date().toISOString(),
          success: false,
          message: 'Requested time range exceeds 31 days',
        });
      }
    } else {
      const hoursAgo = Math.min(Math.max(parseInt(String(hours), 10) || 8, 1), 24 * 31);
      rangeStart = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      rangeEnd = new Date();
    }

    // Lower bound on status_start_time for *closed* segments: any row overlapping [rangeStart, rangeEnd]
    // must have start >= rangeStart - lookback, with lookback capped (avoids full history scan).
    // Open segments (status_end_time IS NULL) are fetched separately (typically very few rows).
    const rangeSpanMs = rangeEnd.getTime() - rangeStart.getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const maxLookbackMs = 400 * DAY_MS;
    const minLookbackMs = 14 * DAY_MS;
    const lookbackMs = Math.min(
      maxLookbackMs,
      Math.max(minLookbackMs, rangeSpanMs * 3)
    );
    const lowerBoundStart = new Date(rangeStart.getTime() - lookbackMs);

    const statusSql = `
      SELECT * FROM (
        SELECT
          id,
          machine_id,
          status,
          previous_status,
          status_start_time,
          status_end_time,
          duration_seconds,
          is_production_time
        FROM machine_status_history
        WHERE machine_id = $1
          AND status_end_time IS NOT NULL
          AND status_start_time <= $3
          AND status_start_time >= $4
          AND status_end_time >= $2
        UNION ALL
        SELECT
          id,
          machine_id,
          status,
          previous_status,
          status_start_time,
          status_end_time,
          duration_seconds,
          is_production_time
        FROM machine_status_history
        WHERE machine_id = $1
          AND status_end_time IS NULL
          AND status_start_time <= $3
      ) AS msh
      ORDER BY msh.status_start_time ASC`;

    const statusHistoryResult = await query(statusSql, [
      machineId,
      rangeStart,
      rangeEnd,
      lowerBoundStart,
    ]);
    
    // Format the data for frontend
    const statusHistory = statusHistoryResult.rows.map(row => ({
      id: row.id,
      machineId: row.machine_id,
      status: row.status,
      previousStatus: row.previous_status,
      startTime: new Date(row.status_start_time).toISOString(),
      endTime: row.status_end_time ? new Date(row.status_end_time).toISOString() : null,
      durationSeconds: row.duration_seconds,
      isProductionTime: row.is_production_time
    }));
    
    res.json({
      data: statusHistory,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching status history:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// GET /api/machines/:machineId/speed-history - Speed time-series from oee_calculations
router.get('/:machineId/speed-history', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { start: startQ, end: endQ, bucketSec: bucketSecQ, limit: limitQ } = req.query;

    if (startQ == null || String(startQ).trim() === '' || endQ == null || String(endQ).trim() === '') {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'start and end query params are required (ISO 8601)',
      });
    }

    const rangeStart = new Date(String(startQ));
    const rangeEnd = new Date(String(endQ));
    const bucketSec = bucketSecQ != null ? parseInt(String(bucketSecQ), 10) : 60;
    const limit = limitQ != null ? parseInt(String(limitQ), 10) : null;

    const data = await getMachineSpeedHistory(machineId, rangeStart, rangeEnd, bucketSec, limit);

    res.json({
      data,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    const isClient = /must be before|Invalid date|exceeds 31 days|required/i.test(error.message || '');
    console.error('Error fetching speed history:', error);
    res.status(isClient ? 400 : 500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PATCH /api/machines/:machineId - Update machine data
router.patch('/:machineId', async (req, res) => {
  return await withClient(async (client) => {
  try {
    const { machineId } = req.params;
    const updates = req.body;

    await client.query('BEGIN');

    const machineResult = await client.query(
      `SELECT * FROM machines WHERE id = $1 FOR UPDATE`,
      [machineId]
    );

    if (machineResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Machine not found',
      });
    }

    const machineRow = machineResult.rows[0];

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

    await applyLengthCounterUpdate({
      client,
      machineRow,
      updates,
      eventTime: new Date()
    });

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      status: 'status',
      lineSpeed: 'line_speed',
      targetSpeed: 'target_speed',
      producedLength: 'produced_length',
      lengthCounter: 'length_counter',
      lengthCounterLast: 'length_counter_last',
      lengthCounterLastAt: 'length_counter_last_at',
      currentShiftId: 'current_shift_id',
      currentShiftStart: 'current_shift_start',
      currentShiftEnd: 'current_shift_end',
      length_counter: 'length_counter',
      length_counter_last: 'length_counter_last',
      producedLengthOk: 'produced_length_ok', // OK length for quality calculation
      producedLengthNg: 'produced_length_ng', // NG length for quality calculation
      targetLength: 'target_length',
      productionOrderId: 'production_order_id',
      productionOrderName: 'production_order_name',
      materialCode: 'material_code',
      material_code: 'material_code',
      productName: 'product_name',
      product_name: 'product_name',
      operatorName: 'operator_name',
      oee: 'oee',
      availability: 'availability',
      performance: 'performance',
      quality: 'quality',
      current: 'current',
      power: 'power',
      energyMeterKwh: 'energy_meter_kwh',
      energy_meter_kwh: 'energy_meter_kwh',
      temperature: 'temperature',
      multiZoneTemperatures: 'multi_zone_temperatures',
      healthScore: 'health_score',
      vibrationLevel: 'vibration_level',
      runtimeHours: 'runtime_hours',
    };

    await applyMaterialAndProductRules(updates);

    const isDrawingMachine = machineRow.area === 'drawing';

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key] && value !== undefined) {
        fields.push(`${fieldMapping[key]} = $${paramIndex}`);
        if (key === 'multiZoneTemperatures' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else if ((key === 'lineSpeed' || key === 'targetSpeed') && isDrawingMachine) {
          // Convert m/s to m/min for drawing machines before storing
          values.push(value * 60);
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      await client.query('ROLLBACK');
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

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Machine not found',
      });
    }

    try {
      await recordEnergyMeterSampleOnRowUpdate(
        client,
        machineId,
        machineRow,
        result.rows[0],
        updates
      );
    } catch (metricErr) {
      console.error(
        `[PATCH /machines/${machineId}] energy_meter_kwh metric mirror failed:`,
        metricErr.message || metricErr
      );
    }

    const updatedMachine = formatMachine(result.rows[0]);

    await client.query('COMMIT');

    if (updates.productName !== undefined) {
      try {
        await syncRunningOrderProductNameCurrent(machineId, updatedMachine.productName || null);
      } catch (error) {
        console.error(`Error syncing current product for ${machineId}:`, error);
      }
    }

    // Update status cache if status changed
    if (statusChanged) {
      updateCachedStatus(machineId, updatedMachine.status);
      
      // Ensure availability aggregation is calculated when status changes
      // Uses shift-based calculation
      try {
        await ensureAvailabilityCalculated(machineId, true); // Shift-based calculation
      } catch (error) {
        console.error(`Error ensuring availability calculated for ${machineId}:`, error);
        // Continue without blocking
      }
    }

    // Calculate real-time OEE if relevant fields were updated
    // Note: statusChanged indicates if status was in the original updates and changed
    const oeeRelevantFields = ['lineSpeed', 'targetSpeed', 'producedLength', 'producedLengthOk', 'producedLengthNg', 'status', 'productionOrderId'];
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
          producedLengthOk:
            updates.producedLengthOk !== undefined ? updates.producedLengthOk : updatedMachine.producedLengthOk,
          producedLengthNg:
            updates.producedLengthNg !== undefined ? updates.producedLengthNg : updatedMachine.producedLengthNg,
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
           SET oee = $1, availability = $2, performance = $3, quality = $4,
               performance_data_quality = $5, quality_data_quality = $6, last_updated = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            oeeResult.oee,
            oeeResult.availability,
            oeeResult.performance,
            oeeResult.quality,
            oeeResult.performanceDataQuality,
            oeeResult.qualityDataQuality,
            machineId,
          ]
        );

        // Update machine object with OEE values
        updatedMachine.oee = oeeResult.oee;
        updatedMachine.availability = oeeResult.availability;
        updatedMachine.availabilityIsPreliminary = oeeResult.availabilityIsPreliminary;
        updatedMachine.performance = oeeResult.performance;
        updatedMachine.quality = oeeResult.quality;
        updatedMachine.performanceDataQuality = oeeResult.performanceDataQuality;
        updatedMachine.qualityDataQuality = oeeResult.qualityDataQuality;
      } catch (error) {
        console.error(`Error calculating OEE for ${machineId}:`, error);
        // Continue without OEE update if calculation fails
      }
    }

    // Broadcast WebSocket update (includes OEE if calculated)
    broadcast('machine:update', updatedMachine);

    // Run energy telemetry persistence out-of-band so machine realtime updates
    // are never blocked by migration lag / telemetry table errors.
    const telemetryNextRow = buildTelemetryRowAfterApiUpdate(result.rows[0], updatedMachine);
    const skipUnchanged = telemetryApiShouldSkipUnchanged();
    if (!skipUnchanged || hasMachineTelemetrySnapshotChanged(machineRow, telemetryNextRow)) {
      recordEnergyTelemetryAndAggregateBestEffort(
        machineId,
        machineRow,
        telemetryNextRow,
        `PATCH /machines/${machineId}`
      );
    }

    return res.json({
      data: updatedMachine,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error updating machine:', error);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back machine update:', rollbackError);
    }
    return res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
  });
});

// PUT /api/machines/name/:machineName - Update machine by name (for Node-RED)
// Important: do not hold a pool client across pool.query() work (OEE, sync orders, etc.).
// MES often bursts many PUTs; nested pool.query while withClient holds a client exhausts the pool
// (timeouts ~ connectionTimeoutMillis) and can crash the process on uncaught pool.connect errors.
router.put('/name/:machineName', authenticateToken, async (req, res) => {
  const ts = () => new Date().toISOString();
  const failBody = (message) => ({
    data: null,
    timestamp: ts(),
    success: false,
    message,
  });

  try {
    const { machineName } = req.params;
    const updates =
      req.body != null && typeof req.body === 'object' && !Array.isArray(req.body)
        ? { ...req.body }
        : {};

    await applyMaterialAndProductRules(updates);

    let tx;
    try {
      tx = await withClient(async (client) => {
        try {
          const nameRes = await client.query(
            `SELECT id, area, product_name FROM machines WHERE name = $1`,
            [machineName]
          );
          if (!nameRes.rows.length) {
            return {
              ok: false,
              status: 404,
              body: failBody(`Machine with name "${machineName}" not found`),
            };
          }
          const machineRecord = nameRes.rows[0];
          const machineId = machineRecord.id;

          await client.query('BEGIN');

          const machineResult = await client.query(`SELECT * FROM machines WHERE id = $1 FOR UPDATE`, [machineId]);

          if (machineResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false, status: 404, body: failBody('Machine not found') };
          }

          const machineRow = machineResult.rows[0];

          let statusChanged = false;
          if (updates.status !== undefined) {
            const newStatus = updates.status;
            statusChanged = hasStatusChanged(machineId, newStatus);

            if (!statusChanged) {
              console.log(
                `⏭️  Machine ${machineName} (${machineId}): Status unchanged (${newStatus}), skipping status update`
              );
              delete updates.status;
            } else {
              console.log(`🔄 Machine ${machineName} (${machineId}): Status changed to ${newStatus}`);
            }
          }

          await applyLengthCounterUpdate({
            client,
            machineRow,
            updates,
            eventTime: new Date(),
          });

          const fields = [];
          const values = [];
          let paramIndex = 1;

          const fieldMapping = {
            status: 'status',
            lineSpeed: 'line_speed',
            targetSpeed: 'target_speed',
            producedLength: 'produced_length',
            lengthCounter: 'length_counter',
            lengthCounterLast: 'length_counter_last',
            lengthCounterLastAt: 'length_counter_last_at',
            currentShiftId: 'current_shift_id',
            currentShiftStart: 'current_shift_start',
            currentShiftEnd: 'current_shift_end',
            length_counter: 'length_counter',
            length_counter_last: 'length_counter_last',
            targetLength: 'target_length',
            productionOrderId: 'production_order_id',
            productionOrderName: 'production_order_name',
            materialCode: 'material_code',
            material_code: 'material_code',
            productName: 'product_name',
            product_name: 'product_name',
            operatorName: 'operator_name',
            producedLengthOk: 'produced_length_ok',
            producedLengthNg: 'produced_length_ng',
            oee: 'oee',
            availability: 'availability',
            performance: 'performance',
            quality: 'quality',
            current: 'current',
            power: 'power',
            powerConsumption: 'power',
            energyMeterKwh: 'energy_meter_kwh',
            energy_meter_kwh: 'energy_meter_kwh',
            temperature: 'temperature',
            multiZoneTemperatures: 'multi_zone_temperatures',
            healthScore: 'health_score',
            health_score: 'health_score',
            vibrationLevel: 'vibration_level',
            vibration_level: 'vibration_level',
            runtimeHours: 'runtime_hours',
            runtime_hours: 'runtime_hours',
          };

          const isDrawingMachine = machineRecord.area === 'drawing';

          for (const [key, value] of Object.entries(updates)) {
            const dbField = fieldMapping[key];
            if (dbField && value !== undefined) {
              fields.push(`${dbField} = $${paramIndex}`);
              if (key === 'multiZoneTemperatures' && typeof value === 'object') {
                values.push(JSON.stringify(value));
              } else if ((key === 'lineSpeed' || key === 'targetSpeed') && isDrawingMachine) {
                values.push(value * 60);
              } else {
                values.push(value);
              }
              paramIndex += 1;
            }
          }

          if (fields.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false, status: 400, body: failBody('No valid fields to update') };
          }

          fields.push(`last_updated = CURRENT_TIMESTAMP`);

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

          const result = await client.query(updateQuery, values);

          if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false, status: 404, body: failBody('Machine not found') };
          }

          try {
            await recordEnergyMeterSampleOnRowUpdate(client, machineId, machineRow, result.rows[0], updates);
          } catch (metricErr) {
            console.error(
              `[PUT /machines/name/${machineName}] energy_meter_kwh metric mirror failed:`,
              metricErr.message || metricErr
            );
          }

          await client.query('COMMIT');

          return {
            ok: true,
            machineId,
            machineName,
            updates,
            machineRow,
            statusChanged,
            resultRow: result.rows[0],
            updatedMachine: formatMachine(result.rows[0]),
          };
        } catch (error) {
          console.error('Error updating machine by name (transaction):', error);
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('Error rolling back machine name update:', rollbackError);
          }
          return { ok: false, status: 500, body: failBody(error.message) };
        }
      });
    } catch (poolErr) {
      console.error('PUT /machines/name DB pool / connect error:', poolErr);
      return res.status(503).json(failBody(poolErr.message || 'Database temporarily unavailable'));
    }

    if (!tx.ok) {
      return res.status(tx.status).json(tx.body);
    }

    let { updatedMachine } = tx;

    if (tx.updates.productName !== undefined) {
      try {
        await syncRunningOrderProductNameCurrent(tx.machineId, updatedMachine.productName || null);
      } catch (error) {
        console.error(`Error syncing current product for ${tx.machineId}:`, error);
      }
    }

    if (tx.updates.status !== undefined) {
      try {
        await ensureAvailabilityCalculated(tx.machineId, true);
      } catch (error) {
        console.error(`Error ensuring availability calculated for ${tx.machineId}:`, error);
      }
    }

    const oeeRelevantFields = [
      'lineSpeed',
      'targetSpeed',
      'producedLength',
      'producedLengthOk',
      'producedLengthNg',
      'status',
      'productionOrderId',
    ];
    const shouldRecalculateOEE = oeeRelevantFields.some((field) => tx.updates[field] !== undefined);

    if (shouldRecalculateOEE) {
      try {
        const currentMachineData = {
          lineSpeed: updatedMachine.lineSpeed || 0,
          targetSpeed: updatedMachine.targetSpeed || 0,
          producedLength: updatedMachine.producedLength || 0,
          producedLengthOk:
            tx.updates.producedLengthOk !== undefined ? tx.updates.producedLengthOk : updatedMachine.producedLengthOk,
          producedLengthNg:
            tx.updates.producedLengthNg !== undefined ? tx.updates.producedLengthNg : updatedMachine.producedLengthNg,
          status: updatedMachine.status,
        };

        const oeeResult = await calculateOEE(
          tx.machineId,
          currentMachineData,
          updatedMachine.productionOrderId || null
        );

        await query(
          `UPDATE machines 
           SET oee = $1, availability = $2, performance = $3, quality = $4,
               performance_data_quality = $5, quality_data_quality = $6, last_updated = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            oeeResult.oee,
            oeeResult.availability,
            oeeResult.performance,
            oeeResult.quality,
            oeeResult.performanceDataQuality,
            oeeResult.qualityDataQuality,
            tx.machineId,
          ]
        );

        updatedMachine = {
          ...updatedMachine,
          oee: oeeResult.oee,
          availability: oeeResult.availability,
          availabilityIsPreliminary: oeeResult.availabilityIsPreliminary,
          performance: oeeResult.performance,
          quality: oeeResult.quality,
          performanceDataQuality: oeeResult.performanceDataQuality,
          qualityDataQuality: oeeResult.qualityDataQuality,
        };
      } catch (error) {
        console.error(`Error calculating OEE for ${tx.machineId}:`, error);
      }
    }

    broadcast('machine:update', updatedMachine);

    const telemetryNextRow = buildTelemetryRowAfterApiUpdate(tx.resultRow, updatedMachine);
    const skipUnchanged = telemetryApiShouldSkipUnchanged();
    if (!skipUnchanged || hasMachineTelemetrySnapshotChanged(tx.machineRow, telemetryNextRow)) {
      recordEnergyTelemetryAndAggregateBestEffort(
        tx.machineId,
        tx.machineRow,
        telemetryNextRow,
        `PUT /machines/name/${tx.machineName}`
      );
    }

    console.log(`✅ Machine ${tx.machineName} updated via API by ${req.user?.username || 'unknown'}`);

    return res.json({
      data: updatedMachine,
      timestamp: ts(),
      success: true,
    });
  } catch (error) {
    console.error('PUT /machines/name unhandled error:', error);
    if (!res.headersSent) {
      return res.status(500).json(failBody(error.message || 'Internal server error'));
    }
  }
});

// POST /api/machines/:machineId/metrics - Insert metric data point
router.post('/:machineId/metrics', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { metricType, value, targetValue, zoneNumber } = req.body;
    const machineName = req.body.machine_name || req.body.machineName;

    if (!metricType || value === undefined) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'metricType and value are required',
      });
    }

    let resolvedMachineId = machineId;
    let productName = null;

    if (machineName) {
      const machineRecord = await resolveMachineByName(machineName);
      if (!machineRecord) {
        return res.status(404).json({
          data: null,
          timestamp: new Date().toISOString(),
          success: false,
          message: `Machine with name "${machineName}" not found`,
        });
      }
      resolvedMachineId = machineRecord.id;
      productName = machineRecord.product_name || null;
    } else if (resolvedMachineId) {
      const productionResult = await query(
        `SELECT product_name FROM machines WHERE id = $1`,
        [resolvedMachineId]
      );
      productName = productionResult.rows.length > 0
        ? productionResult.rows[0].product_name
        : null;
    } else {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'machine_name or machine_id is required',
      });
    }

    const result = await query(
      `INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, zone_number, product_name, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [resolvedMachineId, metricType, value, targetValue || null, zoneNumber || null, productName]
    );

    if (String(metricType).toLowerCase() === 'energy_meter_kwh') {
      const v = parseFloat(value);
      if (!Number.isNaN(v)) {
        await query(
          `UPDATE machines SET energy_meter_kwh = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2`,
          [v, resolvedMachineId]
        );
      }
    }

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
      producedLengthOk:
        order.produced_length_ok !== undefined && order.produced_length_ok !== null
          ? parseFloat(order.produced_length_ok)
          : undefined,
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
