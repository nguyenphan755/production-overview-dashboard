/**
 * Speed trend API window — aligned with OEE toolbar (not full 3-ca Gantt span).
 * Mirrors resolveEnergyChartContext in equipment-energy-chart.ts.
 *
 * chartWindow* = full OEE filter on X-axis (matches sh04-speed-compare.html).
 * queryEnd = API fetch upper bound (min(now, chartWindowEnd) when ca is in progress).
 */

import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from './equipmentOeeDisplay';
import { equipmentOeeModeLabelVi } from './equipmentOeeDisplay';
import {
  FACTORY_TIME_ZONE,
  getCurrentShiftWindow,
  getProductionDayLabelDate,
  getProductionDayWindow,
  getShiftWindow,
  parseShiftDateToAnchor,
  addDaysToYmd,
} from './shiftCalculator';

export const SPEED_BUCKET_SEC = 30;
export const SPEED_POLL_MS = 30_000;

export type EquipmentSpeedHistoryQuery = {
  /** API range start */
  queryStart: Date;
  /** API range end (≤ chartWindowEnd; may be "now" for live ca) */
  queryEnd: Date;
  /** X-axis / OEE filter start — always full filter window */
  chartWindowStart: Date;
  /** X-axis / OEE filter end — always full filter window */
  chartWindowEnd: Date;
  bucketSec: number;
  pollMs: number | null;
  sectionSubtitle: string;
};

