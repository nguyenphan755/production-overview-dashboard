import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import type {
  EquipmentOeeAnalyticsScope,
  EquipmentOeeMode,
  MachineOeeRollupRow,
} from '../utils/equipmentOeeDisplay';
import { equipmentOeeModeToAnalyticsParams } from '../utils/equipmentOeeDisplay';

type AnalyticsPayload = {
  machineOeeRollup?: Array<{
    machineId: string;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  }>;
  scope?: NonNullable<EquipmentOeeAnalyticsScope>;
};

function buildRollupRecord(rows: AnalyticsPayload['machineOeeRollup']): Record<string, MachineOeeRollupRow> {
  const out: Record<string, MachineOeeRollupRow> = {};
  if (!rows?.length) return out;
  for (const r of rows) {
    out[r.machineId] = {
      oee: r.oee,
      availability: r.availability,
      performance: r.performance,
      quality: r.quality,
    };
  }
  return out;
}

/**
 * Loads per-machine OEE rollup from cached analytics (Ca cố định / hôm nay / hôm qua / 7 ngày / cả ngày chọn).
 */
export function useEquipmentOeeRollup(
  mode: EquipmentOeeMode,
  enabled: boolean,
  referenceDate: string
) {
  const [byMachineId, setByMachineId] = useState<Record<string, MachineOeeRollupRow>>({});
  const [scope, setScope] = useState<EquipmentOeeAnalyticsScope>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRollup = useCallback(async () => {
    if (!enabled || mode === 'realtime' || mode === 'past_shift') return;

    const req = equipmentOeeModeToAnalyticsParams(mode, referenceDate);
    if (!req) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getAnalytics(
        req.range,
        'all',
        undefined,
        req.shiftDate,
        req.shiftNumber,
        req.dayDate
      );
      if (!response.success) {
        setError(response.message || 'Không tải được rollup OEE');
        setByMachineId({});
        setScope(null);
        return;
      }
      const payload = response.data as AnalyticsPayload | undefined;
      const rows = payload?.machineOeeRollup;
      setByMachineId(buildRollupRecord(rows));
      setScope(payload?.scope ? payload.scope : null);
      if (!rows?.length) {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được rollup OEE');
      setByMachineId({});
      setScope(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, mode, referenceDate]);

  useEffect(() => {
    if (!enabled || mode === 'realtime' || mode === 'past_shift') {
      setByMachineId({});
      setScope(null);
      setLoading(false);
      setError(null);
      return;
    }
    fetchRollup();
  }, [enabled, mode, referenceDate, fetchRollup]);

  useEffect(() => {
    if (!enabled || mode === 'realtime' || mode === 'past_shift') return;
    const id = window.setInterval(() => {
      fetchRollup();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [enabled, mode, referenceDate, fetchRollup]);

  return { byMachineId, scope, loading, error, refetch: fetchRollup };
}
