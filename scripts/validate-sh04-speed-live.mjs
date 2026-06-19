#!/usr/bin/env node
/** Live API/DB validation for SH-04 speed-history vs OEE Ca 1 window */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../backend');
process.chdir(backendRoot);
await import('dotenv/config');
const { query } = await import(pathToFileURL(path.join(backendRoot, 'database/connection.js')).href);

const MACHINE = 'SH-04';
const START = '2026-06-12T06:00:00+07:00';
const END = '2026-06-12T14:00:00+07:00';
const BUCKET = 30;

async function main() {
  const countRes = await query(
    `SELECT COUNT(*)::int AS n FROM oee_calculations
     WHERE machine_id = $1
       AND calculation_timestamp >= $2::timestamptz
       AND calculation_timestamp <= $3::timestamptz`,
    [MACHINE, START, END]
  );
  const rawCount = countRes.rows[0]?.n ?? 0;

  const bucketRes = await query(
    `SELECT
       to_timestamp(floor(extract(epoch from calculation_timestamp) / $4) * $4) AS bucket,
       AVG(actual_speed)::float AS actual_speed
     FROM oee_calculations
     WHERE machine_id = $1
       AND calculation_timestamp >= $2::timestamptz
       AND calculation_timestamp <= $3::timestamptz
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [MACHINE, START, END, BUCKET]
  );

  const buckets = bucketRes.rows;
  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  const downtime = buckets.filter((b) => {
    const ms = new Date(b.bucket).getTime();
    const s = new Date('2026-06-12T12:10:00+07:00').getTime();
    const e = new Date('2026-06-12T12:32:00+07:00').getTime();
    return ms >= s && ms < e;
  });
  const dtAvg =
    downtime.length > 0
      ? downtime.reduce((a, b) => a + Number(b.actual_speed), 0) / downtime.length
      : null;

  const recovery = buckets.filter((b) => {
    const ms = new Date(b.bucket).getTime();
    return ms >= new Date('2026-06-12T12:45:00+07:00').getTime();
  });
  const recAvg =
    recovery.length > 0
      ? recovery.reduce((a, b) => a + Number(b.actual_speed), 0) / recovery.length
      : null;

  console.log('\n=== SH-04 Live DB speed-history validation ===\n');
  console.log(`Raw rows in window: ${rawCount}`);
  console.log(`Buckets (${BUCKET}s): ${buckets.length}`);
  console.log(`First bucket: ${first?.bucket} speed=${first?.actual_speed}`);
  console.log(`Last bucket:  ${last?.bucket} speed=${last?.actual_speed}`);
  console.log(`Downtime avg (12:10–12:32): ${dtAvg?.toFixed(2) ?? 'n/a'} m/min`);
  console.log(`Recovery avg (12:45+): ${recAvg?.toFixed(2) ?? 'n/a'} m/min`);

  const ok =
    rawCount > 20000 &&
    buckets.length >= 900 &&
    Number(first?.actual_speed) > 0 &&
    dtAvg != null &&
    dtAvg < 1 &&
    recAvg != null &&
    recAvg >= 30;

  console.log(`\n${ok ? 'PASS' : 'FAIL'} — Live DB matches CSV expectations\n`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('DB validation skipped/failed:', err.message);
  process.exit(2);
});
