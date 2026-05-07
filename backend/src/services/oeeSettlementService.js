/**
 * Immutable settled OEE per shift (rollup_v1) — first INSERT wins.
 */

import { query } from '../../database/connection.js';
import { QualityDataQuality, PerformanceDataQuality } from '../constants/oee-data-quality.js';
import { getShiftId, getShiftWindow } from '../utils/shiftCalculator.js';
import {
  buildRollupQualityPercentByMachine,
  computeRollupOeeRows,
  getWeightedOeeSnapshotMetrics,
} from './oeeRollupService.js';

async function fetchHistoricalQualityRows(machineIds, start, end) {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT 
       machine_id,
       COALESCE(SUM(produced_length_ok), 0) as produced_length_ok,
       COALESCE(SUM(produced_length_ng), 0) as produced_length_ng
     FROM production_quality
     WHERE calculation_period_start < $2
       AND (calculation_period_end IS NULL OR calculation_period_end > $1)
       AND machine_id = ANY($3)
     GROUP BY machine_id`,
    [start, end, machineIds]
  );
  return result.rows;
}

function inferPerformanceDQ(targetSpeedWeighted) {
  return parseFloat(targetSpeedWeighted || 0) > 0
    ? PerformanceDataQuality.OK
    : PerformanceDataQuality.MISSING_TARGET_DEFAULT_100;
}

function inferQualityDQ(machineRow, qualityAggRow) {
  if (qualityAggRow) {
    const ok = parseFloat(qualityAggRow.produced_length_ok || 0);
    const ng = parseFloat(qualityAggRow.produced_length_ng || 0);
    const t = ok + ng;
    if (t > 0) {
      return ng > 0 ? QualityDataQuality.OK : QualityDataQuality.ASSUMED_100_PENDING_NG_INTEGRATION;
    }
  }
  const mok = parseFloat(machineRow?.produced_length_ok ?? 0);
  const mng = parseFloat(machineRow?.produced_length_ng ?? 0);
  const mt = mok + mng;
  if (mt > 0) {
    return mng > 0 ? QualityDataQuality.OK : QualityDataQuality.ASSUMED_100_PENDING_NG_INTEGRATION;
  }
  const len = parseFloat(machineRow?.produced_length ?? 0);
  if (len > 0) return QualityDataQuality.ASSUMED_100_PENDING_NG_INTEGRATION;
  return QualityDataQuality.NO_PRODUCTION;
}

/**
 * @param {{ shiftNumber: number|string, shiftDate: string, area?: string|null }} opts shiftDate YYYY-MM-DD
 */
export async function settleCompletedShift({ shiftNumber, shiftDate, area = null }) {
  const sn = parseInt(String(shiftNumber), 10);
  if (![1, 2, 3].includes(sn)) {
    throw new Error('shiftNumber must be 1, 2, or 3');
  }

  const parts = shiftDate.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] || 1;
  const day = parts[2] || 1;
  const anchor = new Date(year, month - 1, day, 12, 0, 0, 0);
  const window = getShiftWindow(sn, anchor);
  const shiftId = getShiftId(sn, window.start);

  const now = new Date();
  if (window.end.getTime() > now.getTime()) {
    throw new Error('Cannot settle a shift that has not ended yet');
  }

  let sql = `SELECT id, area, line_speed, target_speed, performance, produced_length, produced_length_ok, produced_length_ng
     FROM machines`;
  const params = [];
  if (area && area !== 'all') {
    sql += ` WHERE area = $1`;
    params.push(area);
  }
  sql += ` ORDER BY area, id`;

  const machinesResult = await query(sql, params);
  const machines = machinesResult.rows;
  const machineIds = machines.map((m) => m.id);

  if (!machineIds.length) {
    return { shiftId, periodStart: window.start, periodEnd: window.end, insertedCount: 0, skippedMachineIds: [] };
  }

  const historicalQuality = await fetchHistoricalQualityRows(machineIds, window.start, window.end);
  const weightedSnapshots = await getWeightedOeeSnapshotMetrics(machineIds, window.start, window.end);
  const qualityPctByMachine = buildRollupQualityPercentByMachine(machines, historicalQuality);
  const machinesById = Object.fromEntries(machines.map((m) => [m.id, m]));

  const rollupRows = await computeRollupOeeRows(
    machineIds,
    window.start,
    window.end,
    qualityPctByMachine,
    weightedSnapshots,
    machinesById
  );

  const qualityByMid = Object.fromEntries(historicalQuality.map((r) => [r.machine_id, r]));

  const skippedMachineIds = [];
  let insertedCount = 0;

  for (const row of rollupRows) {
    const perfDQ = inferPerformanceDQ(row.target_speed);
    const qualDQ = inferQualityDQ(machinesById[row.machine_id], qualityByMid[row.machine_id]);

    const ins = await query(
      `INSERT INTO oee_shift_settlements (
        machine_id, shift_id, period_start, period_end,
        availability, performance, quality, oee,
        performance_data_quality, quality_data_quality, methodology_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (machine_id, shift_id) DO NOTHING
      RETURNING id`,
      [
        row.machine_id,
        shiftId,
        window.start,
        window.end,
        row.availability,
        row.performance,
        row.quality,
        row.oee,
        perfDQ,
        qualDQ,
        'rollup_v1',
      ]
    );

    if (ins.rows.length) {
      insertedCount += 1;
    } else {
      skippedMachineIds.push(row.machine_id);
    }
  }

  return {
    shiftId,
    periodStart: window.start.toISOString(),
    periodEnd: window.end.toISOString(),
    insertedCount,
    skippedMachineIds,
    methodologyVersion: 'rollup_v1',
  };
}

export async function listShiftSettlements(shiftId) {
  const result = await query(
    `SELECT *
     FROM oee_shift_settlements
     WHERE shift_id = $1
     ORDER BY machine_id`,
    [shiftId]
  );
  return result.rows;
}
