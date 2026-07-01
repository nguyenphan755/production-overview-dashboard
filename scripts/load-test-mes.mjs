#!/usr/bin/env node
/**
 * MES load benchmark — simulates fleet poll + Equipment/Speed Lab heavy queries.
 * Usage: node scripts/load-test-mes.mjs [--base http://localhost:3001] [--users 20] [--duration 30]
 */

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const BASE = getArg('--base', 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE}/api`;
const USERS = parseInt(getArg('--users', '20'), 10);
const DURATION_SEC = parseInt(getArg('--duration', '25'), 10);
const MACHINE_IDS = ['D-01', 'SH-05', 'SH-06', 'A-01', 'S-04'];

// Typical "current shift" window (~8h) — matches Equipment/Speed Lab toolbar
const now = Date.now();
const shiftStart = new Date(now - 8 * 3600_000).toISOString();
const shiftEnd = new Date(now).toISOString();

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function timedFetch(label, url, opts = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(120_000) });
    const ms = performance.now() - t0;
    const text = await res.text();
    let bytes = text.length;
    let ok = res.ok;
    if (!ok) return { label, ms, ok, status: res.status, bytes, error: text.slice(0, 120) };
    return { label, ms, ok, status: res.status, bytes };
  } catch (e) {
    return { label, ms: performance.now() - t0, ok: false, status: 0, bytes: 0, error: e.message };
  }
}

function buildUrls(machineId) {
  const q = (params) => new URLSearchParams(params).toString();
  return {
    health: `${BASE}/health/ready`,
    kpis: `${API}/kpis/global`,
    areas: `${API}/areas`,
    machines: `${API}/machines`,
    machineDetail: `${API}/machines/${machineId}`,
    speedHistory: `${API}/machines/${machineId}/speed-history?${q({ start: shiftStart, end: shiftEnd, bucketSec: '30' })}`,
    statusHistory: `${API}/machines/${machineId}/status-history?${q({ start: shiftStart, end: shiftEnd })}`,
    speedLabQuery: `${API}/speed-lab/query?${q({ machineId, start: shiftStart, end: shiftEnd, bucketSec: '30', includeRaw: '1', rawLimit: '5000' })}`,
    speedLabWaterfall: `${API}/speed-lab/waterfall?${q({ machineId, start: shiftStart, end: shiftEnd })}`,
  };
}

async function baseline() {
  console.log('═══════════════════════════════════════════');
  console.log(' 1) BASELINE — single request latency');
  console.log('═══════════════════════════════════════════');
  console.log(` Base: ${BASE} | shift window: 8h | machine: D-01\n`);

  const urls = buildUrls('D-01');
  const order = [
    ['health/ready', urls.health],
    ['GET /kpis/global', urls.kpis],
    ['GET /areas', urls.areas],
    ['GET /machines', urls.machines],
    ['GET /machines/:id (Equipment)', urls.machineDetail],
    ['GET /speed-history (Equipment chart)', urls.speedHistory],
    ['GET /status-history (Gantt)', urls.statusHistory],
    ['GET /speed-lab/query (Speed Lab)', urls.speedLabQuery],
    ['GET /speed-lab/waterfall (OEE)', urls.speedLabWaterfall],
  ];

  const results = [];
  for (const [label, url] of order) {
    const r = await timedFetch(label, url);
    results.push(r);
    const flag = r.ok ? '✅' : '❌';
    const kb = (r.bytes / 1024).toFixed(1);
    console.log(` ${flag} ${label.padEnd(42)} ${r.ms.toFixed(0).padStart(6)} ms  ${kb.padStart(8)} KB  ${r.ok ? '' : r.error || r.status}`);
  }
  return results;
}

/** One virtual user: fleet poll every 1s + occasional detail tabs */
async function virtualUser(userId, stopAt, samples) {
  const machineId = MACHINE_IDS[userId % MACHINE_IDS.length];
  const urls = buildUrls(machineId);
  // ~30% on Equipment detail, ~20% on Speed Lab, ~50% Production overview only
  const mode = userId % 10;
  const hasDetail = mode < 3;
  const hasSpeedLab = mode >= 3 && mode < 5;

  while (Date.now() < stopAt) {
    const tick = performance.now();

    // Fleet poll (every user every ~1s)
    const fleet = await Promise.all([
      timedFetch('kpis', urls.kpis),
      timedFetch('areas', urls.areas),
      timedFetch('machines', urls.machines),
    ]);
    for (const r of fleet) samples.push({ ...r, userId, kind: 'fleet' });

    if (hasDetail) {
      const heavy = await Promise.all([
        timedFetch('machineDetail', urls.machineDetail),
        timedFetch('speedHistory', urls.speedHistory),
        timedFetch('statusHistory', urls.statusHistory),
      ]);
      for (const r of heavy) samples.push({ ...r, userId, kind: 'equipment' });
    }

    if (hasSpeedLab) {
      const lab = await Promise.all([
        timedFetch('speedLabQuery', urls.speedLabQuery),
        timedFetch('speedLabWaterfall', urls.speedLabWaterfall),
      ]);
      for (const r of lab) samples.push({ ...r, userId, kind: 'speedlab' });
    }

    const elapsed = performance.now() - tick;
    const wait = Math.max(0, 1000 - elapsed);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
}

function summarize(samples, label) {
  const ok = samples.filter((s) => s.ok);
  const fail = samples.filter((s) => !s.ok);
  const ms = ok.map((s) => s.ms).sort((a, b) => a - b);
  const bytes = ok.map((s) => s.bytes);
  const avgBytes = bytes.length ? bytes.reduce((a, b) => a + b, 0) / bytes.length : 0;
  console.log(`\n── ${label} (${samples.length} requests, ${fail.length} failed) ──`);
  if (!ms.length) {
    console.log('   (no successful requests)');
    return;
  }
  console.log(`   p50: ${pct(ms, 50).toFixed(0)} ms | p95: ${pct(ms, 95).toFixed(0)} ms | p99: ${pct(ms, 99).toFixed(0)} ms | max: ${ms[ms.length - 1].toFixed(0)} ms`);
  console.log(`   avg payload: ${(avgBytes / 1024).toFixed(1)} KB`);
  if (fail.length) {
    const reasons = [...new Set(fail.map((f) => f.error || f.status))].slice(0, 3);
    console.log(`   failures: ${reasons.join('; ')}`);
  }
}

async function loadTest() {
  console.log('\n═══════════════════════════════════════════');
  console.log(` 2) LOAD TEST — ${USERS} virtual users × ${DURATION_SEC}s`);
  console.log('═══════════════════════════════════════════');
  console.log(' Mix: all users poll KPIs+areas+machines @1Hz');
  console.log('      ~30% also open Equipment (detail+speed+status)');
  console.log('      ~20% also open Speed Lab (query+waterfall)\n');

  const samples = [];
  const stopAt = Date.now() + DURATION_SEC * 1000;
  const t0 = Date.now();

  await Promise.all(
    Array.from({ length: USERS }, (_, i) => virtualUser(i, stopAt, samples))
  );

  const wallSec = (Date.now() - t0) / 1000;
  const rps = samples.length / wallSec;

  console.log(`\n Completed in ${wallSec.toFixed(1)}s — ${samples.length} total HTTP requests (${rps.toFixed(1)} req/s)`);

  summarize(samples, 'ALL');
  summarize(samples.filter((s) => s.kind === 'fleet'), 'Fleet poll (kpis/areas/machines)');
  summarize(samples.filter((s) => s.label === 'speedHistory'), 'Equipment speed-history');
  summarize(samples.filter((s) => s.label === 'machineDetail'), 'Equipment machine detail');
  summarize(samples.filter((s) => s.label === 'speedLabQuery'), 'Speed Lab query');
  summarize(samples.filter((s) => s.label === 'speedLabWaterfall'), 'Speed Lab waterfall');

  const fleetP95 = pct(samples.filter((s) => s.kind === 'fleet' && s.ok).map((s) => s.ms).sort((a, b) => a - b), 95);
  const chartP95 = pct(
    samples.filter((s) => (s.label === 'speedHistory' || s.label === 'speedLabQuery') && s.ok).map((s) => s.ms).sort((a, b) => a - b),
    95
  );

  console.log('\n═══════════════════════════════════════════');
  console.log(' KẾT LUẬN');
  console.log('═══════════════════════════════════════════');

  if (chartP95 > 3000) {
    console.log(` ⚠️  Chart API p95 = ${chartP95.toFixed(0)} ms (>3s) — đúng triệu chứng "load trend/chart lâu"`);
  } else if (chartP95 > 1500) {
    console.log(` ⚠️  Chart API p95 = ${chartP95.toFixed(0)} ms (1.5–3s) — cảm nhận chậm khi nhiều user mở tab nặng`);
  } else {
    console.log(` ✅ Chart API p95 = ${chartP95.toFixed(0)} ms — chart OK ở mức tải test này`);
  }

  const failRate = samples.filter((s) => !s.ok).length / Math.max(1, samples.length);
  if (failRate > 0.05) {
    console.log(` ❌ Error rate ${(failRate * 100).toFixed(1)}% — hệ thống quá tải ở ${USERS} user`);
  } else if (fleetP95 > 800) {
    console.log(` ⚠️  Fleet poll p95 = ${fleetP95.toFixed(0)} ms — dashboard lag khi ${USERS} user`);
  } else {
    console.log(` ✅ Fleet poll p95 = ${fleetP95.toFixed(0)} ms — ${USERS} user trong vùng ổn cho overview`);
  }

  console.log('\n Gợi ý: chạy migration index + VITE_POLL_MS_MACHINES=2000 nếu chart p95 > 2s.');
}

async function main() {
  console.log('MES Load Benchmark');
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error(`Backend not reachable at ${BASE}`);
  } catch (e) {
    console.error(`❌ Cannot reach backend: ${e.message}`);
    process.exit(1);
  }

  await baseline();
  await loadTest();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
