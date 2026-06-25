#!/usr/bin/env node
/**
 * Report oee_calculations table volume for retention planning.
 * Usage: node backend/scripts/report-oee-calculations-volume.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const envPath of [join(root, '.env'), join(root, 'backend', '.env')]) {
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = t.slice(eq + 1).trim();
  }
}

const { default: pool, query } = await import('../database/connection.js');

async function main() {
  const [size, range, perMachine, week] = await Promise.all([
    query(`SELECT pg_size_pretty(pg_total_relation_size('oee_calculations')) AS total_size`),
    query(`SELECT MIN(calculation_timestamp) AS oldest, MAX(calculation_timestamp) AS newest, COUNT(*)::bigint AS total_rows FROM oee_calculations`),
    query(`
      SELECT machine_id, COUNT(*)::bigint AS rows_7d
      FROM oee_calculations
      WHERE calculation_timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY machine_id
      ORDER BY rows_7d DESC
      LIMIT 10
    `),
    query(`
      SELECT COUNT(*)::bigint AS rows_7d_total
      FROM oee_calculations
      WHERE calculation_timestamp >= NOW() - INTERVAL '7 days'
    `),
  ]);

  console.log('=== oee_calculations volume ===');
  console.log('Table size:', size.rows[0]?.total_size);
  console.log('Row range:', range.rows[0]);
  console.log('Rows last 7d (all machines):', week.rows[0]?.rows_7d_total);
  console.log('\nTop machines (7d):');
  for (const row of perMachine.rows) {
    console.log(`  ${row.machine_id}: ${row.rows_7d}`);
  }
  console.log('\nSee docs/grafana/RETENTION_PLAN.md');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
