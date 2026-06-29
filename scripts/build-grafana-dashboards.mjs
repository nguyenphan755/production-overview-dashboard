#!/usr/bin/env node
/**
 * Build MES Grafana dashboards (Equipment Detail + Speed Lab).
 * Run: node scripts/build-grafana-dashboards.mjs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'grafana', 'dashboards');

const DS = { type: 'postgres', uid: 'mes-postgres' };
const TZ = 'Asia/Ho_Chi_Minh';

/** ICT wall-clock (timestamp without tz) → UTC for Grafana queries & charts. */
const TS_UTC_OEE = `(calculation_timestamp AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC')`;
const TS_FILTER_OEE = `$__timeFilter(${TS_UTC_OEE})`;
const BUCKET_OEE = `to_timestamp(floor(extract(epoch from ${TS_UTC_OEE}) / 30) * 30)`;

const TS_UTC_METRIC = `(timestamp AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC')`;
const TS_FILTER_METRIC = `$__timeFilter(${TS_UTC_METRIC})`;

const TS_UTC_ENERGY = `(hour AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC')`;
const TS_FILTER_ENERGY = `$__timeFilter(${TS_UTC_ENERGY})`;

const machineVar = {
  current: { selected: true, text: 'SH-05', value: 'SH-05' },
  datasource: DS,
  definition:
    "SELECT id AS __value, name || ' (' || id || ')' AS __text FROM machines ORDER BY area, id",
  hide: 0,
  includeAll: false,
  label: 'Machine',
  multi: false,
  name: 'machine_id',
  options: [],
  query:
    "SELECT id AS __value, name || ' (' || id || ')' AS __text FROM machines ORDER BY area, id",
  refresh: 1,
  sort: 1,
  type: 'query',
};

function row(title, y) {
  return {
    type: 'row',
    title,
    gridPos: { h: 1, w: 24, x: 0, y },
    collapsed: false,
    panels: [],
    id: Math.floor(Math.random() * 1e6),
  };
}

function statPanel(id, title, sql, gridPos, opts = {}) {
  return {
    id,
    type: 'stat',
    title,
    datasource: DS,
    gridPos,
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        thresholds: {
          mode: 'absolute',
          steps: [
            { color: '#73BF69', value: null },
            { color: '#FADE2A', value: 60 },
            { color: '#F2495C', value: 85 },
          ],
        },
        unit: opts.unit ?? 'none',
        ...(opts.max != null ? { max: opts.max, min: 0 } : {}),
      },
      overrides: [],
    },
    options: {
      colorMode: 'background',
      graphMode: opts.spark ? 'area' : 'none',
      justifyMode: 'auto',
      orientation: 'auto',
      reduceOptions: { calcs: [opts.calc ?? 'lastNotNull'], fields: '', values: false },
      textMode: 'auto',
    },
    targets: [{ refId: 'A', format: 'table', rawSql: sql, datasource: DS }],
  };
}

function timeseries(id, title, sql, gridPos, opts = {}) {
  return {
    id,
    type: 'timeseries',
    title,
    datasource: DS,
    gridPos,
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' },
        custom: {
          drawStyle: opts.bars ? 'bars' : 'line',
          fillOpacity: opts.bars ? 80 : 12,
          lineWidth: 2,
          showPoints: 'never',
          spanNulls: true,
          stacking: opts.bars ? { mode: 'normal' } : { mode: 'none' },
        },
        unit: opts.unit ?? 'none',
        ...(opts.percent ? { min: 0, max: 100, unit: 'percent' } : {}),
      },
      overrides: opts.overrides ?? [],
    },
    options: {
      legend: { displayMode: 'list', placement: 'bottom', showLegend: true },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
    targets: [{ refId: 'A', format: 'time_series', rawSql: sql, datasource: DS }],
  };
}

function textPanel(id, title, content, gridPos) {
  return {
    id,
    type: 'text',
    title,
    gridPos,
    options: {
      mode: 'markdown',
      content,
    },
    transparent: true,
  };
}

