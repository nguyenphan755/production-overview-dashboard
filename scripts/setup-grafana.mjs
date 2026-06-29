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

function dockerOutput(args) {
  const r = spawnSync('docker', args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) return '';
  return (r.stdout || '').trim();
}

/** Containers publishing host port (e.g. 3000). */
function containersOnHostPort(port) {
  const text = dockerOutput(['ps', '--format', '{{.Names}}\t{{.Ports}}']);
  if (!text) return [];
  const needle = `:${port}->`;
  return text
    .split('\n')
    .filter((line) => line.includes(needle))
    .map((line) => line.split('\t')[0])
    .filter(Boolean);
}

function isMesGrafanaRunning() {
  const status = dockerOutput(['ps', '--filter', 'name=^mes-grafana-poc$', '--format', '{{.Status}}']);
  return status.toLowerCase().includes('up');
}

function isHostPortInUse(port) {
  const p = Number(port);
  if (!Number.isFinite(p)) return false;
  if (process.platform === 'win32') {
    const r = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true });
    const re = new RegExp(`[:.]${p}\\s+[^\\n]*LISTENING`, 'm');
    return re.test(r.stdout || '');
  }
  const r = spawnSync('sh', ['-c', `ss -ltn 2>/dev/null | grep -q ':${p} ' || netstat -ltn 2>/dev/null | grep -q ':${p} '`], {
    stdio: 'ignore',
    shell: false,
  });
  return r.status === 0;
}

function mesGrafanaContainerExists() {
  const name = dockerOutput(['ps', '-a', '--filter', 'name=^mes-grafana-poc$', '--format', '{{.Names}}']);
  return name === 'mes-grafana-poc';
}

function pickAvailablePort(preferred) {
  const candidates = [String(preferred), '3002', '3003', '3010'];
  const seen = new Set();
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);
    const occ = containersOnHostPort(p);
    if (occ.length === 1 && occ[0] === 'mes-grafana-poc') return p;
    if (occ.length === 0 && !isHostPortInUse(p)) return p;
  }
  return null;
}

function removeMesGrafanaIfPortMismatch(desiredPort) {
  if (!mesGrafanaContainerExists()) return;
  const ports = dockerOutput(['ps', '-a', '--filter', 'name=^mes-grafana-poc$', '--format', '{{.Ports}}']);
  const needle = `:${desiredPort}->`;
  if (ports && !ports.includes(needle)) {
    console.log(`\nℹ️  Gỡ mes-grafana-poc cũ (port mapping ≠ ${desiredPort})`);
    const r = spawnSync('docker', ['rm', '-f', 'mes-grafana-poc'], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
      throw new Error('Remove mes-grafana-poc failed');
    }
  }
}

function runDockerCompose(port) {
  const grafanaEnvPath = join(root, 'grafana', '.env');
  upsertEnvFile(grafanaEnvPath, {
    GRAFANA_PORT: String(port),
    GRAFANA_URL: `http://localhost:${port}`,
  });

  const env = { ...process.env };
  for (const [k, v] of Object.entries(loadEnvFile(grafanaEnvPath))) {
    env[k] = v;
  }
  env.GRAFANA_PORT = String(port);

  removeMesGrafanaIfPortMismatch(port);

  console.log(`\n▶ Start Grafana container (mes-grafana-poc) on host port ${port}`);
  console.log('  docker compose --env-file grafana/.env -f docker-compose.grafana.yml up -d');
  const result = spawnSync(
    'docker',
    ['compose', '--env-file', 'grafana/.env', '-f', 'docker-compose.grafana.yml', 'up', '-d'],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env },
  );
  if (result.status !== 0) {
    throw new Error(`Start Grafana container (mes-grafana-poc) failed (exit ${result.status ?? 'unknown'})`);
  }
}

function syncFrontendGrafanaUrl(port) {
  const grafanaUrl = `http://localhost:${port}`;
  const targets = [
    join(root, 'frontend', '.env'),
    join(root, 'frontend', '.env.production'),
  ];
  let updated = 0;
  for (const path of targets) {
    if (!existsSync(path)) continue;
    upsertEnvFile(path, { VITE_GRAFANA_URL: grafanaUrl });
    updated += 1;
  }
  if (updated > 0) {
    console.log(`✅ Đã cập nhật VITE_GRAFANA_URL=${grafanaUrl} trong frontend/.env`);
    console.log('   → Restart dev server: npm run dev (hoặc build lại production)');
  }
  return grafanaUrl;
}

