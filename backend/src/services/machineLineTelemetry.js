import { withClient } from '../../database/connection.js';

export const parseFiniteOrNull = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

const LENGTH_EPS = 0.01;
const NUM_EPS = 1e-4;
const METER_KWH_EPS = 1e-3;

function stableJsonb(val) {
  if (val === undefined || val === null) return 'null';
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val));
    } catch {
      return val;
    }
  }
  return JSON.stringify(val);
}

function strNorm(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function numClose(a, b, eps) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= eps;
}

const LENGTH_KEYS = new Set([
  'produced_length',
  'produced_length_ok',
  'produced_length_ng',
  'target_length',
  'runtime_hours',
]);

/**
 * True when API-visible machine row should produce a new telemetry snapshot
 * (any column that we persist to machine_line_telemetry differs within epsilon).
 */
export function hasMachineTelemetrySnapshotChanged(prevRow, nextRow) {
  if (!prevRow || !nextRow) return true;

  const stringKeys = [
    'area',
    'status',
    'production_order_id',
    'production_order_name',
    'material_code',
    'product_name',
    'operator_name',
    'performance_data_quality',
    'quality_data_quality',
    'vibration_level',
  ];

  for (const key of stringKeys) {
    if (strNorm(prevRow[key]) !== strNorm(nextRow[key])) return true;
  }

  const numericKeys = [
    'line_speed',
    'target_speed',
    'oee',
    'availability',
    'performance',
    'quality',
    'current',
    'power',
    'temperature',
    'health_score',
  ];

  for (const key of numericKeys) {
    const a = parseFiniteOrNull(prevRow[key]);
    const b = parseFiniteOrNull(nextRow[key]);
    if (!numClose(a, b, NUM_EPS)) return true;
  }

  for (const key of LENGTH_KEYS) {
    const a = parseFiniteOrNull(prevRow[key]);
    const b = parseFiniteOrNull(nextRow[key]);
    if (!numClose(a, b, LENGTH_EPS)) return true;
  }

  {
    const a = parseFiniteOrNull(prevRow.energy_meter_kwh);
    const b = parseFiniteOrNull(nextRow.energy_meter_kwh);
    if (!numClose(a, b, METER_KWH_EPS)) return true;
  }

  if (stableJsonb(prevRow.multi_zone_temperatures) !== stableJsonb(nextRow.multi_zone_temperatures)) {
    return true;
  }

  return false;
}

/**
 * Merge OEE fields from formatMachine() output (post-recalc) into the DB row used for telemetry.
 */
export function buildTelemetryRowAfterApiUpdate(dbRow, updatedMachine) {
  if (!dbRow) return dbRow;
  const out = { ...dbRow };
  if (!updatedMachine) return out;
  if (updatedMachine.oee !== undefined) out.oee = updatedMachine.oee;
  if (updatedMachine.availability !== undefined) out.availability = updatedMachine.availability;
  if (updatedMachine.performance !== undefined) out.performance = updatedMachine.performance;
  if (updatedMachine.quality !== undefined) out.quality = updatedMachine.quality;
  if (updatedMachine.performanceDataQuality !== undefined) {
    out.performance_data_quality = updatedMachine.performanceDataQuality;
  }
  if (updatedMachine.qualityDataQuality !== undefined) {
    out.quality_data_quality = updatedMachine.qualityDataQuality;
  }
  return out;
}

/** Default true: do not INSERT telemetry on PATCH/PUT when snapshot equals previous (within epsilon). */
export function telemetryApiShouldSkipUnchanged() {
  const v = process.env.TELEMETRY_API_SKIP_UNCHANGED;
  if (v === undefined || v === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(v).trim().toLowerCase());
}

/** Default true: interval sampler skips machines whose row equals last sampled snapshot. */
export function telemetrySamplerShouldSkipUnchanged() {
  const v = process.env.TELEMETRY_SAMPLER_SKIP_UNCHANGED;
  if (v === undefined || v === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(v).trim().toLowerCase());
}

