import type { SpeedLabStopBlock } from '../types/oee-analytics-lab';
import { MIN_DOWNTIME_STOP_SEC } from '../constants/downtime-threshold';

const MIN_STOP_SEC = MIN_DOWNTIME_STOP_SEC;
const SPEED_RUN = 1;

type SpeedPoint = {
  timestamp: string;
  actualSpeed: number;
};

function pointTimeMs(point: SpeedPoint): number {
  return new Date(point.timestamp).getTime();
}

function speedState(actual: number): 'running' | 'creep' | 'stopped' {
  if (actual === 0) return 'stopped';
  if (actual < SPEED_RUN) return 'creep';
  return 'running';
}

function buildSegmentsFromPoints(points: SpeedPoint[]) {
  if (!points.length) return [];
  const segments: Array<{ state: ReturnType<typeof speedState>; start: number; end: number }> = [];
  let cur = {
    state: speedState(points[0].actualSpeed),
    start: pointTimeMs(points[0]),
    end: pointTimeMs(points[0]),
  };
  for (let i = 1; i < points.length; i += 1) {
    const st = speedState(points[i].actualSpeed);
    const t = pointTimeMs(points[i]);
    if (st !== cur.state) {
      cur.end = t;
      segments.push(cur);
      cur = { state: st, start: t, end: t };
    } else {
      cur.end = t;
    }
  }
  segments.push(cur);
  return segments;
}

/** Mirror backend buildStopBlocks — full list for export (not capped at 20). */
export function buildStopBlocksFromPoints(points: SpeedPoint[]): SpeedLabStopBlock[] {
  const segments = buildSegmentsFromPoints(points);
  return segments
    .filter((segment) => segment.state === 'stopped' && (segment.end - segment.start) / 1000 >= MIN_STOP_SEC)
    .map((segment) => ({
      startMs: segment.start,
      endMs: segment.end,
      durationSec: Math.round((segment.end - segment.start) / 1000),
      source: 'actual_speed_zero',
    }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}
