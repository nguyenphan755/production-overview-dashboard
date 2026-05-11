/**
 * Energy (kWh) chart windows aligned with factory shifts / OEE scope.
 * Supports ISO bucket starts from API and legacy { hour, energy } rows.
 */

import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from './equipmentOeeDisplay';
import {
  getCurrentShiftWindow,
  getFactoryShiftWindowsForCalendarDay,
  getShiftWindow,
  parseShiftDateToAnchor,
} from './shiftCalculator';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type EnergyChartContext = {
  windowStart: Date;
  windowEnd: Date;
  bucketDurationMs: number;
  bucketCount: number;
  /** Subtitle under total kWh KPI */
  kpiSubtitle: string;
  /** X-axis caption */
  xAxisLabel: string;
  aggregation: 'hour' | 'day';
};

export type EnergyBarRow = {
  label: string;
  energy: number;
  bucketStart: string;
  bucketEnd: string;
};

function modeToShiftNumber(mode: EquipmentOeeMode): 1 | 2 | 3 | null {
  if (mode === 'shift_1') return 1;
  if (mode === 'shift_2') return 2;
  if (mode === 'shift_3') return 3;
  return null;
}

/**
 * Resolves the visible time window and bucket granularity for the machine energy bar chart.
 */
export function resolveEnergyChartContext(
  mode: EquipmentOeeMode,
  referenceDate: string,
  pastIsoShiftNumber: 1 | 2 | 3,
  scope: EquipmentOeeAnalyticsScope,
  now: Date
): EnergyChartContext {
  const maxHourlyBuckets = 48;
  const maxDailyBuckets = 31;

  if (mode === 'realtime' || mode === 'shift_live') {
    const { start, end } = getCurrentShiftWindow(now);
    const bucketCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / HOUR_MS));
    return {
      windowStart: start,
      windowEnd: end,
      bucketDurationMs: HOUR_MS,
      bucketCount,
      kpiSubtitle: 'Tổng trong ca hiện tại (8 h)',
      xAxisLabel: 'Thời gian (trong ca)',
      aggregation: 'hour',
    };
  }

  const fixedShift = modeToShiftNumber(mode);
  if (fixedShift !== null) {
    const { start, end } = getShiftWindow(fixedShift, parseShiftDateToAnchor(referenceDate));
    return {
      windowStart: start,
      windowEnd: end,
      bucketDurationMs: HOUR_MS,
      bucketCount: 8,
      kpiSubtitle: `Tổng ca ${fixedShift} — ${referenceDate}`,
      xAxisLabel: 'Giờ (theo ca)',
      aggregation: 'hour',
    };
  }

  if (mode === 'past_shift') {
    const { start, end } = getShiftWindow(pastIsoShiftNumber, parseShiftDateToAnchor(referenceDate));
    return {
      windowStart: start,
      windowEnd: end,
      bucketDurationMs: HOUR_MS,
      bucketCount: 8,
      kpiSubtitle: `Tổng ca ${pastIsoShiftNumber} (ISO) — ${referenceDate}`,
      xAxisLabel: 'Giờ (theo ca)',
      aggregation: 'hour',
    };
  }

  if (mode === 'calendar_day') {
    const ymd = scope?.dayDate || referenceDate;
    const rows = getFactoryShiftWindowsForCalendarDay(ymd);
    const windowStart = new Date(Math.min(...rows.map((r) => r.start.getTime())));
    const windowEnd = new Date(Math.max(...rows.map((r) => r.end.getTime())));
    const bucketCount = Math.min(
      maxHourlyBuckets,
      Math.max(1, Math.ceil((windowEnd.getTime() - windowStart.getTime()) / HOUR_MS))
    );
    return {
      windowStart,
      windowEnd,
      bucketDurationMs: HOUR_MS,
      bucketCount,
      kpiSubtitle: `Tổng trong ngày xưởng (3 ca) — ${ymd}`,
      xAxisLabel: 'Giờ (24 h)',
      aggregation: 'hour',
    };
  }

  if (scope?.start && scope?.end) {
    const windowStart = new Date(scope.start);
    const windowEnd = new Date(scope.end);
    const span = windowEnd.getTime() - windowStart.getTime();
    if (span <= 36 * HOUR_MS) {
      const bucketCount = Math.min(maxHourlyBuckets, Math.max(1, Math.ceil(span / HOUR_MS)));
      return {
        windowStart,
        windowEnd,
        bucketDurationMs: HOUR_MS,
        bucketCount,
        kpiSubtitle: `Tổng trong phạm vi đã chọn (${Math.round(span / HOUR_MS)} h)`,
        xAxisLabel: 'Giờ',
        aggregation: 'hour',
      };
    }
    const days = Math.min(maxDailyBuckets, Math.max(1, Math.ceil(span / DAY_MS)));
    return {
      windowStart,
      windowEnd,
      bucketDurationMs: DAY_MS,
      bucketCount: days,
      kpiSubtitle: `Tổng theo ngày (${days} ngày)`,
      xAxisLabel: 'Ngày',
      aggregation: 'day',
    };
  }

  const { start, end } = getCurrentShiftWindow(now);
  return {
    windowStart: start,
    windowEnd: end,
    bucketDurationMs: HOUR_MS,
    bucketCount: 8,
    kpiSubtitle: 'Tổng trong ca hiện tại (8 h)',
    xAxisLabel: 'Giờ',
    aggregation: 'hour',
  };
}

