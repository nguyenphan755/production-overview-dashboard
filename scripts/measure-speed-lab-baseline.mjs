#!/usr/bin/env node
/**
 * Measure Speed Lab + Equipment speed-history API latency for POC scenarios A/B/C.
 * Usage: node scripts/measure-speed-lab-baseline.mjs [--api http://localhost:3001/api] [--machine SH-08]
 *
 * Writes/updates docs/grafana/MES_BASELINE_RESULTS.md
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const API_BASE = (process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : process.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
).replace(/\/$/, '');

const MACHINE_OVERRIDE = process.argv.includes('--machine')
  ? process.argv[process.argv.indexOf('--machine') + 1]
  : null;

const FACTORY_TZ = 'Asia/Ho_Chi_Minh';

function factoryClock(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FACTORY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (t) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour') };
}

function factoryZonedDate(y, m, d, h, min = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00+07:00`);
}

function getCurrentShiftWindow(now = new Date()) {
  const { year, month, day, hour } = factoryClock(now);
  if (hour >= 6 && hour < 14) {
    return {
      start: factoryZonedDate(year, month, day, 6),
      end: factoryZonedDate(year, month, day, 14),
    };
  }
  if (hour >= 14 && hour < 22) {
    return {
      start: factoryZonedDate(year, month, day, 14),
      end: factoryZonedDate(year, month, day, 22),
    };
  }
  if (hour >= 22) {
    const next = new Date(factoryZonedDate(year, month, day, 12).getTime() + 86_400_000);
    const nc = factoryClock(next);
    return {
      start: factoryZonedDate(year, month, day, 22),
      end: factoryZonedDate(nc.year, nc.month, nc.day, 6),
    };
  }
  const prev = new Date(factoryZonedDate(year, month, day, 12).getTime() - 86_400_000);
  const pc = factoryClock(prev);
  return {
    start: factoryZonedDate(pc.year, pc.month, pc.day, 22),
    end: factoryZonedDate(year, month, day, 6),
  };
}

function getProductionDayWindow(ymd, now = new Date()) {
  const [y, m, d] = ymd.split('-').map(Number);
  const start = factoryZonedDate(y, m, d, 6);
  const next = new Date(factoryZonedDate(y, m, d, 12).getTime() + 86_400_000);
  const nc = factoryClock(next);
  const endFull = factoryZonedDate(nc.year, nc.month, nc.day, 6);
  const end = endFull.getTime() > now.getTime() ? now : endFull;
  return { start, end };
}

function productionDayLabel(now = new Date()) {
  const { year, month, day, hour } = factoryClock(now);
  if (hour < 6) {
    const prev = new Date(factoryZonedDate(year, month, day, 12).getTime() - 86_400_000);
    const pc = factoryClock(prev);
    return `${pc.year}-${String(pc.month).padStart(2, '0')}-${String(pc.day).padStart(2, '0')}`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const noon = factoryZonedDate(y, m, d, 12);
  const nc = factoryClock(new Date(noon.getTime() + delta * 86_400_000));
  return `${nc.year}-${String(nc.month).padStart(2, '0')}-${String(nc.day).padStart(2, '0')}`;
}

async function timedFetch(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  const body = await res.text();
  const ms = Math.round(performance.now() - t0);
  let bytes = new TextEncoder().encode(body).length;
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* ignore */
  }
  return { ms, bytes, ok: res.ok, status: res.status, json };
}

async function fetchMachineId() {
  if (MACHINE_OVERRIDE) return MACHINE_OVERRIDE;
  const res = await fetch(`${API_BASE}/machines`);
  const data = await res.json();
  const machines = data?.data ?? [];
  if (!machines.length) throw new Error('No machines from API');
  return machines[0].id;
}