async function recordMachineLineTelemetrySample(
  client,
  machineId,
  prevRow,
  nextRow,
  source = 'machine_api'
) {
  let flags = 0;
  const prevMeter = parseFiniteOrNull(prevRow?.energy_meter_kwh);
  const nextMeter = parseFiniteOrNull(nextRow?.energy_meter_kwh);
  if (prevMeter !== null && nextMeter !== null && nextMeter < prevMeter - 1e-3) {
    flags |= 1;
  }
  if (nextMeter === null && prevMeter !== null) {
    flags |= 2;
  }

  const mzt = nextRow.multi_zone_temperatures;
  const mztJson =
    mzt === undefined || mzt === null
      ? null
      : typeof mzt === 'string'
        ? mzt
        : JSON.stringify(mzt);

  await client.query(
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
       $1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CAST($26 AS jsonb), $27, $28, $29, $30, $31
     )`,
    [
      machineId,
      nextRow.area,
      nextRow.status || 'idle',
      parseFiniteOrNull(nextRow.line_speed),
      parseFiniteOrNull(nextRow.target_speed),
      parseFiniteOrNull(nextRow.produced_length),
      parseFiniteOrNull(nextRow.produced_length_ok),
      parseFiniteOrNull(nextRow.produced_length_ng),
      parseFiniteOrNull(nextRow.target_length),
      nextRow.production_order_id || null,
      nextRow.production_order_name || null,
      nextRow.material_code || null,
      nextRow.product_name || null,
      nextRow.operator_name || null,
      parseFiniteOrNull(nextRow.oee),
      parseFiniteOrNull(nextRow.availability),
      parseFiniteOrNull(nextRow.performance),
      parseFiniteOrNull(nextRow.quality),
      nextRow.performance_data_quality || null,
      nextRow.quality_data_quality || null,
      parseFiniteOrNull(nextRow.current),
      parseFiniteOrNull(nextRow.power),
      nextMeter,
      parseFiniteOrNull(nextRow.temperature),
      mztJson,
      parseFiniteOrNull(nextRow.health_score),
      nextRow.vibration_level || null,
      parseFiniteOrNull(nextRow.runtime_hours),
      source,
      flags,
    ]
  );
}

async function upsertEnergyConsumptionHourly(client, machineId, sampledAt = new Date()) {
  await client.query(
    `WITH bucket AS (
       SELECT date_trunc('hour', $2::timestamp) AS hour_start
     ),
     samples AS (
       SELECT
         s.sampled_at,
         s.status AS machine_status,
         s.power_kw,
         s.energy_meter_kwh,
         s.material_code,
         s.product_name,
         s.produced_length,
         s.produced_length_ok
       FROM machine_line_telemetry s
       CROSS JOIN bucket b
       WHERE s.machine_id = $1
         AND s.sampled_at >= b.hour_start
         AND s.sampled_at < b.hour_start + INTERVAL '1 hour'
     ),
     aggregated AS (
       SELECT
         COUNT(*)::int AS sample_count,
         AVG(power_kw) FILTER (WHERE power_kw IS NOT NULL) AS avg_power_kw,
         (ARRAY_AGG(energy_meter_kwh ORDER BY sampled_at ASC)
           FILTER (WHERE energy_meter_kwh IS NOT NULL))[1] AS meter_start,
         (ARRAY_AGG(energy_meter_kwh ORDER BY sampled_at DESC)
           FILTER (WHERE energy_meter_kwh IS NOT NULL))[1] AS meter_end,
         (ARRAY_AGG(COALESCE(produced_length_ok, produced_length) ORDER BY sampled_at ASC)
           FILTER (WHERE COALESCE(produced_length_ok, produced_length) IS NOT NULL))[1] AS length_start,
         (ARRAY_AGG(COALESCE(produced_length_ok, produced_length) ORDER BY sampled_at DESC)
           FILTER (WHERE COALESCE(produced_length_ok, produced_length) IS NOT NULL))[1] AS length_end
       FROM samples
     ),
     latest_context AS (
       SELECT material_code, product_name, machine_status
       FROM samples
       ORDER BY sampled_at DESC
       LIMIT 1
     ),
     payload AS (
       SELECT
         b.hour_start AS hour,
         a.sample_count,
         a.avg_power_kw,
         CASE
           WHEN a.meter_start IS NULL OR a.meter_end IS NULL THEN 0::numeric
           WHEN a.meter_end < a.meter_start THEN 0::numeric
           ELSE ROUND((a.meter_end - a.meter_start)::numeric, 3)
         END AS energy_kwh,
         CASE
           WHEN a.length_start IS NULL OR a.length_end IS NULL THEN NULL::numeric
           WHEN a.length_end < a.length_start THEN NULL::numeric
           ELSE ROUND((a.length_end - a.length_start)::numeric, 3)
         END AS produced_length_m,
         c.material_code,
         c.product_name,
         c.machine_status
       FROM aggregated a
       CROSS JOIN bucket b
       LEFT JOIN latest_context c ON TRUE
       WHERE a.sample_count > 0
     )
     INSERT INTO energy_consumption (
       machine_id,
       hour,
       energy_kwh,
       power_kw,
       material_code,
       product_name,
       machine_status,
       produced_length_m,
       kwh_per_100m,
       sample_count,
       created_at,
       updated_at
     )
     SELECT
       $1,
       p.hour,
       p.energy_kwh,
       ROUND(p.avg_power_kw::numeric, 3),
       p.material_code,
       p.product_name,
       p.machine_status,
       p.produced_length_m,
       CASE
         WHEN p.produced_length_m IS NULL OR p.produced_length_m <= 0 THEN NULL
         ELSE ROUND(((p.energy_kwh * 100.0) / p.produced_length_m)::numeric, 4)
       END AS kwh_per_100m,
       p.sample_count,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
     FROM payload p
     ON CONFLICT (machine_id, hour) DO UPDATE SET
       energy_kwh = EXCLUDED.energy_kwh,
       power_kw = EXCLUDED.power_kw,
       material_code = EXCLUDED.material_code,
       product_name = EXCLUDED.product_name,
       machine_status = EXCLUDED.machine_status,
       produced_length_m = EXCLUDED.produced_length_m,
       kwh_per_100m = EXCLUDED.kwh_per_100m,
       sample_count = EXCLUDED.sample_count,
       updated_at = CURRENT_TIMESTAMP`,
    [machineId, sampledAt]
  );
}

export async function recordEnergyTelemetryAndAggregate(
  client,
  machineId,
  prevRow,
  nextRow,
  dbSource = 'machine_api'
) {
  await recordMachineLineTelemetrySample(client, machineId, prevRow, nextRow, dbSource);
  await upsertEnergyConsumptionHourly(client, machineId, new Date());
}

export async function recordEnergyTelemetryAndAggregateBestEffort(
  machineId,
  prevRow,
  nextRow,
  sourceTag,
  dbSource = 'machine_api'
) {
  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await recordEnergyTelemetryAndAggregate(client, machineId, prevRow, nextRow, dbSource);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });
  } catch (energyErr) {
    console.error(
      `[${sourceTag}] energy telemetry aggregate skipped:`,
      energyErr.message || energyErr
    );
  }
}
