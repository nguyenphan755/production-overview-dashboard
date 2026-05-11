/**
 * Fleet polling: base interval from env; slower on tabs that do not need 1s freshness.
 */
const SLOW_TABS = new Set(['maintenance', 'schedule', 'quality', 'analytics', 'accounts']);

export function parseFleetPollBaseMs(): number {
  const raw = import.meta.env.VITE_POLL_MS_MACHINES;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n >= 500 && n <= 60_000) return n;
  return 1000;
}

export function getFleetPollIntervalMs(activeTab: string | undefined): number {
  const base = parseFleetPollBaseMs();
  if (!activeTab) return base;
  return SLOW_TABS.has(activeTab) ? Math.max(base, 3000) : base;
}

/** Detail page polling (defaults to same base as fleet unless overridden). */
export function parseMachineDetailPollBaseMs(): number {
  const raw = import.meta.env.VITE_POLL_MS_MACHINE_DETAIL;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n >= 500 && n <= 60_000) return n;
  return parseFleetPollBaseMs();
}
