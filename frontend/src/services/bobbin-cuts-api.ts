import type { OrderBobbinRecord } from '../types';

export type BobbinCutSyncPayload = {
  id: string;
  machineId: string;
  machineName?: string;
  area?: string;
  orderId: string;
  orderName?: string;
  sequence: number;
  cutLengthOkM: number;
  recordedAt: string;
  bobbinCountPlanned?: number;
  triggerType?: string;
  qcStatus?: string;
  machineStatus?: string;
  producedLengthOkAtCut?: number;
  lineSpeedAtCut?: number;
};

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
}

export async function syncBobbinCuts(cuts: BobbinCutSyncPayload[]): Promise<void> {
  if (!cuts.length) return;

  const response = await fetch(`${getApiBaseUrl()}/bobbin-cuts/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cuts }),
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Bobbin sync failed: ${response.status}`);
  }
}

export async function fetchBobbinCutsForMachine(
  machineId: string,
  params?: { orderId?: string; from?: string; to?: string }
): Promise<OrderBobbinRecord[]> {
  const search = new URLSearchParams();
  if (params?.orderId) search.set('orderId', params.orderId);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);

  const qs = search.toString();
  const response = await fetch(
    `${getApiBaseUrl()}/bobbin-cuts/machines/${encodeURIComponent(machineId)}${qs ? `?${qs}` : ''}`
  );
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Fetch bobbin cuts failed: ${response.status}`);
  }
  return payload.data as OrderBobbinRecord[];
}
