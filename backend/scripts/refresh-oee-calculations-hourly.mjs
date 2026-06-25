#!/usr/bin/env node
/**
 * Incremental refresh of oee_calculations_hourly from raw data.
 * Usage: node backend/scripts/refresh-oee-calculations-hourly.mjs [--hours 48]
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

const hoursBack = process.argv.includes('--hours')
  ? parseInt(process.argv[process.argv.indexOf('--hours') + 1], 10)
  : 48;

async function main() {
  const result = await query(
    `INSERT INTO oee_calculations_hourly (
       machine_id, hour_start,
       avg_actual_speed, max_actual_speed, avg_target_speed,
       avg_oee, avg_availability, avg_performance, avg_quality,
       sample_count, updated_at
     )
     SELECT
       machine_id,
       date_trunc('hour', calculation_timestamp) AS hour_start,
       AVG(actual_speed)::decimal(10,2),
       MAX(actual_speed)::decimal(10,2),
       AVG(target_speed)::decimal(10,2),
       AVG(oee)::decimal(5,2),
       AVG(availability)::decimal(5,2),
       AVG(performance)::decimal(5,2),
       AVG(quality)::decimal(5,2),
       COUNT(*)::int,
       NOW()
     FROM oee_calculations
     WHERE calculation_timestamp >= NOW() - ($1::text || ' hours')::interval
     GROUP BY machine_id, date_trunc('hour', calculation_timestamp)
     ON CONFLICT (machine_id, hour_start) DO UPDATE SET
       avg_actual_speed = EXCLUDED.avg_actual_speed,
       max_actual_speed = EXCLUDED.max_actual_speed,
       avg_target_speed = EXCLUDED.avg_target_speed,
       avg_oee = EXCLUDED.avg_oee,
       avg_availability = EXCLUDED.avg_availability,
       avg_performance = EXCLUDED.avg_performance,
       avg_quality = EXCLUDED.avg_quality,
       sample_count = EXCLUDED.sample_count,
       updated_at = NOW()`,
    [String(hoursBack)]
  );
  console.log(`Refreshed hourly rollup (last ${hoursBack}h): ${result.rowCount} rows touched`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
