import { query } from '../../database/connection.js';
import { getMachineSpeedHistory } from './oeeSpeedHistoryService.js';

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const DTL_THRESHOLD_SEC = 300;
const LAB_TIMEZONE = 'Asia/Ho_Chi_Minh';

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round0(n) {
  return Math.round(n);
}

function notSecFromL(lTotalM, ilsMmin) {
  if (!ilsMmin || ilsMmin <= 0 || lTotalM == null || lTotalM < 0) return null;
  return (lTotalM / ilsMmin) * 60;
}

function perfPct(notSec, otSec) {
  if (notSec == null || !otSec || otSec <= 0) return null;
  return Math.min(100, (notSec / otSec) * 100);
}

function statusHistoryLowerBound(rangeStart, rangeEnd) {
  const rangeSpanMs = rangeEnd.getTime() - rangeStart.getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const maxLookbackMs = 400 * DAY_MS;
  const minLookbackMs = 14 * DAY_MS;
  const lookbackMs = Math.min(maxLookbackMs, Math.max(minLookbackMs, rangeSpanMs * 3));
  return new Date(rangeStart.getTime() - lookbackMs);
}

async function fetchMachine(machineId) {
  const result = await query(
    `SELECT id, name, area, target_speed, line_speed, produced_length,
            produced_length_ok, produced_length_ng, production_order_id
     FROM machines WHERE id = $1`,
    [machineId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error(`Machine not found: ${machineId}`);
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function fetchStatusSegments(machineId, rangeStart, rangeEnd) {
  const lowerBound = statusHistoryLowerBound(rangeStart, rangeEnd);
  const result = await query(
    `SELECT * FROM (
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
    ORDER BY msh.status_start_time ASC`,
    [machineId, rangeStart, rangeEnd, lowerBound]
  );
  return result.rows;
}

function clipSegments(segments, rangeStart, rangeEnd, reportNowMs = Date.now()) {
  const w0 = rangeStart.getTime();
  const w1 = rangeEnd.getTime();
  if (w1 <= w0) return [];

  const out = [];
  for (const seg of segments) {
    const itemStart = new Date(seg.status_start_time).getTime();
    const itemEnd = seg.status_end_time
      ? Math.min(new Date(seg.status_end_time).getTime(), w1)
      : Math.min(reportNowMs, w1);
    if (itemEnd <= w0 || itemStart >= w1) continue;
    const actualStart = Math.max(itemStart, w0);
    const actualEnd = Math.min(itemEnd, w1);
    if (actualEnd <= actualStart) continue;
    const status = String(seg.status ?? '').trim().toLowerCase();
    out.push({
      status,
      startMs: actualStart,
      endMs: actualEnd,
      seconds: (actualEnd - actualStart) / 1000,
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

function classifySegment(status, durationSec) {
  if (status === 'running') return { bucket: 'OT', reason: 'RUNNING' };
  if (durationSec <= DTL_THRESHOLD_SEC) return { bucket: 'SPEED_LOSS', reason: 'MINOR_STOP' };
  if (status === 'setup') return { bucket: 'DTL', reason: 'CHANGEOVER' };
  if (status === 'idle') return { bucket: 'DTL', reason: 'WAIT_MAT' };
  if (status === 'error' || status === 'stopped') return { bucket: 'DTL', reason: 'MECH_FAIL' };
  if (status === 'warning') return { bucket: 'SPEED_LOSS', reason: 'REDUCED_SPEED' };
  return { bucket: 'DTL', reason: 'UNKNOWN' };
}

async function fetchLengthTotal(machineId, rangeStart, rangeEnd) {
  const result = await query(
    `SELECT
       COALESCE(SUM(delta_length), 0)::float AS l_total_m,
       COUNT(*)::int AS event_count
     FROM production_length_events
     WHERE machine_id = $1
       AND event_time >= $2
       AND event_time < $3`,
    [machineId, rangeStart, rangeEnd]
  );
  const row = result.rows[0];
  const fromEvents = parseFloat(row?.l_total_m || 0);
  if (fromEvents > 0) {
    return { lTotalM: fromEvents, source: 'production_length_events', eventCount: row?.event_count ?? 0 };
  }
  return { lTotalM: 0, source: 'none', eventCount: 0 };
}

async function fetchSnapshotSpeed(machineId, rangeEnd) {
  const result = await query(
    `SELECT actual_speed, target_speed
     FROM oee_calculations
     WHERE machine_id = $1 AND calculation_timestamp <= $2
     ORDER BY calculation_timestamp DESC
     LIMIT 1`,
    [machineId, rangeEnd]
  );
  const row = result.rows[0];
  return {
    actualSpeed: row ? parseFloat(row.actual_speed || 0) : null,
    targetSpeed: row ? parseFloat(row.target_speed || 0) : null,
  };
}

function aggregateBreakdown(clipped, potSec) {
  const breakdownAgg = {};
  for (const seg of clipped) {
    if (seg.status === 'running') continue;
    const { bucket, reason } = classifySegment(seg.status, seg.seconds);
    const key = `${bucket}|${reason}|${seg.status}`;
    if (!breakdownAgg[key]) {
      breakdownAgg[key] = { bucket, reason, status: seg.status, seconds: 0, count: 0 };
    }
    breakdownAgg[key].seconds += seg.seconds;
    breakdownAgg[key].count += 1;
  }
  return Object.values(breakdownAgg)
    .map((x) => ({
      ...x,
      seconds: round0(x.seconds),
      pct_of_pot: potSec > 0 ? round1((x.seconds / potSec) * 100) : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

function processingFromClipped(clipped) {
  const totals = { running_sec: 0, idle_sec: 0, setup_sec: 0, slot_sec: 0 };
  for (const seg of clipped) {
    if (seg.status === 'running') totals.running_sec += seg.seconds;
    else if (seg.status === 'idle') totals.idle_sec += seg.seconds;
    else if (seg.status === 'setup') totals.setup_sec += seg.seconds;
    else totals.slot_sec += seg.seconds;
  }
  for (const k of Object.keys(totals)) totals[k] = round0(totals[k]);
  return totals;
}

/**
 * OEE waterfall v2 — P = NOT/OT, NOT = L/ILS×60, dual ILS plan/study.
 */
export async function queryOeeWaterfall(machineId, rangeStart, rangeEnd) {
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

  const reportNowMs = Date.now();
  const potSec = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 1000);
  const pstSec = 0;

  const [machineRow, rawSegments, lengthInfo, snapshot, speedHistory] = await Promise.all([
    fetchMachine(machineId),
    fetchStatusSegments(machineId, rangeStart, rangeEnd),
    fetchLengthTotal(machineId, rangeStart, rangeEnd),
    fetchSnapshotSpeed(machineId, rangeEnd),
    getMachineSpeedHistory(machineId, rangeStart, rangeEnd, 60).catch(() => null),
  ]);

  const clipped = clipSegments(rawSegments, rangeStart, rangeEnd, reportNowMs);
  const processing = processingFromClipped(clipped);

  let dtlSec = 0;
  let heuristicSpeedLossSec = 0;
  for (const seg of clipped) {
    if (seg.status === 'running') continue;
    const { bucket } = classifySegment(seg.status, seg.seconds);
    if (bucket === 'DTL') dtlSec += seg.seconds;
    else heuristicSpeedLossSec += seg.seconds;
  }

  const pptSec = Math.max(1, potSec - pstSec);
  const otSec = Math.max(0, pptSec - dtlSec);

  const ok = parseFloat(machineRow.produced_length_ok || 0);
  const ng = parseFloat(machineRow.produced_length_ng || 0);
  let lTotalM = lengthInfo.lTotalM;
  if (lTotalM <= 0 && (ok + ng) > 0) {
    lTotalM = ok + ng;
    lengthInfo.source = 'machines_ok_ng_snapshot';
  }

  const ilsPlan =
    parseFloat(machineRow.target_speed || 0) > 0
      ? parseFloat(machineRow.target_speed)
      : speedHistory?.summary?.currentTargetSpeed ?? null;

  const ilsStudy = speedHistory?.summary?.stableRunningMedian ?? null;

  const notPlanSec = notSecFromL(lTotalM, ilsPlan);
  const notStudySec = notSecFromL(lTotalM, ilsStudy);
  const pPlanPct = perfPct(notPlanSec, otSec);
  const pStudyPct = perfPct(notStudySec, otSec);
  const speedLossPlanSec = Math.max(0, otSec - (notPlanSec ?? 0));
  const speedLossStudySec = Math.max(0, otSec - (notStudySec ?? 0));

  const aPct = pptSec > 0 ? (otSec / pptSec) * 100 : 0;
  const total = ok + ng || lTotalM;
  const qualityPct = total > 0 && ok > 0 ? (ok / total) * 100 : 100;
  const qualityLossSec = Math.max(0, (notPlanSec ?? 0) * (1 - qualityPct / 100));
  const fptSec = Math.max(0, (notPlanSec ?? 0) - qualityLossSec);

  const oeePlanPct = (aPct * (pPlanPct ?? 0) * qualityPct) / 10000;
  const oeeStudyPct = (aPct * (pStudyPct ?? 0) * qualityPct) / 10000;

  const pProxyPct = otSec > 0 ? (processing.running_sec / otSec) * 100 : null;
  const pSnapshotPct =
    snapshot.targetSpeed > 0
      ? Math.min(100, (snapshot.actualSpeed / snapshot.targetSpeed) * 100)
      : null;

  const avgSpeedRunning =
    processing.running_sec > 0 && lTotalM > 0 ? lTotalM / (processing.running_sec / 60) : null;

  const ilsGapPct =
    ilsPlan > 0 && ilsStudy != null ? ((ilsStudy - ilsPlan) / ilsPlan) * 100 : null;

  const breakdownSummary = aggregateBreakdown(clipped, potSec);

  const dataQuality = {
    l_total_source: lengthInfo.source,
    l_total_event_count: lengthInfo.eventCount,
    has_ils_plan: ilsPlan != null && ilsPlan > 0,
    has_ils_study: ilsStudy != null && ilsStudy > 0,
    segment_count: clipped.length,
  };

  return {
    meta: {
      machineId,
      timezone: LAB_TIMEZONE,
      methodology: 'waterfall_shift_v2_performance_ils',
      dtl_threshold_sec: DTL_THRESHOLD_SEC,
    },
    machine: {
      id: machineRow.id,
      name: machineRow.name,
      area: machineRow.area,
    },
    periodStart: rangeStart.toISOString(),
    periodEnd: rangeEnd.toISOString(),
    buckets: {
      pot_sec: round0(potSec),
      pst_sec: round0(pstSec),
      ppt_sec: round0(pptSec),
      dtl_sec: round0(dtlSec),
      ot_sec: round0(otSec),
      running_sec: processing.running_sec,
      speed_loss_heuristic_sec: round0(heuristicSpeedLossSec),
      not_plan_sec: notPlanSec != null ? round0(notPlanSec) : null,
      not_study_sec: notStudySec != null ? round0(notStudySec) : null,
      speed_loss_plan_sec: round0(speedLossPlanSec),
      speed_loss_study_sec: round0(speedLossStudySec),
      net_ot_sec: notPlanSec != null ? round0(notPlanSec) : null,
      quality_loss_sec: round0(qualityLossSec),
      fpt_sec: round0(fptSec),
    },
    apq: {
      availability_pct: round1(aPct),
      performance_plan_pct: pPlanPct != null ? round1(pPlanPct) : null,
      performance_study_pct: pStudyPct != null ? round1(pStudyPct) : null,
      quality_pct: round1(qualityPct),
      oee_plan_pct: round1(oeePlanPct),
      oee_study_pct: round1(oeeStudyPct),
    },
    performance: {
      l_total_m: round1(lTotalM),
      ils_plan: ilsPlan != null ? round1(ilsPlan) : null,
      ils_study: ilsStudy != null ? round1(ilsStudy) : null,
      ils_gap_pct: ilsGapPct != null ? round1(ilsGapPct) : null,
      snapshot_actual_speed: snapshot.actualSpeed,
      snapshot_target_speed: snapshot.targetSpeed,
    },
    compare: {
      p_proxy_pct: pProxyPct != null ? round1(pProxyPct) : null,
      p_snapshot_pct: pSnapshotPct != null ? round1(pSnapshotPct) : null,
      avg_speed_running_m_min: avgSpeedRunning != null ? round1(avgSpeedRunning) : null,
    },
    processing,
    breakdown_summary: breakdownSummary,
    data_quality: dataQuality,
    note:
      'P_v2: P = NOT/OT, NOT = L/ILS×60. DTL = dừng >5 phút. Dừng ngắn trong OT → ảnh hưởng P. PST=0 (chưa có PM). Q từ OK/(OK+NG) khi có.',
  };
}
