#!/usr/bin/env node
/**
 * Stress benchmark on dense OEE windows (realistic factory shift with ~10k+ rows).
 * Usage: node scripts/benchmark-chart-apis.mjs
 */

const BASE = 'http://localhost:3001/api';

const SCENARIOS = [
  {
    name: 'Ca 8h bận (~15k rows) — Equipment speed-history',
    url: (m) =>
      `${BASE}/machines/${m}/speed-history?start=2026-06-22T06:00:00.000Z&end=2026-06-22T14:00:00.000Z&bucketSec=30`,
  },
  {
    name: 'Ca 8h bận — Speed Lab query + raw',
    url: (m) =>
      `${BASE}/speed-lab/query?machineId=${m}&start=2026-06-22T06:00:00.000Z&end=2026-06-22T14:00:00.000Z&bucketSec=30&includeRaw=1&rawLimit=28800`,
  },
  {
    name: 'Ca 8h bận — Speed Lab waterfall',
    url: (m) =>
      `${BASE}/speed-lab/waterfall?machineId=${m}&start=2026-06-22T06:00:00.000Z&end=2026-06-22T14:00:00.000Z`,
  },
  {
    name: '1 ngày (24h) — Speed Lab query + raw',
    url: (m) =>
      `${BASE}/speed-lab/query?machineId=${m}&start=2026-06-22T00:00:00.000Z&end=2026-06-23T00:00:00.000Z&bucketSec=60&includeRaw=1&rawLimit=90000`,
  },
  {
    name: '7 ngày — Speed Lab query (no raw, coarsened bucket)',
    url: (m) =>
      `${BASE}/speed-lab/query?machineId=${m}&start=2026-06-15T00:00:00.000Z&end=2026-06-22T00:00:00.000Z&bucketSec=300`,
  },
  {
    name: 'Equipment detail (heavy)',
    url: (m) => `${BASE}/machines/${m}`,
  },
];

const MACHINE = 'SH-05';
const CONCURRENT = 20;

async function once(url) {
  const t0 = performance.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  const text = await res.text();
  return {
    ms: performance.now() - t0,
    ok: res.ok,
    bytes: text.length,
    status: res.status,
  };
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
}

async function main() {
  console.log('Chart API stress benchmark (dense data)');
  console.log(`Machine: ${MACHINE} | concurrent burst: ${CONCURRENT}\n`);

  for (const sc of SCENARIOS) {
    const url = sc.url(MACHINE);

    // Single request
    const single = await once(url);
    const flag = single.ok ? '✅' : '❌';
    console.log(`${flag} ${sc.name}`);
    console.log(`   1 req:  ${single.ms.toFixed(0)} ms  ${(single.bytes / 1024).toFixed(0)} KB`);

    if (!single.ok) {
      console.log(`   status ${single.status}\n`);
      continue;
    }

    // Burst: 20 concurrent (simulates 20 users opening same tab)
    const burst = await Promise.all(Array.from({ length: CONCURRENT }, () => once(url)));
    const ok = burst.filter((b) => b.ok);
    const ms = ok.map((b) => b.ms);
    console.log(
      `   ${CONCURRENT} concurrent: p50=${pct(ms, 50).toFixed(0)} ms p95=${pct(ms, 95).toFixed(0)} ms max=${pct(ms, 100).toFixed(0)} ms`
    );
    console.log(`   fail: ${burst.length - ok.length}/${CONCURRENT}\n`);
  }

  // Sustained: 20 users each hitting speed-history every 30s for 60s (2 waves)
  console.log('── Sustained: 20× speed-history @30s interval (2 waves) ──');
  const url = SCENARIOS[0].url(MACHINE);
  const waves = [];
  for (let w = 0; w < 2; w += 1) {
    const t0 = performance.now();
    const r = await Promise.all(Array.from({ length: CONCURRENT }, () => once(url)));
    waves.push({ wall: performance.now() - t0, results: r });
    if (w < 1) await new Promise((r) => setTimeout(r, 30_000));
  }
  const allMs = waves.flatMap((w) => w.results.filter((x) => x.ok).map((x) => x.ms));
  console.log(
    `   p50=${pct(allMs, 50).toFixed(0)} ms p95=${pct(allMs, 95).toFixed(0)} ms max=${pct(allMs, 100).toFixed(0)} ms`
  );
  console.log(`   wall per wave: ${waves.map((w) => w.wall.toFixed(0)).join(' ms, ')} ms`);
}

main().catch(console.error);
