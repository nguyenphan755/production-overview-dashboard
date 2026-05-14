/**
 * Backfill machine_line_telemetry from MES/Excel export CSV:
 *   machine_name,sampled_at,material_code,material_description
 * sampled_at format: DD/MM/YYYY HH:mm (wall clock Vietnam +07 by default).
 *
 * Usage:
 *   node scripts/import-machine-material-timeseries-csv.mjs "C:\\path\\machine_material_timeseries.csv"
 *   node scripts/import-machine-material-timeseries-csv.mjs ./data.csv --dry-run
 *   node scripts/import-machine-material-timeseries-csv.mjs ./data.csv --full --replace
 *
 * Flags:
 *   --dry-run          Parse + map only, no INSERT/DELETE
 *   --full             Insert every CSV row (default: sparse = only rows where material_code changes per machine)
 *   --replace          DELETE existing rows with source=csv_import_mes in [min_ts, max_ts) from file, then insert
 *   --upsert-material  Upsert material_master from CSV (code + description)
 *   --batch=N          Rows per INSERT (default 800)
 *   --map=path.json    Optional: { "CSV machine_name": "machines.name in DB" } for mismatched labels
 *   --mes-alias        Try common MES→DB name aliases (Bọc 150-1→150-1, KÉO LHT1→LHT-1, XOẮN 54-1→54-1, …)
 *
 * Before first May–2026 import on a fresh DB, run:
 *   npm run ensure-telemetry-partitions
 *
 * Env:
 *   IMPORT_CSV_TZ_OFFSET=+07:00   (default) wall time for parsed timestamps
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SOURCE_TAG = 'csv_import_mes';

function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  const opts = { batch: 800, tzOffset: process.env.IMPORT_CSV_TZ_OFFSET || '+07:00', mapPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') flags.add('dry-run');
    else if (a === '--full') flags.add('full');
    else if (a === '--replace') flags.add('replace');
    else if (a === '--upsert-material') flags.add('upsert-material');
    else if (a === '--mes-alias') flags.add('mes-alias');
    else if (a.startsWith('--batch=')) opts.batch = parseInt(a.slice('--batch='.length), 10) || 800;
    else if (a.startsWith('--tz=')) opts.tzOffset = a.slice('--tz='.length);
    else if (a.startsWith('--map=')) opts.mapPath = a.slice('--map='.length);
    else if (!a.startsWith('-')) positional.push(a);
  }
  return { csvPath: positional[0], flags, opts };
}

function normName(s) {
  return String(s || '')
    .trim()
    .normalize('NFC');
}

/** Minimal CSV row split (supports quoted fields). */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * "08/05/2026 00:00" -> Date interpreted as wall time in IMPORT_CSV_TZ_OFFSET.
 */
