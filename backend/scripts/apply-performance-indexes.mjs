#!/usr/bin/env node
/**
 * Apply performance indexes from migration_performance_indexes_2026_07.sql.
 * Each CREATE INDEX CONCURRENTLY runs outside a transaction (safe for production).
 *
 * Usage (from repo root):
 *   node backend/scripts/apply-performance-indexes.mjs
 *   node backend/scripts/apply-performance-indexes.mjs --dry-run
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');

const EXPECTED_INDEXES = [
  'idx_machine_metrics_machine_type_time',
  'idx_production_orders_machine_start',
  'idx_prod_len_events_machine_time',
  'idx_availability_agg_machine_type_window',
  'idx_msh_machine_closed_end_start',
  'idx_alarms_machine_timestamp',
  'idx_oee_calc_ts_brin',
  'uq_msh_one_open_per_machine',
];

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'production_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

function extractCreateStatements(sql) {
  const lines = sql.split('\n');
  const stmts = [];
  let buf = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('--')) continue;
    buf += `${line}\n`;
    if (t.endsWith(';')) {
      if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(buf.trim())) stmts.push(buf.trim());
      buf = '';
    }
  }
  return stmts;
}

async function existingIndexes() {
  const res = await pool.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [EXPECTED_INDEXES]
  );
  return new Set(res.rows.map((r) => r.indexname));
}

async function checkOpenStatusDuplicates() {
  const res = await pool.query(`
    SELECT machine_id, count(*)::int AS open_rows
    FROM machine_status_history
    WHERE status_end_time IS NULL
    GROUP BY machine_id
    HAVING count(*) > 1
    ORDER BY open_rows DESC
    LIMIT 20
  `);
  return res.rows;
}

async function main() {
  console.log('Performance index migration');
  console.log(`DB: ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'production_dashboard'}`);
  if (dryRun) console.log('(dry-run — no DDL executed)\n');

  const sqlPath = path.join(__dirname, '..', 'database', 'migration_performance_indexes_2026_07.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = extractCreateStatements(sql);
  if (!statements.length) throw new Error(`No CREATE INDEX statements found in ${sqlPath}`);

  const have = await existingIndexes();
  const missing = statements.filter((s) => {
    const m = s.match(/IF NOT EXISTS\s+(\S+)/i);
    const name = m?.[1];
    return name ? !have.has(name) : true;
  });

  console.log(`Indexes: ${have.size}/${EXPECTED_INDEXES.length} already present, ${missing.length} to apply\n`);

  if (!missing.length) {
    console.log('All performance indexes already exist — running ANALYZE only.');
    if (!dryRun) {
      await pool.query(`
        ANALYZE machine_metrics, production_orders, production_length_events,
                availability_aggregations, machine_status_history, alarms, oee_calculations
      `);
      console.log('ANALYZE complete.');
    }
    await pool.end();
    return;
  }

  const dupes = await checkOpenStatusDuplicates();
  const needsUnique = missing.some((s) => s.includes('uq_msh_one_open_per_machine'));
  if (needsUnique && dupes.length) {
    console.error('❌ Cannot create uq_msh_one_open_per_machine — duplicate OPEN status rows:');
    for (const row of dupes) {
      console.error(`   machine_id=${row.machine_id} open_rows=${row.open_rows}`);
    }
    console.error('\nClean up first (example — review before running on production):');
    console.error(`   SELECT machine_id, id, status_start_time FROM machine_status_history
     WHERE status_end_time IS NULL AND machine_id = '<id>' ORDER BY status_start_time;`);
    await pool.end();
    process.exit(1);
  }

  for (let i = 0; i < missing.length; i += 1) {
    const stmt = missing[i];
    const nameMatch = stmt.match(/IF NOT EXISTS\s+(\S+)/i);
    const name = nameMatch?.[1] ?? `statement-${i + 1}`;
    console.log(`[${i + 1}/${missing.length}] ${name}`);
    if (dryRun) {
      console.log(`   ${stmt.replace(/\s+/g, ' ').slice(0, 100)}...`);
      continue;
    }
    const t0 = Date.now();
    await pool.query(stmt);
    console.log(`   OK (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  if (!dryRun) {
    console.log('\nRunning ANALYZE on affected tables...');
    await pool.query(`
      ANALYZE machine_metrics, production_orders, production_length_events,
              availability_aggregations, machine_status_history, alarms, oee_calculations
    `);
    console.log('ANALYZE complete.');
    const after = await existingIndexes();
    const stillMissing = EXPECTED_INDEXES.filter((n) => !after.has(n));
    if (stillMissing.length) {
      console.warn('⚠️  Still missing:', stillMissing.join(', '));
    } else {
      console.log(`✅ All ${EXPECTED_INDEXES.length} performance indexes present.`);
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});
