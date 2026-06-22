import { FACTORY_TIME_ZONE } from './shiftCalculator';
import type { SpeedLabInferredState } from '../types/oee-analytics-lab';

export const MACHINE_COLORS = [
  '#ffffff',
  '#4fffbc',
  '#ffb86c',
  '#34e7f8',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#22d3ee',
  '#fb923c',
  '#86efac',
  '#c084fc',
  '#fcd34d',
  '#67e8f9',
  '#fda4af',
  '#bef264',
];

export const STATE_COLORS: Record<SpeedLabInferredState, string> = {
  running: '#22c55e',
  creep: '#f59e0b',
  stopped: '#ef4444',
  oee_accum: '#34e7f8',
  oee_frozen: '#475569',
};

export function machineColor(index: number): string {
  return MACHINE_COLORS[index % MACHINE_COLORS.length];
}

/** Human-readable line name (e.g. DA13) from machines catalog; falls back to id (e.g. D-01). */
export function machineDisplayName(
  machineId: string,
  nameById: Readonly<Record<string, string>>
): string {
  const name = nameById[machineId]?.trim();
  return name || machineId;
}

export function fmtIctHour(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function fmtIctFull(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Same as multi-machine-speed-compare.html fmtDur */
export function fmtDur(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function segmentDurationSec(startMs: number, endMs: number): number {
  return (endMs - startMs) / 1000;
}

export function totalSegmentDuration(
  segments: { state: SpeedLabInferredState; startMs: number; endMs: number }[],
  states: SpeedLabInferredState[]
): number {
  return segments
    .filter((s) => states.includes(s.state))
    .reduce((acc, s) => acc + segmentDurationSec(s.startMs, s.endMs), 0);
}
