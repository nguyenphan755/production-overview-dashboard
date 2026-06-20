/**
 * Shared contracts for analytics lab tabs (Speed Lab now, OEE Waterfall later).
 * Speed Lab: mirrors scripts/sh04-speed-compare.html
 * Waterfall: mirrors docs/reference/samples/oee-waterfall-demo.html
 */

import type { EquipmentOeeMode } from '../utils/equipmentOeeDisplay';

/** ICT +07 — all lab filters and chart axes use factory timezone */
export const LAB_FACTORY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// ─── Speed Lab (oee_calculations) ───────────────────────────────────────────

/** One raw row from oee_calculations (~1 Hz), for Gantt + running_time chart */
export type OeeCalculationRawRow = {
  timestamp: string;
  actualSpeed: number;
  targetSpeed: number;
  runningTimeSeconds: number;
  plannedTimeSeconds: number;
  performance: number | null;
  availability: number | null;
  quality: number | null;
  oee: number | null;
  productionOrderId: string | null;
};

/** Bucketed point (30s default) — speed trend chart */
export type OeeSpeedBucketPoint = {
  timestamp: string;
  actualSpeed: number;
  targetSpeed: number;
  /** MAX running_time in bucket — for cumulative chart approximation */
  runningTimeSeconds: number;
  performance: number | null;
};

export type SpeedLabInferredState = 'running' | 'creep' | 'stopped' | 'oee_accum' | 'oee_frozen';

export type SpeedLabTimelineSegment = {
  state: SpeedLabInferredState;
  startMs: number;
  endMs: number;
  source: 'actual_speed' | 'running_time' | 'machine_status_history';
};

export type SpeedLabStopBlock = {
  startMs: number;
  endMs: number;
  durationSec: number;
  source: string;
};

export type SpeedLabQueryRequest = {
  machineId: string;
  /** Resolved from Equipment OEE mode + referenceDate + scope */
  mode: EquipmentOeeMode;
  referenceDate: string;
  pastIsoShiftNumber?: 1 | 2 | 3;
  /** Explicit override — ISO start/end when scope is custom */
  start?: string;
  end?: string;
  bucketSec?: number;
};

export type SpeedLabQueryResponse = {
  meta: {
    machineId: string;
    source: 'oee_calculations';
    bucketSec: number;
    /** Full OEE filter window — chart X-axis min/max */
    windowStart: string;
    windowEnd: string;
    /** Data fetch upper bound (may be < windowEnd for live ca) */
    dataEnd: string;
    rawRowCount: number;
    bucketCount: number;
    timezone: typeof LAB_FACTORY_TIME_ZONE;
    rawLimitApplied?: number | null;
  };
  summary: {
    peakSpeed: number;
    zeroSpeedPct: number;
    stoppedDurationSec: number;
    finalRunningTimeSec: number;
    plannedTimeSec: number;
    stopSegmentCount: number;
  };
  buckets: OeeSpeedBucketPoint[];
  /** Optional raw rows — capped server-side for Gantt fidelity */
  rawRows?: OeeCalculationRawRow[];
  inferredSegments?: {
    fromActualSpeed: SpeedLabTimelineSegment[];
    fromRunningTime: SpeedLabTimelineSegment[];
  };
  statusHistorySegments?: SpeedLabTimelineSegment[];
  stopBlocks: SpeedLabStopBlock[];
};

export type SpeedLabMachineOverview = {
  meta: {
    machineId: string;
    source: 'oee_calculations';
    bucketSec: number;
    windowStart: string;
    windowEnd: string;
    rawRowCount: number;
    bucketCount: number;
    timezone: typeof LAB_FACTORY_TIME_ZONE;
  };
  summary: SpeedLabQueryResponse['summary'];
  buckets: OeeSpeedBucketPoint[];
  stopBlocks: SpeedLabStopBlock[];
};

export type SpeedLabMultiQueryResponse = {
  meta: {
    source: 'oee_calculations';
    bucketSec: number;
    windowStart: string;
    windowEnd: string;
    machineCount: number;
    machinesWithData: number;
    timezone: typeof LAB_FACTORY_TIME_ZONE;
  };
  machines: Record<string, SpeedLabMachineOverview>;
  machineIds: string[];
};

// ─── OEE Waterfall (future phase — oee-waterfall-demo.html) ─────────────────

/** TPM time buckets in seconds */
export type OeeWaterfallBuckets = {
  pot_sec: number;
  pst_sec: number;
  ppt_sec: number;
  dtl_sec: number;
  ot_sec: number;
  running_sec: number;
  speed_loss_sec: number;
  net_ot_sec: number;
  quality_loss_sec: number;
  fpt_sec: number;
};

export type OeeWaterfallApq = {
  availability_pct: number;
  performance_pct: number;
  quality_pct: number;
  oee_pct: number;
};

export type OeeWaterfallBreakdownRow = {
  bucket: 'DTL' | 'SPEED_LOSS' | 'OT' | 'PST' | string;
  reason: string;
  status: string;
  seconds: number;
  count: number;
  pct_of_pot: number;
};

export type OeeWaterfallProcessingReport = {
  running_sec: number;
  idle_sec: number;
  setup_sec: number;
  slot_sec: number;
  running_fmt?: string;
  idle_fmt?: string;
  setup_fmt?: string;
};

/** Future API response — not implemented in Speed Lab phase */
export type OeeWaterfallShiftData = {
  machine: { id: string; name: string; area: string };
  periodStart: string;
  periodEnd: string;
  window_label: string;
  buckets: OeeWaterfallBuckets;
  apq: OeeWaterfallApq;
  breakdown_summary: OeeWaterfallBreakdownRow[];
  segment_count: number;
  processing: OeeWaterfallProcessingReport;
  product_changes: Array<{ time: string; product: string; material: string }>;
  methodology: string;
  note?: string;
};

/** Lab context passed between Speed Lab and future Waterfall tab */
export type OeeAnalyticsLabContext = {
  machineId: string;
  mode: EquipmentOeeMode;
  referenceDate: string;
  windowStart: string;
  windowEnd: string;
};
