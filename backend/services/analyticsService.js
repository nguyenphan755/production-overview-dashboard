/**
 * AI-assisted analytics service (deterministic, rule-based, explainable)
 * Computes and caches Six Big Losses, Pareto, ranking, root cause, anomalies.
 */

import { query } from '../database/connection.js';
import { getCurrentShiftWindow, getShiftId, getShiftWindow } from '../utils/shiftCalculator.js';

const CACHE_TTL_SECONDS = parseInt(process.env.ANALYTICS_CACHE_TTL || '60', 10);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const floorToMinute = (date) => new Date(Math.floor(date.getTime() / 60000) * 60000);

const getRangeWindow = (range, now = new Date(), options = {}) => {
  const normalizedEnd = floorToMinute(now);
  if (range === 'shift') {
    if (options.shiftDate && options.shiftNumber) {
      const [year, month, day] = options.shiftDate.split('-').map(Number);
      const date = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
      const shiftWindow = getShiftWindow(parseInt(options.shiftNumber, 10), date);
      const shiftId = getShiftId(parseInt(options.shiftNumber, 10), shiftWindow.start);
      return {
        range,
        start: shiftWindow.start,
        end: shiftWindow.end,
        shiftId,
        shift: parseInt(options.shiftNumber, 10),
      };
    }
    const window = getCurrentShiftWindow(now);
    return {
      range,
      start: window.start,
      end: normalizedEnd,
      shiftId: getShiftId(window.shift, now),
      shift: window.shift,
    };
  }

  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { range, start, end: normalizedEnd };
  }

  if (range === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { range, start, end };
  }

  if (range === 'last7' || range === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { range: 'last7', start, end: normalizedEnd };
  }

  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { range, start, end: normalizedEnd };
  }

  return { range: 'today', start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: normalizedEnd };
};

const normalizeMachineSpeed = (machine) => {
  if (machine.area === 'drawing') {
    return {
      ...machine,
      line_speed: machine.line_speed / 60,
      target_speed: machine.target_speed / 60,
    };
  }
  return machine;
};

const buildParetoSeries = (items) => {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let cumulative = 0;
  return items.map((item) => {
    cumulative += item.value;
    return {
      label: item.label,
      value: Math.round(item.value * 100) / 100,
      cumulative: Math.round((cumulative / total) * 1000) / 10,
    };
  });
};

const getMachineStatusHistory = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       machine_id,
       status,
       previous_status,
       status_start_time,
       status_end_time,
       duration_seconds
     FROM machine_status_history
     WHERE machine_id = ANY($1)
       AND status_start_time < $3
       AND (status_end_time IS NULL OR status_end_time > $2)
     ORDER BY status_start_time ASC`,
    [machineIds, start, end]
  );
  return result.rows;
};

const buildDowntimeByStatus = (statusHistory, start, end) => {
  const buckets = {};
  const statusColors = {
    idle: '#64748B',
    warning: '#F59E0B',
    error: '#EF4444',
    stopped: '#34E7F8',
    setup: '#FFB86C',
  };

  statusHistory.forEach((entry) => {
    const status = (entry.status || 'idle').toLowerCase();
    if (status === 'running') return;

    const startTime = new Date(entry.status_start_time).getTime();
    const endTime = entry.status_end_time ? new Date(entry.status_end_time).getTime() : end.getTime();
    const clampedStart = Math.max(startTime, start.getTime());
    const clampedEnd = Math.min(endTime, end.getTime());

    if (clampedEnd <= clampedStart) return;

    const durationSeconds = (clampedEnd - clampedStart) / 1000;
    if (!buckets[status]) {
      buckets[status] = { durationSeconds: 0, machineIds: new Set() };
    }
    buckets[status].durationSeconds += durationSeconds;
    buckets[status].machineIds.add(entry.machine_id);
  });

  return Object.entries(buckets)
    .map(([reason, data]) => ({
      reason: reason.charAt(0).toUpperCase() + reason.slice(1),
      duration: Math.round((data.durationSeconds / 60) * 10) / 10,
      count: data.machineIds.size,
      color: statusColors[reason] || '#9580FF',
    }))
    .sort((a, b) => b.duration - a.duration);
};

const buildDowntimeByShift = (statusHistory, start, end) => {
  const buckets = {
    'Shift 1 (06-14)': { durationSeconds: 0, machineIds: new Set() },
    'Shift 2 (14-22)': { durationSeconds: 0, machineIds: new Set() },
    'Shift 3 (22-06)': { durationSeconds: 0, machineIds: new Set() },
  };

  statusHistory.forEach((entry) => {
    const status = (entry.status || 'idle').toLowerCase();
    if (status === 'running') return;

    const startTime = new Date(entry.status_start_time).getTime();
    const endTime = entry.status_end_time ? new Date(entry.status_end_time).getTime() : end.getTime();
    let cursor = Math.max(startTime, start.getTime());
    const rangeEnd = Math.min(endTime, end.getTime());

    while (cursor < rangeEnd) {
      const window = getCurrentShiftWindow(new Date(cursor));
      const windowEnd = Math.min(window.end.getTime(), rangeEnd);
      const durationSeconds = Math.max(0, (windowEnd - cursor) / 1000);

      const key = window.shift === 1
        ? 'Shift 1 (06-14)'
        : window.shift === 2
          ? 'Shift 2 (14-22)'
          : 'Shift 3 (22-06)';

      buckets[key].durationSeconds += durationSeconds;
      buckets[key].machineIds.add(entry.machine_id);

      cursor = windowEnd;
    }
  });

  return Object.entries(buckets).map(([label, data]) => ({
    label,
    duration: Math.round((data.durationSeconds / 60) * 10) / 10,
    count: data.machineIds.size,
  }));
};

const getAlarmHistory = async (machineIds, start) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT machine_id, severity, message, timestamp, acknowledged
     FROM alarms
     WHERE machine_id = ANY($1)
       AND timestamp >= $2`,
    [machineIds, start]
  );
  return result.rows;
};

