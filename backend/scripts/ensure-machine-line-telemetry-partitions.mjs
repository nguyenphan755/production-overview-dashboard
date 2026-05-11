/**
 * Ensure monthly partitions exist for machine_line_telemetry (current month + next N months).
 * Run via cron monthly or weekly: node scripts/ensure-machine-line-telemetry-partitions.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'production_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const MONTHS_AHEAD = parseInt(process.env.TELEMETRY_PARTITION_MONTHS_AHEAD || '3', 10);

function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1, 0, 0, 0, 0);
}

/** YYYY-MM-DD for partition bounds (local calendar date from JS Date). */
function toPgDateLiteral(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

async function main() {
  const client = await pool.connect();
  try {
    const now = new Date();
    const base = monthStart(now);
    for (let i = 0; i <= MONTHS_AHEAD; i += 1) {
      const pStart = addMonths(base, i);
      const pEnd = addMonths(base, i + 1);
      const y = pStart.getFullYear();
      const m = String(pStart.getMonth() + 1).padStart(2, '0');
      const partName = `machine_line_telemetry_y${y}m${m}`;
      if (!/^machine_line_telemetry_y\d{4}m\d{2}$/.test(partName)) {
        throw new Error(`Invalid partition name: ${partName}`);
      }
      // DDL partition bounds do not accept bind parameters reliably; use literals from controlled dates.
      const fromLit = toPgDateLiteral(pStart);
      const toLit = toPgDateLiteral(pEnd);
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF machine_line_telemetry
         FOR VALUES FROM ('${fromLit}'::timestamp) TO ('${toLit}'::timestamp)`
      );
      console.log(`OK partition ${partName} ${fromLit} .. ${toLit}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
