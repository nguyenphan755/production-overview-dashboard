/**
 * One-off: apply energy telemetry schema for 5-second sampling.
 * Run: node scripts/apply-energy-telemetry-migration.mjs
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
  const sqlPath = path.join(__dirname, '..', 'database', 'migration_add_energy_telemetry_5s.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('OK: migration_add_energy_telemetry_5s.sql applied.');

  const verify = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'energy_consumption'
       AND column_name IN ('power_kw', 'material_code', 'product_name', 'machine_status', 'kwh_per_100m', 'sample_count')
     ORDER BY column_name`
  );
  console.log('VERIFY energy_consumption columns:', verify.rows.map((r) => r.column_name));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
