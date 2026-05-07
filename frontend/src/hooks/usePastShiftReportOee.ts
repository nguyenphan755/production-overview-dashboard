import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import type {
  EquipmentOeeAnalyticsScope,
  MachineOeeRollupRow,
} from '../utils/equipmentOeeDisplay';
import { isShiftEnded } from '../utils/shiftCalculator';

export type PastShiftSelection = { shiftDate: string; shiftNumber: 1 | 2 | 3 };

function num(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0;
}

function machineIdFromSettlement(row: Record<string, unknown>): string {
  return String(row.machine_id ?? row.machineId ?? '');
}

/**
 * Closed-shift report: prefer immutable `oee_shift_settlements`, merge gaps from analytics shift rollup (same TPM formula).
 */
export function usePastShiftReportOee(
  enabled: boolean,
  selection: PastShiftSelection | null,
  authToken: string | null
) {
  const [byMachineId, setByMachineId] = useState<Record<string, MachineOeeRollupRow>>({});
  const [scope, setScope] = useState<EquipmentOeeAnalyticsScope>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !selection) {
      setByMachineId({});
      setScope(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!isShiftEnded(selection.shiftNumber, selection.shiftDate)) {
      setByMachineId({});
      setScope(null);
      setError('Ca này chưa kết thúc — báo cáo OEE chuẩn chỉ cho ca đã khóa hoàn toàn.');
      setLoading(false);
      return;
    }

    if (!authToken?.trim()) {
      setByMachineId({});
      setScope(null);
      setError('Thiếu phiên đăng nhập — không đọc được snapshot ca đã settle (JWT).');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const settledRes = await apiClient.getOeeSettledShift(
        selection.shiftDate,
        selection.shiftNumber,
        authToken
      );

      const settledPayload = settledRes.success ? settledRes.data : null;
      const settlements =
        (settledPayload?.settlements as Record<string, unknown>[] | undefined) ?? [];

      const analyticsRes = await apiClient.getAnalytics(
        'shift',
        'all',
        undefined,
        selection.shiftDate,
        String(selection.shiftNumber)
      );

      if (!analyticsRes.success || !analyticsRes.data) {
        setError(analyticsRes.message || 'Không tải được rollup ca để ghép dữ liệu.');
        setByMachineId({});
        setScope(null);
        setLoading(false);
        return;
      }

      const analyticsPayload = analyticsRes.data as {
        machineOeeRollup?: Array<{
          machineId: string;
          oee: number;
          availability: number;
          performance: number;
          quality: number;
        }>;
        scope?: NonNullable<EquipmentOeeAnalyticsScope>;
      };

      const rollupRows = analyticsPayload.machineOeeRollup ?? [];

      const map: Record<string, MachineOeeRollupRow> = {};

      for (const row of settlements) {
        const mid = machineIdFromSettlement(row);
        if (!mid) continue;
        map[mid] = {
          oee: num(row.oee),
          availability: num(row.availability),
          performance: num(row.performance),
          quality: num(row.quality),
          provenance: 'settled',
        };
      }

      for (const r of rollupRows) {
        if (!map[r.machineId]) {
          map[r.machineId] = {
            oee: r.oee,
            availability: r.availability,
            performance: r.performance,
            quality: r.quality,
            provenance: 'rollup_closed_shift',
          };
        }
      }

      const anySettled = Object.values(map).some((x) => x.provenance === 'settled');
      const anyFallback = Object.values(map).some((x) => x.provenance === 'rollup_closed_shift');
      let reportTier: NonNullable<EquipmentOeeAnalyticsScope>['reportTier'] = 'rollup_only';
      if (anySettled && !anyFallback) reportTier = 'settled_only';
      else if (anySettled && anyFallback) reportTier = 'settled_partial';

      if (!settledRes.success && settlements.length === 0 && rollupRows.length > 0) {
        setError(
          settledRes.message
            ? `${settledRes.message} Đang hiển thị rollup ca đã đóng (chưa có snapshot settle).`
            : null
        );
      }

      const mergedScope: EquipmentOeeAnalyticsScope = {
        range: 'past_shift',
        start:
          settledPayload?.periodStart ||
          analyticsPayload.scope?.start ||
          '',
        end:
          settledPayload?.periodEnd ||
          analyticsPayload.scope?.end ||
          '',
        shiftId:
          settledPayload?.shiftId ?? analyticsPayload.scope?.shiftId ?? null,
        reportTier,
      };

      setByMachineId(map);
      setScope(mergedScope);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải báo cáo ca');
      setByMachineId({});
      setScope(null);
    } finally {
      setLoading(false);
    }
  }, [authToken, enabled, selection]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !selection || !authToken?.trim()) return;
    const id = window.setInterval(load, 120_000);
    return () => window.clearInterval(id);
  }, [enabled, selection, authToken, load]);

  return { byMachineId, scope, loading, error, refetch: load };
}
