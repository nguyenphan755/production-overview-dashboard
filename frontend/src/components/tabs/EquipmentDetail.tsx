import { useMemo } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import { GrafanaEmbeddedView } from '../grafana/GrafanaEmbeddedView';
import {
  type EquipmentOeeAnalyticsScope,
  type EquipmentOeeMode,
  type MachineOeeRollupRow,
} from '../../utils/equipmentOeeDisplay';
import {
  buildGrafanaDashboardUrl,
  GRAFANA_BASE_URL,
  GRAFANA_DASHBOARD,
} from '../../utils/grafana-embed';

type EquipmentDetailProps = {
  machineId: string;
  onBack: () => void;
  equipmentOeeMode: EquipmentOeeMode;
  onEquipmentOeeModeChange: (mode: EquipmentOeeMode) => void;
  equipmentOeeRollupByMachine: Record<string, MachineOeeRollupRow>;
  equipmentOeeScope: EquipmentOeeAnalyticsScope;
  equipmentOeeRollupLoading: boolean;
  equipmentOeeRollupError: string | null;
  referenceDate: string;
  onReferenceDateChange: (isoDate: string) => void;
  pastIsoShiftNumber: 1 | 2 | 3;
  onPastIsoShiftNumberChange: (n: 1 | 2 | 3) => void;
  authToken?: string;
};

/**
 * Equipment Detail — analytics via Grafana (mes-equipment-detail dashboard).
 * Legacy React charts: frontend/src/components/tabs/EquipmentDetail.legacy.tsx
 */
export function EquipmentDetail({
  machineId,
  onBack,
  equipmentOeeMode,
  onEquipmentOeeModeChange,
  equipmentOeeRollupByMachine: _equipmentOeeRollupByMachine,
  equipmentOeeScope,
  equipmentOeeRollupLoading,
  equipmentOeeRollupError,
  referenceDate,
  onReferenceDateChange,
  pastIsoShiftNumber,
  onPastIsoShiftNumberChange,
  authToken: _authToken,
}: EquipmentDetailProps) {
  const grafanaSrc = useMemo(
    () =>
      buildGrafanaDashboardUrl({
        dashboardUid: GRAFANA_DASHBOARD.equipmentDetail,
        machineId,
        equipmentOeeMode,
        referenceDate,
        pastIsoShiftNumber,
        theme: 'dark',
        kiosk: true,
      }),
    [machineId, equipmentOeeMode, referenceDate, pastIsoShiftNumber]
  );

  const grafanaStandalone = useMemo(() => {
    const u = new URL(grafanaSrc);
    u.searchParams.delete('kiosk');
    return u.toString();
  }, [grafanaSrc]);

  return (
    <div className="flex flex-col gap-4 min-h-0 h-full pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách thiết bị
        </button>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm font-mono">{machineId}</span>
          <a
            href={grafanaStandalone}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400/80 hover:text-cyan-300 border border-cyan-500/30 rounded-lg px-2.5 py-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Grafana
          </a>
        </div>
      </div>

      <EquipmentOeeToolbar
        mode={equipmentOeeMode}
        onModeChange={onEquipmentOeeModeChange}
        scope={equipmentOeeScope}
        rollupLoading={equipmentOeeRollupLoading}
        rollupError={equipmentOeeRollupError}
        referenceDate={referenceDate}
        onReferenceDateChange={onReferenceDateChange}
        pastIsoShiftNumber={pastIsoShiftNumber}
        onPastIsoShiftNumberChange={onPastIsoShiftNumberChange}
      />

      <p className="text-white/40 text-xs px-1">
        Phân tích lịch sử & OEE qua Grafana ({GRAFANA_BASE_URL}). Toolbar trên đồng bộ cửa sổ
        thời gian với dashboard.
      </p>

      <GrafanaEmbeddedView
        src={grafanaSrc}
        title={`Equipment Detail — ${machineId}`}
        className="flex-1"
      />
    </div>
  );
}
