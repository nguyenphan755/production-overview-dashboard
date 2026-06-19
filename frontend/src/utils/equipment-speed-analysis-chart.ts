import { FACTORY_TIME_ZONE } from './shiftCalculator';

export type SpeedAnalysisPhase =
  | 'stable_running'
  | 'variable_running'
  | 'setup'
  | 'stopped'
  | 'idle';

export type SpeedHistoryPoint = {
  timestamp: string;
  actualSpeed: number;
  targetSpeed: number;
  performance: number | null;
  phase: SpeedAnalysisPhase;
};

export type SpeedHistorySummary = {
  stableRunningMedian: number | null;
  stableRunningP90: number | null;
  setupAvgSpeed: number | null;
  stoppedDurationSec: number;
  proposedTargetSpeed: number | null;
  currentTargetSpeed: number | null;
  deltaVsTargetPct: number | null;
};

export type SpeedHistoryMeta = {
  bucketSec: number;
  source: string;
  fallbackUsed: boolean;
  pointCount: number;
  speedFloor: number;
  area: string | null;
  rangeStart?: string;
  rangeEnd?: string;
  limitApplied?: number | null;
};

export type SpeedHistoryResponse = {
  points: SpeedHistoryPoint[];
  summary: SpeedHistorySummary;
  productNotes?: ProductSpeedNote[];
  meta: SpeedHistoryMeta;
};

export type ProductSpeedNote = {
  orderId: string | null;
  orderName: string | null;
  productName: string;
  segmentStart: string;
  segmentEnd: string;
  stableSpeedMedian: number | null;
  avgRunningSpeed: number | null;
  ictMedian: number | null;
  proposedIct: number | null;
  pointCount: number;
  durationSec: number;
  status: string | null;
};

export type SpeedChartRow = SpeedHistoryPoint & {
  time: string;
  timestampMs: number;
  /** ms offset from OEE window start — Recharts X (matches HTML min/max window) */
  plotX: number;
  phaseColor: string;
};

export type SpeedReferenceLines = {
  vKtcn: number | null;
  vDesign: number | null;
};

export type StableSpeedSegment = {
  xStart: number;
  xEnd: number;
};

const DESIGN_SPEED_FACTOR = 1.15;
/** Extend stable band to cover full bucket on the right edge. */
export function extendStableSegmentEnd(xEndMs: number, bucketSec: number): number {
  return xEndMs + bucketSec * 1000;
}

const PHASE_COLORS: Record<SpeedAnalysisPhase, string> = {
  stable_running: '#4FFFBC',
  variable_running: '#22C55E',
  setup: '#FFB86C',
  stopped: '#34E7F8',
  idle: '#64748B',
};

const PHASE_LABELS_VI: Record<SpeedAnalysisPhase, string> = {
  stable_running: 'Chạy ổn định',
  variable_running: 'Chạy biến thiên',
  setup: 'Setup',
  stopped: 'Dừng',
  idle: 'Idle',
};

export function speedPhaseColor(phase: SpeedAnalysisPhase): string {
  return PHASE_COLORS[phase] ?? PHASE_COLORS.idle;
}

export function speedPhaseLabelVi(phase: SpeedAnalysisPhase): string {
  return PHASE_LABELS_VI[phase] ?? phase;
}