const clock12 = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
});

function formatBucketLabel(d: Date, aggregation: 'hour' | 'day'): string {
  if (aggregation === 'day') return dayLabel.format(d);
  return clock12.format(d).replace(/\s+/g, '');
}

type ParsedPoint = { at: Date; kwh: number };

function parseBucketRows(raw: unknown[]): { iso: ParsedPoint[]; legacyEnergy: number[] } {
  const iso: ParsedPoint[] = [];
  const legacyEnergy: number[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.bucketStart === 'string') {
      const at = new Date(o.bucketStart);
      if (!Number.isNaN(at.getTime())) {
        iso.push({ at, kwh: Number(o.energy ?? 0) || 0 });
      }
      continue;
    }
    const e = Number(o.energy ?? o.value ?? 0) || 0;
    if (typeof o.hour === 'string' || typeof o.hour === 'number') {
      legacyEnergy.push(e);
    }
  }
  return { iso, legacyEnergy };
}

/**
 * Builds bar rows for the chart: sums kWh into buckets.
 * Uses bucketStart ISO when available; otherwise distributes last N legacy energies across the window (mock / old API).
 */
export function buildEnergyBarChartData(
  raw: unknown[] | undefined,
  ctx: EnergyChartContext
): EnergyBarRow[] {
  const { windowStart, windowEnd, bucketDurationMs, bucketCount, aggregation } = ctx;
  const rows: EnergyBarRow[] = [];
  const { iso, legacyEnergy } = parseBucketRows(raw || []);

  if (aggregation === 'hour' || ctx.bucketDurationMs === HOUR_MS) {
    for (let i = 0; i < bucketCount; i++) {
      const b0 = new Date(windowStart.getTime() + i * bucketDurationMs);
      const b1 = new Date(Math.min(windowEnd.getTime(), b0.getTime() + bucketDurationMs));
      if (b0.getTime() >= windowEnd.getTime()) break;

      let energy = 0;
      for (const p of iso) {
        if (p.at.getTime() >= b0.getTime() && p.at.getTime() < b1.getTime()) {
          energy += p.kwh;
        }
      }

      rows.push({
        label: formatBucketLabel(b0, 'hour'),
        energy,
        bucketStart: b0.toISOString(),
        bucketEnd: b1.toISOString(),
      });
    }

    const allZero = rows.every((r) => r.energy === 0);
    if (allZero && legacyEnergy.length > 0 && rows.length > 0) {
      const take = Math.min(legacyEnergy.length, rows.length);
      const slice = legacyEnergy.slice(-take);
      for (let j = 0; j < take; j++) {
        const rowIndex = rows.length - take + j;
        if (rowIndex >= 0) rows[rowIndex] = { ...rows[rowIndex], energy: slice[j] ?? 0 };
      }
    }
    return rows;
  }

  // Daily buckets
  for (let i = 0; i < bucketCount; i++) {
    const b0 = new Date(windowStart.getTime() + i * bucketDurationMs);
    const b1 = new Date(Math.min(windowEnd.getTime(), b0.getTime() + bucketDurationMs));
    if (b0.getTime() >= windowEnd.getTime()) break;

    let energy = 0;
    for (const p of iso) {
      if (p.at.getTime() >= b0.getTime() && p.at.getTime() < b1.getTime()) {
        energy += p.kwh;
      }
    }
    rows.push({
      label: formatBucketLabel(b0, 'day'),
      energy,
      bucketStart: b0.toISOString(),
      bucketEnd: b1.toISOString(),
    });
  }

  if (rows.every((r) => r.energy === 0) && legacyEnergy.length > 0 && rows.length > 0) {
    const take = Math.min(legacyEnergy.length, rows.length);
    const slice = legacyEnergy.slice(-take);
    for (let j = 0; j < take; j++) {
      const rowIndex = rows.length - take + j;
      if (rowIndex >= 0) rows[rowIndex] = { ...rows[rowIndex], energy: slice[j] ?? 0 };
    }
  }

  return rows;
}

type MeterTrendPt = { t: number; v: number };

