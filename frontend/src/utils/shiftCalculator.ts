/**
 * Mirror backend/src/utils/shiftCalculator.js — factory shifts:
 * 1: 06:00–14:00, 2: 14:00–22:00, 3: 22:00–06:00 (next day)
 * All wall-clock math uses Asia/Ho_Chi_Minh (ICT, UTC+7).
 */

export const FACTORY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type FactoryClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getFactoryClock(date: Date = new Date()): FactoryClock {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FACTORY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

/** Instant for factory wall-clock (ICT). */
export function factoryZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+07:00`
  );
}

function factoryDatePlusDays(year: number, month: number, day: number, delta: number): FactoryClock {
  const noon = factoryZonedDate(year, month, day, 12, 0);
  return getFactoryClock(new Date(noon.getTime() + delta * 86_400_000));
}

function shiftFromHour(hour: number): 1 | 2 | 3 {
  if (hour >= 6 && hour < 14) return 1;
  if (hour >= 14 && hour < 22) return 2;
  return 3;
}

export function getCurrentShift(date: Date = new Date()): 1 | 2 | 3 {
  return shiftFromHour(getFactoryClock(date).hour);
}

export function getShiftWindow(
  shift: number,
  date: Date = new Date()
): { shift: number; start: Date; end: Date } {
  const { year, month, day } = getFactoryClock(date);

  let shiftStart: Date;
  let shiftEnd: Date;

  switch (shift) {
    case 1:
      shiftStart = factoryZonedDate(year, month, day, 6, 0);
      shiftEnd = factoryZonedDate(year, month, day, 14, 0);
      break;
    case 2:
      shiftStart = factoryZonedDate(year, month, day, 14, 0);
      shiftEnd = factoryZonedDate(year, month, day, 22, 0);
      break;
    case 3:
      shiftStart = factoryZonedDate(year, month, day, 22, 0);
      shiftEnd = (() => {
        const next = factoryDatePlusDays(year, month, day, 1);
        return factoryZonedDate(next.year, next.month, next.day, 6, 0);
      })();
      break;
    default:
      throw new Error(`Invalid shift number: ${shift}`);
  }

  return { shift, start: shiftStart, end: shiftEnd };
}

export function getCurrentShiftWindow(date: Date = new Date()) {
  const clock = getFactoryClock(date);
  const shift = shiftFromHour(clock.hour);

  if (shift === 3 && clock.hour < 6) {
    const prev = factoryDatePlusDays(clock.year, clock.month, clock.day, -1);
    return {
      shift,
      start: factoryZonedDate(prev.year, prev.month, prev.day, 22, 0),
      end: factoryZonedDate(clock.year, clock.month, clock.day, 6, 0),
    };
  }

  const startHour = shift === 1 ? 6 : shift === 2 ? 14 : 22;
  const shiftStart = factoryZonedDate(clock.year, clock.month, clock.day, startHour, 0);
  let shiftEnd: Date;
  if (shift === 3) {
    const next = factoryDatePlusDays(clock.year, clock.month, clock.day, 1);
    shiftEnd = factoryZonedDate(next.year, next.month, next.day, 6, 0);
  } else {
    shiftEnd = new Date(shiftStart.getTime() + 8 * 3_600_000);
  }

  return { shift, start: shiftStart, end: shiftEnd };
}

export function formatYmdLocal(d: Date): string {
  const { year, month, day } = getFactoryClock(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * `shiftDate` query param for GET /api/oee-settled/shift — calendar day that defines the shift window via backend anchor noon.
 */
export function shiftApiDateFromCompletedWindow(shiftNumber: 1 | 2 | 3, windowStart: Date): string {
  const clock = getFactoryClock(windowStart);
  if (shiftNumber === 3 && clock.hour >= 22) {
    return formatYmdLocal(windowStart);
  }
  if (shiftNumber === 3 && clock.hour < 6) {
    const prev = factoryDatePlusDays(clock.year, clock.month, clock.day, -1);
    return `${prev.year}-${String(prev.month).padStart(2, '0')}-${String(prev.day).padStart(2, '0')}`;
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
  return factoryZonedDate(year, month, day, 12, 0);
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

/** Before 06:00 ICT = still previous production day (Ca 3). */
export function getProductionDayLabelDate(now: Date = new Date()): string {
  const clock = getFactoryClock(now);
  if (clock.hour < 6) {
    const prev = factoryDatePlusDays(clock.year, clock.month, clock.day, -1);
    return `${prev.year}-${String(prev.month).padStart(2, '0')}-${String(prev.day).padStart(2, '0')}`;
  }
  return `${clock.year}-${String(clock.month).padStart(2, '0')}-${String(clock.day).padStart(2, '0')}`;
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
  const live = getCurrentShiftWindow(now);
  const currentShiftStart = live.start;

  const rows: FactoryShiftWindowRow[] = [];
  for (let i = 2; i >= 0; i -= 1) {
    const start = new Date(currentShiftStart.getTime() - i * 8 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
    const { hour } = getFactoryClock(start);
    const shiftNumber = (hour === 6 ? 1 : hour === 14 ? 2 : 3) as 1 | 2 | 3;
    rows.push({
      key: `rolling-${start.getTime()}`,
      shiftNumber,
      start,
      end,
    });
  }
  return rows;
}
