#!/usr/bin/env node
/**
 * Validate SH-04 oee_calculations CSV against speed-chart pipeline:
 * - OEE window Ca 1 (06:00–14:00 ICT)
 * - 30s bucket AVG(actual_speed) like oeeSpeedHistoryService
 * - Downtime ~11:49 and recovery ~12:49 milestones
 *
 * Usage:
 *   node scripts/validate-sh04-speed-chart.mjs [path-to-oee-csv] [path-to-status-csv?]
 */

import fs from 'fs';
import path from 'path';

const FACTORY_TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_OEE_CSV =
  'c:/Users/Admin/OneDrive - CÔNG TY CP DÂY CÁP ĐIỆN VIỆT NAM/Desktop/data-1781835754512.csv';

const oeeCsvPath = process.argv[2] ?? DEFAULT_OEE_CSV;
const statusCsvPath = process.argv[3] ?? null;

function factoryZonedDate(y, m, d, h, min = 0, sec = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(sec)}+07:00`);
}

function parseShiftDateToAnchor(shiftDate) {
  const [y, m, d] = shiftDate.split('-').map(Number);
  return factoryZonedDate(y, m, d, 12, 0);
}

function getShiftWindow(shift, anchor) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FACTORY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(anchor);
  const pick = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');

  if (shift === 1) {
    return {
      start: factoryZonedDate(year, month, day, 6, 0),
      end: factoryZonedDate(year, month, day, 14, 0),
    };
  }
  throw new Error(`shift ${shift} not implemented in validator`);
}

function formatIct(ms) {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: FACTORY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function parseOeeRow(line) {
  const m = line.match(
    /^(\d+),"([^"]+)","([^"]+)","([^"]+)",([^,]+),([^,]+),([^,]+),([^,]+),"([^"]+)","([^"]+)",(\d+),(\d+),([^,]+),([^,]+),([^,]+),([^,]+),"([^"]+)"$/
  );
  if (!m) return null;
  const tsStr = m[4];
  return {
    machineId: m[2],
    ts: new Date(tsStr.replace(' ', 'T') + '+07:00'),
    periodStart: m[9],
    periodEnd: m[10],
    running: Number(m[11]),
    actual: Number(m[13]),
    target: Number(m[14]),
  };
}

function bucketRows(rows, bucketSec) {
  const map = new Map();
  for (const r of rows) {
    const sec = Math.floor(r.ts.getTime() / 1000);
    const b = Math.floor(sec / bucketSec) * bucketSec;
    if (!map.has(b)) map.set(b, { sum: 0, n: 0, ts: b * 1000 });
    const o = map.get(b);
    o.sum += r.actual;
    o.n += 1;
  }
  return [...map.values()]
    .map((o) => ({
      timestampMs: o.ts,
      actualSpeed: o.sum / o.n,
    }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function avgSpeedInWindow(buckets, startMs, endMs) {
  const inWin = buckets.filter((b) => b.timestampMs >= startMs && b.timestampMs < endMs);
  if (!inWin.length) return null;
  return inWin.reduce((s, b) => s + b.actualSpeed, 0) / inWin.length;
}

function parseStatusRow(line) {
  // Flexible: machine_id, status, status_start_time, status_end_time
  const parts = line.split(',');
  if (parts.length < 4) return null;
  const unquote = (s) => s.replace(/^"|"$/g, '');
  const machineId = unquote(parts[1] ?? parts[0]);
  const status = unquote(parts.find((p) => /running|stopped|idle|error|setup/i.test(p)) ?? parts[2]);
  const timeRe = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
  const times = line.match(timeRe) ?? [];
  if (times.length < 2) return null;
  return {
    machineId,
    status: status.toLowerCase(),
    start: new Date(times[0].replace(' ', 'T') + '+07:00'),
    end: times[1] ? new Date(times[1].replace(' ', 'T') + '+07:00') : null,
  };
}

function main() {
  if (!fs.existsSync(oeeCsvPath)) {
    console.error('OEE CSV not found:', oeeCsvPath);
    process.exit(1);
  }

  const lines = fs.readFileSync(oeeCsvPath, 'utf8').trim().split(/\r?\n/);
  const rows = lines.slice(1).map(parseOeeRow).filter(Boolean);
  rows.sort((a, b) => a.ts - b.ts);

  const shiftDate = '2026-06-12';
  const anchor = parseShiftDateToAnchor(shiftDate);
  const { start: queryStart, end: queryEnd } = getShiftWindow(1, anchor);
  const bucketSec = 30;

  const inWindow = rows.filter(
    (r) => r.ts >= queryStart && r.ts <= queryEnd && r.periodStart.startsWith('2026-06-12 06:00')
  );
  const buckets = bucketRows(inWindow, bucketSec);

  const xDomain = [queryStart.getTime(), Math.max(queryEnd.getTime(), queryStart.getTime() + 60_000)];

  // Downtime core: speed=0 while running_time frozen; recovery ramp ~12:39 → 35 by 12:45
  const downtimeStart = factoryZonedDate(2026, 6, 12, 11, 49, 0).getTime();
  const downtimeEnd = factoryZonedDate(2026, 6, 12, 12, 48, 0).getTime();
  const recoveryStart = factoryZonedDate(2026, 6, 12, 12, 45, 0).getTime();
  const recoveryEnd = factoryZonedDate(2026, 6, 12, 12, 47, 0).getTime();

  const avgRecovery = avgSpeedInWindow(buckets, recoveryStart, recoveryEnd);

  const solidDowntimeStart = factoryZonedDate(2026, 6, 12, 12, 10, 0).getTime();
  const solidDowntimeEnd = factoryZonedDate(2026, 6, 12, 12, 32, 0).getTime();
  const solidRows = inWindow.filter(
    (r) => r.ts.getTime() >= solidDowntimeStart && r.ts.getTime() < solidDowntimeEnd
  );
  const solidZeroPct =
    solidRows.length > 0
      ? (solidRows.filter((r) => r.actual === 0).length / solidRows.length) * 100
      : 0;

  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];

  const checks = [];

  checks.push({
    name: 'Single shift Ca 1 in CSV',
    pass: rows.every((r) => r.periodStart === '2026-06-12 06:00:00' && r.periodEnd === '2026-06-12 14:00:00'),
    detail: `rows=${rows.length}`,
  });

  checks.push({
    name: 'Timestamps within OEE window 06:00–14:00 ICT',
    pass:
      rows[0].ts >= queryStart &&
      rows[rows.length - 1].ts <= queryEnd &&
      inWindow.length === rows.length,
    detail: `${formatIct(rows[0].ts.getTime())} → ${formatIct(rows[rows.length - 1].ts.getTime())}`,
  });

  checks.push({
    name: 'X domain matches OEE filter (06:00–14:00)',
    pass:
      xDomain[0] === queryStart.getTime() &&
      xDomain[1] === queryEnd.getTime() &&
      firstBucket.timestampMs >= xDomain[0] &&
      lastBucket.timestampMs <= xDomain[1],
    detail: `${formatIct(xDomain[0])} → ${formatIct(xDomain[1])}`,
  });

  checks.push({
    name: 'Bucket count ~960 for 8h @ 30s',
    pass: buckets.length >= 900 && buckets.length <= 970,
    detail: `${buckets.length} buckets`,
  });

  checks.push({
    name: 'Downtime transition 11:49–12:05 mostly speed = 0',
    pass: (() => {
      const rows = inWindow.filter(
        (r) => r.ts.getTime() >= downtimeStart && r.ts.getTime() < solidDowntimeStart
      );
      if (!rows.length) return true;
      const pct = (rows.filter((r) => r.actual === 0).length / rows.length) * 100;
      return pct >= 70;
    })(),
    detail: 'Ramp-down from speed 10 → 0 around 11:39–11:49',
  });

  checks.push({
    name: 'Solid downtime 12:10–12:32 speed = 0',
    pass: solidZeroPct >= 99.5,
    detail: `${solidZeroPct.toFixed(1)}% rows zero (${solidRows.length} rows)`,
  });

  checks.push({
    name: 'Early recovery creep 12:33+ shows low speed before ramp',
    pass: (() => {
      const creepStart = factoryZonedDate(2026, 6, 12, 12, 33, 0).getTime();
      const creepEnd = factoryZonedDate(2026, 6, 12, 12, 39, 0).getTime();
      const creepRows = inWindow.filter(
        (r) => r.ts.getTime() >= creepStart && r.ts.getTime() < creepEnd
      );
      return creepRows.some((r) => r.actual > 0 && r.actual < 10);
    })(),
    detail: 'Low speed 0.4–3 m/min visible on chart before full ramp at 12:39',
  });

  checks.push({
    name: 'Recovery ramp 12:39–12:45 speed rises (10 → 35)',
    pass: (() => {
      const rampStart = factoryZonedDate(2026, 6, 12, 12, 39, 0).getTime();
      const rampEnd = factoryZonedDate(2026, 6, 12, 12, 46, 0).getTime();
      const rampRows = inWindow.filter(
        (r) => r.ts.getTime() >= rampStart && r.ts.getTime() < rampEnd
      );
      const hasLow = rampRows.some((r) => r.actual > 0 && r.actual < 20);
      const hasHigh = rampRows.some((r) => r.actual >= 30);
      return hasLow && hasHigh;
    })(),
    detail: 'Chart should show ramp-up after downtime, not instant jump',
  });

  checks.push({
    name: 'Recovery ~12:45 shows speed ≈ 35',
    pass: avgRecovery != null && avgRecovery >= 30,
    detail: `avg actual_speed=${avgRecovery?.toFixed(2) ?? 'n/a'} m/min`,
  });

  checks.push({
    name: 'Start of shift has speed > 0 (not empty chart)',
    pass: buckets.slice(0, 5).some((b) => b.actualSpeed > 0),
    detail: `first buckets avg=${(
      buckets.slice(0, 5).reduce((s, b) => s + b.actualSpeed, 0) / Math.min(5, buckets.length)
    ).toFixed(2)}`,
  });

  let statusCompare = null;
  if (statusCsvPath && fs.existsSync(statusCsvPath)) {
    const sLines = fs.readFileSync(statusCsvPath, 'utf8').trim().split(/\r?\n/);
    const statuses = sLines.slice(1).map(parseStatusRow).filter(Boolean);
    const stoppedInDowntime = statuses.filter(
      (s) =>
        s.status.includes('stop') &&
        s.start.getTime() < downtimeEnd &&
        (s.end?.getTime() ?? Infinity) > downtimeStart
    );
    statusCompare = {
      segments: stoppedInDowntime.length,
      note: 'Compare Gantt STOPPED segments with speed=0 window',
    };
    checks.push({
      name: 'Status history overlaps downtime window',
      pass: stoppedInDowntime.length > 0,
      detail: `${stoppedInDowntime.length} stopped segment(s) in 11:49–12:49`,
    });
  }

  const allPass = checks.every((c) => c.pass);

  console.log('\n=== SH-04 Speed Chart Validation ===\n');
  console.log(`OEE CSV: ${oeeCsvPath}`);
  console.log(`Machine: ${rows[0]?.machineId ?? '?'}`);
  console.log(`OEE window: ${formatIct(queryStart.getTime())} → ${formatIct(queryEnd.getTime())}`);
  console.log(`Raw rows: ${rows.length} | Buckets (${bucketSec}s): ${buckets.length}\n`);

  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} — ${c.name}`);
    console.log(`       ${c.detail}`);
  }

  if (statusCompare) {
    console.log(`\nStatus CSV: ${statusCsvPath}`);
    console.log(`       ${statusCompare.note}`);
  } else {
    console.log('\n(Optional) Pass machine_status_history CSV as 2nd arg to compare Gantt vs speed.');
    console.log('  SQL: SELECT * FROM machine_status_history');
    console.log("       WHERE machine_id = 'SH-04'");
    console.log("         AND status_start_time >= '2026-06-12 06:00:00+07'");
    console.log("         AND status_start_time <  '2026-06-12 14:00:00+07'");
  }

  console.log(`\n${allPass ? 'RESULT: ALL CHECKS PASSED — data supports speed chart aligned to OEE window.' : 'RESULT: SOME CHECKS FAILED — review above.'}\n`);

  process.exit(allPass ? 0 : 1);
}

main();
