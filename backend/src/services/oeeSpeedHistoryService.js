import { query } from '../../database/connection.js';

const STABLE_CV_THRESHOLD = 0.05;
const STABLE_WINDOW_BUCKETS = 5;
const STOPPED_STATUSES = new Set(['stopped', 'error']);
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

function speedFloorForArea(area) {
  return area === 'drawing' ? 0.01 : 0.5;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

async function fetchMachineArea(machineId) {
  const result = await query(
    'SELECT area, target_speed, product_name FROM machines WHERE id = $1',
    [machineId]
  );
  const row = result.rows[0];
  return {
    area: row?.area ?? null,
    targetSpeed: row?.target_speed != null ? parseFloat(row.target_speed) : null,
    productName: row?.product_name != null ? String(row.product_name).trim() : null,
  };
}

async function fetchStatusSegments(machineId, rangeStart, rangeEnd) {
  const rangeSpanMs = rangeEnd.getTime() - rangeStart.getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const maxLookbackMs = 400 * DAY_MS;
  const minLookbackMs = 14 * DAY_MS;
  const lookbackMs = Math.min(maxLookbackMs, Math.max(minLookbackMs, rangeSpanMs * 3));
  const lowerBoundStart = new Date(rangeStart.getTime() - lookbackMs);

  const statusSql = `
    SELECT * FROM (
      SELECT status, status_start_time, status_end_time
      FROM machine_status_history
      WHERE machine_id = $1
        AND status_end_time IS NOT NULL
        AND status_start_time <= $3
        AND status_start_time >= $4
        AND status_end_time >= $2
      UNION ALL
      SELECT status, status_start_time, status_end_time
      FROM machine_status_history
      WHERE machine_id = $1
        AND status_end_time IS NULL
        AND status_start_time <= $3
    ) AS msh
    ORDER BY msh.status_start_time ASC`;

  const result = await query(statusSql, [machineId, rangeStart, rangeEnd, lowerBoundStart]);
  return result.rows;
}

function findStatusAt(segments, timeMs, nowMs = Date.now()) {
  for (const seg of segments) {
    const start = new Date(seg.status_start_time).getTime();
    const end = seg.status_end_time ? new Date(seg.status_end_time).getTime() : nowMs;
    if (timeMs >= start && timeMs < end) {
      return String(seg.status || 'idle').toLowerCase();
    }
  }
  return 'idle';
}

async function fetchSpeedBucketsFromOee(machineId, rangeStart, rangeEnd, bucketSec, limit = null) {
  const limitN = limit != null && Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 5000) : null;

  if (limitN != null) {
    const result = await query(
      `SELECT bucket, actual_speed, target_speed, performance FROM (
         SELECT
           to_timestamp(floor(extract(epoch from calculation_timestamp) / $4) * $4) AS bucket,
           AVG(actual_speed)::float AS actual_speed,
           AVG(target_speed)::float AS target_speed,
           AVG(performance)::float AS performance
         FROM oee_calculations
         WHERE machine_id = $1
           AND calculation_timestamp >= $2
           AND calculation_timestamp <= $3
         GROUP BY bucket
       ) sub
       ORDER BY bucket DESC
       LIMIT $5`,
      [machineId, rangeStart, rangeEnd, bucketSec, limitN]
    );
    return result.rows
      .reverse()
      .map((row) => ({
        timestamp: new Date(row.bucket),
        actualSpeed: parseFloat(row.actual_speed || 0),
        targetSpeed: parseFloat(row.target_speed || 0),
        performance: parseFloat(row.performance || 0),
      }));
  }

  const result = await query(
    `SELECT
       to_timestamp(floor(extract(epoch from calculation_timestamp) / $4) * $4) AS bucket,
       AVG(actual_speed)::float AS actual_speed,
       AVG(target_speed)::float AS target_speed,
       AVG(performance)::float AS performance
     FROM oee_calculations
     WHERE machine_id = $1
       AND calculation_timestamp >= $2
       AND calculation_timestamp <= $3
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [machineId, rangeStart, rangeEnd, bucketSec]
  );
  return result.rows.map((row) => ({
    timestamp: new Date(row.bucket),
    actualSpeed: parseFloat(row.actual_speed || 0),
    targetSpeed: parseFloat(row.target_speed || 0),
    performance: parseFloat(row.performance || 0),
  }));
}

async function fetchSpeedBucketsFromTelemetry(machineId, rangeStart, rangeEnd, bucketSec, limit = null) {
  const limitN = limit != null && Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 5000) : null;

  if (limitN != null) {
    const result = await query(
      `SELECT bucket, actual_speed, target_speed FROM (
         SELECT
           to_timestamp(floor(extract(epoch from sampled_at) / $4) * $4) AS bucket,
           AVG(line_speed)::float AS actual_speed,
           AVG(target_speed)::float AS target_speed
         FROM machine_line_telemetry
         WHERE machine_id = $1
           AND sampled_at >= $2
           AND sampled_at <= $3
         GROUP BY bucket
       ) sub
       ORDER BY bucket DESC
       LIMIT $5`,
      [machineId, rangeStart, rangeEnd, bucketSec, limitN]
    );
    return result.rows
      .reverse()
      .map((row) => ({
        timestamp: new Date(row.bucket),
        actualSpeed: parseFloat(row.actual_speed || 0),
        targetSpeed: parseFloat(row.target_speed || 0),
        performance: null,
      }));
  }

  const result = await query(
    `SELECT
       to_timestamp(floor(extract(epoch from sampled_at) / $4) * $4) AS bucket,
       AVG(line_speed)::float AS actual_speed,
       AVG(target_speed)::float AS target_speed
     FROM machine_line_telemetry
     WHERE machine_id = $1
       AND sampled_at >= $2
       AND sampled_at <= $3
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [machineId, rangeStart, rangeEnd, bucketSec]
  );
  return result.rows.map((row) => ({
    timestamp: new Date(row.bucket),
    actualSpeed: parseFloat(row.actual_speed || 0),
    targetSpeed: parseFloat(row.target_speed || 0),
    performance: null,
  }));
}

