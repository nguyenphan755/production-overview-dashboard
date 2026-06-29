#!/usr/bin/env node
/**
 * Verify Grafana → Postgres and sample dashboard queries.
 * Usage: node scripts/diagnose-grafana-postgres.mjs [--grafana-url http://localhost:3002] [--machine SH-05]
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  const opts = { grafanaUrl: 'http://localhost:3002', machine: 'SH-05' };
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--grafana-url') opts.grafanaUrl = process.argv[++i];
    else if (process.argv[i] === '--machine') opts.machine = process.argv[++i];
  }
  return opts;
}

async function grafanaQuery(baseUrl, rawSql, format = 'table', rangeMs = 24 * 3600_000) {
  const auth = Buffer.from('admin:admin').toString('base64');
  const to = Date.now();
  const from = to - rangeMs;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ds/query`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: String(from),
      to: String(to),
      queries: [
        {
          refId: 'A',
          format,
          rawSql,
          datasource: { type: 'postgres', uid: 'mes-postgres' },
        },
      ],
    }),
  });
  const json = await res.json();
  const r = json.results?.A;
  if (!r || r.error) throw new Error(r?.error || `HTTP ${res.status}`);
  return r.frames?.[0];
}

async function main() {
  const opts = parseArgs();
  const grafanaEnv = loadEnv(join(root, 'grafana', '.env'));
  const baseUrl = opts.grafanaUrl || grafanaEnv.GRAFANA_URL || 'http://localhost:3002';
  const machine = opts.machine;

  console.log('═══════════════════════════════════════════');
  console.log(' Grafana ↔ Postgres diagnostic');
  console.log('═══════════════════════════════════════════');
  console.log(` Grafana:  ${baseUrl}`);
  console.log(` Machine:  ${machine}`);
  console.log('');

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    console.log(health.ok ? '✅ Grafana health OK' : `❌ Grafana health HTTP ${health.status}`);
  } catch (e) {
    console.error(`❌ Cannot reach Grafana: ${e.message}`);
    process.exit(1);
  }

  const dsRes = await fetch(`${baseUrl}/api/datasources/uid/mes-postgres`, {
    headers: { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` },
  });
  if (!dsRes.ok) {
    console.error('❌ Datasource mes-postgres not found — run: node scripts/render-grafana-datasource.mjs && docker restart mes-grafana-poc');
    process.exit(1);
  }
  const ds = await dsRes.json();
  console.log(`✅ Datasource: ${ds.name} → ${ds.url} db=${ds.jsonData?.database}`);

  const TS = `(calculation_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`;
  const tests = [
    {
      label: 'Samples in range (COUNT)',
      format: 'table',
      sql: `SELECT COUNT(*)::bigint AS n FROM oee_calculations WHERE machine_id='${machine}' AND $__timeFilter(${TS})`,
    },
    {
      label: 'Peak speed (MAX)',
      format: 'table',
      sql: `SELECT COALESCE(MAX(actual_speed), 0) AS peak FROM oee_calculations WHERE machine_id='${machine}' AND $__timeFilter(${TS})`,
    },
    {
      label: 'Speed trend (bucket 30s, UTC-aligned)',
      format: 'time_series',
      sql: `SELECT to_timestamp(floor(extract(epoch from ${TS}) / 30) * 30) AS time,
        AVG(actual_speed) AS "Actual speed"
       FROM oee_calculations
       WHERE $__timeFilter(${TS}) AND machine_id='${machine}'
       GROUP BY 1 ORDER BY 1`,
    },
  ];

  for (const t of tests) {
    try {
      const frame = await grafanaQuery(baseUrl, t.sql, t.format);
      const fields = frame?.schema?.fields?.map((f) => f.name) ?? [];
      const n = frame?.data?.values?.[0]?.length ?? 0;
      const preview = frame?.data?.values?.map((col) => col.slice(0, 2));
      console.log(`✅ ${t.label}: fields=[${fields.join(', ')}] rows=${n} sample=${JSON.stringify(preview)}`);
    } catch (e) {
      console.log(`❌ ${t.label}: ${e.message}`);
    }
  }

  console.log('\nNếu COUNT > 0 nhưng trend = 0 rows → đổi time range trên dashboard (Last 24h).');
  console.log('Nếu tất cả ❌ connection → kiểm tra backend/.env DB_PASSWORD + Postgres listen + host.docker.internal');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