const getOrders = async (machineIds) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT id, name, machine_id, status
     FROM production_orders
     WHERE machine_id = ANY($1)`,
    [machineIds]
  );
  return result.rows;
};

const getHistoricalOeeMetrics = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       machine_id,
       AVG(availability) as availability,
       AVG(performance) as performance,
       AVG(quality) as quality,
       AVG(oee) as oee,
       AVG(actual_speed) as actual_speed,
       AVG(target_speed) as target_speed
     FROM oee_calculations
     WHERE calculation_timestamp >= $1
       AND calculation_timestamp <= $2
       AND machine_id = ANY($3)
     GROUP BY machine_id`,
    [start, end, machineIds]
  );
  return result.rows;
};

const getHistoricalQuality = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       machine_id,
       COALESCE(SUM(produced_length_ok), 0) as produced_length_ok,
       COALESCE(SUM(produced_length_ng), 0) as produced_length_ng
     FROM production_quality
     WHERE calculation_period_start < $2
       AND (calculation_period_end IS NULL OR calculation_period_end > $1)
       AND machine_id = ANY($3)
     GROUP BY machine_id`,
    [start, end, machineIds]
  );
  return result.rows;
};

const getOeeTrend = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       date_trunc('minute', calculation_timestamp) 
         - ((EXTRACT(MINUTE FROM calculation_timestamp)::int % 10) * INTERVAL '1 minute') as bucket,
       AVG(availability) as availability,
       AVG(performance) as performance,
       AVG(quality) as quality,
       AVG(oee) as oee
     FROM oee_calculations
     WHERE calculation_timestamp >= $1
       AND calculation_timestamp <= $2
       AND machine_id = ANY($3)
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [start, end, machineIds]
  );
  return result.rows.map((row) => ({
    time: new Date(row.bucket).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    availability: parseFloat(row.availability || 0),
    performance: parseFloat(row.performance || 0),
    quality: parseFloat(row.quality || 0),
    oee: parseFloat(row.oee || 0),
  }));
};

const getProductionRateTrend = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       date_trunc('minute', timestamp) 
         - ((EXTRACT(MINUTE FROM timestamp)::int % 10) * INTERVAL '1 minute') as bucket,
       AVG(value) as rate,
       AVG(target_value) as target
     FROM machine_metrics
     WHERE metric_type = 'speed'
       AND timestamp >= $1
       AND timestamp <= $2
       AND machine_id = ANY($3)
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [start, end, machineIds]
  );
  return result.rows.map((row) => ({
    time: new Date(row.bucket).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    rate: parseFloat(row.rate || 0),
    target: parseFloat(row.target || 0),
  }));
};

const getEnergyTrend = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       date_trunc('hour', hour) as bucket,
       SUM(energy_kwh) as energy
     FROM energy_consumption
     WHERE hour >= $1
       AND hour <= $2
       AND machine_id = ANY($3)
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [start, end, machineIds]
  );
  return result.rows.map((row) => ({
    time: new Date(row.bucket).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    energy: parseFloat(row.energy || 0),
  }));
};

const getOutputSummary = async (machineIds, start, end) => {
  if (!machineIds.length) {
    return { totalOk: 0, totalNg: 0, totalLength: 0, ngRate: 0 };
  }
  const result = await query(
    `SELECT 
       COALESCE(SUM(produced_length_ok), 0) as total_ok,
       COALESCE(SUM(produced_length_ng), 0) as total_ng
     FROM production_quality
     WHERE calculation_period_start < $2
       AND (calculation_period_end IS NULL OR calculation_period_end > $1)
       AND machine_id = ANY($3)`,
    [start, end, machineIds]
  );
  const totalOk = parseFloat(result.rows[0]?.total_ok || 0);
  const totalNg = parseFloat(result.rows[0]?.total_ng || 0);
  const totalLength = totalOk + totalNg;

  if (totalLength > 0) {
    return {
      totalOk,
      totalNg,
      totalLength,
      ngRate: (totalNg / totalLength) * 100,
    };
  }

  const fallback = await query(
    `SELECT COALESCE(SUM(delta_length), 0) as total_length
     FROM production_length_events
     WHERE event_time >= $1
       AND event_time <= $2
       AND machine_id = ANY($3)`,
    [start, end, machineIds]
  );
  const fallbackLength = parseFloat(fallback.rows[0]?.total_length || 0);
  return {
    totalOk: fallbackLength,
    totalNg: 0,
    totalLength: fallbackLength,
    ngRate: 0,
  };
};

const getNgTrend = async (machineIds, start, end) => {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       date_trunc('hour', calculation_period_start) as bucket,
       COALESCE(SUM(produced_length_ok), 0) as total_ok,
       COALESCE(SUM(produced_length_ng), 0) as total_ng
     FROM production_quality
     WHERE calculation_period_start >= $1
       AND calculation_period_start <= $2
       AND machine_id = ANY($3)
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [start, end, machineIds]
  );
  return result.rows.map((row) => {
    const totalOk = parseFloat(row.total_ok || 0);
    const totalNg = parseFloat(row.total_ng || 0);
    const total = totalOk + totalNg;
    return {
      time: new Date(row.bucket).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      ngRate: total > 0 ? (totalNg / total) * 100 : 0,
      ngLength: totalNg,
    };
  });
};

const getPlannedVsActual = async (machineIds, start, end) => {
  if (!machineIds.length) {
    return { planned: 0, actual: 0, variance: 0 };
  }
  const result = await query(
    `SELECT 
       COALESCE(SUM(target_length), 0) as planned,
       COALESCE(SUM(produced_length), 0) as actual
     FROM production_orders
     WHERE machine_id = ANY($1)
       AND start_time < $3
       AND (end_time IS NULL OR end_time > $2)`,
    [machineIds, start, end]
  );
  const planned = parseFloat(result.rows[0]?.planned || 0);
  const actual = parseFloat(result.rows[0]?.actual || 0);
  const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;
  return { planned, actual, variance };
};

const getTemperatureStability = async (machineIds, start, end) => {
  if (!machineIds.length) return { avgVariance: 0, stability: 100 };
  const result = await query(
    `SELECT machine_id, zone_number, AVG(value) as avg_value
     FROM machine_metrics
     WHERE metric_type = 'multi_zone_temp'
       AND timestamp >= $1
       AND timestamp <= $2
       AND machine_id = ANY($3)
     GROUP BY machine_id, zone_number`,
    [start, end, machineIds]
  );
  const zonesByMachine = result.rows.reduce((acc, row) => {
    acc[row.machine_id] = acc[row.machine_id] || [];
    acc[row.machine_id].push(parseFloat(row.avg_value || 0));
    return acc;
  }, {});
  const variances = Object.values(zonesByMachine).map((zones) => {
    if (zones.length < 2) return 0;
    const avg = zones.reduce((sum, value) => sum + value, 0) / zones.length;
    return zones.reduce((sum, value) => sum + Math.abs(value - avg), 0) / zones.length;
  });
  const avgVariance = variances.length
    ? variances.reduce((sum, value) => sum + value, 0) / variances.length
    : 0;
  const stability = Math.max(0, 100 - avgVariance * 2);
  return {
    avgVariance: Math.round(avgVariance * 100) / 100,
    stability: Math.round(stability * 100) / 100,
  };
};

const calculateMachineLossProfile = (machine, history, alarms, now) => {
  const availability = clamp(machine.availability || 0, 0, 100);
  const performance = clamp(machine.performance || 0, 0, 100);
  const quality = clamp(machine.quality || 0, 0, 100);
  const oee = clamp(machine.oee || 0, 0, 100);

  const availabilityLoss = clamp(100 - availability, 0, 100);
  const performanceLoss = clamp(availability - (availability * performance) / 100, 0, 100);
  const qualityLoss = clamp((availability * performance) / 100 - oee, 0, 100);
  const totalGap = clamp(100 - oee, 0, 100);
  const theoreticalSum = availabilityLoss + performanceLoss + qualityLoss;
  const scale = theoreticalSum > 0 ? totalGap / theoreticalSum : 0;

  const durations = history.reduce(
    (acc, entry) => {
      const start = new Date(entry.status_start_time).getTime();
      const end = entry.status_end_time ? new Date(entry.status_end_time).getTime() : now.getTime();
      const durationSeconds = entry.duration_seconds || Math.max(0, (end - start) / 1000);
      const status = (entry.status || 'idle').toLowerCase();
      if (status !== 'running') {
        acc.total += durationSeconds;
        acc[status] = (acc[status] || 0) + durationSeconds;
      }
      if (durationSeconds <= 300 && status !== 'running') {
        acc.shortStops += 1;
      }
      if (durationSeconds >= 1200 && (status === 'error' || status === 'stopped')) {
        acc.longStops += 1;
      }
      return acc;
    },
    { total: 0, shortStops: 0, longStops: 0 }
  );

  const equipmentFailureWeight = (durations.error || 0) + (durations.stopped || 0);
  const setupWeight = durations.setup || 0;
  const idlingWeight = (durations.idle || 0) + (durations.warning || 0);
  const availabilityWeightSum = equipmentFailureWeight + setupWeight + idlingWeight;

  const availabilityWeights = availabilityWeightSum > 0
    ? {
        equipmentFailure: equipmentFailureWeight / availabilityWeightSum,
        setup: setupWeight / availabilityWeightSum,
        idling: idlingWeight / availabilityWeightSum,
      }
    : {
        equipmentFailure: 0.4,
        setup: 0.3,
        idling: 0.3,
      };

  const producedOk = parseFloat(machine.produced_length_ok || 0);
  const producedNg = parseFloat(machine.produced_length_ng || 0);
  const totalProduced = producedOk + producedNg > 0 ? producedOk + producedNg : parseFloat(machine.produced_length || 0);
  const ngRate = totalProduced > 0 ? (producedNg / totalProduced) * 100 : 0;
  const defectsWeight = clamp(ngRate / 5, 0.2, 0.8);

  const categoryLosses = {
    'Equipment Failure': Math.round(availabilityLoss * scale * availabilityWeights.equipmentFailure * 100) / 100,
    'Setup & Adjustments': Math.round(availabilityLoss * scale * availabilityWeights.setup * 100) / 100,
    'Idling & Minor Stops': Math.round(availabilityLoss * scale * availabilityWeights.idling * 100) / 100,
    'Reduced Speed': Math.round(performanceLoss * scale * 100) / 100,
    'Process Defects': Math.round(qualityLoss * scale * defectsWeight * 100) / 100,
    'Reduced Yield': Math.round(qualityLoss * scale * (1 - defectsWeight) * 100) / 100,
  };

  const speedGapPct = machine.target_speed > 0
    ? Math.max(0, (machine.target_speed - (machine.line_speed || 0)) / machine.target_speed) * 100
    : 0;

  return {
    machineId: machine.id,
    machineName: machine.name,
    area: machine.area,
    oee,
    availability,
    performance,
    quality,
    totalGap,
    downtimeSeconds: durations.total,
    shortStops: durations.shortStops,
    longStops: durations.longStops,
    alarms: alarms || [],
    speedGapPct: Math.round(speedGapPct * 10) / 10,
    ngRate: Math.round(ngRate * 10) / 10,
    categoryLosses,
  };
};

const buildInsightSummary = (sixBigLosses, machineLossProfiles, paretoByShift) => {
  if (!sixBigLosses.length) return 'No validated loss data available yet.';
  const topLoss = [...sixBigLosses].sort((a, b) => b.loss - a.loss)[0];
  const topMachine = [...machineLossProfiles].sort((a, b) => b.totalGap - a.totalGap)[0];
  const topShift = paretoByShift[0]?.label;
  return `${topLoss.category} is the main contributor to the current OEE loss (${topLoss.loss.toFixed(1)}%). ` +
    `${topMachine ? `Largest impact is from ${topMachine.machineName}. ` : ''}` +
    `${topShift ? `Losses are concentrated in ${topShift}.` : ''}`.trim();
};

export async function computeAnalytics({ range = 'today', area = 'all', machineId = null, shiftDate, shiftNumber }) {
  const now = new Date();
  const window = getRangeWindow(range, now, { shiftDate, shiftNumber });
  const scopeStart = window.start;
  const scopeEnd = window.end;

  const machinesResult = await query(
    `SELECT id, name, area, status, line_speed, target_speed, produced_length, produced_length_ok, produced_length_ng,
            oee, availability, performance, quality, production_order_id
     FROM machines
     ${area && area !== 'all' ? 'WHERE area = $1' : ''}
     ORDER BY area, id`,
    area && area !== 'all' ? [area] : []
  );

  let machines = machinesResult.rows.map(normalizeMachineSpeed);
  if (machineId) {
    machines = machines.filter((machine) => machine.id === machineId);
  }

  const machineIds = machines.map((machine) => machine.id);
  const [statusHistory, alarms, orders, historicalOee, historicalQuality, oeeTrend, productionRateTrend, energyTrend, outputSummary, ngTrend, plannedVsActual, temperatureStability] = await Promise.all([
    getMachineStatusHistory(machineIds, scopeStart, scopeEnd),
    getAlarmHistory(machineIds, scopeStart),
    getOrders(machineIds),
    getHistoricalOeeMetrics(machineIds, scopeStart, scopeEnd),
    getHistoricalQuality(machineIds, scopeStart, scopeEnd),
    getOeeTrend(machineIds, scopeStart, scopeEnd),
    getProductionRateTrend(machineIds, scopeStart, scopeEnd),
    getEnergyTrend(machineIds, scopeStart, scopeEnd),
    getOutputSummary(machineIds, scopeStart, scopeEnd),
    getNgTrend(machineIds, scopeStart, scopeEnd),
    getPlannedVsActual(machineIds, scopeStart, scopeEnd),
    getTemperatureStability(machineIds, scopeStart, scopeEnd),
  ]);

  const alarmsByMachine = alarms.reduce((acc, alarm) => {
    acc[alarm.machine_id] = acc[alarm.machine_id] || [];
    acc[alarm.machine_id].push(alarm);
    return acc;
  }, {});

  const historyByMachine = statusHistory.reduce((acc, entry) => {
    acc[entry.machine_id] = acc[entry.machine_id] || [];
    acc[entry.machine_id].push(entry);
    return acc;
  }, {});

  const downtimeByStatus = buildDowntimeByStatus(statusHistory, scopeStart, scopeEnd);
  const downtimeByShift = buildDowntimeByShift(statusHistory, scopeStart, scopeEnd);

  const oeeByMachine = historicalOee.reduce((acc, row) => {
    acc[row.machine_id] = {
      availability: parseFloat(row.availability || 0),
      performance: parseFloat(row.performance || 0),
      quality: parseFloat(row.quality || 0),
      oee: parseFloat(row.oee || 0),
      actualSpeed: parseFloat(row.actual_speed || 0),
      targetSpeed: parseFloat(row.target_speed || 0),
    };
    return acc;
  }, {});

  const qualityByMachine = historicalQuality.reduce((acc, row) => {
    acc[row.machine_id] = {
      producedLengthOk: parseFloat(row.produced_length_ok || 0),
      producedLengthNg: parseFloat(row.produced_length_ng || 0),
    };
    return acc;
  }, {});

  const machinesWithHistory = machines.map((machine) => {
    const historical = oeeByMachine[machine.id];
    const quality = qualityByMachine[machine.id];
    if (!historical && !quality) return machine;
    return {
      ...machine,
      availability: historical?.availability ?? machine.availability,
      performance: historical?.performance ?? machine.performance,
      quality: historical?.quality ?? machine.quality,
      oee: historical?.oee ?? machine.oee,
      line_speed: historical?.actualSpeed ?? machine.line_speed,
      target_speed: historical?.targetSpeed ?? machine.target_speed,
      produced_length_ok: quality?.producedLengthOk ?? machine.produced_length_ok,
      produced_length_ng: quality?.producedLengthNg ?? machine.produced_length_ng,
      produced_length: quality
        ? (quality.producedLengthOk || 0) + (quality.producedLengthNg || 0)
        : machine.produced_length,
    };
  });

  const machineLossProfiles = machinesWithHistory.map((machine) =>
    calculateMachineLossProfile(
      machine,
      historyByMachine[machine.id] || [],
      alarmsByMachine[machine.id] || [],
      now
    )
  );

  const avgOee = machineLossProfiles.length
    ? machineLossProfiles.reduce((sum, machine) => sum + machine.oee, 0) / machineLossProfiles.length
    : 0;
  const avgAvailability = machineLossProfiles.length
    ? machineLossProfiles.reduce((sum, machine) => sum + machine.availability, 0) / machineLossProfiles.length
    : 0;
  const avgPerformance = machineLossProfiles.length
    ? machineLossProfiles.reduce((sum, machine) => sum + machine.performance, 0) / machineLossProfiles.length
    : 0;
  const avgQuality = machineLossProfiles.length
    ? machineLossProfiles.reduce((sum, machine) => sum + machine.quality, 0) / machineLossProfiles.length
    : 0;
  const totalGap = clamp(100 - avgOee, 0, 100);

  const categoryTotals = machineLossProfiles.reduce((acc, profile) => {
    Object.entries(profile.categoryLosses).forEach(([category, loss]) => {
      acc[category] = (acc[category] || 0) + loss;
    });
    return acc;
  }, {});
  const totalCategoryLoss = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0) || 1;
  const scaledCategoryTotals = Object.entries(categoryTotals).map(([category, loss]) => ({
    category,
    loss: Math.round((loss / totalCategoryLoss) * totalGap * 100) / 100,
  }));

  const sixBigLosses = scaledCategoryTotals
    .map((entry) => ({
      ...entry,
      type:
        entry.category === 'Reduced Speed'
          ? 'performance'
          : entry.category === 'Process Defects' || entry.category === 'Reduced Yield'
            ? 'quality'
            : 'availability',
      color:
        entry.category === 'Equipment Failure' ? '#EF4444' :
        entry.category === 'Setup & Adjustments' ? '#FFB86C' :
        entry.category === 'Idling & Minor Stops' ? '#F59E0B' :
        entry.category === 'Reduced Speed' ? '#34E7F8' :
        entry.category === 'Process Defects' ? '#FF4C4C' : '#9580FF',
    }))
    .filter((entry) => entry.loss > 0)
    .sort((a, b) => b.loss - a.loss);

  const paretoByCategory = buildParetoSeries(
    [...sixBigLosses].map((loss) => ({ label: loss.category, value: loss.loss }))
  );

  const paretoByMachine = buildParetoSeries(
    [...machineLossProfiles]
      .map((profile) => ({ label: profile.machineName, value: profile.totalGap }))
      .sort((a, b) => b.value - a.value)
  );

  const paretoByArea = (() => {
    const areaMap = new Map();
    machineLossProfiles.forEach((profile) => {
      areaMap.set(profile.area, (areaMap.get(profile.area) || 0) + profile.totalGap);
    });
    return buildParetoSeries(
      Array.from(areaMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
    );
  })();

  const paretoByShift = (() => {
    const shiftBuckets = {
      'Shift 1 (00-08)': 0,
      'Shift 2 (08-16)': 0,
      'Shift 3 (16-24)': 0,
    };
    statusHistory.forEach((entry) => {
      const start = new Date(entry.status_start_time);
      const hours = start.getHours();
      const key = hours < 8 ? 'Shift 1 (00-08)' : hours < 16 ? 'Shift 2 (08-16)' : 'Shift 3 (16-24)';
      const durationSeconds = entry.duration_seconds || 0;
      if ((entry.status || '').toLowerCase() !== 'running') {
        shiftBuckets[key] += durationSeconds;
      }
    });
    const rawTotal = Object.values(shiftBuckets).reduce((sum, value) => sum + value, 0);
    return buildParetoSeries(
      Object.entries(shiftBuckets)
        .map(([label, value]) => ({
          label,
          value: rawTotal > 0 ? (value / rawTotal) * totalGap : 0,
        }))
        .sort((a, b) => b.value - a.value)
    );
  })();

  const lossRanking = (() => {
    const items = machineLossProfiles.flatMap((profile) =>
      Object.entries(profile.categoryLosses).map(([category, loss]) => ({
        category,
        machineId: profile.machineId,
        machineName: profile.machineName,
        area: profile.area,
        impact: loss,
        duration: profile.downtimeSeconds,
        frequency: profile.shortStops + profile.longStops,
      }))
    );
    const maxImpact = Math.max(1, ...items.map((item) => item.impact));
    const maxDuration = Math.max(1, ...items.map((item) => item.duration));
    const maxFrequency = Math.max(1, ...items.map((item) => item.frequency));
    return items
      .map((item) => {
        const severity = Math.round(
          (0.5 * (item.impact / maxImpact) +
            0.3 * (item.duration / maxDuration) +
            0.2 * (item.frequency / maxFrequency)) *
            100
        );
        return { ...item, severity };
      })
      .filter((item) => item.impact > 0)
      .sort((a, b) => b.severity - a.severity);
  })();

  const rootCauseContributors = machineLossProfiles.flatMap((profile) => {
    const causes = [];
    if (profile.shortStops >= 5) {
      causes.push({
        machineId: profile.machineId,
        machineName: profile.machineName,
        category: 'Idling & Minor Stops',
        evidence: `${profile.shortStops} short stops detected`,
      });
    }
    if (profile.longStops >= 2 && profile.alarms.length > 0) {
      causes.push({
        machineId: profile.machineId,
        machineName: profile.machineName,
        category: 'Equipment Failure',
        evidence: `${profile.longStops} long stops with alarms active`,
      });
    }
    if (profile.speedGapPct >= 10) {
      causes.push({
        machineId: profile.machineId,
        machineName: profile.machineName,
        category: 'Reduced Speed',
        evidence: `Speed ${profile.speedGapPct.toFixed(1)}% below target`,
      });
    }
    if (profile.ngRate >= 1) {
      causes.push({
        machineId: profile.machineId,
        machineName: profile.machineName,
        category: 'Process Defects',
        evidence: `NG rate ${profile.ngRate.toFixed(1)}%`,
      });
    }
    return causes;
  });

  const lossByMachine = machineLossProfiles
    .map((profile) => ({ label: profile.machineName, value: profile.totalGap }))
    .sort((a, b) => b.value - a.value);

  const lossByOrder = (() => {
    const orderMap = new Map();
    machineLossProfiles.forEach((profile) => {
      const order = orders.find((entry) => entry.machine_id === profile.machineId && entry.status === 'running') ||
        orders.find((entry) => entry.machine_id === profile.machineId);
      if (order) {
        const nextValue = (orderMap.get(order.id)?.value || 0) + profile.totalGap;
        orderMap.set(order.id, { label: order.name || order.id, value: nextValue });
      }
    });
    return Array.from(orderMap.values()).sort((a, b) => b.value - a.value);
  })();

  const lossByShift = paretoByShift.map((item) => ({
    label: item.label,
    value: item.value,
  }));

  const insightSummary = buildInsightSummary(sixBigLosses, machineLossProfiles, paretoByShift);

  return {
    scope: {
      range: window.range,
      start: scopeStart.toISOString(),
      end: scopeEnd.toISOString(),
      shiftId: window.shiftId || null,
      area: area || 'all',
      machineId: machineId || null,
    },
    oeeSummary: {
      oee: Math.round(avgOee * 10) / 10,
      availability: Math.round(avgAvailability * 10) / 10,
      performance: Math.round(avgPerformance * 10) / 10,
      quality: Math.round(avgQuality * 10) / 10,
      totalGap: Math.round(totalGap * 10) / 10,
    },
    sixBigLosses,
    pareto: {
      byCategory: paretoByCategory,
      byMachine: paretoByMachine,
      byArea: paretoByArea,
      byShift: paretoByShift,
    },
    lossRanking,
    rootCauseContributors,
    breakdowns: {
      byMachine: lossByMachine,
      byShift: lossByShift,
      byOrder: lossByOrder,
    },
    lossTrend: [],
    anomalies: [],
    insights: {
      summary: insightSummary,
    },
    oeeTrend,
    productionRateTrend,
    energyTrend,
    downtimeByStatus,
    downtimeByShift,
    outputSummary: {
      totalOk: Math.round(outputSummary.totalOk * 100) / 100,
      totalNg: Math.round(outputSummary.totalNg * 100) / 100,
      totalLength: Math.round(outputSummary.totalLength * 100) / 100,
      ngRate: Math.round(outputSummary.ngRate * 100) / 100,
    },
    ngTrend,
    plannedVsActual: {
      planned: Math.round(plannedVsActual.planned * 100) / 100,
      actual: Math.round(plannedVsActual.actual * 100) / 100,
      variance: Math.round(plannedVsActual.variance * 100) / 100,
    },
    temperatureStability,
  };
}

export async function saveAnalyticsCache(scope, payload) {
  const result = await query(
    `INSERT INTO analytics_cache (
       scope_type, scope_start, scope_end, scope_shift_id, scope_area, scope_machine_id, payload, computed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, computed_at`,
    [
      scope.range,
      scope.start,
      scope.end,
      scope.shiftId,
      scope.area,
      scope.machineId,
      payload,
    ]
  );
  return result.rows[0];
}

export async function getCachedAnalytics(scope) {
  const result = await query(
    `SELECT payload, computed_at
     FROM analytics_cache
     WHERE scope_type = $1
       AND scope_start = $2
       AND scope_end = $3
       AND COALESCE(scope_area, 'all') = $4
       AND COALESCE(scope_machine_id, '') = $5
     ORDER BY computed_at DESC
     LIMIT 1`,
    [
      scope.range,
      scope.start,
      scope.end,
      scope.area || 'all',
      scope.machineId || '',
    ]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  const computedAt = new Date(row.computed_at);
  const isFresh = (Date.now() - computedAt.getTime()) / 1000 <= CACHE_TTL_SECONDS;
  return { payload: row.payload, computedAt, isFresh };
}

const getAnalyticsHistory = async (scope, limit = 20) => {
  const result = await query(
    `SELECT payload, computed_at
     FROM analytics_cache
     WHERE scope_type = $1
       AND scope_start = $2
       AND scope_end = $3
       AND COALESCE(scope_area, 'all') = $4
       AND COALESCE(scope_machine_id, '') = $5
     ORDER BY computed_at DESC
     LIMIT $6`,
    [
      scope.range,
      scope.start,
      scope.end,
      scope.area || 'all',
      scope.machineId || '',
      limit,
    ]
  );
  return result.rows.map((row) => ({
    payload: row.payload,
    computedAt: new Date(row.computed_at),
  }));
};

const buildAnomalies = (history) => {
  if (history.length < 6) return [];
  const latest = history[0]?.payload;
  if (!latest || !latest.sixBigLosses) return [];
  const categories = latest.sixBigLosses.map((entry) => entry.category);
  return categories
    .map((category) => {
      const series = history.map((entry) => {
        const match = entry.payload.sixBigLosses?.find((loss) => loss.category === category);
        return match ? match.loss : 0;
      });
      const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
      const variance = series.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / series.length;
      const std = Math.sqrt(variance);
      const latestValue = series[0] || 0;
      const zScore = std > 0 ? (latestValue - mean) / std : 0;
      return {
        category,
        latestValue,
        mean,
        zScore,
      };
    })
    .filter((entry) => entry.zScore >= 2);
};

const buildLossTrend = (history) => {
  return history
    .map((entry) => {
      const totalLoss = (entry.payload.sixBigLosses || []).reduce((sum, item) => sum + (item.loss || 0), 0);
      return {
        timestamp: entry.computedAt.toISOString(),
        totalLoss: Math.round(totalLoss * 100) / 100,
      };
    })
    .reverse();
};

export async function computeAndCacheAnalytics(params) {
  const payload = await computeAnalytics(params);
  await saveAnalyticsCache(payload.scope, payload);
  return payload;
}

export async function getAnalyticsWithCache(params, { force = false } = {}) {
  const window = getRangeWindow(params.range || 'today', new Date(), {
    shiftDate: params.shiftDate,
    shiftNumber: params.shiftNumber,
  });
  const scope = {
    range: window.range,
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    shiftId: window.shiftId || null,
    area: params.area || 'all',
    machineId: params.machineId || null,
  };

  if (!force) {
    const cached = await getCachedAnalytics(scope);
    if (cached && cached.isFresh) {
      const history = await getAnalyticsHistory(scope);
      cached.payload.lossTrend = buildLossTrend(history);
      cached.payload.anomalies = buildAnomalies(history);
      return { payload: cached.payload, cached: true, computedAt: cached.computedAt };
    }
  }

  const payload = await computeAndCacheAnalytics({
    range: scope.range,
    area: scope.area,
    machineId: scope.machineId,
    shiftDate: params.shiftDate,
    shiftNumber: params.shiftNumber,
  });
  const history = await getAnalyticsHistory(scope);
  payload.lossTrend = buildLossTrend(history);
  payload.anomalies = buildAnomalies(history);
  return { payload, cached: false, computedAt: new Date() };
}

export function startAnalyticsScheduler({ ranges = ['shift', 'today'], intervalSeconds = 60 } = {}) {
  const run = async () => {
    for (const range of ranges) {
      try {
        await computeAndCacheAnalytics({ range, area: 'all' });
      } catch (error) {
        console.error(`Analytics scheduler error for ${range}:`, error);
      }
    }
  };

  run();
  const interval = setInterval(run, intervalSeconds * 1000);
  return () => clearInterval(interval);
}
