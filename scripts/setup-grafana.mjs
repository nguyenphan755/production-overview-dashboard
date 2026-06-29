#!/usr/bin/env node
/**
 * One-shot Grafana setup for MES (Docker POC — same stack as mes-grafana-poc).
 *
 * Usage (from repo root):
 *   node scripts/setup-grafana.mjs
 *   node scripts/setup-grafana.mjs --db-host 192.168.1.50
 *   node scripts/setup-grafana.mjs --grafana-port 3002 --admin-password MySecret
 *
 * Windows shortcut:
 *   powershell -ExecutionPolicy Bypass -File scripts/setup-grafana.ps1
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    dbHost: null,
    dbPort: null,
    grafanaPort: null,
    adminPassword: null,
    skipDocker: false,
    skipBuild: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--skip-docker') opts.skipDocker = true;
    else if (a === '--skip-build') opts.skipBuild = true;
    else if (a === '--db-host') opts.dbHost = argv[++i];
    else if (a === '--db-port') opts.dbPort = argv[++i];
    else if (a === '--grafana-port') opts.grafanaPort = argv[++i];
    else if (a === '--admin-password') opts.adminPassword = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function run(cmd, args, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? 'unknown'})`);
  }
}

function commandExists(name) {
  const check = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(check, [name], { stdio: 'ignore', shell: process.platform === 'win32' });
  return r.status === 0;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function upsertEnvFile(path, updates) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const map = loadEnvFile(path);
  Object.assign(map, updates);
  const keysWritten = new Set();
  const next = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) return line;
    const key = t.slice(0, t.indexOf('=')).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      keysWritten.add(key);
      return `${key}=${map[key]}`;
    }
    return line;
  });
  for (const [key, val] of Object.entries(updates)) {
    if (!keysWritten.has(key)) next.push(`${key}=${val}`);
  }
  writeFileSync(path, `${next.filter((l, i, arr) => !(i === arr.length - 1 && l === '')).join('\n')}\n`, 'utf8');
}

async function waitForGrafana(url, maxSec = 90) {
  const deadline = Date.now() + maxSec * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function printHelp() {
  console.log(`
MES Grafana — automatic setup

Prerequisites:
  - Docker Desktop running
  - Node.js 18+
  - Repo cloned; backend/.env has DB_* (or pass --db-host)

Commands:
  node scripts/setup-grafana.mjs [options]

Options:
  --db-host <ip>         Postgres host (PC chạy DB). Ví dụ: 192.168.1.100
  --db-port <port>       Postgres port (default 5432)
  --grafana-port <port>  Grafana UI port (default 3000)
  --admin-password <pw>  Grafana admin password (default: admin)
  --skip-docker          Chỉ render config + build JSON, không start container
  --skip-build           Không chạy build-grafana-dashboards.mjs
  -h, --help             Hiện trợ giúp

Sau khi chạy:
  - Grafana: http://localhost:<port>
  - MES frontend: thêm VITE_GRAFANA_URL=http://<ip-pc-grafana>:<port>
`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return;
  }

  console.log('═══════════════════════════════════════════');
  console.log(' MES Grafana — automatic setup');
  console.log('═══════════════════════════════════════════');

  if (!commandExists('node')) {
    console.error('❌ Node.js not found. Install Node 18+ first.');
    process.exit(1);
  }

  if (!opts.skipDocker && !commandExists('docker')) {
    console.error('❌ Docker not found. Install Docker Desktop and ensure it is running.');
    process.exit(1);
  }

  const grafanaEnvPath = join(root, 'grafana', '.env');
  const examplePath = join(root, 'grafana', '.env.example');
  if (!existsSync(grafanaEnvPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, grafanaEnvPath);
    console.log('✅ Created grafana/.env from .env.example');
  }

  const envUpdates = {};
  if (opts.dbHost) envUpdates.GRAFANA_PG_HOST = opts.dbHost;
  if (opts.dbPort) envUpdates.GRAFANA_PG_PORT = opts.dbPort;
  if (opts.grafanaPort) envUpdates.GRAFANA_PORT = opts.grafanaPort;
  if (opts.adminPassword) envUpdates.GRAFANA_ADMIN_PASSWORD = opts.adminPassword;

  if (Object.keys(envUpdates).length > 0) {
    upsertEnvFile(grafanaEnvPath, envUpdates);
    console.log('✅ Updated grafana/.env:', Object.keys(envUpdates).join(', '));
  }

  const backendEnv = loadEnvFile(join(root, 'backend', '.env'));
  const grafanaEnv = loadEnvFile(grafanaEnvPath);
  const dbPassword = grafanaEnv.GRAFANA_PG_PASSWORD || backendEnv.DB_PASSWORD;
  if (!dbPassword && !opts.skipDocker) {
    console.warn('⚠️  DB_PASSWORD chưa có trong backend/.env — datasource có thể lỗi.');
    console.warn('   Sửa backend/.env hoặc thêm GRAFANA_PG_PASSWORD vào grafana/.env');
  }

  run('node', ['scripts/render-grafana-datasource.mjs'], 'Render Postgres datasource');

  if (!opts.skipBuild) {
    run('node', ['scripts/build-grafana-dashboards.mjs'], 'Build dashboard JSON');
  }

  if (opts.skipDocker) {
    console.log('\n✅ Config ready (--skip-docker). Start manually:');
    console.log('   docker compose -f docker-compose.grafana.yml up -d');
    return;
  }

  run(
    'docker',
    ['compose', '-f', 'docker-compose.grafana.yml', 'up', '-d', '--force-recreate'],
    'Start Grafana container (mes-grafana-poc)'
  );

  const port = opts.grafanaPort || grafanaEnv.GRAFANA_PORT || '3000';
  const baseUrl = `http://localhost:${port}`;
  console.log(`\n⏳ Waiting for Grafana at ${baseUrl} ...`);
  const ok = await waitForGrafana(baseUrl);
  if (!ok) {
    console.warn('⚠️  Grafana health check timed out. Check: docker logs mes-grafana-poc');
  } else {
    console.log('✅ Grafana is up');
  }

  const lanIp = (await import('os')).networkInterfaces();
  let hintIp = 'localhost';
  for (const ifaces of Object.values(lanIp)) {
    for (const net of ifaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        hintIp = net.address;
        break;
      }
    }
  }

  const adminPw = opts.adminPassword || grafanaEnv.GRAFANA_ADMIN_PASSWORD || 'admin';

  console.log('\n═══════════════════════════════════════════');
  console.log(' Done');
  console.log('═══════════════════════════════════════════');
  console.log(` Grafana UI:     ${baseUrl}`);
  console.log(` Login:          admin / ${adminPw}`);
  console.log(` Speed Lab:      ${baseUrl}/d/mes-speed-lab`);
  console.log(` Equipment:      ${baseUrl}/d/mes-equipment-detail`);
  console.log('');
  console.log(' Trên PC chạy MES (frontend), thêm vào frontend/.env:');
  console.log(`   VITE_GRAFANA_URL=http://${hintIp}:${port}`);
  console.log(' Rồi restart: npm run dev  (hoặc build lại production)');
  console.log('');
  console.log(' Nếu DB trên PC khác: chạy lại với --db-host <IP-server-postgres>');
  console.log(' Docs: docs/grafana/HUONG_DAN_SU_DUNG.md');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message || err}`);
  process.exit(1);
});