const clock12 = new Intl.DateTimeFormat('vi-VN', {
  timeZone: FACTORY_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatTimeShort(d: Date): string {
  return clock12.format(d).replace(/\s+/g, '');
}

function formatDdMmYyyy(d: Date): string {
  return d.toLocaleDateString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatScopeTimeRange(start: Date, end: Date): string {
  const sameDay =
    start.toLocaleDateString('en-CA', { timeZone: FACTORY_TIME_ZONE }) ===
    end.toLocaleDateString('en-CA', { timeZone: FACTORY_TIME_ZONE });
  if (sameDay) {
    return `${formatTimeShort(start)}–${formatTimeShort(end)} ${formatDdMmYyyy(start)}`;
  }
  return `${formatTimeShort(start)} ${formatDdMmYyyy(start)} – ${formatTimeShort(end)} ${formatDdMmYyyy(end)}`;
}

function modeToShiftNumber(mode: EquipmentOeeMode): 1 | 2 | 3 | null {
  if (mode === 'shift_1') return 1;
  if (mode === 'shift_2') return 2;
  if (mode === 'shift_3') return 3;
  return null;
}

/** Bucket from full chart window span (same as HTML compare tool). */
function resolveSpeedBucketSec(chartWindowStart: Date, chartWindowEnd: Date): number {
  const spanHours = (chartWindowEnd.getTime() - chartWindowStart.getTime()) / 3_600_000;
  if (spanHours <= 24) return SPEED_BUCKET_SEC;
  if (spanHours <= 72) return 60;
  return 300;
}

function buildQuery(
  chartWindowStart: Date,
  chartWindowEnd: Date,
  now: Date,
  pollMs: number | null,
  sectionSubtitle: string
): EquipmentSpeedHistoryQuery {
  const fetchEnd =
    chartWindowEnd.getTime() > now.getTime() ? now : chartWindowEnd;
  const queryStart = chartWindowStart;
  const queryEnd =
    fetchEnd.getTime() > queryStart.getTime()
      ? fetchEnd
      : new Date(queryStart.getTime() + 60_000);

  return {
    queryStart,
    queryEnd,
    chartWindowStart,
    chartWindowEnd,
    bucketSec: resolveSpeedBucketSec(chartWindowStart, chartWindowEnd),
    pollMs,
    sectionSubtitle,
  };
}

function resolveFixedShiftWindow(
  mode: EquipmentOeeMode,
  referenceDate: string,
  pastIsoShiftNumber: 1 | 2 | 3
): { start: Date; end: Date } | null {
  const fixed = modeToShiftNumber(mode);
  if (fixed != null) {
    const anchor = parseShiftDateToAnchor(referenceDate);
    return getShiftWindow(fixed, anchor);
  }
  if (mode === 'past_shift') {
    const anchor = parseShiftDateToAnchor(referenceDate);
    return getShiftWindow(pastIsoShiftNumber, anchor);
  }
  return null;
}

export function buildEquipmentSpeedHistoryQuery(
  mode: EquipmentOeeMode,
  referenceDate: string,
  pastIsoShiftNumber: 1 | 2 | 3,
  scope: EquipmentOeeAnalyticsScope,
  now: Date = new Date()
): EquipmentSpeedHistoryQuery {
  const modeLabel = equipmentOeeModeLabelVi(mode);

  if (mode === 'realtime' || mode === 'shift_live') {
    const win = getCurrentShiftWindow(now);
    return buildQuery(
      win.start,
      win.end,
      now,
      SPEED_POLL_MS,
      `${modeLabel} — Ca ${win.shift} · ${formatScopeTimeRange(win.start, win.end)}`
    );
  }

  const shiftWin = resolveFixedShiftWindow(mode, referenceDate, pastIsoShiftNumber);
  if (shiftWin) {
    const pollMs =
      shiftWin.end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(
      shiftWin.start,
      shiftWin.end,
      now,
      pollMs,
      `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))} · ${formatScopeTimeRange(shiftWin.start, shiftWin.end)}`
    );
  }

  if (mode === 'calendar_day') {
    const ymd = scope?.dayDate || referenceDate;
    const { start, end } = getProductionDayWindow(ymd, now);
    const pollMs = end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(
      start,
      end,
      now,
      pollMs,
      `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(ymd))} · ${formatScopeTimeRange(start, end)}`
    );
  }

  if (mode === 'day' || mode === 'yesterday') {
    const label =
      mode === 'day'
        ? getProductionDayLabelDate(now)
        : addDaysToYmd(getProductionDayLabelDate(now), -1);
    const { start, end } = getProductionDayWindow(label, now);
    const pollMs = end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(start, end, now, pollMs, `${modeLabel} · ${formatScopeTimeRange(start, end)}`);
  }

  if (mode === 'week') {
    const chartWindowEnd = now;
    const chartWindowStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return buildQuery(
      chartWindowStart,
      chartWindowEnd,
      now,
      SPEED_POLL_MS,
      `${modeLabel} · ${formatScopeTimeRange(chartWindowStart, chartWindowEnd)}`
    );
  }

  if (scope?.start && scope?.end) {
    const chartWindowStart = new Date(scope.start);
    const chartWindowEnd = new Date(scope.end);
    const liveModes: EquipmentOeeMode[] = ['day', 'yesterday', 'week'];
    const pollMs =
      liveModes.includes(mode) && chartWindowEnd.getTime() > now.getTime() - 60_000
        ? SPEED_POLL_MS
        : chartWindowEnd.getTime() > now.getTime() - 60_000
          ? SPEED_POLL_MS
          : null;
    let subtitle = modeLabel;
    if (scope.dayDate) {
      subtitle += ` — ${formatDdMmYyyy(parseShiftDateToAnchor(scope.dayDate))}`;
    }
    subtitle += ` · ${formatScopeTimeRange(chartWindowStart, chartWindowEnd)}`;
    return buildQuery(chartWindowStart, chartWindowEnd, now, pollMs, subtitle);
  }

  const chartWindowEnd = now;
  const chartWindowStart = new Date(now.getTime() - 8 * 3600 * 1000);
  return buildQuery(
    chartWindowStart,
    chartWindowEnd,
    now,
    SPEED_POLL_MS,
    `${modeLabel} — chờ phạm vi OEE`
  );
}

/**
 * Speed Lab only — resolves window from mode + referenceDate (never stale analytics scope).
 * Prevents 3-ca modes from collapsing to an 8h shift scope.start/end.
 */
export function buildSpeedLabQuery(
  mode: EquipmentOeeMode,
  referenceDate: string,
  pastIsoShiftNumber: 1 | 2 | 3,
  now: Date = new Date()
): EquipmentSpeedHistoryQuery {
  const modeLabel = equipmentOeeModeLabelVi(mode);

  if (mode === 'realtime' || mode === 'shift_live') {
    const win = getCurrentShiftWindow(now);
    return buildQuery(
      win.start,
      win.end,
      now,
      SPEED_POLL_MS,
      `${modeLabel} — Ca ${win.shift} · ${formatScopeTimeRange(win.start, win.end)}`
    );
  }

  const shiftWin = resolveFixedShiftWindow(mode, referenceDate, pastIsoShiftNumber);
  if (shiftWin) {
    const pollMs = shiftWin.end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(
      shiftWin.start,
      shiftWin.end,
      now,
      pollMs,
      `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))} · ${formatScopeTimeRange(shiftWin.start, shiftWin.end)}`
    );
  }

  if (mode === 'calendar_day') {
    const { start, end } = getProductionDayWindow(referenceDate, now);
    const pollMs = end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(
      start,
      end,
      now,
      pollMs,
      `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))} · ${formatScopeTimeRange(start, end)}`
    );
  }

  if (mode === 'day' || mode === 'yesterday') {
    const label =
      mode === 'day'
        ? getProductionDayLabelDate(now)
        : addDaysToYmd(getProductionDayLabelDate(now), -1);
    const { start, end } = getProductionDayWindow(label, now);
    const pollMs = end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return buildQuery(start, end, now, pollMs, `${modeLabel} · ${formatScopeTimeRange(start, end)}`);
  }

  if (mode === 'week') {
    const chartWindowEnd = now;
    const chartWindowStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return buildQuery(
      chartWindowStart,
      chartWindowEnd,
      now,
      SPEED_POLL_MS,
      `${modeLabel} · ${formatScopeTimeRange(chartWindowStart, chartWindowEnd)}`
    );
  }

  const chartWindowEnd = now;
  const chartWindowStart = new Date(now.getTime() - 8 * 3600 * 1000);
  return buildQuery(
    chartWindowStart,
    chartWindowEnd,
    now,
    SPEED_POLL_MS,
    `${modeLabel} — chờ phạm vi OEE`
  );
}
