/**
 * Read first sheet of .xlsx / .xls, write a UTF-8 CSV next to the import script expectations,
 * then run import-machine-material-timeseries-csv.mjs (same flags).
 *
 * Sheet must have header row: machine_name, sampled_at, material_code, material_description
 * (same as CSV). Excel date/time cells become DD/MM/YYYY HH:mm in Asia/Ho_Chi_Minh.
 *
 * Usage:
 *   npm run import-machine-material-xlsx -- "C:\\data\\lich_su.xlsx" --full --mes-alias --upsert-material
 *   node scripts/import-machine-material-timeseries-xlsx.mjs ./file.xlsx --dry-run
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import readXlsxFile from 'read-excel-file';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Excel serial (days) → Date (UTC midnight of that calendar day + fraction for time). */
function excelSerialToDate(serial) {
  const whole = Math.floor(serial);
  const frac = serial - whole;
  const ms = (whole - 25569) * 86400000 + Math.round(frac * 86400000);
  return new Date(ms);
}

function formatDdMmYyyyHhMm(d) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.IMPORT_CSV_TZ || 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
}

function cellToSampledAtString(cell) {
  if (cell == null || cell === '') return '';
  if (cell instanceof Date) return formatDdMmYyyyHhMm(cell);
  if (typeof cell === 'number' && !Number.isNaN(cell)) return formatDdMmYyyyHhMm(excelSerialToDate(cell));
  return String(cell).trim();
}

function parseArgs(argv) {
  const positional = [];
  const forward = [];
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('-')) forward.push(a);
    else if (!positional.length) positional.push(a);
    else forward.push(a);
  }
  return { xlsxPath: positional[0] || null, forward };
}

async function xlsxToTempCsv(absXlsx) {
  const rows = await readXlsxFile(fs.createReadStream(absXlsx));
  if (!rows.length) throw new Error('Excel file has no rows');

  const headerNorm = rows[0].map((c) => String(c ?? '').trim().toLowerCase());
  const need = ['machine_name', 'sampled_at', 'material_code', 'material_description'];
  const idx = {};
  for (const h of need) {
    const i = headerNorm.indexOf(h);
    if (i < 0) throw new Error(`Missing column "${h}" in first row. Found: ${headerNorm.join(', ')}`);
    idx[h] = i;
  }

  const lines = [need.join(',')];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const machine_name = String(row[idx.machine_name] ?? '').trim();
    const sampled_at = cellToSampledAtString(row[idx.sampled_at]);
    const material_code = String(row[idx.material_code] ?? '').trim();
    const material_description = String(row[idx.material_description] ?? '').trim();
    if (!machine_name && !sampled_at && !material_code && !material_description) continue;
    lines.push(
      [csvEscape(machine_name), csvEscape(sampled_at), csvEscape(material_code), csvEscape(material_description)].join(
        ','
      )
    );
  }

  const tmp = path.join(os.tmpdir(), `mlt-import-${Date.now()}.csv`);
  fs.writeFileSync(tmp, lines.join('\n'), 'utf8');
  return tmp;
}

async function main() {
  const { xlsxPath, forward } = parseArgs(process.argv);
  if (!xlsxPath) {
    console.error(
      'Usage: node scripts/import-machine-material-timeseries-xlsx.mjs <path.xlsx> [-- same flags as csv import --]'
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(xlsxPath) ? xlsxPath : path.resolve(process.cwd(), xlsxPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  let tmp;
  try {
    tmp = await xlsxToTempCsv(abs);
    console.log(`Wrote temp CSV: ${tmp}`);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  const csvScript = path.join(__dirname, 'import-machine-material-timeseries-csv.mjs');
  const node = process.execPath;
  const args = [csvScript, tmp, ...forward];
  console.log('Running:', node, args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' '));

  const r = spawnSync(node, args, { stdio: 'inherit', env: process.env });
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