function classifyPhases(buckets, segments, bucketSec, speedFloor) {
  const nowMs = Date.now();
  const basePhases = buckets.map((b) => {
    const midMs = b.timestamp.getTime() + (bucketSec * 1000) / 2;
    const status = findStatusAt(segments, midMs, nowMs);
    const speed = b.actualSpeed;

    if (status === 'setup') {
      return { ...b, phase: 'setup' };
    }
    if (STOPPED_STATUSES.has(status) || speed < speedFloor) {
      return { ...b, phase: 'stopped' };
    }
    if (status === 'idle' || status === 'warning') {
      return { ...b, phase: status === 'warning' ? 'idle' : 'idle' };
    }
    if (status === 'running') {
      return { ...b, phase: 'running_pending' };
    }
    return { ...b, phase: 'idle' };
  });

  return basePhases.map((point, idx) => {
    if (point.phase !== 'running_pending') {
      return point;
    }

    const windowStart = Math.max(0, idx - STABLE_WINDOW_BUCKETS + 1);
    const window = basePhases.slice(windowStart, idx + 1).filter((p) => p.phase === 'running_pending');
    const speeds = window.map((p) => p.actualSpeed).filter((s) => s >= speedFloor);

    if (speeds.length < 2) {
      return { ...point, phase: 'variable_running' };
    }

    const m = mean(speeds);
    const cv = m > 0 ? stddev(speeds) / m : 1;
    const phase = cv < STABLE_CV_THRESHOLD && m > speedFloor ? 'stable_running' : 'variable_running';
    return { ...point, phase };
  });
}