function buildEquipmentDetail() {
  const panels = [];
  let y = 0;

  panels.push(
    textPanel(
      100,
      '',
      `## MES Equipment Detail\n**Machine:** \`$machine_id\` · Timezone **${TZ}** · Auto-refresh 30s\n\n[← Speed Lab](/d/mes-speed-lab?var-machine_id=$machine_id)`,
      { h: 3, w: 24, x: 0, y }
    )
  );
  y += 3;

  panels.push(row('Machine snapshot (live)', y++));
  panels.push(
    statPanel(
      101,
      'Status',
      `SELECT status::text AS status FROM machines WHERE id = '$machine_id'`,
      { h: 4, w: 4, x: 0, y }
    ),
    statPanel(
      102,
      'Line speed',
      `SELECT line_speed AS speed FROM machines WHERE id = '$machine_id'`,
      { h: 4, w: 4, x: 4, y },
      { spark: true }
    ),
    statPanel(
      103,
      'Target speed',
      `SELECT target_speed AS target FROM machines WHERE id = '$machine_id'`,
      { h: 4, w: 4, x: 8, y }
    ),
    statPanel(
      104,
      'Live OEE',
      `SELECT oee FROM machines WHERE id = '$machine_id'`,
      { h: 4, w: 4, x: 12, y },
      { unit: 'percent', max: 100 }
    ),
    statPanel(
      105,
      'Operator',
      `SELECT COALESCE(operator_name, '—') AS operator FROM machines WHERE id = '$machine_id'`,
      { h: 4, w: 4, x: 16, y }
    ),
    statPanel(
      106,
      'Product / Order',
      `SELECT COALESCE(po.product_name, m.product_name, '—') AS product
       FROM machines m LEFT JOIN production_orders po ON m.production_order_id = po.id
       WHERE m.id = '$machine_id'`,
      { h: 4, w: 4, x: 20, y }
    )
  );
  y += 4;

  panels.push(row('OEE analytics (selected time range)', y++));
  panels.push(
    statPanel(
      110,
      'OEE (range avg)',
      `SELECT ROUND(AVG(oee)::numeric, 1) AS oee FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 5, w: 6, x: 0, y },
      { unit: 'percent', max: 100, calc: 'lastNotNull' }
    ),
    statPanel(
      111,
      'Availability',
      `SELECT ROUND(AVG(availability)::numeric, 1) AS a FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 5, w: 6, x: 6, y },
      { unit: 'percent', max: 100 }
    ),
    statPanel(
      112,
      'Performance',
      `SELECT ROUND(AVG(performance)::numeric, 1) AS p FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 5, w: 6, x: 12, y },
      { unit: 'percent', max: 100 }
    ),
    statPanel(
      113,
      'Quality',
      `SELECT ROUND(AVG(quality)::numeric, 1) AS q FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 5, w: 6, x: 18, y },
      { unit: 'percent', max: 100 }
    )
  );
  y += 5;

  panels.push(row('Speed & operational states', y++));
  panels.push(
    timeseries(
      120,
      'Speed trend — actual vs target (m/min)',
      `SELECT ${BUCKET_OEE} AS "time",
        AVG(actual_speed) AS "Actual speed",
        AVG(target_speed) AS "Target speed"
       FROM oee_calculations
       WHERE ${TS_FILTER_OEE} AND machine_id='$machine_id'
       GROUP BY 1 ORDER BY 1`,
      { h: 9, w: 24, x: 0, y },
      {
        overrides: [
          {
            matcher: { id: 'byName', options: 'Target speed' },
            properties: [
              { id: 'custom.lineStyle', value: { dash: [10, 10], fill: 'dash' } },
              { id: 'color', value: { fixedColor: '#FF9830', mode: 'fixed' } },
            ],
          },
          {
            matcher: { id: 'byName', options: 'Actual speed' },
            properties: [{ id: 'color', value: { fixedColor: '#5794F2', mode: 'fixed' } }],
          },
        ],
      }
    )
  );
  y += 9;

  panels.push({
    id: 121,
    type: 'state-timeline',
    title: 'Operational states Gantt',
    datasource: DS,
    gridPos: { h: 5, w: 24, x: 0, y },
    fieldConfig: {
      defaults: {
        color: { mode: 'fixed' },
        custom: { fillOpacity: 80, lineWidth: 0 },
        mappings: [
          { type: 'value', options: { running: { color: '#73BF69', text: 'running' } } },
          { type: 'value', options: { idle: { color: '#FADE2A', text: 'idle' } } },
          { type: 'value', options: { setup: { color: '#5794F2', text: 'setup' } } },
          { type: 'value', options: { stopped: { color: '#F2495C', text: 'stopped' } } },
          { type: 'value', options: { error: { color: '#C4162A', text: 'error' } } },
        ],
      },
      overrides: [],
    },
    options: {
      alignValue: 'left',
      legend: { displayMode: 'list', placement: 'bottom' },
      mergeValues: false,
      rowHeight: 0.85,
    },
    targets: [
      {
        refId: 'A',
        format: 'table',
        datasource: DS,
        rawSql: `SELECT
          (status_start_time AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC') AS time,
          (COALESCE(status_end_time, NOW()) AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC') AS time_end,
          status::text AS status
        FROM machine_status_history
        WHERE machine_id='$machine_id'
          AND (status_start_time AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC') <= $__timeTo()
          AND (COALESCE(status_end_time, NOW()) AT TIME ZONE '${TZ}' AT TIME ZONE 'UTC') >= $__timeFrom()
        ORDER BY status_start_time`,
      },
    ],
  });
  y += 5;

  panels.push(row('Live telemetry (machine_metrics)', y++));
  panels.push(
    timeseries(
      130,
      'Temperature',
      `SELECT ${TS_UTC_METRIC} AS "time", value AS temperature
       FROM machine_metrics
       WHERE machine_id='$machine_id' AND metric_type='temperature'
         AND ${TS_FILTER_METRIC}
       ORDER BY 1`,
      { h: 6, w: 8, x: 0, y },
      { unit: 'celsius' }
    ),
    timeseries(
      131,
      'Speed (5m buffer)',
      `SELECT ${TS_UTC_METRIC} AS "time", value AS speed
       FROM machine_metrics
       WHERE machine_id='$machine_id' AND metric_type='speed'
         AND ${TS_FILTER_METRIC}
       ORDER BY 1`,
      { h: 6, w: 8, x: 8, y }
    ),
    timeseries(
      132,
      'Motor current',
      `SELECT ${TS_UTC_METRIC} AS "time", value AS current
       FROM machine_metrics
       WHERE machine_id='$machine_id' AND metric_type='current'
         AND ${TS_FILTER_METRIC}
       ORDER BY 1`,
      { h: 6, w: 8, x: 16, y },
      { unit: 'amp' }
    )
  );
  y += 6;

  panels.push(
    timeseries(
      133,
      'Power & energy meter',
      `SELECT ${TS_UTC_METRIC} AS "time", value AS power
       FROM machine_metrics
       WHERE machine_id='$machine_id' AND metric_type='power'
         AND ${TS_FILTER_METRIC}
       ORDER BY 1`,
      { h: 6, w: 12, x: 0, y },
      { unit: 'kwatt' }
    ),
    timeseries(
      134,
      'Energy kWh (hourly)',
      `SELECT ${TS_UTC_ENERGY} AS "time", energy_kwh AS "Energy kWh"
       FROM energy_consumption
       WHERE machine_id='$machine_id' AND ${TS_FILTER_ENERGY}
       ORDER BY 1`,
      { h: 6, w: 12, x: 12, y },
      { bars: true, unit: 'kwatth' }
    )
  );
  y += 6;

  panels.push(row('Production orders', y++));
  panels.push({
    id: 140,
    type: 'table',
    title: 'Recent production orders',
    datasource: DS,
    gridPos: { h: 8, w: 24, x: 0, y },
    fieldConfig: { defaults: {}, overrides: [] },
    options: { showHeader: true, cellHeight: 'sm', footer: { show: false } },
    targets: [
      {
        refId: 'A',
        format: 'table',
        datasource: DS,
        rawSql: `SELECT id, product_name, status::text, start_time, end_time,
          produced_length, target_length
         FROM production_orders
         WHERE machine_id='$machine_id'
         ORDER BY start_time DESC NULLS LAST
         LIMIT 20`,
      },
    ],
  });

  return {
    annotations: { list: [] },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 1,
    liveNow: true,
    style: 'dark',
    links: [
      {
        title: 'Speed Lab',
        url: '/d/mes-speed-lab?var-machine_id=${machine_id}',
        type: 'link',
        icon: 'external link',
      },
    ],
    panels,
    refresh: '30s',
    schemaVersion: 39,
    tags: ['mes', 'equipment'],
    templating: { list: [machineVar] },
    time: { from: 'now-1h', to: 'now' },
    timepicker: { refresh_intervals: ['5s', '10s', '30s', '1m', '5m'] },
    timezone: TZ,
    title: 'MES Equipment Detail',
    uid: 'mes-equipment-detail',
    version: 2,
  };
}