export function formatSpeedDuration(seconds: number): string {
  if (seconds <= 0) return '0 phút';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

export function formatSpeedChartTime(iso: string, longSpan: boolean): string {
  const d = new Date(iso);
  if (longSpan) {
    return d.toLocaleString('vi-VN', {
      timeZone: FACTORY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleTimeString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSpeedChartRows(
  points: SpeedHistoryPoint[],
  rangeStart: Date,
  rangeEnd: Date
): SpeedChartRow[] {
  const longSpan = rangeEnd.getTime() - rangeStart.getTime() > 36 * 3600 * 1000;
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  return points
    .map((p) => {
      const timestampMs = new Date(p.timestamp).getTime();
      return {
        ...p,
        time: formatSpeedChartTime(p.timestamp, longSpan),
        timestampMs,
        plotX: timestampMs - startMs,
        phaseColor: speedPhaseColor(p.phase),
      };
    })
    .filter((row) => Number.isFinite(row.timestampMs) && row.timestampMs >= startMs && row.timestampMs <= endMs)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Absolute ms domain for labels / HTML parity. */
export function resolveSpeedChartXDomain(
  windowStartMs: number,
  windowEndMs: number
): [number, number] {
  return [windowStartMs, Math.max(windowEndMs, windowStartMs + 60_000)];
}

/** Plot domain: 0 → full OEE window span (Chart.js min/max equivalent). */
export function resolveSpeedChartPlotDomain(
  windowStartMs: number,
  windowEndMs: number
): [number, number] {
  const endMs = Math.max(windowEndMs, windowStartMs + 60_000);
  return [0, endMs - windowStartMs];
}

/** Evenly spaced X-axis ticks so Recharts shows the full OEE filter window. */
export function buildSpeedChartTimeTicks(
  xDomain: [number, number],
  tickCount = 6
): number[] {
  const [startMs, endMs] = xDomain;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [startMs, endMs].filter((v) => Number.isFinite(v));
  }
  const count = Math.max(2, Math.min(tickCount, 12));
  const step = (endMs - startMs) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(startMs + step * i));
}

/** Bucket size by OEE window span — finer detail for shift, coarser for week. */
export function resolveSpeedBucketSec(rangeStart: Date, rangeEnd: Date): number {
  const spanHours = (rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000;
  if (spanHours <= 9) return 15;
  if (spanHours <= 24) return 30;
  if (spanHours <= 72) return 60;
  return 300;
}

export function resolveSpeedReferenceLines(
  points: SpeedHistoryPoint[],
  currentTargetSpeed: number | null
): SpeedReferenceLines {
  const targetFromPoints = points.map((p) => p.targetSpeed).filter((v) => v > 0);
  const vKtcn =
    (currentTargetSpeed != null && currentTargetSpeed > 0 ? currentTargetSpeed : null)
    ?? (targetFromPoints.length ? targetFromPoints[targetFromPoints.length - 1] : null);

  const peakActual = points.reduce((m, p) => Math.max(m, p.actualSpeed), 0);
  let vDesign: number | null = null;
  if (vKtcn != null && vKtcn > 0) {
    vDesign = Math.max(vKtcn * DESIGN_SPEED_FACTOR, peakActual * 1.02);
  } else if (peakActual > 0) {
    vDesign = peakActual * 1.15;
  }

  return { vKtcn, vDesign };
}

export function findStableRunningSegments(
  points: SpeedHistoryPoint[],
  bucketSec = 60
): StableSpeedSegment[] {
  const segments: StableSpeedSegment[] = [];
  let runStartMs: number | null = null;
  let runEndMs: number | null = null;

  const flush = () => {
    if (runStartMs != null && runEndMs != null && runEndMs >= runStartMs) {
      segments.push({
        xStart: runStartMs,
        xEnd: extendStableSegmentEnd(runEndMs, bucketSec),
      });
    }
    runStartMs = null;
    runEndMs = null;
  };

  for (const p of points) {
    const ms = new Date(p.timestamp).getTime();
    if (p.phase === 'stable_running') {
      if (runStartMs == null) runStartMs = ms;
      runEndMs = ms;
    } else {
      flush();
    }
  }
  flush();
  return segments;
}

export function calculateSpeedTrendYDomain(
  points: SpeedHistoryPoint[],
  refs: SpeedReferenceLines,
  isDrawing: boolean
): [number, number] {
  const cap = isDrawing ? 50 : 2000;
  const peakActual = points.reduce((m, p) => Math.max(m, p.actualSpeed), 0);
  const peakTarget = points.reduce((m, p) => Math.max(m, p.targetSpeed), 0);
  const localPeak = Math.max(peakActual, peakTarget, refs.vKtcn ?? 0);
  if (localPeak <= 0) {
    return isDrawing ? [0, 10] : [0, 200];
  }
  const padded = Math.min(cap, Math.max(localPeak * 1.15, 1));
  return [0, padded];
}

export function calculateSpeedAnalysisDomain(
  points: SpeedHistoryPoint[],
  proposedTargetSpeed: number | null,
  isDrawing: boolean
): [number, number] {
  const values = points.flatMap((p) => [p.actualSpeed, p.targetSpeed]).filter((v) => v > 0);
  if (proposedTargetSpeed != null && proposedTargetSpeed > 0) {
    values.push(proposedTargetSpeed);
  }
  if (!values.length) {
    return isDrawing ? [0, 10] : [0, 200];
  }
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const margin = Math.max(maxVal * 0.15, 1);
  const cap = isDrawing ? 50 : 2000;
  return [Math.max(0, minVal - margin), Math.min(cap, maxVal + margin)];
}

export function speedUnitForArea(area: string | null | undefined): string {
  return area === 'drawing' ? 'm/s' : 'm/min';
}

export const SPEED_PHASE_LEGEND: { phase: SpeedAnalysisPhase; label: string; color: string }[] = [
  { phase: 'stable_running', label: PHASE_LABELS_VI.stable_running, color: PHASE_COLORS.stable_running },
  { phase: 'variable_running', label: PHASE_LABELS_VI.variable_running, color: PHASE_COLORS.variable_running },
  { phase: 'setup', label: PHASE_LABELS_VI.setup, color: PHASE_COLORS.setup },
  { phase: 'stopped', label: PHASE_LABELS_VI.stopped, color: PHASE_COLORS.stopped },
  { phase: 'idle', label: PHASE_LABELS_VI.idle, color: PHASE_COLORS.idle },
];

export const PRODUCT_NOTE_BAND_COLORS = [
  '#A78BFA',
  '#F472B6',
  '#34D399',
  '#60A5FA',
  '#FB923C',
  '#E879F9',
  '#2DD4BF',
];

export function productNoteBandColor(index: number): string {
  return PRODUCT_NOTE_BAND_COLORS[index % PRODUCT_NOTE_BAND_COLORS.length];
}

export function findProductNoteAtTime(
  notes: ProductSpeedNote[] | undefined,
  timestampMs: number
): ProductSpeedNote | null {
  if (!notes?.length) return null;
  for (const note of notes) {
    const start = new Date(note.segmentStart).getTime();
    const end = new Date(note.segmentEnd).getTime();
    if (timestampMs >= start && timestampMs < end) {
      return note;
    }
  }
  return null;
}

export function formatProductNoteTimeRange(startIso: string, endIso: string, longSpan: boolean): string {
  const a = formatSpeedChartTime(startIso, longSpan);
  const b = formatSpeedChartTime(endIso, longSpan);
  return `${a} → ${b}`;
}
