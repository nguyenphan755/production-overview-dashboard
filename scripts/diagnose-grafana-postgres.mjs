#!/usr/bin/env node
/**
 * Verify Grafana → Postgres and explain empty dashboards.
 * Usage: node scripts/diagnose-grafana-postgres.mjs [--grafana-url http://localhost:3002] [--machine D-01]
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TZ_TS = `(calculation_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`;

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function parseArgs() {
  const opts = { grafanaUrl: 'http://localhost:3002', machine: 'SH-05' };
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--grafana-url') opts.grafanaUrl = process.argv[++i];
    else if (process.argv[i] === '--machine') opts.machine = process.argv[++i];
  }
  return opts;
}

function authHeader() {
  return { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` };
}

async function grafanaQuery(baseUrl, rawSql, format = 'table', fromMs, toMs) {
  const to = toMs ?? Date.now();
  const from = fromMs ?? to - 24 * 3600_000;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ds/query`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: String(from),
      to: String(to),
      queries: [
        {
          refId: 'A',
          format,
          rawSql,
          datasource: { type: 'postgres', uid: 'mes-postgres' },
        },
      ],
    }),
  });
  const json = await res.json();
  const r = json.results?.A;
  if (!r || r.error) throw new Error(r?.error || `HTTP ${res.status}`);
  return r.frames?.[0];
}

function frameScalar(frame) {
  const v = frame?.data?.values?.[0]?.[0];
  return v == null ? null : Number(v);
}

function frameRows(frame) {
  return frame?.data?.values?.[0]?.length ?? 0;
}

async function main() {
  const opts = parseArgs();
  const grafanaEnv = loadEnv(join(root, 'grafana', '.env'));
  const backendEnv = loadEnv(join(root, 'backend', '.env'));
  const baseUrl = opts.grafanaUrl || grafanaEnv.GRAFANA_URL || 'http://localhost:3002';
  const machine = opts.machine;

  console.log('═══════════════════════════════════════════');
  console.log(' Grafana ↔ Postgres diagnostic');
  console.log('═══════════════════════════════════════════');
  console.log(` Grafana:   ${baseUrl}`);
  console.log(` Machine:   ${machine}`);
  console.log(` DB pass:   ${backendEnv.DB_PASSWORD ? `backend/.env (${backendEnv.DB_PASSWORD.length} chars)` : '⚠️  thiếu DB_PASSWORD'}`);
  console.log('');

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    console.log(health.ok ? '✅ Grafana UI health OK' : `❌ Grafana health HTTP ${health.status}`);
  } catch (e) {
    console.error(`❌ Cannot reach Grafana: ${e.message}`);
    process.exit(1);
  }

  const dsRes = await fetch(`${baseUrl}/api/datasources/uid/mes-postgres`, { headers: authHeader() });
  if (!dsRes.ok) {
    console.error('❌ Datasource mes-postgres không có — chạy:');
    console.error('   node scripts/render-grafana-datasource.mjs');
    console.error('   docker restart mes-grafana-poc');
    process.exit(1);
  }
  const ds = await dsRes.json();
  console.log(`✅ Datasource: ${ds.name} → ${ds.url} db=${ds.jsonData?.database}`);

  try {
    const hRes = await fetch(`${baseUrl}/api/datasources/${ds.id}/health`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: '{}',
    });
    const h = await hRes.json();
    const ok = hRes.ok && (h.status === 'OK' || h.message === 'Database Connection OK');
    console.log(ok ? '✅ Datasource Save & test: OK' : `❌ Datasource test failed: ${h.message || h.status || hRes.status}`);
    if (!ok) {
      console.log('\n→ Sửa backend/.env DB_PASSWORD (mỗi PC khác nhau), rồi:');
      console.log('   node scripts/render-grafana-datasource.mjs');
      console.log('   docker restart mes-grafana-poc');
      process.exit(1);
    }
  } catch (e) {
    console.warn(`⚠️  Không test được datasource health: ${e.message}`);
  }

  const now = Date.now();
  const ranges = [
    { label: '24 giờ qua', ms: 24 * 3600_000 },
    { label: '7 ngày qua', ms: 7 * 24 * 3600_000 },
  ];

  console.log('\n--- Dữ liệu oee_calculations ---');
  for (const r of ranges) {
    try {
      const frame = await grafanaQuery(
        baseUrl,
        `SELECT COUNT(*)::bigint AS n FROM oee_calculations WHERE machine_id='${machine}' AND $__timeFilter(${TZ_TS})`,
        'table',
        now - r.ms,
        now,
      );
      console.log(`  ${machine} · ${r.label}: ${frameScalar(frame) ?? 0} mẫu`);
    } catch (e) {
      console.log(`  ${machine} · ${r.label}: ❌ ${e.message}`);
    }
  }

  try {
    const latest = await grafanaQuery(
      baseUrl,
      `SELECT MAX(calculation_timestamp) AS t FROM oee_calculations WHERE machine_id='${machine}'`,
      'table',
      now - 365 * 24 * 3600_000,
      now,
    );
    const t = latest?.data?.values?.[0]?.[0];
    console.log(`  ${machine} · mẫu mới nhất trong DB: ${t ?? '(không có)'}`);
  } catch (e) {
    console.log(`  Không đọc được latest timestamp: ${e.message}`);
  }

  try {
    const top = await grafanaQuery(
      baseUrl,
      `SELECT machine_id, COUNT(*)::bigint AS n, MAX(calculation_timestamp) AS latest
       FROM oee_calculations
       WHERE $__timeFilter(${TZ_TS})
       GROUP BY machine_id
       ORDER BY n DESC
       LIMIT 5`,
      'table',
      now - 24 * 3600_000,
      now,
    );
    const ids = top?.data?.values?.[0] ?? [];
    const counts = top?.data?.values?.[1] ?? [];
    const latests = top?.data?.values?.[2] ?? [];
    if (ids.length) {
      console.log('\n  Máy có dữ liệu trong 24h qua (top 5):');
      for (let i = 0; i < ids.length; i += 1) {
        console.log(`    - ${ids[i]}: ${counts[i] ?? '?'} mẫu, latest ${latests[i] ?? '?'}`);
      }
    } else {
      console.log('\n  ⚠️  Không máy nào có oee_calculations trong 24h qua.');
    }
  } catch (e) {
    console.log(`\n  Không liệt kê được máy: ${e.message}`);
  }

  console.log('\n--- Query giống dashboard Speed Lab (24h) ---');
  try {
    const count = await grafanaQuery(
      baseUrl,
      `SELECT COUNT(*)::bigint AS n FROM oee_calculations WHERE machine_id='${machine}' AND $__timeFilter(${TZ_TS})`,
      'table',
      now - 24 * 3600_000,
      now,
    );
    const peak = await grafanaQuery(
      baseUrl,
      `SELECT COALESCE(MAX(actual_speed), 0) AS peak FROM oee_calculations WHERE machine_id='${machine}' AND $__timeFilter(${TZ_TS})`,
      'table',
      now - 24 * 3600_000,
      now,
    );
    const trend = await grafanaQuery(
      baseUrl,
      `SELECT to_timestamp(floor(extract(epoch from ${TZ_TS}) / 30) * 30) AS time,
        AVG(actual_speed) AS "Actual speed"
       FROM oee_calculations
       WHERE $__timeFilter(${TZ_TS}) AND machine_id='${machine}'
       GROUP BY 1 ORDER BY 1`,
      'time_series',
      now - 24 * 3600_000,
      now,
    );
    const n = frameScalar(count);
    const p = frameScalar(peak);
    const pts = frameRows(trend);
    console.log(`  Samples: ${n ?? 0} | Peak: ${p ?? 0} | Chart points: ${pts}`);

    console.log('\n═══════════════════════════════════════════');
    if ((n ?? 0) === 0) {
      console.log(' KẾT LUẬN: Postgres OK nhưng KHÔNG CÓ DỮ LIỆU trong cửa sổ thời gian.');
      console.log('═══════════════════════════════════════════');
      console.log(' 1) Trên Grafana: đổi time range → Last 7 days');
      console.log(' 2) Chọn máy có dữ liệu (xem danh sách top 5 ở trên)');
      console.log(' 3) Nút Mở Grafana từ MES truyền ca/ngày — nếu ca đó không có telemetry → trống');
      console.log(' 4) Kiểm tra backend MES đang ghi oee_calculations (tab Speed Lab có chart không?)');
    } else if (pts === 0) {
      console.log(' KẾT LUẬN: Có mẫu nhưng chart trống → rebuild dashboard.');
      console.log('═══════════════════════════════════════════');
      console.log('   node scripts/build-grafana-dashboards.mjs');
      console.log('   docker restart mes-grafana-poc');
    } else {
      console.log(' KẾT LUẬN: Dữ liệu OK — nếu UI vẫn trống, hard-refresh (Ctrl+Shift+R)');
      console.log('           hoặc time range trên dashboard quá hẹp (Last 5 minutes).');
      console.log('═══════════════════════════════════════════');
    }
  } catch (e) {
    console.log(`❌ Query dashboard failed: ${e.message}`);
    console.log('\n→ Chạy lại: node scripts/build-grafana-dashboards.mjs && docker restart mes-grafana-poc');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