function buildSpeedLab() {
  const panels = [];
  let y = 0;

  panels.push(
    textPanel(
      200,
      '',
      `## MES Speed Lab\nDeep-dive speed & OEE for **$machine_id** · Bucket **30s** · [Equipment Detail](/d/mes-equipment-detail?var-machine_id=$machine_id)`,
      { h: 3, w: 24, x: 0, y }
    )
  );
  y += 3;

  panels.push(
    statPanel(
      201,
      'Peak speed',
      `SELECT COALESCE(MAX(actual_speed), 0) AS peak FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 4, w: 6, x: 0, y }
    ),
    statPanel(
      202,
      'Avg running speed',
      `SELECT COALESCE(ROUND(AVG(actual_speed)::numeric, 2), 0) AS avg FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE} AND actual_speed >= 1`,
      { h: 4, w: 6, x: 6, y }
    ),
    statPanel(
      203,
      '% time at speed=0',
      `SELECT COALESCE(ROUND(100.0 * SUM(CASE WHEN actual_speed < 0.5 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1), 0) AS pct
       FROM oee_calculations WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 4, w: 6, x: 12, y },
      { unit: 'percent', max: 100 }
    ),
    statPanel(
      204,
      'Samples in range',
      `SELECT COUNT(*)::bigint AS n FROM oee_calculations
       WHERE machine_id='$machine_id' AND ${TS_FILTER_OEE}`,
      { h: 4, w: 6, x: 18, y }
    )
  );
  y += 4;

  panels.push(
    timeseries(
      210,
      'Speed trend (actual vs target)',
      `SELECT ${BUCKET_OEE} AS "time",
        AVG(actual_speed) AS "Actual speed",
        AVG(target_speed) AS "Target speed"
       FROM oee_calculations
       WHERE ${TS_FILTER_OEE} AND machine_id='$machine_id'
       GROUP BY 1 ORDER BY 1`,
      { h: 10, w: 24, x: 0, y },
      {
        overrides: [
          {
            matcher: { id: 'byName', options: 'Target speed' },
            properties: [
              { id: 'custom.lineStyle', value: { dash: [10, 10], fill: 'dash' } },
              { id: 'color', value: { fixedColor: '#FF9830', mode: 'fixed' } },
            ],
          },
          {
            matcher: { id: 'byName', options: 'Actual speed' },
            properties: [{ id: 'color', value: { fixedColor: '#8AB8FF', mode: 'fixed' } }],
          },
        ],
      }
    )
  );
  y += 10;

  panels.push(
    timeseries(
      211,
      'OEE components',
      `SELECT ${BUCKET_OEE} AS "time",
        AVG(oee) AS OEE, AVG(availability) AS Availability,
        AVG(performance) AS Performance, AVG(quality) AS Quality
       FROM oee_calculations
       WHERE ${TS_FILTER_OEE} AND machine_id='$machine_id'
       GROUP BY 1 ORDER BY 1`,
      { h: 7, w: 12, x: 0, y },
      { percent: true }
    ),
    timeseries(
      212,
      'Cumulative running time (s)',
      `SELECT ${BUCKET_OEE} AS "time",
        MAX(running_time_seconds) AS "Running time"
       FROM oee_calculations
       WHERE ${TS_FILTER_OEE} AND machine_id='$machine_id'
       GROUP BY 1 ORDER BY 1`,
      { h: 7, w: 12, x: 12, y }
    )
  );
  y += 7;

  panels.push({
    id: 213,
    type: 'state-timeline',
    title: 'Speed states (≥1 run · 0–1 creep · 0 stop)',
    datasource: DS,
    gridPos: { h: 5, w: 24, x: 0, y },
    fieldConfig: {
      defaults: {
        mappings: [
          { type: 'value', options: { running: { color: '#73BF69', text: 'running' } } },
          { type: 'value', options: { creep: { color: '#FADE2A', text: 'creep' } } },
          { type: 'value', options: { stopped: { color: '#F2495C', text: 'stopped' } } },
        ],
      },
      overrides: [],
    },
    options: { alignValue: 'left', legend: { displayMode: 'list', placement: 'bottom' } },
    targets: [
      {
        refId: 'A',
        format: 'table',
        datasource: DS,
        rawSql: `WITH buckets AS (
          SELECT ${BUCKET_OEE} AS t,
            AVG(actual_speed) AS spd
          FROM oee_calculations
          WHERE ${TS_FILTER_OEE} AND machine_id='$machine_id'
          GROUP BY 1
        )
        SELECT t AS time, t + INTERVAL '30 seconds' AS time_end,
          CASE WHEN spd >= 1 THEN 'running' WHEN spd > 0 THEN 'creep' ELSE 'stopped' END AS status
        FROM buckets ORDER BY t`,
      },
    ],
  });
  y += 5;

  panels.push(
    timeseries(
      214,
      'Energy kWh (hourly)',
      `SELECT ${TS_UTC_ENERGY} AS "time", energy_kwh AS kwh
       FROM energy_consumption
       WHERE machine_id='$machine_id'
         AND ${TS_FILTER_ENERGY}
       ORDER BY 1`,
      { h: 6, w: 24, x: 0, y },
      { bars: true, unit: 'kwatth' }
    )
  );

  return {
    annotations: { list: [] },
    editable: true,
    graphTooltip: 1,
    liveNow: true,
    style: 'dark',
    links: [
      { title: 'Live 1h', url: '/d/mes-speed-lab?var-machine_id=${machine_id}&from=now-1h&to=now', type: 'link' },
      { title: '24h', url: '/d/mes-speed-lab?var-machine_id=${machine_id}&from=now-24h&to=now', type: 'link' },
      { title: '7d', url: '/d/mes-speed-lab?var-machine_id=${machine_id}&from=now-7d&to=now', type: 'link' },
      { title: 'Equipment Detail', url: '/d/mes-equipment-detail?var-machine_id=${machine_id}', type: 'link' },
    ],
    panels,
    refresh: '30s',
    schemaVersion: 39,
    tags: ['mes', 'speed-lab'],
    templating: { list: [machineVar] },
    time: { from: 'now-1h', to: 'now' },
    timepicker: { refresh_intervals: ['5s', '10s', '30s', '1m', '5m'] },
    timezone: TZ,
    title: 'MES Speed Lab',
    uid: 'mes-speed-lab',
    version: 2,
  };
}

const equipment = buildEquipmentDetail();
const speedLab = buildSpeedLab();

writeFileSync(join(outDir, 'mes-equipment-detail.json'), JSON.stringify(equipment, null, 2));
writeFileSync(join(outDir, 'mes-speed-lab.json'), JSON.stringify(speedLab, null, 2));

console.log('✅ Wrote grafana/dashboards/mes-equipment-detail.json');
console.log('✅ Wrote grafana/dashboards/mes-speed-lab.json');
