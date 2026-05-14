/**
 * Insert one QA row into machine_line_telemetry (same shape as the API writer, minimal required columns).
 *
 * Usage (from repo root or backend folder):
 *   node backend/scripts/insert-test-machine-line-telemetry.mjs <machineIdOrName> [productName]
 *
 * Examples:
 *   node backend/scripts/insert-test-machine-line-telemetry.mjs GB3 "QA snapshot product"
 *   node backend/scripts/insert-test-machine-line-telemetry.mjs GB-03
 *
 * Requires backend/.env (DB_*). Rows use source = 'manual_test_script' for easy DELETE/WHERE filter.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SOURCE = 'manual_test_script';

async function main() {
  const argId = process.argv[2];
  const productOverride =
    process.argv.length > 3 ? process.argv.slice(3).join(' ').trim() : null;

  if (!argId || argId.startsWith('-')) {
    console.error('Usage: node insert-test-machine-line-telemetry.mjs <machineIdOrName> [productName]');
    process.exit(1);
  }

  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'production_dashboard',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  const client = await pool.connect();
  try {
    const mRes = await client.query(
      `SELECT * FROM machines WHERE id = $1 OR name = $1 LIMIT 1`,
      [argId]
    );
    if (mRes.rows.length === 0) {
      console.error(`No machine found for id/name: ${argId}`);
      process.exit(2);
    }
    const m = mRes.rows[0];
    const productName =
      productOverride && productOverride.length > 0 ? productOverride : m.product_name || 'TEST_PRODUCT';

    const ins = await client.query(
      `INSERT INTO machine_line_telemetry (
         machine_id,
         sampled_at,
         area,
         status,
         line_speed,
         target_speed,
         produced_length,
         produced_length_ok,
         produced_length_ng,
         target_length,
         production_order_id,
         production_order_name,
         material_code,
         product_name,
         operator_name,
         oee,
         availability,
         performance,
         quality,
         performance_data_quality,
         quality_data_quality,
         motor_current,
         power_kw,
         energy_meter_kwh,
         temperature,
         multi_zone_temperatures,
         health_score,
         vibration_level,
         runtime_hours,
         source,
         data_quality_flags
       ) VALUES (
         $1, CURRENT_TIMESTAMP, $2::production_area, $3::machine_status,
         $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
         CAST($25 AS jsonb), $26, $27, $28, $29, $30, 0
       )
       RETURNING telemetry_id, machine_id, sampled_at, product_name, source`,
      [
        m.id,
        m.area,
        m.status || 'idle',
        m.line_speed ?? null,
        m.target_speed ?? null,
        m.produced_length ?? null,
        m.produced_length_ok ?? null,
        m.produced_length_ng ?? null,
        m.target_length ?? null,
        m.production_order_id ?? null,
        m.production_order_name ?? null,
        m.material_code ?? null,
        productName,
        m.operator_name ?? null,
        m.oee ?? null,
        m.availability ?? null,
        m.performance ?? null,
        m.quality ?? null,
        m.performance_data_quality ?? null,
        m.quality_data_quality ?? null,
        m.current ?? null,
        m.power ?? null,
        m.energy_meter_kwh ?? null,
        m.temperature ?? null,
        m.multi_zone_temperatures != null
          ? typeof m.multi_zone_temperatures === 'string'
            ? m.multi_zone_temperatures
            : JSON.stringify(m.multi_zone_temperatures)
          : null,
        m.health_score ?? null,
        m.vibration_level ?? null,
        m.runtime_hours ?? null,
        SOURCE,
      ]
    );

    console.log('OK: inserted machine_line_telemetry row');
    console.log(ins.rows[0]);
    console.log(`Filter: SELECT * FROM machine_line_telemetry WHERE source = '${SOURCE}' ORDER BY sampled_at DESC LIMIT 5;`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