async function fetchOverlappingOrders(machineId, rangeStart, rangeEnd) {
  const result = await query(
    `SELECT id, name, product_name, start_time, end_time, status
     FROM production_orders
     WHERE machine_id = $1
       AND start_time < $3
       AND (end_time IS NULL OR end_time > $2)
     ORDER BY start_time ASC`,
    [machineId, rangeStart, rangeEnd]
  );
  return result.rows;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const TELEMETRY_PRODUCT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeProductName(name) {
  if (name == null) return 'UNKNOWN';
  const s = String(name).trim();
  return s === '' ? 'UNKNOWN' : s;
}

function normalizeMaterialCode(code) {
  if (code == null) return '';
  const s = String(code).trim();
  return s === '' ? '' : s;
}

async function fetchTelemetryProductRows(machineId, rangeStart, rangeEnd) {
  const lowerBound = new Date(rangeStart.getTime() - TELEMETRY_PRODUCT_LOOKBACK_MS);
  const result = await query(
    `SELECT sampled_at, product_name, material_code, target_speed
     FROM machine_line_telemetry
     WHERE machine_id = $1
       AND sampled_at >= $2
       AND sampled_at <= $3
     ORDER BY sampled_at ASC`,
    [machineId, lowerBound, rangeEnd]
  );

  let lastProduct = null;
  let lastMaterial = null;
  const rows = [];
  for (const row of result.rows) {
    const rawP = row.product_name != null ? String(row.product_name).trim() : '';
    const rawM = row.material_code != null ? String(row.material_code).trim() : '';
    if (rawP !== '') lastProduct = rawP;
    if (rawM !== '') lastMaterial = rawM;
    rows.push({
      sampledAt: new Date(row.sampled_at),
      productName: normalizeProductName(rawP !== '' ? rawP : lastProduct),
      materialCode: rawM !== '' ? rawM : (lastMaterial || ''),
      targetSpeed:
        row.target_speed != null && Number.isFinite(parseFloat(row.target_speed))
          ? parseFloat(row.target_speed)
          : null,
    });
  }
  return rows;
}

/** Product sessions from machine_line_telemetry (same source as machines.product_name snapshot). */
function buildTelemetryProductSessions(rows, rangeStart, rangeEnd) {
  const w0t = rangeStart.getTime();
  const w1t = rangeEnd.getTime();
  if (!rows.length) return [];

  let productAtWindowStart = 'UNKNOWN';
  let materialAtWindowStart = '';
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].sampledAt.getTime() < w0t) {
      productAtWindowStart = rows[i].productName;
      materialAtWindowStart = normalizeMaterialCode(rows[i].materialCode);
      break;
    }
  }
  if (productAtWindowStart === 'UNKNOWN') {
    const firstIn = rows.find((r) => {
      const t = r.sampledAt.getTime();
      return t >= w0t && t < w1t;
    });
    if (firstIn) {
      productAtWindowStart = firstIn.productName;
      materialAtWindowStart = normalizeMaterialCode(firstIn.materialCode);
    }
  }

  const sessions = [];
  let currentProduct = productAtWindowStart;
  let currentMaterial = materialAtWindowStart;
  let sessionStartMs = w0t;

  const emitSession = (endMs) => {
    if (endMs <= sessionStartMs) return;
    sessions.push({
      product: currentProduct,
      materialCode: currentMaterial,
      start: new Date(sessionStartMs),
      end: new Date(endMs),
    });
  };

  for (const r of rows) {
    const t = r.sampledAt.getTime();
    if (t < w0t) continue;
    if (t >= w1t) break;
    const rowMat = normalizeMaterialCode(r.materialCode);
    if (r.productName !== currentProduct || rowMat !== currentMaterial) {
      emitSession(t);
      currentProduct = r.productName;
      currentMaterial = rowMat;
      sessionStartMs = t;
    }
  }
  emitSession(w1t);
  return sessions;
}

function findBestOverlappingOrder(orders, segStartMs, segEndMs, nowMs) {
  let best = null;
  let bestOverlap = 0;
  for (const order of orders) {
    const oStart = new Date(order.start_time).getTime();
    const oEnd = order.end_time ? new Date(order.end_time).getTime() : nowMs;
    const overlapStart = Math.max(segStartMs, oStart);
    const overlapEnd = Math.min(segEndMs, oEnd);
    const overlap = overlapEnd - overlapStart;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = order;
    }
  }
  return bestOverlap > 0 ? best : null;
}

function segmentSpeedStats(segPoints) {
  const stableSpeeds = segPoints
    .filter((p) => p.phase === 'stable_running')
    .map((p) => p.actualSpeed);
  const runSpeeds = segPoints
    .filter((p) => (p.phase === 'stable_running' || p.phase === 'variable_running') && p.actualSpeed > 0)
    .map((p) => p.actualSpeed);
  const targets = segPoints.map((p) => p.targetSpeed).filter((v) => v > 0);
  return {
    stableSpeedMedian: stableSpeeds.length ? round2(median(stableSpeeds)) : null,
    avgRunningSpeed: runSpeeds.length ? round2(mean(runSpeeds)) : null,
    ictMedian: targets.length ? round2(median(targets)) : null,
    proposedIct: stableSpeeds.length ? round2(median(stableSpeeds)) : null,
    pointCount: segPoints.length,
  };
}

