/**
 * Speed trend API window — aligned with OEE toolbar (not full 3-ca Gantt span).
 * Mirrors resolveEnergyChartContext in equipment-energy-chart.ts.
 */

import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from './equipmentOeeDisplay';
import { equipmentOeeModeLabelVi } from './equipmentOeeDisplay';
import {
  FACTORY_TIME_ZONE,
  getCurrentShiftWindow,
  getFactoryShiftWindowsForCalendarDay,
  getProductionDayLabelDate,
  getProductionDayWindow,
  getShiftWindow,
  parseShiftDateToAnchor,
  addDaysToYmd,
} from './shiftCalculator';

export const SPEED_BUCKET_SEC = 30;
export const SPEED_POLL_MS = 30_000;

export type EquipmentSpeedHistoryQuery = {
  queryStart: Date;
  queryEnd: Date;
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
  const sameDay = start.toDateString() === end.toDateString();
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

function resolveFixedShiftWindow(
  mode: EquipmentOeeMode,
  referenceDate: string,
  pastIsoShiftNumber: 1 | 2 | 3,
  now: Date
): { start: Date; end: Date } | null {
  const fixed = modeToShiftNumber(mode);
  if (fixed != null) {
    const anchor = parseShiftDateToAnchor(referenceDate);
    const win = getShiftWindow(fixed, anchor);
    const end = win.end.getTime() > now.getTime() ? now : win.end;
    return { start: win.start, end };
  }
  if (mode === 'past_shift') {
    const anchor = parseShiftDateToAnchor(referenceDate);
    return getShiftWindow(pastIsoShiftNumber, anchor);
  }
  return null;
}

/** Coarser buckets only for multi-day windows (still time-window limited, no point cap). */
function resolveSpeedBucketSec(rangeStart: Date, rangeEnd: Date): number {
  const spanHours = (rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000;
  if (spanHours <= 24) return SPEED_BUCKET_SEC;
  if (spanHours <= 72) return 60;
  return 300;
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
    const bucketSec = resolveSpeedBucketSec(win.start, now);
    return {
      queryStart: win.start,
      queryEnd: now,
      bucketSec,
      pollMs: SPEED_POLL_MS,
      sectionSubtitle: `${modeLabel} — Ca ${win.shift} · ${formatScopeTimeRange(win.start, now)}`,
    };
  }

  const shiftWin = resolveFixedShiftWindow(mode, referenceDate, pastIsoShiftNumber, now);
  if (shiftWin) {
    const bucketSec = resolveSpeedBucketSec(shiftWin.start, shiftWin.end);
    const pollMs =
      shiftWin.end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    return {
      queryStart: shiftWin.start,
      queryEnd: shiftWin.end,
      bucketSec,
      pollMs,
      sectionSubtitle: `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))} · ${formatScopeTimeRange(shiftWin.start, shiftWin.end)}`,
    };
  }

  if (mode === 'calendar_day') {
    const ymd = scope?.dayDate || referenceDate;
    const rows = getFactoryShiftWindowsForCalendarDay(ymd);
    const start = scope?.start ? new Date(scope.start) : new Date(Math.min(...rows.map((r) => r.start.getTime())));
    let end = scope?.end ? new Date(scope.end) : new Date(Math.max(...rows.map((r) => r.end.getTime())));
    if (end.getTime() > now.getTime()) end = now;
    const bucketSec = resolveSpeedBucketSec(start, end);
    return {
      queryStart: start,
      queryEnd: end,
      bucketSec,
      pollMs: end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null,
      sectionSubtitle: `${modeLabel} — ${formatDdMmYyyy(parseShiftDateToAnchor(ymd))} · ${formatScopeTimeRange(start, end)}`,
    };
  }

  if (scope?.start && scope?.end) {
    const queryStart = new Date(scope.start);
    let queryEnd = new Date(scope.end);
    const liveModes: EquipmentOeeMode[] = ['day', 'yesterday', 'week'];
    if (liveModes.includes(mode) && queryEnd.getTime() > now.getTime()) {
      queryEnd = now;
    }
    if (queryEnd <= queryStart) {
      queryEnd = new Date(queryStart.getTime() + 60_000);
    }
    const bucketSec = resolveSpeedBucketSec(queryStart, queryEnd);
    const pollMs =
      queryEnd.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null;
    let subtitle = modeLabel;
    if (scope.dayDate) {
      subtitle += ` — ${formatDdMmYyyy(parseShiftDateToAnchor(scope.dayDate))}`;
    }
    subtitle += ` · ${formatScopeTimeRange(queryStart, queryEnd)}`;
    return {
      queryStart,
      queryEnd,
      bucketSec,
      pollMs,
      sectionSubtitle: subtitle,
    };
  }

  if (mode === 'day' || mode === 'yesterday') {
    const label =
      mode === 'day'
        ? getProductionDayLabelDate(now)
        : addDaysToYmd(getProductionDayLabelDate(now), -1);
    const { start, end } = getProductionDayWindow(label, now);
    const bucketSec = resolveSpeedBucketSec(start, end);
    return {
      queryStart: start,
      queryEnd: end,
      bucketSec,
      pollMs: end.getTime() > now.getTime() - 60_000 ? SPEED_POLL_MS : null,
      sectionSubtitle: `${modeLabel} · ${formatScopeTimeRange(start, end)}`,
    };
  }

  const queryEnd = now;
  const queryStart = new Date(now.getTime() - 8 * 3600 * 1000);
  return {
    queryStart,
    queryEnd,
    bucketSec: SPEED_BUCKET_SEC,
    pollMs: SPEED_POLL_MS,
    sectionSubtitle: `${modeLabel} — chờ phạm vi OEE`,
  };
}