function parseSampledAt(raw, tzOffset) {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const yyyy = m[3];
  const hh = m[4].padStart(2, '0');
  const mi = m[5];
  const iso = `${yyyy}-${mo}-${dd}T${hh}:${mi}:00${tzOffset}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Extra lookup keys for typical CADIVI/MES labels vs short names in `machines.name`.
 * Used only with --mes-alias (after --map and exact name).
 */
function mesAliasCandidates(displayName) {
  const c = normName(displayName);
  const keys = [];
  const add = (k) => {
    const v = normName(k);
    if (v && !keys.includes(v)) keys.push(v);
  };

  const keo = /^K\u00C9O\s+(.+)$/iu.exec(c);
  if (keo) {
    const tail = normName(keo[1]).replace(/\s+/g, '');
    if (/^DA$/i.test(tail)) add('DA13');
    if (/^LHT1$/i.test(tail)) add('LHT-1');
    if (/^LHT2$/i.test(tail)) add('LHT-2');
    if (/^LHD$/i.test(tail)) add('LHD450');
    if (/^LSD$/i.test(tail)) add('LSD');
  }

  const xoan = /^XO\u1EAEN\s+(.+)$/iu.exec(c);
  if (xoan) {
    const rest = normName(xoan[1]);
    add(rest);
    const slash = /^7\/630-(\d)$/i.exec(rest);
    if (slash) add(`7-630.${slash[1]}`);
  }

  const gb = /^Giap\s+bang\s+(\d+)$/i.exec(c);
  if (gb) add(`GB-${gb[1]}`);

  if (/^GB\s*4$/i.test(c)) add('GB-4');
  if (/^GB4$/i.test(c)) add('GB-4');

  const boc = /^B\u1ECDc\s+(.+)$/iu.exec(c) || /^Boc\s+(.+)$/i.exec(c);
  if (boc) {
    let rest = normName(boc[1]);
    add(rest);
    const compact = rest.replace(/\s+/g, '');
    if (/^CCV[\s-]*Line$/i.test(rest)) add('CCVL');
    if (/^65LT$/i.test(compact)) {
      add('65 LT');
      add('65-LT');
    }
    if (/^75-C$/i.test(rest) || /^75C$/i.test(compact)) add('75C');
  }

  return keys;
}

function resolveMachineRow(csvNormName, nameMap, nameToMachine, useMesAlias) {
  const mapped = nameMap[csvNormName];
  const primary = normName(mapped != null ? String(mapped) : csvNormName);
  const chain = [primary];
  if (useMesAlias) {
    for (const k of mesAliasCandidates(csvNormName)) {
      if (!chain.includes(k)) chain.push(k);
    }
    for (const k of mesAliasCandidates(primary)) {
      if (!chain.includes(k)) chain.push(k);
    }
  }
  for (const key of chain) {
    const m = nameToMachine.get(key);
    if (m) return { m, matchedKey: key };
  }
  return null;
}

async function main() {
  const { csvPath, flags, opts } = parseArgs(process.argv);
  if (!csvPath) {
    console.error(
      'Usage: node scripts/import-machine-material-timeseries-csv.mjs <path-to.csv> [--dry-run] [--full] [--replace] [--upsert-material] [--mes-alias] [--map=names.json]'
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  let nameMap = {};
  if (opts.mapPath) {
    const mp = path.isAbsolute(opts.mapPath) ? opts.mapPath : path.resolve(process.cwd(), opts.mapPath);
    if (!fs.existsSync(mp)) {
      console.error(`Map file not found: ${mp}`);
      process.exit(1);
    }
    nameMap = JSON.parse(fs.readFileSync(mp, 'utf8'));
    if (typeof nameMap !== 'object' || nameMap === null) {
      console.error('--map JSON must be an object');
      process.exit(1);
    }
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
    const { rows: machineRows } = await client.query(
      `SELECT id, name, area::text AS area FROM machines`
    );
    const nameToMachine = new Map();
    for (const r of machineRows) {
      nameToMachine.set(normName(r.name), { id: r.id, area: r.area });
    }

    const { rows: mmRows } = await client.query(
      `SELECT material_code, material_name FROM material_master`
    );
    const materialNameByCode = new Map(mmRows.map((r) => [String(r.material_code).trim(), r.material_name]));

    const rl = readline.createInterface({
      input: fs.createReadStream(abs, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let lineNo = 0;
    const parsed = [];
    for await (const line of rl) {
      lineNo += 1;
      if (lineNo === 1) {
        const h = splitCsvLine(line).map((x) => normName(x).toLowerCase());
        const exp = ['machine_name', 'sampled_at', 'material_code', 'material_description'];
        if (h.length < 4 || h[0] !== exp[0] || h[1] !== exp[1] || h[2] !== exp[2] || h[3] !== exp[3]) {
          console.warn('Unexpected header (continuing anyway):', line);
        }
        continue;
      }
      if (!line.trim()) continue;
      const parts = splitCsvLine(line);
      if (parts.length < 4) {
        console.warn(`Line ${lineNo}: expected 4 columns, got ${parts.length}`);
        continue;
      }
      const machine_name = parts[0];
      const sampledRaw = parts[1];
      const material_code = String(parts[2] || '').trim();
      const material_description = String(parts[3] || '').trim();
      const sampled_at = parseSampledAt(sampledRaw, opts.tzOffset);
      if (!sampled_at) {
        console.warn(`Line ${lineNo}: bad sampled_at "${sampledRaw}"`);
        continue;
      }
      parsed.push({
        machine_name: normName(machine_name),
        sampled_at,
        material_code,
        material_description,
      });
    }

    parsed.sort((a, b) => {
      const c = a.machine_name.localeCompare(b.machine_name, 'vi');
      if (c !== 0) return c;
      return a.sampled_at.getTime() - b.sampled_at.getTime();
    });

    const unmappedMachines = new Set();
    const rowsOut = [];
    let lastKey = '';
    let lastCode = null;

    const useMesAlias = flags.has('mes-alias');
    for (const r of parsed) {
      const hit = resolveMachineRow(r.machine_name, nameMap, nameToMachine, useMesAlias);
      if (!hit) {
        unmappedMachines.add(r.machine_name);
        continue;
      }
      const { m } = hit;
      const code = r.material_code || null;
      const fromMaster = code ? materialNameByCode.get(code) : null;
      const product_name = (fromMaster || r.material_description || '').trim() || null;

      const sparse = !flags.has('full');
      const key = `${m.id}\t${r.machine_name}`;
      if (sparse) {
        if (key !== lastKey) {
          lastKey = key;
          lastCode = null;
        }
        if (code === lastCode && lastCode !== null) continue;
        lastCode = code;
      }

      rowsOut.push({
        machine_id: m.id,
        area: m.area,
        sampled_at: r.sampled_at,
        material_code: code,
        product_name,
      });
    }

    console.log(`Parsed CSV lines (data): ${parsed.length}`);
    console.log(`Rows to insert (${flags.has('full') ? 'full' : 'sparse'}): ${rowsOut.length}`);
    if (unmappedMachines.size) {
      console.warn(
        `Unmapped machine_name (not in machines.name), skipped rows for:`,
        [...unmappedMachines].sort((a, b) => a.localeCompare(b, 'vi'))
      );
    }

    if (rowsOut.length === 0) {
      console.error('Nothing to insert: no CSV machine_name matched machines.name.');
      if (!flags.has('mes-alias')) {
        console.error('Hint: retry with --mes-alias if your DB uses short names (e.g. 150-1) but CSV uses MES labels (e.g. Bọc 150-1).');
      } else {
        console.error('Hint: add --map=names.json { "CSV name": "exact machines.name" } for remaining lines.');
      }
      const { rows: allNames } = await client.query(
        `SELECT name FROM machines ORDER BY area::text, name`
      );
      console.error('Current machines.name in DB:', allNames.map((r) => r.name).join(', '));
      process.exit(2);
    }

    if (flags.has('upsert-material') && !flags.has('dry-run')) {
      const byCode = new Map();
      for (const r of parsed) {
        if (!r.material_code) continue;
        const desc = r.material_description?.trim();
        if (!desc) continue;
        byCode.set(r.material_code.trim(), desc);
      }
      await client.query('BEGIN');
      try {
        for (const [material_code, material_name] of byCode) {
          await client.query(
            `INSERT INTO material_master (material_code, material_name)
             VALUES ($1, $2)
             ON CONFLICT (material_code) DO UPDATE
             SET material_name = EXCLUDED.material_name, updated_at = CURRENT_TIMESTAMP`,
            [material_code, material_name]
          );
        }
        await client.query('COMMIT');
        console.log(`Upserted material_master: ${byCode.size} codes`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    const tMin = new Date(Math.min(...rowsOut.map((r) => r.sampled_at.getTime())));
    const tMax = new Date(Math.max(...rowsOut.map((r) => r.sampled_at.getTime())));

    if (flags.has('replace') && !flags.has('dry-run')) {
      const del = await client.query(
        `DELETE FROM machine_line_telemetry
         WHERE source = $1 AND sampled_at >= $2 AND sampled_at <= $3`,
        [SOURCE_TAG, tMin, tMax]
      );
      console.log(`Deleted prior ${SOURCE_TAG} rows in range: ${del.rowCount}`);
    }

    if (flags.has('dry-run')) {
      console.log('Dry run — no inserts. Sample rows:');
      for (const s of rowsOut.slice(0, 5)) {
        console.log(
          JSON.stringify({
            machine_id: s.machine_id,
            sampled_at: s.sampled_at.toISOString(),
            material_code: s.material_code,
            product_name: s.product_name,
            area: s.area,
          })
        );
      }
      return;
    }

    const batch = Math.max(50, Math.min(2000, opts.batch));
    let inserted = 0;
    for (let i = 0; i < rowsOut.length; i += batch) {
      const chunk = rowsOut.slice(i, i + batch);
      const values = [];
      const params = [];
      let p = 1;
      for (const r of chunk) {
        values.push(
          `($${p++},$${p++},$${p++}::production_area,$${p++}::machine_status,$${p++},$${p++},$${p++})`
        );
        params.push(
          r.machine_id,
          r.sampled_at,
          r.area,
          'idle',
          r.material_code,
          r.product_name,
          SOURCE_TAG
        );
      }
      const sql = `
        INSERT INTO machine_line_telemetry (
          machine_id, sampled_at, area, status,
          material_code, product_name, source
        ) VALUES ${values.join(',')}`;
      const res = await client.query(sql, params);
      inserted += res.rowCount ?? chunk.length;
    }
    console.log(`Inserted rows: ${inserted}`);
    console.log(`Time range: ${tMin.toISOString()} .. ${tMax.toISOString()}`);
    console.log(`source column: ${SOURCE_TAG} (filter or DELETE if you re-import)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
