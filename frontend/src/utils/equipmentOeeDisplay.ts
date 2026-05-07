import type { Machine } from '../types';

export type EquipmentOeeMode =
  | 'realtime'
  | 'shift_live'
  | 'shift_1'
  | 'shift_2'
  | 'shift_3'
  | 'day'
  | 'yesterday'
  | 'week'
  | 'calendar_day'
  | 'past_shift';

/** settled = immutable DB row; rollup_closed_shift = same formula, closed window, not yet POST settle */
export type OeeRollupProvenance = 'settled' | 'rollup_closed_shift';

export type MachineOeeRollupRow = {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  provenance?: OeeRollupProvenance;
};

export type EquipmentOeeAnalyticsScope = {
  range: string;
  start: string;
  end: string;
  shiftId?: string | null;
  /** Calendar day YYYY-MM-DD when range is calendar_day */
  dayDate?: string | null;
  area?: string;
  machineId?: string | null;
  /** Present when mode is past_shift */
  reportTier?: 'settled_only' | 'settled_partial' | 'rollup_only';
} | null;

/** Resolved OEE numbers for one machine card/detail block */
export type ResolvedMachineOee = {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  source: 'realtime' | 'rollup' | 'settled';
};

export function pickMachineOee(
  machine: Machine,
  mode: EquipmentOeeMode,
  rollupByMachineId: Record<string, MachineOeeRollupRow | undefined>
): ResolvedMachineOee {
  if (mode === 'realtime') {
    return {
      oee: machine.oee ?? 0,
      availability: machine.availability ?? 0,
      performance: machine.performance ?? 0,
      quality: machine.quality ?? 0,
      source: 'realtime',
    };
  }
  const rolled = rollupByMachineId[machine.id];
  if (!rolled) {
    return {
      oee: machine.oee ?? 0,
      availability: machine.availability ?? 0,
      performance: machine.performance ?? 0,
      quality: machine.quality ?? 0,
      source: 'realtime',
    };
  }
  const src: ResolvedMachineOee['source'] =
    mode === 'past_shift' && rolled.provenance === 'settled' ? 'settled' : 'rollup';
  return {
    oee: rolled.oee,
    availability: rolled.availability,
    performance: rolled.performance,
    quality: rolled.quality,
    source: src,
  };
}

export function equipmentOeeModeLabelVi(mode: EquipmentOeeMode): string {
  switch (mode) {
    case 'realtime':
      return 'Realtime';
    case 'shift_live':
      return 'Ca hiện tại';
    case 'shift_1':
      return 'Ca 1';
    case 'shift_2':
      return 'Ca 2';
    case 'shift_3':
      return 'Ca 3';
    case 'day':
      return 'Hôm nay';
    case 'yesterday':
      return 'Hôm qua';
    case 'week':
      return '7 ngày';
    case 'calendar_day':
      return 'OEE theo ngày';
    case 'past_shift':
      return 'Ca đã qua (ISO)';
    default:
      return mode;
  }
}

/** Maps UI mode → analytics API params (referenceDate = YYYY-MM-DD cho Ca 1–3 và “Cả ngày”). */
export function equipmentOeeModeToAnalyticsParams(
  mode: EquipmentOeeMode,
  referenceDate: string
): {
  range: string;
  shiftDate?: string;
  shiftNumber?: string;
  dayDate?: string;
} | null {
  if (mode === 'realtime') return null;
  switch (mode) {
    case 'shift_live':
      return { range: 'shift' };
    case 'shift_1':
      return { range: 'shift', shiftDate: referenceDate, shiftNumber: '1' };
    case 'shift_2':
      return { range: 'shift', shiftDate: referenceDate, shiftNumber: '2' };
    case 'shift_3':
      return { range: 'shift', shiftDate: referenceDate, shiftNumber: '3' };
    case 'day':
      return { range: 'today' };
    case 'yesterday':
      return { range: 'yesterday' };
    case 'week':
      return { range: 'week' };
    case 'calendar_day':
      return { range: 'calendar_day', dayDate: referenceDate };
    default:
      return null;
  }
}