function printPortConflictHelp(port, occupants) {
  console.error(`\n❌ Port ${port} đã được dùng bởi: ${occupants.join(', ')}`);
  console.error('\nChọn một trong các cách sau:\n');
  console.error('  1) Dùng Grafana đang chạy (nếu đã là mes-grafana-poc):');
  console.error('     node scripts/render-grafana-datasource.mjs');
  console.error('     node scripts/build-grafana-dashboards.mjs');
  console.error('     docker restart mes-grafana-poc\n');
  console.error('  2) Dừng container chiếm port rồi chạy lại setup:');
  for (const name of occupants) {
    console.error(`     docker stop ${name}`);
  }
  console.error('     node scripts/setup-grafana.mjs\n');
  console.error('  3) Chạy MES Grafana trên port khác (khuyến nghị nếu giữ Grafana cũ):');
  console.error('     node scripts/setup-grafana.mjs --grafana-port 3002');
  console.error('     (cập nhật VITE_GRAFANA_URL=http://localhost:3002)\n');
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
  } else if (!opts.skipDocker && dbPassword) {
    const src = grafanaEnv.GRAFANA_PG_PASSWORD ? 'grafana/.env (GRAFANA_PG_PASSWORD)' : 'backend/.env (DB_PASSWORD)';
    console.log(`ℹ️  Postgres password: ${src} — ${dbPassword.length} ký tự (mỗi PC có mật khẩu riêng, không copy .env từ máy khác)`);
  }

  run('node', ['scripts/render-grafana-datasource.mjs'], 'Render Postgres datasource');

  if (!opts.skipBuild) {
    run('node', ['scripts/build-grafana-dashboards.mjs'], 'Build dashboard JSON');
  }

  if (opts.skipDocker) {
    console.log('\n✅ Config ready (--skip-docker). Start manually:');
    console.log('   docker compose --env-file grafana/.env -f docker-compose.grafana.yml up -d');
    return;
  }

  const grafanaEnvAfter = loadEnvFile(grafanaEnvPath);
  let port = String(opts.grafanaPort || grafanaEnvAfter.GRAFANA_PORT || '3000');
  let occupants = containersOnHostPort(port);
  const mesRunning = isMesGrafanaRunning();
  let portBusy = isHostPortInUse(port);

  // Port bận bởi process khác (không phải mes-grafana-poc) → chọn port trống trước khi compose
  if (
    !opts.grafanaPort &&
    portBusy &&
    !occupants.includes('mes-grafana-poc')
  ) {
    const alt = pickAvailablePort('3002');
    if (alt && alt !== port) {
      console.log(`\n⚠️  Port ${port} đang bận (${occupants.length ? occupants.join(', ') : 'process khác'}) → dùng port ${alt}`);
      port = alt;
      portBusy = isHostPortInUse(port);
      occupants = containersOnHostPort(port);
    }
  }

  // mes-grafana-poc đã chạy đúng port → chỉ restart, KHÔNG compose (tránh bind conflict)
  if (mesRunning && occupants.includes('mes-grafana-poc')) {
    console.log(`\n✅ mes-grafana-poc đang chạy trên port ${port} — chỉ restart để nạp config mới.`);
    run('docker', ['restart', 'mes-grafana-poc'], 'Restart mes-grafana-poc');
  } else if (portBusy && occupants.includes('mes-grafana-poc') && !mesRunning) {
    console.log(`\nℹ️  mes-grafana-poc đã tồn tại (stopped) — start lại trên port ${port}`);
    runDockerCompose(port);
  } else if (portBusy || (occupants.length > 0 && !occupants.includes('mes-grafana-poc'))) {
    const blockedBy = occupants.length ? occupants : [`process khác trên port ${port}`];
    const alt = pickAvailablePort(port === '3000' ? '3002' : port);
    if (!alt) {
      printPortConflictHelp(port, blockedBy);
      process.exit(1);
    }
    if (alt !== port) {
      console.log(`\n⚠️  Port ${port} vẫn bận (${blockedBy.join(', ')}) → chuyển sang port ${alt}`);
      port = alt;
    }
    runDockerCompose(port);
  } else {
    runDockerCompose(port);
  }

  const baseUrl = `http://localhost:${port}`;
  console.log(`\n⏳ Waiting for Grafana at ${baseUrl} ...`);
  const ok = await waitForGrafana(baseUrl);
  if (!ok) {
    console.warn('⚠️  Grafana health check timed out. Check: docker logs mes-grafana-poc');
  } else {
    console.log('✅ Grafana is up');
    try {
      run('node', ['scripts/diagnose-grafana-postgres.mjs', '--grafana-url', baseUrl], 'Postgres query smoke test');
    } catch {
      console.warn('⚠️  Postgres smoke test failed — xem hướng dẫn bên dưới.');
    }
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
  const mesGrafanaUrl = syncFrontendGrafanaUrl(port);

  console.log('\n═══════════════════════════════════════════');
  console.log(' Done');
  console.log('═══════════════════════════════════════════');
  console.log(` Grafana UI:     ${baseUrl}`);
  console.log(` Login:          admin / ${adminPw}`);
  console.log(` Speed Lab:      ${baseUrl}/d/mes-speed-lab`);
  console.log(` Equipment:      ${baseUrl}/d/mes-equipment-detail`);
  console.log('');
  console.log(' Nút Mở Grafana trên MES dùng:');
  console.log(`   VITE_GRAFANA_URL=${mesGrafanaUrl}`);
  if (!existsSync(join(root, 'frontend', '.env'))) {
    console.log('   (tạo frontend/.env và thêm dòng trên nếu chưa có)');
  }
  console.log('');
  console.log(' MES trên PC khác: dùng IP LAN thay localhost, ví dụ:');
  console.log(`   VITE_GRAFANA_URL=http://${hintIp}:${port}`);
  console.log(' Nếu DB trên PC khác: chạy lại với --db-host <IP-server-postgres>');
  console.log(' Docs: docs/grafana/HUONG_DAN_SU_DUNG.md');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message || err}`);
  process.exit(1);
});