async function measureScenario(name, machineId, start, end, bucketSec = 30) {
  const qs = (path, extra = {}) => {
    const q = new URLSearchParams({
      machineId,
      start: start.toISOString(),
      end: end.toISOString(),
      ...extra,
    });
    return `${API_BASE}${path}?${q}`;
  };

  const urls = {
    speedLabQuery: qs('/speed-lab/query', { bucketSec: String(bucketSec), includeRaw: '1' }),
    waterfall: qs('/speed-lab/waterfall'),
    speedHistory: `${API_BASE}/machines/${encodeURIComponent(machineId)}/speed-history?` +
      new URLSearchParams({ start: start.toISOString(), end: end.toISOString() }),
    statusHistory: `${API_BASE}/machines/${encodeURIComponent(machineId)}/status-history?` +
      new URLSearchParams({ start: start.toISOString(), end: end.toISOString() }),
  };

  const t0 = performance.now();
  const [speedLabQuery, waterfall, speedHistory, statusHistory] = await Promise.all([
    timedFetch(urls.speedLabQuery),
    timedFetch(urls.waterfall),
    timedFetch(urls.speedHistory),
    timedFetch(urls.statusHistory),
  ]);
  const totalMs = Math.round(performance.now() - t0);

  const rawRows =
    speedLabQuery.json?.data?.meta?.segmentRowCount ??
    speedLabQuery.json?.data?.meta?.rawRowCount ??
    null;

  return {
    name,
    machineId,
    start: start.toISOString(),
    end: end.toISOString(),
    spanHours: Math.round((end - start) / 3_600_000 * 10) / 10,
    bucketSec,
    totalMs,
    apis: {
      speedLabQuery: { ms: speedLabQuery.ms, bytes: speedLabQuery.bytes, ok: speedLabQuery.ok },
      waterfall: { ms: waterfall.ms, bytes: waterfall.bytes, ok: waterfall.ok },
      speedHistory: { ms: speedHistory.ms, bytes: speedHistory.bytes, ok: speedHistory.ok },
      statusHistory: { ms: statusHistory.ms, bytes: statusHistory.bytes, ok: statusHistory.ok },
    },
    segmentRowCount: rawRows,
    payloadTotalBytes:
      speedLabQuery.bytes + waterfall.bytes + speedHistory.bytes + statusHistory.bytes,
  };
}

function resolveBucketSec(start, end) {
  const spanHours = (end - start) / 3_600_000;
  if (spanHours <= 24) return 30;
  if (spanHours <= 72) return 60;
  return 300;
}

async function main() {
  const now = new Date();
  const machineId = await fetchMachineId();
  console.log(`API: ${API_BASE}`);
  console.log(`Machine: ${machineId}`);

  const shiftWin = getCurrentShiftWindow(now);
  const yesterdayYmd = addDaysYmd(productionDayLabel(now), -1);
  const prodDay = getProductionDayWindow(yesterdayYmd, now);
  const weekStart = new Date(now.getTime() - 7 * 24 * 3600_000);

  const scenarios = [
    await measureScenario('A — 1 ca (current shift)', machineId, shiftWin.start, shiftWin.end, 30),
    await measureScenario(
      'B — production day (yesterday)',
      machineId,
      prodDay.start,
      prodDay.end,
      30
    ),
    await measureScenario(
      'C — 7 ngày (week)',
      machineId,
      weekStart,
      now,
      resolveBucketSec(weekStart, now)
    ),
  ];

  const lines = [
    '# MES API baseline — Speed Lab & Equipment',
    '',
    `Generated: ${now.toISOString()}`,
    `API base: \`${API_BASE}\``,
    `Machine: \`${machineId}\``,
    '',
    '## Summary',
    '',
    '| Scenario | Span (h) | T_total parallel (ms) | Payload (KB) | segment rows |',
    '|----------|----------|------------------------|--------------|--------------|',
  ];

  for (const s of scenarios) {
    lines.push(
      `| ${s.name} | ${s.spanHours} | **${s.totalMs}** | ${Math.round(s.payloadTotalBytes / 1024)} | ${s.segmentRowCount ?? 'n/a'} |`
    );
  }

  lines.push('', '## Per-endpoint detail', '');

  for (const s of scenarios) {
    lines.push(`### ${s.name}`, '');
    lines.push(`- Window: \`${s.start}\` → \`${s.end}\``);
    lines.push(`- bucketSec: ${s.bucketSec}`, '');
    lines.push('| Endpoint | ms | KB | OK |');
    lines.push('|----------|-----|-----|-----|');
    for (const [key, v] of Object.entries(s.apis)) {
      lines.push(`| \`${key}\` | ${v.ms} | ${Math.round(v.bytes / 1024)} | ${v.ok} |`);
    }
    lines.push('');
  }

  lines.push('## Grafana POC targets', '');
  lines.push('| Scenario | MES T_total | Grafana target T_query |');
  lines.push('|----------|-------------|-------------------------|');
  lines.push(`| A | ${scenarios[0].totalMs} ms | ≤ 500 ms |`);
  lines.push(`| B | ${scenarios[1].totalMs} ms | ≤ 2000 ms |`);
  lines.push(`| C | ${scenarios[2].totalMs} ms | ≤ 2000 ms |`);
  lines.push('');
  lines.push('Re-run: `node scripts/measure-speed-lab-baseline.mjs`');
  lines.push('Grafana SQL baseline: `node scripts/measure-grafana-query-baseline.mjs`');

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'grafana', 'MES_BASELINE_RESULTS.md');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nWrote ${outPath}`);
  for (const s of scenarios) {
    console.log(`  ${s.name}: ${s.totalMs}ms total, ${Math.round(s.payloadTotalBytes / 1024)}KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
