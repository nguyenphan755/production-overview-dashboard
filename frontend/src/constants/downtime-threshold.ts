/** Min consecutive actual_speed=0 duration to count as a downtime stop (seconds). */
export const MIN_DOWNTIME_STOP_SEC = Math.max(
  30,
  parseInt(import.meta.env.VITE_MIN_DOWNTIME_STOP_SEC || '60', 10)
);

export function downtimeMinStopLabelVi(short = false): string {
  if (MIN_DOWNTIME_STOP_SEC % 60 === 0) {
    const minutes = MIN_DOWNTIME_STOP_SEC / 60;
    return short ? `≥${minutes}p` : `≥${minutes} phút`;
  }
  return short ? `≥${MIN_DOWNTIME_STOP_SEC}s` : `≥${MIN_DOWNTIME_STOP_SEC} giây`;
}
