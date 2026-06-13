/**
 * Mirror backend/src/utils/shiftCalculator.js — factory shifts:
 * 1: 06:00–14:00, 2: 14:00–22:00, 3: 22:00–06:00 (next day)
 */

export function getCurrentShift(date: Date = new Date()): 1 | 2 | 3 {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 1;
  if (hour >= 14 && hour < 22) return 2;
  return 3;
}

export function getShiftWindow(
  shift: number,
  date: Date = new Date()
): { shift: number; start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let shiftStart: Date;
  let shiftEnd: Date;

  switch (shift) {
    case 1:
      shiftStart = new Date(year, month, day, 6, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 14, 0, 0, 0);
      break;
    case 2:
      shiftStart = new Date(year, month, day, 14, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 22, 0, 0, 0);
      break;
    case 3:
      shiftStart = new Date(year, month, day, 22, 0, 0, 0);
      shiftEnd = new Date(year, month, day + 1, 6, 0, 0, 0);
      break;
    default:
      throw new Error(`Invalid shift number: ${shift}`);
  }

  return { shift, start: shiftStart, end: shiftEnd };
}

export function getCurrentShiftWindow(date: Date = new Date()) {
  const shift = getCurrentShift(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let shiftStart: Date;
  let shiftEnd: Date;

  switch (shift) {
    case 1:
      shiftStart = new Date(year, month, day, 6, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 14, 0, 0, 0);
      break;
    case 2:
      shiftStart = new Date(year, month, day, 14, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 22, 0, 0, 0);
      break;
    case 3:
      shiftStart = new Date(year, month, day, 22, 0, 0, 0);
      if (date.getHours() < 6) {
        shiftStart = new Date(year, month, day - 1, 22, 0, 0, 0);
        shiftEnd = new Date(year, month, day, 6, 0, 0, 0);
      } else {
        shiftEnd = new Date(year, month, day + 1, 6, 0, 0, 0);
      }
      break;
    default:
      shiftStart = new Date(year, month, day, 6, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 14, 0, 0, 0);
  }

  return { shift, start: shiftStart, end: shiftEnd };
}

export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * `shiftDate` query param for GET /api/oee-settled/shift — calendar day that defines the shift window via backend anchor noon.
 */
export function shiftApiDateFromCompletedWindow(shiftNumber: 1 | 2 | 3, windowStart: Date): string {
  if (shiftNumber === 3 && windowStart.getHours() >= 22) {
    return formatYmdLocal(windowStart);
  }
  if (shiftNumber === 3 && windowStart.getHours() < 6) {
    const prev = new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate() - 1);
    return formatYmdLocal(prev);
  }
  return formatYmdLocal(windowStart);
}

/** Most recent shift whose window has fully ended (factory calendar). */
export function getLastCompletedShiftSelection(now: Date = new Date()): {
  shiftDate: string;
  shiftNumber: 1 | 2 | 3;
} {
  const cur = getCurrentShiftWindow(now);
  const justBefore = new Date(cur.start.getTime() - 60_000);
  const prevWin = getCurrentShiftWindow(justBefore);
  const shiftDate = shiftApiDateFromCompletedWindow(prevWin.shift as 1 | 2 | 3, prevWin.start);
  return { shiftDate, shiftNumber: prevWin.shift as 1 | 2 | 3 };
}

export function parseShiftDateToAnchor(shiftDate: string): Date {
  const parts = shiftDate.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** True when shift window [start,end] ends before `now` (closed period — valid for report). */
export function isShiftEnded(
  shiftNumber: 1 | 2 | 3,
  shiftDate: string,
  now: Date = new Date()
): boolean {
  const anchor = parseShiftDateToAnchor(shiftDate);
  const win = getShiftWindow(shiftNumber, anchor);
  return win.end.getTime() <= now.getTime();
}

/** One factory shift row for Gantt (6/14/22 pattern). */
export type FactoryShiftWindowRow = {
  key: string;
  shiftNumber: 1 | 2 | 3;
  start: Date;
  end: Date;
};

/** Ca 1–3 on the calendar day `ymd` (YYYY-MM-DD), local factory time. */
export function getFactoryShiftWindowsForCalendarDay(ymd: string): FactoryShiftWindowRow[] {
  const anchor = parseShiftDateToAnchor(ymd);
  return ([1, 2, 3] as const).map((n) => {
    const w = getShiftWindow(n, anchor);
    return { key: `shift${n}`, shiftNumber: n, start: w.start, end: w.end };
  });
}

/** Before 06:00 local = still previous production day (Ca 3). */
export function getProductionDayLabelDate(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  return formatYmdLocal(d);
}

export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const anchor = parseShiftDateToAnchor(ymd);
  anchor.setDate(anchor.getDate() + deltaDays);
  return formatYmdLocal(anchor);
}

/** Production day window: Ca1 06:00 → Ca3 ends 06:00 next calendar day. */
export function getProductionDayWindow(
  dayDate: string,
  now: Date = new Date()
): { start: Date; end: Date; dayDate: string } {
  const anchor = parseShiftDateToAnchor(dayDate);
  const start = getShiftWindow(1, anchor).start;
  const endFull = getShiftWindow(3, anchor).end;
  const currentLabel = getProductionDayLabelDate(now);
  let end = endFull;
  if (dayDate > currentLabel) {
    end = new Date(start.getTime());
  } else if (dayDate === currentLabel) {
    end = new Date(Math.min(now.getTime(), endFull.getTime()));
  }
  return { start, end, dayDate };
}

/**
 * Last three consecutive 8h shift windows ending at the current shift’s start
 * (same layout as legacy EquipmentDetail Gantt).
 */
export function getRollingFactoryShiftWindows(now: Date = new Date()): FactoryShiftWindowRow[] {
  const currentShiftStart = new Date(now);
  if (now.getHours() >= 6 && now.getHours() < 14) {
    currentShiftStart.setHours(6, 0, 0, 0);
  } else if (now.getHours() >= 14 && now.getHours() < 22) {
    currentShiftStart.setHours(14, 0, 0, 0);
  } else {
    if (now.getHours() < 6) {
      currentShiftStart.setDate(currentShiftStart.getDate() - 1);
    }
    currentShiftStart.setHours(22, 0, 0, 0);
  }

  const rows: FactoryShiftWindowRow[] = [];
  for (let i = 2; i >= 0; i -= 1) {
    const start = new Date(currentShiftStart.getTime() - i * 8 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
    const h = start.getHours();
    const shiftNumber = (h === 6 ? 1 : h === 14 ? 2 : 3) as 1 | 2 | 3;
    rows.push({
      key: `rolling-${start.getTime()}`,
      shiftNumber,
      start,
      end,
    });
  }
  return rows;
}