function parseMeterTrendToPoints(trend: unknown[] | undefined): MeterTrendPt[] {
  const out: MeterTrendPt[] = [];
  for (const item of trend || []) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const iso = typeof o.timestamp === 'string' ? o.timestamp : null;
    if (!iso) continue;
    const t = new Date(iso).getTime();
    const v = Number(o.meterKwh ?? o.value);
    if (!Number.isFinite(t) || Number.isNaN(t) || !Number.isFinite(v)) continue;
    out.push({ t, v });
  }
  return out.sort((a, b) => a.t - b.t);
}

export type MeterDeltaChartOpts = {
  /** Latest cumulative reading (machines.energy_meter_kwh) to close the window */
  terminalKwh?: number;
  terminalAtMs?: number;
};

function emptyEnergyBars(ctx: EnergyChartContext): EnergyBarRow[] {
  const rows: EnergyBarRow[] = [];
  const useHourLabels =
    ctx.aggregation === 'hour' || Math.abs(ctx.bucketDurationMs - HOUR_MS) < 1;
  const aggLabel: 'hour' | 'day' = useHourLabels ? 'hour' : 'day';
  for (let i = 0; i < ctx.bucketCount; i++) {
    const b0 = new Date(ctx.windowStart.getTime() + i * ctx.bucketDurationMs);
    const b1 = new Date(Math.min(ctx.windowEnd.getTime(), b0.getTime() + ctx.bucketDurationMs));
    if (b0.getTime() >= ctx.windowEnd.getTime()) break;
    rows.push({
      label: formatBucketLabel(b0, aggLabel),
      energy: 0,
      bucketStart: b0.toISOString(),
      bucketEnd: b1.toISOString(),
    });
  }
  return rows;
}

/**
 * kWh per bucket from cumulative meter (machine_metrics energy_meter_kwh + snapshot energyMeterKwh).
 * For each consecutive pair of readings, the segment is clipped to [windowStart, windowEnd) and the
 * meter is linearly interpolated between samples; that window delta is split across buckets by time
 * overlap (ca / ngày / scope từ resolveEnergyChartContext). Works with sparse PLC data.
 */
export function buildMeterDeltaBarChartFromTrend(
  trend: unknown[] | undefined,
  ctx: EnergyChartContext,
  opts?: MeterDeltaChartOpts
): { rows: EnergyBarRow[]; status: 'ok' | 'no_points' | 'outside_window' } {
  const w0 = ctx.windowStart.getTime();
  const w1 = ctx.windowEnd.getTime();
  const pts = parseMeterTrendToPoints(trend);

  const tk = opts?.terminalKwh;
  const tAt = opts?.terminalAtMs ?? Date.now();
  const chain: MeterTrendPt[] = [...pts];
  if (tk != null && Number.isFinite(tk)) {
    const tEdge = Math.min(Math.max(tAt, w0), w1 - 1);
    chain.push({ t: tEdge, v: tk });
  }
  chain.sort((a, b) => a.t - b.t);
  const dedup: MeterTrendPt[] = [];
  for (const p of chain) {
    const last = dedup[dedup.length - 1];
    if (last && last.t === p.t) dedup[dedup.length - 1] = p;
    else dedup.push(p);
  }

  if (dedup.length === 0) {
    return { rows: emptyEnergyBars(ctx), status: 'no_points' };
  }

  const inWin =
    dedup.some((p) => p.t >= w0 && p.t < w1) ||
    (tk != null && Number.isFinite(tk) && tAt >= w0 && tAt < w1);

  const lerpMeter = (a: MeterTrendPt, b: MeterTrendPt, t: number): number => {
    if (Math.abs(b.t - a.t) < 1) return b.v;
    return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  };

  const overlapMs = (a0: number, a1: number, b0: number, b1: number) =>
    Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

  const rows = emptyEnergyBars(ctx);

  for (let i = 0; i < dedup.length - 1; i++) {
    const pA = dedup[i];
    const pB = dedup[i + 1];
    const segDur = pB.t - pA.t;
    if (segDur <= 0) continue;

    const tSeg0 = Math.max(pA.t, w0);
    const tSeg1 = Math.min(pB.t, w1);
    if (tSeg1 <= tSeg0) continue;

    const v0 = lerpMeter(pA, pB, tSeg0);
    const v1 = lerpMeter(pA, pB, tSeg1);
    const deltaWin = v1 - v0;
    if (!Number.isFinite(deltaWin) || deltaWin <= 0) continue;

    const winDur = tSeg1 - tSeg0;
    rows.forEach((row, bi) => {
      const b0 = ctx.windowStart.getTime() + bi * ctx.bucketDurationMs;
      const b1 = Math.min(ctx.windowEnd.getTime(), b0 + ctx.bucketDurationMs);
      if (b0 >= ctx.windowEnd.getTime()) return;
      const om = overlapMs(tSeg0, tSeg1, b0, b1);
      if (om <= 0) return;
      row.energy += (deltaWin * om) / winDur;
    });
  }

  const sum = rows.reduce((s, r) => s + r.energy, 0);
  if (dedup.length < 2 && sum < 0.001) {
    return { rows, status: 'no_points' };
  }
  const status: 'ok' | 'outside_window' | 'no_points' =
    !inWin && sum < 0.001 ? 'outside_window' : 'ok';
  return { rows, status };
}

