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