function displayProductName(raw) {
  if (raw == null || raw === 'UNKNOWN') return 'Chưa xác định';
  const s = String(raw).trim();
  return s === '' ? 'Chưa xác định' : s;
}

/**
 * Product notes by machine snapshot timeline (machine_line_telemetry), not PO product_name.
 * PO id/name attached only when overlapping for reference.
 */
function buildProductNotes(
  telemetrySessions,
  machineProductName,
  orders,
  classifiedPoints,
  rangeStart,
  rangeEnd,
  now = new Date()
) {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const nowMs = now.getTime();
  const notes = [];

  let sessions = telemetrySessions;
  if (!sessions.length && machineProductName) {
    sessions = [
      {
        product: normalizeProductName(machineProductName),
        materialCode: '',
        start: rangeStart,
        end: rangeEnd,
      },
    ];
  }

  for (const session of sessions) {
    const sStart = Math.max(rangeStartMs, session.start.getTime());
    const sEnd = Math.min(rangeEndMs, session.end.getTime());
    if (sEnd <= sStart) continue;

    const segPoints = classifiedPoints.filter((p) => {
      const t = p.timestamp.getTime();
      return t >= sStart && t < sEnd;
    });
    if (segPoints.length === 0 && session.product === 'UNKNOWN') continue;

    const stats = segmentSpeedStats(segPoints);
    const order = findBestOverlappingOrder(orders, sStart, sEnd, nowMs);

    notes.push({
      orderId: order?.id ?? null,
      orderName: order?.name ?? null,
      productName: displayProductName(session.product),
      segmentStart: new Date(sStart).toISOString(),
      segmentEnd: new Date(sEnd).toISOString(),
      ...stats,
      durationSec: Math.round((sEnd - sStart) / 1000),
      status: order?.status ?? null,
    });
  }

  const assignedMs = new Set();
  for (const note of notes) {
    const sStart = new Date(note.segmentStart).getTime();
    const sEnd = new Date(note.segmentEnd).getTime();
    for (const p of classifiedPoints) {
      const t = p.timestamp.getTime();
      if (t >= sStart && t < sEnd) assignedMs.add(t);
    }
  }

  const unassigned = classifiedPoints.filter((p) => !assignedMs.has(p.timestamp.getTime()));
  if (unassigned.length > 0) {
    const stats = segmentSpeedStats(unassigned);
    const uStart = Math.min(...unassigned.map((p) => p.timestamp.getTime()));
    const uEnd = Math.max(...unassigned.map((p) => p.timestamp.getTime()));

    notes.push({
      orderId: null,
      orderName: null,
      productName: 'Chưa xác định',
      segmentStart: new Date(Math.max(uStart, rangeStartMs)).toISOString(),
      segmentEnd: new Date(Math.min(uEnd + 1, rangeEndMs)).toISOString(),
      ...stats,
      durationSec: Math.round((Math.min(uEnd, rangeEndMs) - Math.max(uStart, rangeStartMs)) / 1000),
      status: null,
    });
  }

  return notes.sort((a, b) => new Date(a.segmentStart).getTime() - new Date(b.segmentStart).getTime());
}