export type EnergyBarDataSource = 'db' | 'power_estimate' | 'empty' | 'meter_delta';

/** How hourly kWh bars were filled from kW */
export type EnergyPowerFill = 'none' | 'fallback' | 'policy';

/**
 * When hourly buckets sum to ~0 (no energy_consumption rows in the selected window, or timestamps misaligned),
 * fill each bucket with kWh ≈ average_kW × (bucket duration in hours) using live/trend power.
 * With `preferPowerOverMeter`, always use that estimate for hourly-like buckets (policy: accept error from P).
 */
export function enrichHourlyEnergyBarsWithPowerEstimate(
  rows: EnergyBarRow[],
  ctx: EnergyChartContext,
  averageKw: number | undefined,
  options?: { preferPowerOverMeter?: boolean }
): { rows: EnergyBarRow[]; source: EnergyBarDataSource; powerFill: EnergyPowerFill } {
  const sum = rows.reduce((s, r) => s + r.energy, 0);
  const hourlyLike =
    ctx.aggregation === 'hour' || Math.abs(ctx.bucketDurationMs - HOUR_MS) < 1;

  const kwhFromKw = (kw: number) => {
    const hoursPerBucket = ctx.bucketDurationMs / HOUR_MS;
    return kw * hoursPerBucket;
  };

  if (options?.preferPowerOverMeter && hourlyLike && rows.length > 0) {
    const kw =
      averageKw !== undefined && Number.isFinite(averageKw) && averageKw > 0 ? averageKw : undefined;
    if (kw !== undefined) {
      const energy = kwhFromKw(kw);
      return {
        rows: rows.map((r) => ({ ...r, energy })),
        source: 'power_estimate',
        powerFill: 'policy',
      };
    }
    if (sum > 0.001) return { rows, source: 'db', powerFill: 'none' };
    return { rows, source: 'empty', powerFill: 'none' };
  }

  if (sum > 0.001) {
    return { rows, source: 'db', powerFill: 'none' };
  }

  if (!hourlyLike || rows.length === 0) {
    return { rows, source: 'empty', powerFill: 'none' };
  }

  if (averageKw === undefined || !Number.isFinite(averageKw) || averageKw <= 0) {
    return { rows, source: 'empty', powerFill: 'none' };
  }

  return {
    rows: rows.map((r) => ({ ...r, energy: kwhFromKw(averageKw) })),
    source: 'power_estimate',
    powerFill: 'fallback',
  };
}

export type EnergyByOrderRow = {
  orderId: string;
  label: string;
  kwh: number;
  kwhPerKm: number | null;
};

/**
 * Allocates total kWh across production orders by overlap duration with [windowStart, windowEnd).
 * EnPI-style intensity: kWh per km when producedLengthOk > 0.
 */
export function allocateEnergyByOrderOverlap(params: {
  totalKwh: number;
  windowStart: Date;
  windowEnd: Date;
  /** Same shape as displayOrders in EquipmentDetail */
  orders: Array<{
    id: string;
    productName: string;
    name: string;
    startTime: string;
    endTime?: string;
    producedLengthOk?: number;
  }>;
}): EnergyByOrderRow[] {
  const { totalKwh, windowStart, windowEnd, orders } = params;
  if (totalKwh <= 0 || orders.length === 0) return [];

  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  const overlaps: { order: (typeof orders)[0]; ms: number }[] = [];

  for (const order of orders) {
    const os = new Date(order.startTime).getTime();
    const oeRaw = order.endTime ? new Date(order.endTime).getTime() : Date.now();
    const overlap = Math.max(0, Math.min(w1, oeRaw) - Math.max(w0, os));
    if (overlap > 0) overlaps.push({ order, ms: overlap });
  }

  const sumMs = overlaps.reduce((s, x) => s + x.ms, 0);
  if (sumMs <= 0) return [];

  return overlaps
    .map(({ order, ms }) => {
      const kwh = (totalKwh * ms) / sumMs;
      const lenKm = (order.producedLengthOk ?? 0) / 1000;
      const kwhPerKm = lenKm > 0.001 ? kwh / lenKm : null;
      return {
        orderId: order.id,
        label: order.productName || order.name || order.id,
        kwh,
        kwhPerKm,
      };
    })
    .filter((r) => r.kwh > 0.001)
    .sort((a, b) => b.kwh - a.kwh);
}
