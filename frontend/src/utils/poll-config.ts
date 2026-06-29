/**
 * Fleet polling: base interval from env; slower on tabs that do not need 1s freshness.
 */
const SLOW_TABS = new Set(['maintenance', 'schedule', 'quality', 'analytics', 'accounts', 'speed-lab']);

export function parseFleetPollBaseMs(): number {
  const raw = import.meta.env.VITE_POLL_MS_MACHINES;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n >= 500 && n <= 60_000) return n;
  return 1000;
}

export function getFleetPollIntervalMs(
  activeTab: string | undefined,
  options?: { machineDetailOpen?: boolean }
): number {
  const base = parseFleetPollBaseMs();
  if (options?.machineDetailOpen) return Math.max(base, 5000);
  if (!activeTab) return base;
  if (SLOW_TABS.has(activeTab)) return Math.max(base, 3000);
  if (activeTab === 'equipment') return Math.max(base, 3000);
  return base;
}

/** Detail page polling — default ≥3s to avoid hammering heavy /machines/:id payload. */
export function parseMachineDetailPollBaseMs(): number {
  const raw = import.meta.env.VITE_POLL_MS_MACHINE_DETAIL;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n >= 500 && n <= 60_000) return n;
  return Math.max(parseFleetPollBaseMs(), 3000);
}
