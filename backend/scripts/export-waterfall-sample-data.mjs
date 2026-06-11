/**
 * One-off: export waterfall bucket data for HTML sample
 */
import { query } from '../database/connection.js';
import { getCurrentShiftWindow } from '../src/utils/shiftCalculator.js';

const DTL_THRESHOLD_SEC = 300;

function fmtSec(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function inferBucket(status, durationSec) {
  if (status === 'running') return { bucket: 'OT_RUNNING', reason: 'RUNNING' };
  if (durationSec <= DTL_THRESHOLD_SEC) return { bucket: 'SPEED_LOSS', reason: 'MINOR_STOP' };
  if (status === 'setup') return { bucket: 'DTL', reason: 'CHANGEOVER' };
  if (status === 'idle') return { bucket: 'DTL', reason: 'WAIT_MAT' };
  if (status === 'error' || status === 'stopped') return { bucket: 'DTL', reason: 'MECH_FAIL' };
  if (status === 'warning') return { bucket: 'SPEED_LOSS', reason: 'REDUCED_SPEED' };
  return { bucket: 'DTL', reason: 'UNKNOWN' };
}

async function pickMachineAndOrder(preferredMachineId = 'D-05') {
  const r = await query(`
    SELECT m.id, m.name, m.area, m.status, m.oee, m.availability, m.performance, m.quality,
           m.line_speed, m.target_speed, m.production_order_id, m.produced_length,
           m.produced_length_ok, m.produced_length_ng,
           po.id AS order_id, po.name AS order_name, po.product_name,
           po.start_time, po.end_time, po.status AS order_status,
           po.produced_length AS order_produced_length, po.target_length AS order_target_length,
           EXTRACT(EPOCH FROM (COALESCE(po.end_time, NOW()) - po.start_time)) AS pot_sec,
           (SELECT COUNT(*) FROM machine_status_history h
            WHERE h.machine_id = m.id
              AND h.status_start_time < COALESCE(po.end_time, NOW())
              AND (h.status_end_time IS NULL OR h.status_end_time > po.start_time)
           ) AS hist_cnt
    FROM production_orders po
    JOIN machines m ON m.id = po.machine_id
    WHERE EXISTS (
      SELECT 1 FROM machine_status_history h2 WHERE h2.machine_id = m.id
    )
    ORDER BY
      CASE WHEN m.id = $1 THEN 0 ELSE 1 END,
      CASE WHEN m.area = 'drawing' THEN 0 ELSE 1 END,
      hist_cnt DESC
    LIMIT 1
  `, [preferredMachineId]);
  const row = r.rows[0];
  if (!row) return { machine: null, order: null };
  const machine = {
    id: row.id,
    name: row.name,
    area: row.area,
    status: row.status,
    oee: row.oee,
    availability: row.availability,
    performance: row.performance,
    quality: row.quality,
    line_speed: row.line_speed,
    target_speed: row.target_speed,
    production_order_id: row.production_order_id,
    produced_length: row.produced_length,
    produced_length_ok: row.produced_length_ok,
    produced_length_ng: row.produced_length_ng,
  };
  const order = {
    id: row.order_id,
    name: row.order_name,
    product_name: row.product_name,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.order_status,
    produced_length: row.order_produced_length,
    target_length: row.order_target_length,
  };
  return { machine, order };
}

async function getStatusSegments(machineId, periodStart, periodEnd) {
  const r = await query(`
    SELECT status, status_start_time, status_end_time,
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(status_end_time, $3::timestamp), $3::timestamp)
        - GREATEST(status_start_time, $2::timestamp)
      )) AS duration_seconds
    FROM machine_status_history
    WHERE machine_id = $1
      AND status_start_time < $3
      AND (status_end_time IS NULL OR status_end_time > $2)
    ORDER BY status_start_time
  `, [machineId, periodStart, periodEnd]);
  return r.rows.filter((row) => parseFloat(row.duration_seconds) > 0);
}

async function computeWaterfall(machine, order, windowMode = 'shift') {
  const now = new Date();
  let periodStart = new Date(order.start_time);
  let periodEnd = order.end_time ? new Date(order.end_time) : now;
  let windowLabel = 'full_order';

  if (windowMode === 'shift') {
    const shift = getCurrentShiftWindow(now);
    periodStart = new Date(Math.max(shift.start.getTime(), new Date(order.start_time).getTime()));
    periodEnd = new Date(Math.min(shift.end.getTime(), now.getTime(), (order.end_time ? new Date(order.end_time).getTime() : now.getTime())));
    windowLabel = `shift_${shift.shift}_trong_lenh`;
  }

  if (periodEnd <= periodStart) {
    periodEnd = now;
    periodStart = new Date(now.getTime() - 8 * 3600 * 1000);
    windowLabel = 'last_8h_fallback';
  }

  const potSec = Math.max(1, (periodEnd - periodStart) / 1000);

  const segments = await getStatusSegments(machine.id, periodStart, periodEnd);

  let pstSec = 0;
  let dtlSec = 0;
  let speedLossSec = 0;
  const breakdown = [];

  for (const seg of segments) {
    const dur = parseFloat(seg.duration_seconds);
    const { bucket, reason } = inferBucket(seg.status, dur);
    if (seg.status === 'running') {
      breakdown.push({ status: seg.status, reason, bucket: 'OT', seconds: dur, start: seg.status_start_time });
      continue;
    }
    if (bucket === 'SPEED_LOSS') {
      speedLossSec += dur;
      breakdown.push({ status: seg.status, reason, bucket: 'SPEED_LOSS', seconds: dur, start: seg.status_start_time });
    } else {
      dtlSec += dur;
      breakdown.push({ status: seg.status, reason, bucket: 'DTL', seconds: dur, start: seg.status_start_time });
    }
  }

  const runningSec = breakdown.filter((b) => b.bucket === 'OT').reduce((s, b) => s + b.seconds, 0);

  const pptSec = Math.max(1, potSec - pstSec);
  const otSec = Math.max(0, pptSec - dtlSec);
  const netOtSec = Math.max(0, otSec - speedLossSec);

  const ok = parseFloat(machine.produced_length_ok || machine.produced_length || 0);
  const ng = parseFloat(machine.produced_length_ng || 0);
  const total = ok + ng || parseFloat(machine.produced_length || 0);
  const qualityPct = total > 0 ? ((ok || total) / total) * 100 : 100;
  const fptSec = netOtSec * (qualityPct / 100);

  const availabilityPct = (otSec / pptSec) * 100;
  const performancePct = otSec > 0 ? (netOtSec / otSec) * 100 : 0;
  const oeePct = (availabilityPct * performancePct * qualityPct) / 10000;

  const targetSpeed = parseFloat(machine.target_speed || 0);
  const lineSpeed = parseFloat(machine.line_speed || 0);
  const speedRatioPct = targetSpeed > 0 ? Math.min(100, (lineSpeed / targetSpeed) * 100) : null;

  const breakdownAgg = {};
  for (const b of breakdown) {
    const key = `${b.bucket}|${b.reason}|${b.status}`;
    if (!breakdownAgg[key]) {
      breakdownAgg[key] = { bucket: b.bucket, reason: b.reason, status: b.status, seconds: 0, count: 0 };
    }
    breakdownAgg[key].seconds += b.seconds;
    breakdownAgg[key].count += 1;
  }
  const breakdownSummary = Object.values(breakdownAgg)
    .map((x) => ({ ...x, seconds: Math.round(x.seconds), pct_of_pot: Math.round((x.seconds / potSec) * 1000) / 10 }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    machine,
    order,
    window_label: windowLabel,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    buckets: {
      pot_sec: Math.round(potSec),
      pst_sec: Math.round(pstSec),
      ppt_sec: Math.round(pptSec),
      dtl_sec: Math.round(dtlSec),
      ot_sec: Math.round(otSec),
      running_sec: Math.round(runningSec),
      speed_loss_sec: Math.round(speedLossSec),
      net_ot_sec: Math.round(netOtSec),
      quality_loss_sec: Math.round(netOtSec - fptSec),
      fpt_sec: Math.round(fptSec),
    },
    apq: {
      availability_pct: Math.round(availabilityPct * 10) / 10,
      performance_pct: Math.round(performancePct * 10) / 10,
      quality_pct: Math.round(qualityPct * 10) / 10,
      oee_pct: Math.round(oeePct * 10) / 10,
    },
    legacy: {
      oee: parseFloat(machine.oee || 0),
      availability: parseFloat(machine.availability || 0),
      performance: parseFloat(machine.performance || 0),
      quality: parseFloat(machine.quality || 0),
      speed_ratio_pct: speedRatioPct,
    },
    breakdown_summary: breakdownSummary,
    segment_count: breakdown.length,
    methodology: 'waterfall_order_v1_demo',
    note: 'PST/DTL phân loại heuristic từ PLC status (chưa có reason_codes). Ngưỡng DTL > 5 phút.',
    fmtSec,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { out: 'tmp/waterfall-sample-data.json', machineId: 'A-01', from: null, to: null, window: 'shift' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') opts.from = args[++i];
    else if (args[i] === '--to') opts.to = args[++i];
    else if (args[i] === '--machine') opts.machineId = args[++i];
    else if (args[i] === '--window') opts.window = args[++i];
    else if (!args[i].startsWith('--') && !opts.outSet) { opts.out = args[i]; opts.outSet = true; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const { machine, order } = await pickMachineAndOrder(opts.machineId);
  if (!machine || !order) {
    console.log(JSON.stringify({ error: 'No suitable machine/order with status history' }));
    process.exit(1);
  }
  let data = await computeWaterfall(machine, order, opts.window);
  if (opts.from && opts.to) {
    data = await computeWaterfall(machine, order, 'custom');
    data.periodStart = new Date(opts.from).toISOString();
    data.periodEnd = new Date(opts.to).toISOString();
    const potSec = Math.max(1, (new Date(opts.to) - new Date(opts.from)) / 1000);
    const segments = await getStatusSegments(machine.id, new Date(opts.from), new Date(opts.to));
    // recompute inline
    let pstSec = 0, dtlSec = 0, speedLossSec = 0;
    const breakdown = [];
    for (const seg of segments) {
      const dur = parseFloat(seg.duration_seconds);
      const { bucket, reason } = inferBucket(seg.status, dur);
      if (seg.status === 'running') {
        breakdown.push({ status: seg.status, reason, bucket: 'OT', seconds: dur, start: seg.status_start_time });
        continue;
      }
      if (bucket === 'SPEED_LOSS') { speedLossSec += dur; breakdown.push({ status: seg.status, reason, bucket: 'SPEED_LOSS', seconds: dur, start: seg.status_start_time }); }
      else { dtlSec += dur; breakdown.push({ status: seg.status, reason, bucket: 'DTL', seconds: dur, start: seg.status_start_time }); }
    }
    const runningSec = breakdown.filter((b) => b.bucket === 'OT').reduce((s, b) => s + b.seconds, 0);
    const pptSec = Math.max(1, potSec - pstSec);
    const otSec = Math.max(0, pptSec - dtlSec);
    const netOtSec = Math.max(0, otSec - speedLossSec);
    const ok = parseFloat(machine.produced_length_ok || machine.produced_length || 0);
    const ng = parseFloat(machine.produced_length_ng || 0);
    const total = ok + ng || parseFloat(machine.produced_length || 0);
    const qualityPct = total > 0 ? ((ok || total) / total) * 100 : 100;
    const fptSec = netOtSec * (qualityPct / 100);
    const availabilityPct = (otSec / pptSec) * 100;
    const performancePct = otSec > 0 ? (netOtSec / otSec) * 100 : 0;
    const oeePct = (availabilityPct * performancePct * qualityPct) / 10000;
    const breakdownAgg = {};
    for (const b of breakdown) {
      const key = `${b.bucket}|${b.reason}|${b.status}`;
      if (!breakdownAgg[key]) breakdownAgg[key] = { bucket: b.bucket, reason: b.reason, status: b.status, seconds: 0, count: 0 };
      breakdownAgg[key].seconds += b.seconds;
      breakdownAgg[key].count += 1;
    }
    const breakdownSummary = Object.values(breakdownAgg)
      .map((x) => ({ ...x, seconds: Math.round(x.seconds), pct_of_pot: Math.round((x.seconds / potSec) * 1000) / 10 }))
      .sort((a, b) => b.seconds - a.seconds);
    data = {
      ...data,
      window_label: `custom_${opts.from}_${opts.to}`,
      periodStart: new Date(opts.from).toISOString(),
      periodEnd: new Date(opts.to).toISOString(),
      buckets: {
        pot_sec: Math.round(potSec), pst_sec: Math.round(pstSec), ppt_sec: Math.round(pptSec),
        dtl_sec: Math.round(dtlSec), ot_sec: Math.round(otSec), running_sec: Math.round(runningSec),
        speed_loss_sec: Math.round(speedLossSec), net_ot_sec: Math.round(netOtSec),
        quality_loss_sec: Math.round(netOtSec - fptSec), fpt_sec: Math.round(fptSec),
      },
      apq: {
        availability_pct: Math.round(availabilityPct * 10) / 10,
        performance_pct: Math.round(performancePct * 10) / 10,
        quality_pct: Math.round(qualityPct * 10) / 10,
        oee_pct: Math.round(oeePct * 10) / 10,
      },
      breakdown_summary: breakdownSummary,
      segment_count: breakdown.length,
    };
  }
  const buckets_fmt = {};
  for (const [k, v] of Object.entries(data.buckets)) {
    buckets_fmt[k.replace('_sec', '')] = fmtSec(v);
  }
  data.buckets_fmt = buckets_fmt;
  const outPath = opts.out;
  const { writeFileSync, mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(outPath);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
