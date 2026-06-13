/**
 * Shift Calculator Utility
 * 
 * Factory shifts:
 * - Shift 1: 06:00–14:00 (8 hours)
 * - Shift 2: 14:00–22:00 (8 hours)
 * - Shift 3: 22:00–06:00 (next day) (8 hours)
 */

/**
 * Get the current shift number (1, 2, or 3) for a given date/time
 * 
 * @param {Date} date - Date/time to check (default: current time)
 * @returns {number} Shift number (1, 2, or 3)
 */
export function getCurrentShift(date = new Date()) {
  const hour = date.getHours();
  
  if (hour >= 6 && hour < 14) {
    return 1; // Shift 1: 06:00–14:00
  } else if (hour >= 14 && hour < 22) {
    return 2; // Shift 2: 14:00–22:00
  } else {
    return 3; // Shift 3: 22:00–06:00 (next day)
  }
}

/**
 * Get the start and end times for the current shift
 * 
 * @param {Date} date - Date/time to check (default: current time)
 * @returns {Object} Object with shift number, start time, and end time
 */
export function getCurrentShiftWindow(date = new Date()) {
  const shift = getCurrentShift(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let shiftStart;
  let shiftEnd;
  
  switch (shift) {
    case 1:
      // Shift 1: 06:00–14:00 (same day)
      shiftStart = new Date(year, month, day, 6, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 14, 0, 0, 0);
      break;
      
    case 2:
      // Shift 2: 14:00–22:00 (same day)
      shiftStart = new Date(year, month, day, 14, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 22, 0, 0, 0);
      break;
      
    case 3:
      // Shift 3: 22:00–06:00 (next day)
      shiftStart = new Date(year, month, day, 22, 0, 0, 0);
      // If current time is before 06:00, shift started yesterday
      if (date.getHours() < 6) {
        // Shift started yesterday at 22:00
        shiftStart = new Date(year, month, day - 1, 22, 0, 0, 0);
        shiftEnd = new Date(year, month, day, 6, 0, 0, 0);
      } else {
        // Shift ends tomorrow at 06:00
        shiftEnd = new Date(year, month, day + 1, 6, 0, 0, 0);
      }
      break;
      
    default:
      // Fallback (should never happen)
      shiftStart = new Date(year, month, day, 6, 0, 0, 0);
      shiftEnd = new Date(year, month, day, 14, 0, 0, 0);
  }
  
  return {
    shift,
    start: shiftStart,
    end: shiftEnd,
    startTime: shiftStart.toISOString(),
    endTime: shiftEnd.toISOString()
  };
}

/**
 * Get the shift window for a specific shift on a specific date
 * 
 * @param {number} shift - Shift number (1, 2, or 3)
 * @param {Date} date - Date to calculate shift for (default: current time)
 * @returns {Object} Object with shift number, start time, and end time
 */
export function getShiftWindow(shift, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let shiftStart;
  let shiftEnd;
  
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
      throw new Error(`Invalid shift number: ${shift}. Must be 1, 2, or 3.`);
  }
  
  return {
    shift,
    start: shiftStart,
    end: shiftEnd,
    startTime: shiftStart.toISOString(),
    endTime: shiftEnd.toISOString()
  };
}

/**
 * Generate a shift ID string for database storage
 * Format: "shift-{shiftNumber}-{YYYY-MM-DD}"
 * 
 * @param {number} shift - Shift number (1, 2, or 3)
 * @param {Date} date - Date for the shift (default: current time)
 * @returns {string} Shift ID string
 */
export function getShiftId(shift, date = new Date()) {
  // For shift 3, if it's before 6 AM, use previous day's date
  let shiftDate = new Date(date);
  if (shift === 3 && date.getHours() < 6) {
    shiftDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  
  const year = shiftDate.getFullYear();
  const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
  const day = String(shiftDate.getDate()).padStart(2, '0');
  
  return `shift-${shift}-${year}-${month}-${day}`;
}

export function formatYmdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDayDateYmd(ymd) {
  const [year, month, day] = String(ymd).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

/** Before 06:00 local = still previous production day (Ca 3). */
export function getProductionDayLabelDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  return formatYmdLocal(d);
}

export function addDaysToYmd(ymd, deltaDays) {
  const anchor = parseDayDateYmd(ymd);
  anchor.setDate(anchor.getDate() + deltaDays);
  return formatYmdLocal(anchor);
}

/**
 * Production day = 3 factory shifts: Ca1 06:00 → Ca3 ends 06:00 next calendar day.
 * @param {string} dayDate YYYY-MM-DD (label date = calendar day Ca1 starts)
 * @param {Date} [now]
 */
export function getProductionDayWindow(dayDate, now = new Date()) {
  const anchor = parseDayDateYmd(dayDate);
  const start = getShiftWindow(1, anchor).start;
  const endFull = getShiftWindow(3, anchor).end;
  const currentLabel = getProductionDayLabelDate(now);

  let end = endFull;
  if (dayDate > currentLabel) {
    end = new Date(start.getTime());
  } else if (dayDate === currentLabel) {
    end = new Date(Math.min(now.getTime(), endFull.getTime()));
  }

  return { start, end, dayDate, productionDay: dayDate };
}
