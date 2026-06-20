/**
 * Epoch bucketing — exact copy of bucketRows() in multi-machine-speed-compare.html
 */
import type { OeeCalculationRawRow, OeeSpeedBucketPoint } from '../types/oee-analytics-lab';

export type SpeedChartBucket = {
  x: number;
  actual: number;
  target: number;
  running: number;
};

type BucketRow = {
  tsMs: number;
  actual: number;
  target: number;
  running: number;
};

function bucketEpochRows(rows: BucketRow[], bucketSec: number): SpeedChartBucket[] {
  const map = new Map<
    number,
    { sumA: number; sumT: number; maxR: number; n: number; ts: number }
  >();
  for (const r of rows) {
    const sec = Math.floor(r.tsMs / 1000);
    const b = Math.floor(sec / bucketSec) * bucketSec;
    if (!map.has(b)) map.set(b, { sumA: 0, sumT: 0, maxR: 0, n: 0, ts: b * 1000 });
    const o = map.get(b)!;
    o.sumA += r.actual;
    o.sumT += r.target;
    o.maxR = Math.max(o.maxR, r.running);
    o.n += 1;
  }
  return [...map.values()]
    .map((o) => ({
      x: o.ts,
      actual: o.sumA / o.n,
      target: o.sumT / o.n,
      running: o.maxR,
    }))
    .sort((a, b) => a.x - b.x);
}

/** Filter rows in shift window — same as HTML analyzeMachine inWin */
export function filterRawRowsInWindow(
  rows: OeeCalculationRawRow[],
  startMs: number,
  endMs: number
): OeeCalculationRawRow[] {
  return rows
    .filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/** Bucket from API raw rows — same pipeline as HTML CSV → Gantt + trend */
export function bucketFromRawRows(
  rows: OeeCalculationRawRow[],
  bucketSec: number
): SpeedChartBucket[] {
  return bucketEpochRows(
    rows.map((r) => ({
      tsMs: new Date(r.timestamp).getTime(),
      actual: r.actualSpeed,
      target: r.targetSpeed,
      running: r.runningTimeSeconds,
    })),
    bucketSec
  );
}

/** Fallback when only SQL buckets available (compare / mini overview) */
export function bucketFromApiBuckets(buckets: OeeSpeedBucketPoint[]): SpeedChartBucket[] {
  return buckets.map((b) => ({
    x: new Date(b.timestamp).getTime(),
    actual: b.actualSpeed,
    target: b.targetSpeed,
    running: b.runningTimeSeconds,
  }));
}
