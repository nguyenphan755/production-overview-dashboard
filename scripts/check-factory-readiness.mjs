#!/usr/bin/env node
/**
 * Pre/post deploy health check for factory PC (DB + API + chart latency).
 * Usage: node scripts/check-factory-readiness.mjs [--base http://localhost:3001] [--machine SH-05]
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'backend', 'package.json'));
const pg = require('pg');

const backendEnvPath = join(root, 'backend', '.env');

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function parseArgs() {
  const opts = { base: 'http://localhost:3001', machine: 'SH-05' };
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--base') opts.base = process.argv[++i];
    else if (process.argv[i] === '--machine') opts.machine = process.argv[++i];
  }
  return opts;
}

const PERF_INDEXES = [
  'idx_machine_metrics_machine_type_time',
  'idx_production_orders_machine_start',
  'idx_prod_len_events_machine_time',
  'idx_availability_agg_machine_type_window',
  'idx_msh_machine_closed_end_start',
  'idx_alarms_machine_timestamp',
  'idx_oee_calc_ts_brin',
  'uq_msh_one_open_per_machine',
];

async function timedFetch(url, timeoutMs = 120_000) {
  const t0 = performance.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  return { ms: performance.now() - t0, ok: res.ok, status: res.status, bytes: text.length };
}

async function checkDb(env, machineId) {
  const pool = new pg.Pool({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '5432', 10),
    database: env.DB_NAME || 'production_dashboard',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
  });

  const out = { ok: true, issues: [] };

  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    const idx = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [PERF_INDEXES]
    );
    const have = new Set(idx.rows.map((r) => r.indexname));
    const missing = PERF_INDEXES.filter((n) => !have.has(n));
    if (missing.length) {
      out.ok = false;
      out.issues.push(`Missing ${missing.length} performance index(es): ${missing.join(', ')}`);
      console.log(`⚠️  Performance indexes: ${have.size}/${PERF_INDEXES.length} (missing: ${missing.join(', ')})`);
    } else {
      console.log(`✅ Performance indexes: ${PERF_INDEXES.length}/${PERF_INDEXES.length}`);
    }

    const dupes = await pool.query(`
      SELECT count(*)::int AS machines_with_dupes FROM (
        SELECT machine_id FROM machine_status_history
        WHERE status_end_time IS NULL
        GROUP BY machine_id HAVING count(*) > 1
      ) t
    `);
    if (dupes.rows[0].machines_with_dupes > 0) {
      out.ok = false;
      out.issues.push(`${dupes.rows[0].machines_with_dupes} machine(s) with duplicate OPEN status — fix before unique index`);
      console.log(`⚠️  Duplicate OPEN status segments: ${dupes.rows[0].machines_with_dupes} machine(s)`);
    } else {
      console.log('✅ machine_status_history: at most one OPEN segment per machine');
    }

    const vol = await pool.query(`
      SELECT
        (SELECT count(*)::bigint FROM oee_calculations) AS oee_rows,
        (SELECT count(*)::bigint FROM machine_metrics) AS metrics_rows,
        (SELECT count(*)::bigint FROM oee_calculations
           WHERE calculation_timestamp >= NOW() - INTERVAL '8 hours') AS oee_last_8h
    `);
    const v = vol.rows[0];
    console.log(`ℹ️  oee_calculations: ${Number(v.oee_rows).toLocaleString()} total, ${Number(v.oee_last_8h).toLocaleString()} last 8h`);
    console.log(`ℹ️  machine_metrics: ${Number(v.metrics_rows).toLocaleString()} rows`);

    const dense = await pool.query(
      `SELECT count(*)::int AS cnt FROM oee_calculations
       WHERE machine_id = $1
         AND calculation_timestamp >= '2026-06-22 06:00:00'
         AND calculation_timestamp < '2026-06-22 14:00:00'`,
      [machineId]
    );
    if (dense.rows[0].cnt > 5000) {
      console.log(`ℹ️  Dense shift sample (${machineId} 22-Jun ca sáng): ${dense.rows[0].cnt.toLocaleString()} OEE rows — good for benchmark`);
    } else {
      console.log(`ℹ️  Dense shift sample (${machineId} 22-Jun): ${dense.rows[0].cnt} rows (benchmark may use current 8h window instead)`);
    }
  } catch (e) {
    out.ok = false;
    out.issues.push(e.message || String(e));
    console.log(`❌ Database: ${e.message || e}`);
  } finally {
    await pool.end();
  }

  return out;
}

async function checkApi(opts) {
  const base = opts.base.replace(/\/$/, '');
  const api = `${base}/api`;
  const out = { ok: true, issues: [] };

  for (const [label, path] of [
    ['liveness', '/health'],
    ['readiness (DB)', '/health/ready'],
  ]) {
    try {
      const r = await timedFetch(`${base}${path}`, 15_000);
      const flag = r.ok ? '✅' : '❌';
      console.log(`${flag} ${label}: ${r.ms.toFixed(0)} ms (HTTP ${r.status})`);
      if (!r.ok) {
        out.ok = false;
        out.issues.push(`${path} returned ${r.status}`);
      }
    } catch (e) {
      out.ok = false;
      out.issues.push(`${path}: ${e.message}`);
      console.log(`❌ ${label}: ${e.message}`);
    }
  }

  const shiftStart = new Date(Date.now() - 8 * 3600_000).toISOString();
  const shiftEnd = new Date().toISOString();
  const chartUrls = [
    ['speed-history (8h)', `${api}/machines/${opts.machine}/speed-history?start=${shiftStart}&end=${shiftEnd}&bucketSec=30`],
    ['speed-lab query (8h)', `${api}/speed-lab/query?machineId=${opts.machine}&start=${shiftStart}&end=${shiftEnd}&bucketSec=30&includeRaw=1&rawLimit=5000`],
    ['fleet /machines', `${api}/machines`],
  ];

  console.log('\nChart / fleet latency (single request):');
  for (const [label, url] of chartUrls) {
    try {
      const r = await timedFetch(url);
      let flag = '✅';
      if (!r.ok) {
        flag = '❌';
        out.ok = false;
        out.issues.push(`${label} HTTP ${r.status}`);
      } else if (r.ms > 2000) {
        flag = '⚠️ ';
        out.issues.push(`${label} slow: ${r.ms.toFixed(0)}ms`);
      } else if (r.ms > 1000) {
        flag = '⚠️ ';
      }
      console.log(`${flag} ${label}: ${r.ms.toFixed(0)} ms, ${(r.bytes / 1024).toFixed(0)} KB`);
    } catch (e) {
      out.ok = false;
      out.issues.push(`${label}: ${e.message}`);
      console.log(`❌ ${label}: ${e.message}`);
    }
  }

  return out;
}

function checkEnv(env) {
  const issues = [];
  if (!env.DB_PASSWORD) issues.push('DB_PASSWORD missing in backend/.env');
  if (env.NODE_ENV === 'production') {
    const secret = env.JWT_SECRET || '';
    if (!secret || secret === 'your-secret-key-change-in-production' || secret === 'change_me') {
      issues.push('JWT_SECRET must be set (non-default) when NODE_ENV=production');
    }
  }
  const sync = parseInt(env.AVAILABILITY_SYNC_INTERVAL || '30', 10);
  if (sync < 45) {
    console.log(`ℹ️  AVAILABILITY_SYNC_INTERVAL=${sync}s — recommend 60 for ≤20 users on chart-heavy shifts`);
  } else {
    console.log(`✅ AVAILABILITY_SYNC_INTERVAL=${sync}s`);
  }
  for (const msg of issues) console.log(`⚠️  ${msg}`);
  return issues.length === 0;
}

async function main() {
  const opts = parseArgs();
  console.log('Factory readiness check');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`API: ${opts.base} | machine: ${opts.machine}\n`);

  if (!existsSync(backendEnvPath)) {
    console.error(`❌ Missing ${backendEnvPath} — copy from .env.example and set DB_PASSWORD`);
    process.exit(1);
  }

  const env = loadEnv(backendEnvPath);
  console.log('── Environment ──');
  const envOk = checkEnv(env);

  console.log('\n── Database ──');
  const db = await checkDb(env, opts.machine);

  console.log('\n── API ──');
  const api = await checkApi(opts);

  console.log('\n── Summary ──');
  const allOk = envOk && db.ok && api.ok;
  if (allOk) {
    console.log('✅ Ready for factory load (~20 users). Run benchmark: node scripts/benchmark-chart-apis.mjs');
  } else {
    console.log('⚠️  Action needed before expecting smooth charts:');
    for (const i of [...db.issues, ...api.issues]) console.log(`   • ${i}`);
    console.log('\n   Fix: powershell -ExecutionPolicy Bypass -File .\\scripts\\factory-post-pull.ps1');
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
