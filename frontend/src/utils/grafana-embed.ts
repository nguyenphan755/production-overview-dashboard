import { buildSpeedLabQuery } from './equipment-speed-history-query';
import type { EquipmentOeeMode } from './equipmentOeeDisplay';

export const GRAFANA_BASE_URL =
  (import.meta.env.VITE_GRAFANA_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3000';

export type GrafanaEmbedOptions = {
  dashboardUid: string;
  machineId: string;
  equipmentOeeMode: EquipmentOeeMode;
  referenceDate: string;
  pastIsoShiftNumber: 1 | 2 | 3;
  theme?: 'dark' | 'light';
  kiosk?: boolean;
};

/** Build Grafana dashboard URL synced with MES OEE toolbar window. */
export function buildGrafanaDashboardUrl(opts: GrafanaEmbedOptions): string {
  const q = buildSpeedLabQuery(
    opts.equipmentOeeMode,
    opts.referenceDate,
    opts.pastIsoShiftNumber,
    new Date()
  );
  const fromMs = q.chartWindowStart.getTime();
  const toMs = Math.min(q.chartWindowEnd.getTime(), Date.now());

  const params = new URLSearchParams({
    orgId: '1',
    from: String(fromMs),
    to: String(toMs),
    'var-machine_id': opts.machineId,
    timezone: 'Asia/Ho_Chi_Minh',
    theme: opts.theme ?? 'dark',
  });
  if (opts.kiosk !== false) {
    params.set('kiosk', '1');
  }
  return `${GRAFANA_BASE_URL}/d/${opts.dashboardUid}?${params.toString()}`;
}

export const GRAFANA_DASHBOARD = {
  equipmentDetail: 'mes-equipment-detail',
  speedLab: 'mes-speed-lab',
} as const;
