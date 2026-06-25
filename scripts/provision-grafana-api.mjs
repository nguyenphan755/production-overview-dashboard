#!/usr/bin/env node
/**
 * Provision MES datasource + dashboard into an existing Grafana (e.g. nhed-grafana on :3000).
 *
 * Usage:
 *   node scripts/render-grafana-datasource.mjs
 *   node scripts/provision-grafana-api.mjs
 *
 * Env (optional, in grafana/.env):
 *   GRAFANA_URL=http://localhost:3000
 *   GRAFANA_ADMIN_USER=admin
 *   GRAFANA_ADMIN_PASSWORD=admin123
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
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
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, 'backend', '.env'));
loadEnvFile(join(root, 'grafana', '.env'));

const GRAFANA_URL = (process.env.GRAFANA_URL || 'http://localhost:3000').replace(/\/$/, '');
const GRAFANA_USER = process.env.GRAFANA_ADMIN_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_ADMIN_PASSWORD || 'admin123';

function resolvePgHost() {
  const explicit = process.env.GRAFANA_PG_HOST?.trim();
  if (explicit) return explicit;
  const dbHost = (process.env.DB_HOST || 'localhost').trim().toLowerCase();
  if (dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1') {
    return 'host.docker.internal';
  }
  return process.env.DB_HOST || 'host.docker.internal';
}

const authHeader =
  'Basic ' + Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');

async function grafanaFetch(path, options = {}) {
  const res = await fetch(`${GRAFANA_URL}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'object' ? JSON.stringify(body) : String(body);
    throw new Error(`Grafana ${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

async function upsertDatasource() {
  const payload = {
    name: 'MES PostgreSQL',
    uid: 'mes-postgres',
    type: 'postgres',
    access: 'proxy',
    url: `${resolvePgHost()}:${process.env.GRAFANA_PG_PORT || process.env.DB_PORT || '5432'}`,
    user: process.env.GRAFANA_PG_USER || process.env.DB_USER || 'postgres',
    database: process.env.GRAFANA_PG_DATABASE || process.env.DB_NAME || 'production_dashboard',
    secureJsonData: {
      password: process.env.GRAFANA_PG_PASSWORD || process.env.DB_PASSWORD || '',
    },
    jsonData: {
      sslmode: 'disable',
      postgresVersion: 1500,
      timescaledb: false,
    },
    isDefault: false,
  };

  let existing = null;
  try {
    existing = await grafanaFetch('/api/datasources/uid/mes-postgres');
  } catch {
    try {
      existing = await grafanaFetch('/api/datasources/name/MES%20PostgreSQL');
    } catch {
      /* new */
    }
  }

  if (existing?.id) {
    await grafanaFetch(`/api/datasources/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, id: existing.id, version: existing.version }),
    });
    console.log(`✅ Updated datasource "MES PostgreSQL" (id=${existing.id})`);
    return;
  }

  const created = await grafanaFetch('/api/datasources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  console.log(`✅ Created datasource "MES PostgreSQL" (id=${created.id ?? created.datasource?.id})`);
}

async function ensureMesFolder() {
  try {
    const folder = await grafanaFetch('/api/folders/mes');
    return folder.uid;
  } catch {
    /* fall through */
  }
  try {
    const created = await grafanaFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ uid: 'mes', title: 'MES' }),
    });
    console.log('✅ Created folder MES');
    return created.uid;
  } catch (e) {
    if (String(e.message).includes('409')) {
      const folders = await grafanaFetch('/api/folders');
      const existing = folders.find((f) => f.uid === 'mes' || f.title === 'MES');
      if (existing) return existing.uid;
    }
    throw e;
  }
}

async function importDashboard() {
  const dashPath = join(root, 'grafana', 'dashboards', 'mes-speed-lab-poc.json');
  const dashboard = JSON.parse(readFileSync(dashPath, 'utf8'));
  dashboard.id = null;

  const folderUid = await ensureMesFolder();

  await grafanaFetch('/api/dashboards/db', {
    method: 'POST',
    body: JSON.stringify({
      dashboard,
      folderUid,
      overwrite: true,
      message: 'MES Speed Lab POC provision',
    }),
  });
  console.log(`✅ Imported dashboard "${dashboard.title}" → ${GRAFANA_URL}/d/${dashboard.uid}`);
}

async function testDatasource() {
  try {
    const ds = await grafanaFetch('/api/datasources/uid/mes-postgres');
    const result = await grafanaFetch(`/api/datasources/${ds.id}/health`);
    console.log(`   Datasource health: ${result.status || result.message || 'OK'}`);
  } catch (e) {
    console.warn(`⚠️  Datasource health check: ${e.message}`);
  }
}

async function main() {
  console.log(`Provisioning Grafana at ${GRAFANA_URL} (user=${GRAFANA_USER})`);
  await upsertDatasource();
  await importDashboard();
  await testDatasource();
  console.log(`\nOpen: ${GRAFANA_URL}/d/mes-speed-lab-poc`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
