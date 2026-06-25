#!/usr/bin/env node
/**
 * Measure PostgreSQL query times equivalent to Grafana POC panels.
 * Uses backend DB connection (loads backend/.env if present).
 *
 * Usage: node scripts/measure-grafana-query-baseline.mjs [--machine SH-08]
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from '../backend/node_modules/pg/lib/index.js';

const { Pool } = pg;

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, 'backend', '.env'));

const MACHINE = process.argv.includes('--machine')
  ? process.argv[process.argv.indexOf('--machine') + 1]
  : null;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'production_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function timedQuery(label, sql, params) {
  const t0 = performance.now();
  const result = await pool.query(sql, params);
  const ms = Math.round(performance.now() - t0);
  return { label, ms, rows: result.rowCount };
}

function getWindows(now = new Date()) {
  const shiftEnd = new Date(now);
  const shiftStart = new Date(now.getTime() - 8 * 3600_000);
  const dayStart = new Date(now.getTime() - 24 * 3600_000);
  const weekStart = new Date(now.getTime() - 7 * 24 * 3600_000);
  return {
    shift: { start: shiftStart, end: shiftEnd, bucket: 30 },
    day: { start: dayStart, end: now, bucket: 30 },
    week: { start: weekStart, end: now, bucket: 300 },
  };
}

const QUERIES = {
  speedAggregate: (bucketSec) => `
    SELECT to_timestamp(floor(extract(epoch from calculation_timestamp) / $4) * $4) AS bucket,
           AVG(actual_speed)::float AS actual_speed,
           AVG(target_speed)::float AS target_speed
    FROM oee_calculations
    WHERE machine_id = $1 AND calculation_timestamp >= $2 AND calculation_timestamp <= $3
    GROUP BY bucket ORDER BY bucket`,
  statusTimeline: `
    SELECT status_start_time, COALESCE(status_end_time, NOW()) AS status_end_time, status
    FROM machine_status_history
    WHERE machine_id = $1 AND status_start_time <= $3 AND COALESCE(status_end_time, NOW()) >= $2
    ORDER BY status_start_time`,
  energyHourly: `
    SELECT hour, energy_kwh FROM energy_consumption
    WHERE machine_id = $1 AND hour >= $2 AND hour <= $3 ORDER BY hour`,
  rowCount: `
    SELECT COUNT(*)::bigint AS c FROM oee_calculations
    WHERE machine_id = $1 AND calculation_timestamp >= $2 AND calculation_timestamp <= $3`,
};

async function main() {
  const machineRes = MACHINE
    ? { rows: [{ id: MACHINE }] }
    : await pool.query('SELECT id FROM machines ORDER BY area, id LIMIT 1');
  const machineId = machineRes.rows[0]?.id;
  if (!machineId) throw new Error('No machine found');

  const now = new Date();
  const windows = getWindows(now);
  const results = [];

  for (const [key, win] of Object.entries(windows)) {
    const scenario = { scenario: key, machineId, ...win, queries: [] };
    for (const [qName, sqlFactory] of [
      ['speed_aggregate', () => QUERIES.speedAggregate(win.bucket)],
      ['status_timeline', () => QUERIES.statusTimeline],
      ['energy_hourly', () => QUERIES.energyHourly],
      ['row_count', () => QUERIES.rowCount],
    ]) {
      const sql = typeof sqlFactory === 'function' ? sqlFactory() : sqlFactory;
      const params =
        qName === 'speed_aggregate'
          ? [machineId, win.start, win.end, win.bucket]
          : [machineId, win.start, win.end];
      const r = await timedQuery(qName, sql, params);
      scenario.queries.push(r);
    }
    scenario.totalMs = scenario.queries.reduce((s, q) => s + q.ms, 0);
    results.push(scenario);
  }

  const baselinePath = join(root, 'docs', 'grafana', 'MES_BASELINE_RESULTS.md');
  let existing = existsSync(baselinePath) ? readFileSync(baselinePath, 'utf8') : '';

  const section = [
    '',
    '## Grafana SQL baseline (direct Postgres)',
    '',
    `Generated: ${now.toISOString()}`,
    `Machine: \`${machineId}\``,
    '',
    '| Scenario | speed_agg (ms) | status (ms) | energy (ms) | count (ms) | **Σ ms** | agg rows |',
    '|----------|----------------|-------------|-------------|------------|----------|----------|',
  ];

  for (const s of results) {
    const byName = Object.fromEntries(s.queries.map((q) => [q.label, q]));
    section.push(
      `| ${s.scenario} | ${byName.speed_aggregate.ms} | ${byName.status_timeline.ms} | ${byName.energy_hourly.ms} | ${byName.row_count.ms} | **${s.totalMs}** | ${byName.speed_aggregate.rows} |`
    );
  }

  section.push('', 'Re-run: `node scripts/measure-grafana-query-baseline.mjs`');

  if (existing.includes('## Grafana SQL baseline')) {
    existing = existing.replace(/\n## Grafana SQL baseline[\s\S]*$/, '');
  }
  writeFileSync(baselinePath, existing + section.join('\n') + '\n', 'utf8');
  console.log(`Updated ${baselinePath}`);
  for (const s of results) {
    console.log(`  ${s.scenario}: ${s.totalMs}ms (SQL panels sum)`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
