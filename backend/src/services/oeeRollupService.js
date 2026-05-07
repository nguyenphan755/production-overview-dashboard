/**
 * TPM-aligned OEE rollup for arbitrary periods (shift / day / week / month):
 * Availability from machine_status_history; Performance from weighted oee_calculations;
 * Quality from summed OK/NG (production_quality + machine counters).
 */

import { query } from '../../database/connection.js';
import { calculateAvailabilityForPeriod } from './oeeCalculator.js';

const weightExpr = `COALESCE(NULLIF(running_time_seconds, 0), 1)::numeric`;

/**
 * Weighted averages from OEE snapshots (better than AVG(oee) across intervals).
 * @returns {Promise<Record<string, { performance: number, actual_speed: number, target_speed: number }>>}
 */
export async function getWeightedOeeSnapshotMetrics(machineIds, start, end) {
  if (!machineIds.length) return {};
  const result = await query(
    `SELECT machine_id,
       CASE WHEN SUM(${weightExpr}) > 0 THEN
         SUM(performance * ${weightExpr}) / SUM(${weightExpr})
       ELSE AVG(performance) END as performance,
       CASE WHEN SUM(${weightExpr}) > 0 THEN
         SUM(actual_speed * ${weightExpr}) / SUM(${weightExpr})
       ELSE AVG(actual_speed) END as actual_speed,
       CASE WHEN SUM(${weightExpr}) > 0 THEN
         SUM(target_speed * ${weightExpr}) / SUM(${weightExpr})
       ELSE AVG(target_speed) END as target_speed
     FROM oee_calculations
     WHERE calculation_timestamp >= $1
       AND calculation_timestamp <= $2
       AND machine_id = ANY($3)
     GROUP BY machine_id`,
    [start, end, machineIds]
  );
  return Object.fromEntries(
    result.rows.map((row) => [
      row.machine_id,
      {
        performance: parseFloat(row.performance || 0),
        actual_speed: parseFloat(row.actual_speed || 0),
        target_speed: parseFloat(row.target_speed || 0),
      },
    ])
  );
}

/**
 * @param {Array<{ id: string, produced_length?: number, produced_length_ok?: number, produced_length_ng?: number }>} machines
 * @param {Array<{ machine_id: string, produced_length_ok: number, produced_length_ng: number }>} historicalQualityRows
 */
export function buildRollupQualityPercentByMachine(machines, historicalQualityRows) {
  const map = {};
  for (const row of historicalQualityRows) {
    const ok = parseFloat(row.produced_length_ok || 0);
    const ng = parseFloat(row.produced_length_ng || 0);
    const t = ok + ng;
    if (t > 0) {
      map[row.machine_id] = Math.max(0, Math.min(100, (ok / t) * 100));
    }
  }
  for (const m of machines) {
    if (map[m.id] != null) continue;
    const ok = parseFloat(m.produced_length_ok ?? 0);
    const ng = parseFloat(m.produced_length_ng ?? 0);
    const t = ok + ng;
    if (t > 0) {
      map[m.id] = Math.max(0, Math.min(100, (ok / t) * 100));
    } else {
      map[m.id] = 100;
    }
  }
  return map;
}

/**
 * @returns {Promise<Array<{ machine_id: string, availability: number, performance: number, quality: number, oee: number, actual_speed: number, target_speed: number }>>}
 */
export async function computeRollupOeeRows(
  machineIds,
  periodStart,
  periodEnd,
  qualityPctByMachine,
  snapshotMetricsByMachine,
  machinesById = {}
) {
  return Promise.all(
    machineIds.map(async (id) => {
      const { availability } = await calculateAvailabilityForPeriod(id, periodStart, periodEnd);
      const snap = snapshotMetricsByMachine[id];
      const m = machinesById[id];
      const performance = snap?.performance ?? parseFloat(m?.performance ?? 0);
      const actual_speed = snap?.actual_speed ?? parseFloat(m?.line_speed ?? 0);
      const target_speed = snap?.target_speed ?? parseFloat(m?.target_speed ?? 0);
      const quality = qualityPctByMachine[id] ?? 100;
      const oee = (availability * performance * quality) / 10000;
      return {
        machine_id: id,
        availability,
        performance,
        quality,
        oee,
        actual_speed,
        target_speed,
      };
    })
  );
}
