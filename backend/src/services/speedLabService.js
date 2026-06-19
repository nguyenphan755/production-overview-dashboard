import { query } from '../../database/connection.js';

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_RAW_LIMIT = 30_000;
const MAX_RAW_LIMIT = 50_000;
const MIN_STOP_SEC = 120;
const SPEED_RUN = 1;
const LAB_TIMEZONE = 'Asia/Ho_Chi_Minh';

async function assertMachineExists(machineId) {
  const result = await query('SELECT id, area FROM machines WHERE id = $1', [machineId]);
  if (!result.rows[0]) {
    const err = new Error(`Machine not found: ${machineId}`);
    err.statusCode = 404;
    throw err;
  }
  return result.rows[0];
}

async function fetchBuckets(machineId, rangeStart, rangeEnd, bucketSec) {
  const result = await query(
    `SELECT
       to_timestamp(floor(extract(epoch from calculation_timestamp) / $4) * $4) AS bucket,
       AVG(actual_speed)::float AS actual_speed,
       AVG(target_speed)::float AS target_speed,
       MAX(running_time_seconds)::int AS running_time_seconds,
       MAX(planned_time_seconds)::int AS planned_time_seconds,
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
    runningTimeSeconds: parseInt(row.running_time_seconds || 0, 10),
    plannedTimeSeconds: parseInt(row.planned_time_seconds || 0, 10),
    performance: row.performance != null ? parseFloat(row.performance) : null,
  }));
}

async function fetchRawRows(machineId, rangeStart, rangeEnd, limit) {
  const result = await query(
    `SELECT
       calculation_timestamp,
       actual_speed,
       target_speed,
       running_time_seconds,
       planned_time_seconds,
       performance,
       availability,
       quality,
       oee,
       production_order_id
     FROM oee_calculations
     WHERE machine_id = $1
       AND calculation_timestamp >= $2
       AND calculation_timestamp <= $3
     ORDER BY calculation_timestamp ASC
     LIMIT $4`,
    [machineId, rangeStart, rangeEnd, limit]
  );
  return result.rows.map((row) => ({
    timestamp: new Date(row.calculation_timestamp).toISOString(),
    actualSpeed: parseFloat(row.actual_speed || 0),
    targetSpeed: parseFloat(row.target_speed || 0),
    runningTimeSeconds: parseInt(row.running_time_seconds || 0, 10),
    plannedTimeSeconds: parseInt(row.planned_time_seconds || 0, 10),
    performance: row.performance != null ? parseFloat(row.performance) : null,
    availability: row.availability != null ? parseFloat(row.availability) : null,
    quality: row.quality != null ? parseFloat(row.quality) : null,
    oee: row.oee != null ? parseFloat(row.oee) : null,
    productionOrderId: row.production_order_id ?? null,
  }));
}

function speedState(actual) {
  if (actual === 0) return 'stopped';
  if (actual < SPEED_RUN) return 'creep';
  return 'running';
}

function buildSegmentsFromPoints(points, getTimeMs, getState) {
  if (!points.length) return [];
  const segments = [];
  let cur = {
    state: getState(points[0]),
    start: getTimeMs(points[0]),
    end: getTimeMs(points[0]),
  };
  for (let i = 1; i < points.length; i += 1) {
    const st = getState(points[i]);
    const t = getTimeMs(points[i]);
    if (st !== cur.state) {
      cur.end = t;
      segments.push(cur);
      cur = { state: st, start: t, end: t };
    } else {
      cur.end = t;
    }
  }
  segments.push(cur);
  return segments;
}

function totalDurationSec(segments, states) {
  return segments
    .filter((s) => states.includes(s.state))
    .reduce((acc, s) => acc + (s.end - s.start) / 1000, 0);
}

function buildStopBlocks(segments, minSec = MIN_STOP_SEC) {
  return segments
    .filter((s) => s.state === 'stopped' && (s.end - s.start) / 1000 >= minSec)
    .map((s) => ({
      startMs: s.start,
      endMs: s.end,
      durationSec: Math.round((s.end - s.start) / 1000),
      source: 'actual_speed_zero',
    }))
    .sort((a, b) => b.durationSec - a.durationSec);
}

function pointTimeMs(point) {
  if (point.timestamp instanceof Date) return point.timestamp.getTime();
  if (typeof point.timestamp === 'string') return new Date(point.timestamp).getTime();
  if (point.ts instanceof Date) return point.ts.getTime();
  return new Date(point.ts).getTime();
}

function buildSummaryFromRaw(rawRows, bucketRows) {
  const peakFromBuckets = bucketRows.reduce((m, b) => Math.max(m, b.actualSpeed), 0);
  const peakFromRaw = rawRows.reduce((m, r) => Math.max(m, r.actualSpeed), 0);
  const peakSpeed = Math.max(peakFromBuckets, peakFromRaw);

  const zeroRaw = rawRows.length
    ? rawRows.filter((r) => r.actualSpeed === 0).length / rawRows.length
    : 0;
  const zeroBuckets = bucketRows.length
    ? bucketRows.filter((b) => b.actualSpeed === 0).length / bucketRows.length
    : 0;
  const zeroSpeedPct = rawRows.length ? zeroRaw * 100 : zeroBuckets * 100;

  const segmentPoints = rawRows.length ? rawRows : bucketRows;
  const speedSegs = buildSegmentsFromPoints(
    segmentPoints,
    pointTimeMs,
    (p) => speedState(p.actualSpeed)
  );

  const stoppedDurationSec = totalDurationSec(speedSegs, ['stopped']);
  const stopBlocks = buildStopBlocks(speedSegs);

  const lastRaw = rawRows.length ? rawRows[rawRows.length - 1] : null;
  const lastBucket = bucketRows.length ? bucketRows[bucketRows.length - 1] : null;
  const finalRunningTimeSec =
    lastRaw?.runningTimeSeconds ?? lastBucket?.runningTimeSeconds ?? 0;
  const plannedTimeSec =
    lastRaw?.plannedTimeSeconds ?? lastBucket?.plannedTimeSeconds ?? 0;

  return {
    peakSpeed: Math.round(peakSpeed * 100) / 100,
    zeroSpeedPct: Math.round(zeroSpeedPct * 10) / 10,
    stoppedDurationSec: Math.round(stoppedDurationSec),
    finalRunningTimeSec,
    plannedTimeSec,
    stopSegmentCount: stopBlocks.length,
  };
}

/**
 * Speed Lab query — strict oee_calculations only (no telemetry fallback).
 */
export async function querySpeedLab(
  machineId,
  rangeStart,
  rangeEnd,
  bucketSec = 30,
  includeRaw = false,
  rawLimit = DEFAULT_RAW_LIMIT
) {
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

  const bucket = Math.min(Math.max(parseInt(String(bucketSec), 10) || 30, 5), 3600);
  const limitN = Math.min(
    Math.max(parseInt(String(rawLimit), 10) || DEFAULT_RAW_LIMIT, 100),
    MAX_RAW_LIMIT
  );

  await assertMachineExists(machineId);

  const [bucketRows, rawRows] = await Promise.all([
    fetchBuckets(machineId, rangeStart, rangeEnd, bucket),
    includeRaw ? fetchRawRows(machineId, rangeStart, rangeEnd, limitN) : Promise.resolve([]),
  ]);

  const summary = buildSummaryFromRaw(rawRows, bucketRows);

  const buckets = bucketRows.map((b) => ({
    timestamp: b.timestamp.toISOString(),
    actualSpeed: Math.round(b.actualSpeed * 100) / 100,
    targetSpeed: Math.round(b.targetSpeed * 100) / 100,
    runningTimeSeconds: b.runningTimeSeconds,
    performance: b.performance != null ? Math.round(b.performance * 100) / 100 : null,
  }));

  const segmentPoints = rawRows.length ? rawRows : bucketRows;
  const stopBlocks = buildStopBlocks(
    buildSegmentsFromPoints(segmentPoints, pointTimeMs, (p) => speedState(p.actualSpeed))
  ).slice(0, 20);

  return {
    meta: {
      machineId,
      source: 'oee_calculations',
      bucketSec: bucket,
      windowStart: rangeStart.toISOString(),
      windowEnd: rangeEnd.toISOString(),
      dataEnd: rangeEnd.toISOString(),
      rawRowCount: rawRows.length,
      bucketCount: buckets.length,
      timezone: LAB_TIMEZONE,
      rawLimitApplied: includeRaw ? limitN : null,
    },
    summary,
    buckets,
    rawRows: includeRaw ? rawRows : undefined,
    stopBlocks,
  };
}

export { LAB_TIMEZONE };
