/**
 * One-off: add machines.energy_meter_kwh if missing. Optional sample on D-01 only if
 * ENERGY_METER_SAMPLE_D01=<number> is set (avoids overwriting real PLC readings).
 * Run: node scripts/apply-energy-meter-migration.mjs
 */
import dotenv from 'dotenv';
import fs from 'fs';
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

async function main() {
  const sqlPath = path.join(__dirname, '..', 'database', 'migration_add_energy_meter_kwh.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('OK: migration_add_energy_meter_kwh.sql applied (IF NOT EXISTS).');

  // Do NOT overwrite production meter readings by default. Old behavior used 250000.5 on D-01
  // and confused operators when the real PLC value differed.
  const sample = process.env.ENERGY_METER_SAMPLE_D01;
  if (sample === undefined || sample === '') {
    console.log(
      'SKIP: no sample write to D-01. Set ENERGY_METER_SAMPLE_D01=<kWh> to set a one-off test value, or PATCH energyMeterKwh from integration.'
    );
  } else {
    const testKwh = Number.parseFloat(String(sample).trim());
    if (Number.isNaN(testKwh)) {
      console.warn('WARN: ENERGY_METER_SAMPLE_D01 is not a number — skip sample update.');
    } else {
      const up = await pool.query(
        `UPDATE machines SET energy_meter_kwh = $1, last_updated = CURRENT_TIMESTAMP WHERE id = 'D-01' RETURNING id, name, energy_meter_kwh`,
        [testKwh]
      );
      if (up.rowCount === 0) {
        console.warn('WARN: no row id=D-01 — skip test value. Check machine id.');
      } else {
        console.log('OK: D-01 energy_meter_kwh set from ENERGY_METER_SAMPLE_D01:', up.rows[0]);
      }
    }
  }

  const all = await pool.query(
    `SELECT id, name, energy_meter_kwh FROM machines WHERE id = 'D-01'`
  );
  console.log('VERIFY D-01:', all.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
