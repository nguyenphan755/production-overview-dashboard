import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from './equipmentOeeDisplay';
import { equipmentOeeModeLabelVi } from './equipmentOeeDisplay';
import {
  formatYmdLocal,
  getFactoryShiftWindowsForCalendarDay,
  getRollingFactoryShiftWindows,
  parseShiftDateToAnchor,
  type FactoryShiftWindowRow,
} from './shiftCalculator';

export type OperationalStatesGanttRow = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

const clock12 = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatTimeShort(d: Date): string {
  return clock12.format(d).replace(/\s+/g, '');
}

function formatDdMmYyyy(d: Date): string {
  return d.toLocaleDateString('en-GB');
}

function shiftRowLabel(w: FactoryShiftWindowRow): string {
  const n = w.shiftNumber;
  const t0 = formatTimeShort(w.start);
  const t1 = formatTimeShort(w.end);
  let datePart = formatDdMmYyyy(w.start);
  if (n === 3 && formatYmdLocal(w.start) !== formatYmdLocal(w.end)) {
    datePart = `${formatDdMmYyyy(w.start)} – ${formatDdMmYyyy(w.end)}`;
  }
  return `Shift ${n} (${t0}–${t1}) — ${datePart}`;
}

const LONG_SCOPE_MODES: EquipmentOeeMode[] = ['day', 'yesterday', 'week'];

/**
 * Gantt rows + API time range for machine_status_history, aligned with OEE toolbar scope where possible.
 */
export function buildOperationalStatesTimeline(
  mode: EquipmentOeeMode,
  referenceDate: string,
  _pastIsoShiftNumber: 1 | 2 | 3,
  scope: EquipmentOeeAnalyticsScope,
  now: Date = new Date()
): {
  rows: OperationalStatesGanttRow[];
  queryStart: Date;
  queryEnd: Date;
  sectionSubtitle: string | null;
  pollMs: number | null;
} {
  if (LONG_SCOPE_MODES.includes(mode)) {
    if (scope?.start && scope?.end) {
      const start = new Date(scope.start);
      const end = new Date(scope.end);
      const sameCalendarDay = formatYmdLocal(start) === formatYmdLocal(end);
      const dateSuffix = sameCalendarDay
        ? formatDdMmYyyy(start)
        : `${formatDdMmYyyy(start)} – ${formatDdMmYyyy(end)}`;
      const label = `${equipmentOeeModeLabelVi(mode)} (${formatTimeShort(start)}–${formatTimeShort(end)}) — ${dateSuffix}`;
      const rows: OperationalStatesGanttRow[] = [{ key: 'scope-range', label, start, end }];
      const pollMs = end.getTime() > now.getTime() - 60_000 ? 30_000 : null;
      return {
        rows,
        queryStart: start,
        queryEnd: end,
        sectionSubtitle: equipmentOeeModeLabelVi(mode),
        pollMs,
      };
    }
    const factoryRows = getRollingFactoryShiftWindows(now);
    const rows: OperationalStatesGanttRow[] = factoryRows.map((w) => ({
      key: w.key,
      label: shiftRowLabel(w),
      start: w.start,
      end: w.end,
    }));
    const queryStart = new Date(Math.min(...rows.map((r) => r.start.getTime())));
    const queryEnd = new Date(Math.max(...rows.map((r) => r.end.getTime())));
    return {
      rows,
      queryStart,
      queryEnd,
      sectionSubtitle: `${equipmentOeeModeLabelVi(mode)} — chờ phạm vi OEE`,
      pollMs: 30_000,
    };
  }

  let factoryRows: FactoryShiftWindowRow[];
  let sectionSubtitle: string | null = null;

  if (mode === 'calendar_day') {
    const ymd = scope?.dayDate || referenceDate;
    factoryRows = getFactoryShiftWindowsForCalendarDay(ymd);
    sectionSubtitle = `${equipmentOeeModeLabelVi(mode)} — ${formatDdMmYyyy(parseShiftDateToAnchor(ymd))}`;
  } else if (mode === 'shift_1' || mode === 'shift_2' || mode === 'shift_3' || mode === 'past_shift') {
    factoryRows = getFactoryShiftWindowsForCalendarDay(referenceDate);
    sectionSubtitle =
      mode === 'past_shift'
        ? `${equipmentOeeModeLabelVi(mode)} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))}`
        : `${equipmentOeeModeLabelVi(mode)} — ${formatDdMmYyyy(parseShiftDateToAnchor(referenceDate))}`;
  } else {
    factoryRows = getRollingFactoryShiftWindows(now);
    sectionSubtitle = equipmentOeeModeLabelVi(mode);
  }

  const rows: OperationalStatesGanttRow[] = factoryRows.map((w) => ({
    key: w.key,
    label: shiftRowLabel(w),
    start: w.start,
    end: w.end,
  }));

  const queryStart = new Date(Math.min(...rows.map((r) => r.start.getTime())));
  const queryEnd = new Date(Math.max(...rows.map((r) => r.end.getTime())));
  const pollMs = queryEnd.getTime() > now.getTime() - 60_000 ? 30_000 : null;

  return { rows, queryStart, queryEnd, sectionSubtitle, pollMs };
}
