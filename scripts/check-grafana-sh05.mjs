#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from '../backend/node_modules/pg/lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const p of ['.env', 'backend/.env']) {
  const path = join(root, p);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const machines = ['SH-05', 'SH-08'];

for (const mid of machines) {
  const [m, stats, recent] = await Promise.all([
    pool.query('SELECT id, name, area, line_speed, status FROM machines WHERE id = $1', [mid]),
    pool.query(
      `SELECT COUNT(*)::int AS cnt_24h,
              COUNT(*) FILTER (WHERE calculation_timestamp >= NOW() - INTERVAL '1 hour')::int AS cnt_1h,
              MAX(calculation_timestamp) AS newest,
              AVG(actual_speed) FILTER (WHERE actual_speed >= 1)::float AS avg_run_speed
       FROM oee_calculations WHERE machine_id = $1
         AND calculation_timestamp >= NOW() - INTERVAL '24 hours'`,
      [mid]
    ),
    pool.query(
      `SELECT calculation_timestamp, actual_speed, target_speed, oee
       FROM oee_calculations WHERE machine_id = $1
       ORDER BY calculation_timestamp DESC LIMIT 3`,
      [mid]
    ),
  ]);
  console.log(`\n=== ${mid} ===`);
  console.log('machines row:', m.rows[0]);
  console.log('oee_calculations:', stats.rows[0]);
  console.log('latest:', recent.rows);
}

// Grafana-like bucket query last 24h
const bucket = await pool.query(
  `SELECT COUNT(*)::int AS buckets
   FROM (
     SELECT to_timestamp(floor(extract(epoch from calculation_timestamp) / 30) * 30) AS bucket
     FROM oee_calculations
     WHERE machine_id = 'SH-05'
       AND calculation_timestamp >= NOW() - INTERVAL '24 hours'
     GROUP BY bucket
   ) t`
);
console.log('\nSH-05 bucket count (30s, 24h):', bucket.rows[0]);

const grafanaWindow = await pool.query(
  `SELECT COUNT(*)::int AS c FROM oee_calculations
   WHERE machine_id = 'SH-05'
     AND calculation_timestamp >= NOW() - INTERVAL '1 hour'`
);
console.log('SH-05 rows last 1h:', grafanaWindow.rows[0]);

const exact = await pool.query(
  `SELECT COUNT(*)::int c FROM oee_calculations
   WHERE calculation_timestamp BETWEEN '2026-06-25T09:35:37.157Z' AND '2026-06-25T10:35:37.167Z'
     AND machine_id = 'SH-05'`
);
console.log('rows in Grafana UTC window:', exact.rows[0]);

const exact2 = await pool.query(
  `SELECT COUNT(*)::int c FROM oee_calculations
   WHERE (calculation_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
     BETWEEN '2026-06-25T09:35:37.157Z' AND '2026-06-25T10:35:37.167Z'
     AND machine_id = 'SH-05'`
);
console.log('rows with ICT→timestamptz fix:', exact2.rows[0]);

const colType = await pool.query(
  `SELECT data_type FROM information_schema.columns
   WHERE table_name = 'oee_calculations' AND column_name = 'calculation_timestamp'`
);
console.log('column type:', colType.rows[0]);

await pool.end();
