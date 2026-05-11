/**
 * Apply migration_machine_line_telemetry_partitioned.sql
 * Run: node scripts/apply-machine-line-telemetry-migration.mjs
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
  const sqlPath = path.join(__dirname, '..', 'database', 'migration_machine_line_telemetry_partitioned.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('OK: migration_machine_line_telemetry_partitioned.sql applied.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
