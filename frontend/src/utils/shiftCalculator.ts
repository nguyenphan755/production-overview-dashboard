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