function buildSummary(points, bucketSec, machineTargetSpeed = null) {
  const stableSpeeds = points.filter((p) => p.phase === 'stable_running').map((p) => p.actualSpeed);
  const setupSpeeds = points.filter((p) => p.phase === 'setup').map((p) => p.actualSpeed);
  const stoppedBuckets = points.filter((p) => p.phase === 'stopped').length;

  const proposedTargetSpeed = median(stableSpeeds);
  const lastTarget = points.length ? points[points.length - 1].targetSpeed : null;
  const currentTargetSpeed =
    (machineTargetSpeed != null && machineTargetSpeed > 0 ? machineTargetSpeed : null)
    ?? (lastTarget != null && lastTarget > 0 ? lastTarget : null)
    ?? (points.find((p) => p.targetSpeed > 0)?.targetSpeed ?? null);

  let deltaVsTargetPct = null;
  if (proposedTargetSpeed != null && currentTargetSpeed != null && currentTargetSpeed > 0) {
    deltaVsTargetPct = Math.round(((proposedTargetSpeed - currentTargetSpeed) / currentTargetSpeed) * 1000) / 10;
  }

  return {
    stableRunningMedian: proposedTargetSpeed != null ? Math.round(proposedTargetSpeed * 100) / 100 : null,
    stableRunningP90: stableSpeeds.length
      ? Math.round((percentile(stableSpeeds, 90) ?? 0) * 100) / 100
      : null,
    setupAvgSpeed: setupSpeeds.length
      ? Math.round(mean(setupSpeeds) * 100) / 100
      : null,
    stoppedDurationSec: stoppedBuckets * bucketSec,
    proposedTargetSpeed: proposedTargetSpeed != null ? Math.round(proposedTargetSpeed * 100) / 100 : null,
    currentTargetSpeed: currentTargetSpeed != null ? Math.round(currentTargetSpeed * 100) / 100 : null,
    deltaVsTargetPct,
  };
}

/**
 * Speed time-series from oee_calculations (fallback: machine_line_telemetry) with phase classification.
 */
export async function getMachineSpeedHistory(machineId, rangeStart, rangeEnd, bucketSec = 60, limit = null) {
  if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date)) {
    throw new Error('rangeStart and rangeEnd must be Date objects');
  }
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new Error('Invalid date range');
  }
  if (rangeStart >= rangeEnd) {
    throw new Error('start must be before end');
  }
  if (rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS) {
    throw new Error('Requested time range exceeds 31 days');
  }

  let bucket = Math.min(Math.max(parseInt(String(bucketSec), 10) || 60, 10), 3600);
  const spanSec = (rangeEnd.getTime() - rangeStart.getTime()) / 1000;
  const MAX_BUCKETS = 4000;
  while (spanSec > 0 && spanSec / bucket > MAX_BUCKETS && bucket < 3600) {
    bucket = Math.min(3600, bucket * 2);
  }

  const [machineInfo, segments, orders] = await Promise.all([
    fetchMachineArea(machineId),
    fetchStatusSegments(machineId, rangeStart, rangeEnd),
    fetchOverlappingOrders(machineId, rangeStart, rangeEnd),
  ]);
  const speedFloor = speedFloorForArea(machineInfo.area);

  let buckets = await fetchSpeedBucketsFromOee(machineId, rangeStart, rangeEnd, bucket, limit);
  let source = 'oee_calculations';
  let fallbackUsed = false;

  if (buckets.length === 0) {
    buckets = await fetchSpeedBucketsFromTelemetry(machineId, rangeStart, rangeEnd, bucket, limit);
    source = 'machine_line_telemetry';
    fallbackUsed = true;
  }

  const classified = classifyPhases(buckets, segments, bucket, speedFloor);
  const points = classified.map((p) => ({
    timestamp: p.timestamp.toISOString(),
    actualSpeed: Math.round(p.actualSpeed * 100) / 100,
    targetSpeed: Math.round(p.targetSpeed * 100) / 100,
    performance: p.performance != null ? Math.round(p.performance * 100) / 100 : null,
    phase: p.phase,
  }));

  const telemetryRows = await fetchTelemetryProductRows(machineId, rangeStart, rangeEnd);
  const telemetrySessions = buildTelemetryProductSessions(telemetryRows, rangeStart, rangeEnd);

  const summary = buildSummary(classified, bucket, machineInfo.targetSpeed);
  const productNotes = buildProductNotes(
    telemetrySessions,
    machineInfo.productName,
    orders,
    classified,
    rangeStart,
    rangeEnd,
    new Date()
  );

  return {
    points,
    summary,
    productNotes,
    meta: {
      bucketSec: bucket,
      source,
      fallbackUsed,
      pointCount: points.length,
      speedFloor,
      area: machineInfo.area,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      limitApplied: limit != null && limit > 0 ? Math.min(Math.floor(limit), 5000) : null,
    },
  };
}
