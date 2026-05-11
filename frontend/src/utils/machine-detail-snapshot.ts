import type { MachineDetail } from '../types';
import { effectiveProducedLengthOkM } from './effectiveProducedLength';

function roundMetric(n: number | undefined | null): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}

/**
 * Snapshot of fields that drive the detail header / gauges / trends hook.
 * Ignores trend arrays, orderHistory, lastUpdated — avoids thrash when only
 * JSON shape or non-display fields change between polls.
 */
export function machineDetailCoreSnapshot(m: MachineDetail): string {
  const z = m.multiZoneTemperatures;
  return JSON.stringify({
    id: m.id,
    status: m.status,
    lineSpeed: roundMetric(m.lineSpeed),
    lenOk: roundMetric(effectiveProducedLengthOkM(m)),
    current: roundMetric(m.current),
    power: roundMetric(m.power),
    temp: roundMetric(m.temperature),
    oee: roundMetric(m.oee),
    poId: m.productionOrderId ?? null,
    poName: m.productionOrderName ?? null,
    poProduct: m.productionOrderProductName ?? null,
    productName: m.productName ?? null,
    z1: roundMetric(z?.zone1),
    z2: roundMetric(z?.zone2),
    z3: roundMetric(z?.zone3),
    z4: roundMetric(z?.zone4),
    z5: roundMetric(z?.zone5),
    z6: roundMetric(z?.zone6),
    z7: roundMetric(z?.zone7),
    z8: roundMetric(z?.zone8),
    z9: roundMetric(z?.zone9),
    z10: roundMetric(z?.zone10),
  });
}

export function machineDetailCoreChanged(
  prev: MachineDetail | null,
  next: MachineDetail
): boolean {
  if (!prev) return true;
  return machineDetailCoreSnapshot(prev) !== machineDetailCoreSnapshot(next);
}
